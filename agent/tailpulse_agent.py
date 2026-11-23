#!/usr/bin/env python3
"""tailpulse 수집기 (agent).

웹서버(nginx · apache) 접속 로그를 따라 읽어 요청 한 건씩 수집 서버로 보낸다.
파이썬 표준 라이브러리만 쓴다(3.6 이상). 웹서버 · 앱은 건드리지 않고 로그 파일을 읽기만 한다.
접속 로그가 없는 서비스(웹소켓 서버 등)는 설정 alive 로 같은 서버 안 주소에 10초마다 응답만 확인한다.

  tailpulse_agent.py --config /etc/tailpulse-agent/config.json   실행
  tailpulse_agent.py --config ... --check     설정과 최근 로그 200줄 해석률만 확인 (전송 없음)
  tailpulse_agent.py --config ... --dry-run   보낼 내용을 화면에 찍기만 한다 (전송 없음)

출력 언어: 환경 변수 TAILPULSE_LANG(또는 LANG)이 ko 로 시작하면 한국어, 아니면 영어.

밖으로 나가는 값: 시각, 응답 시간, 상태 코드, 메서드, 주소(쿼리 문자열 제거 · 번호/토큰 자리 가림), 방문자 해시.
IP · User-Agent 원문과 쿼리 문자열은 보내지 않는다.
"""
import argparse
import hashlib
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request

STATIC_EXT = (
    ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".woff", ".woff2", ".ttf", ".eot",
    ".map", ".mp4", ".webm", ".mp3", ".wav", ".ogg", ".pdf", ".zip", ".txt", ".xml", ".json.gz", ".webmanifest",
)
STATIC_PREFIX = ("/assets/", "/static/", "/favicon")
COMBINED = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[[^\]]+\] "(?P<method>[A-Z]+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+'
    r'(?: "[^"]*" "(?P<ua>[^"]*)")?(?P<rest>.*)$'
)
# 권장 로그 형식(README): combined 뒤에 rt=응답 시간, xff="X-Forwarded-For". nginx $request_time(초) · apache %D(마이크로초)
TIMED = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[[^\]]+\] "(?P<method>[A-Z]+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+ "[^"]*" "(?P<ua>[^"]*)"'
    r' rt=(?P<rt>[\d.]+)(?:.*? xff="(?P<xff>[^"]*)")?'
)
NUMBER = re.compile(r"^\d+(\.\d+)?$")
# 사설 · 내부 주소(로드밸런서 · 도커 · 같은 서버). X-Forwarded-For 에서 실제 접속자를 고를 때 건너뛴다
PRIVATE_IP = re.compile(
    r"^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|::1$|::ffff:(10|127|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\.|f[cd][0-9a-f]{2}:|fe80:)",
    re.I,
)
TOKEN_SEG = re.compile(r"^[A-Za-z0-9_\-=.%]{20,}$")
HEX_SEG = re.compile(r"^[0-9a-fA-F\-]{16,}$")
MAX_QUEUE = 5000
MAX_BATCH = 500
USER_AGENT = "tailpulse-agent"
PROBE_MARK = "tailpulse_probe=1"  # 수집 서버의 health-url 확인 요청에 붙는 표식


def _lang():
    for key in ("TAILPULSE_LANG", "LC_ALL", "LC_MESSAGES", "LANG"):
        value = os.environ.get(key)
        if value:
            return "ko" if value.lower().startswith("ko") else "en"
    return "en"


LANG = _lang()


def T(ko, en):
    return ko if LANG == "ko" else en


def normalize_path(raw):
    """쿼리 문자열을 떼고, 번호 · 토큰처럼 보이는 자리를 가린다(공유 링크 · 비밀번호 재설정 토큰 주소 등이 밖으로 나가지 않게)."""
    path = raw.split("?", 1)[0].split("#", 1)[0]
    if path.startswith("http://") or path.startswith("https://"):
        path = "/" + path.split("/", 3)[-1] if path.count("/") >= 3 else "/"
    out = []
    for seg in path.split("/"):
        if seg.isdigit():
            out.append(":n")
        elif HEX_SEG.match(seg) or TOKEN_SEG.match(seg):
            # 확장자가 붙은 긴 파일명(해시 붙은 js 등)은 확장자만 남긴다
            dot = seg.rfind(".")
            out.append(":token" + (seg[dot:] if 0 < dot and len(seg) - dot <= 6 else ""))
        else:
            out.append(seg)
    return "/".join(out)[:120] or "/"


def client_ip(xff, remote):
    """X-Forwarded-For 에서 실제 접속자 IP 를 고른다: 오른쪽(우리 서버에 가까운 쪽)부터 사설 주소가 아닌 첫 값.
    맨 앞 값은 브라우저가 마음대로 넣을 수 있어 믿지 않는다. 쓸 값이 없으면 접속한 주소(remote)."""
    if xff and xff != "-":
        for part in reversed(str(xff).split(",")):
            p = part.strip()
            if p and p != "-" and not PRIVATE_IP.match(p):
                return p
    return remote


def to_ms(value, unit):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if unit == "s":
        number *= 1000
    elif unit == "us":
        number /= 1000
    return int(number)


class Source:
    def __init__(self, conf, salt):
        self.service = conf["service"]
        # 경로에 %Y-%m-%d 같은 날짜 틀을 쓸 수 있다(톰캣 접속 로그처럼 날마다 파일 이름이 바뀌는 경우).
        # 서버 시계가 UTC 인데 파일 이름은 한국 날짜면 path_tz_offset_hours 에 9 를 적는다.
        self.path_template = conf["path"]
        self.path_offset = float(conf.get("path_tz_offset_hours", 0)) * 3600
        self.path = self.resolve_path()
        self.format = conf.get("format", "combined")
        self.rt_unit = conf.get("rt_unit", "s")
        self.keys = conf.get("json_keys", {})
        self.regex = re.compile(conf["regex"]) if conf.get("regex") else None
        self.exclude = re.compile(conf["exclude_path"]) if conf.get("exclude_path") else None
        # 정규식 그룹(또는 json 항목) 값이 이 조건에 맞는 줄만 보낸다. 예: {"vhost": "^www\\.example\\.com$"}
        self.require = dict((k, re.compile(v)) for k, v in (conf.get("require") or {}).items())
        self.salt = salt
        self.file = None
        self.inode = None
        self.buffer = b""

    def resolve_path(self):
        if "%" not in self.path_template:
            return self.path_template
        return time.strftime(self.path_template, time.gmtime(time.time() + self.path_offset))

    # ---- 로그 한 줄 → 요청 한 건 ----
    def parse(self, line):
        return self.parse_line(line)[0]

    def parse_line(self, line):
        """(보낼 요청 또는 None, 로그 형식이 맞았는지). 상태 확인 요청처럼 일부러 빼는 줄은 (None, True)."""
        ip = ua = method = path = status = rt = xff = None
        if self.format == "json":
            try:
                row = json.loads(line)
            except ValueError:
                return None, False
            k = self.keys
            ip = row.get(k.get("ip", "remote_addr"))
            ua = row.get(k.get("ua", "http_user_agent"))
            method = row.get(k.get("method", "request_method"))
            path = row.get(k.get("path", "request_uri"))
            status = row.get(k.get("status", "status"))
            rt = row.get(k.get("rt", "request_time"))
            xff = row.get(k.get("xff", "http_x_forwarded_for"))
            fields = row
        else:
            m = (self.regex or (TIMED if self.format == "timed" else COMBINED)).match(line)
            if not m:
                return None, False
            g = m.groupdict()
            ip, ua, method, path, status = g.get("ip"), g.get("ua"), g.get("method"), g.get("path"), g.get("status")
            rt = g.get("rt")
            xff = g.get("xff")
            fields = g
            if rt is None and self.format == "combined_rt":
                tail = (g.get("rest") or "").split()
                rt = tail[-1] if tail and NUMBER.match(tail[-1]) else None
        try:
            status = int(status)
        except (TypeError, ValueError):
            return None, False
        if not method or not path:
            return None, False
        for key, rx in self.require.items():  # 다른 가상 호스트(예: 웹소켓 서버) 줄 등은 뺀다
            if not rx.search(str(fields.get(key) or "")):
                return None, True
        if method in ("HEAD", "OPTIONS") or PROBE_MARK in str(path):  # 수집 서버의 생존 확인 · 사전 요청은 접속량이 아니다
            return None, True
        ua = ua or ""
        if ua.startswith("ELB-HealthChecker") or ua.startswith("tailpulse") or ua.startswith("Blackbox Exporter"):
            return None, True
        clean = normalize_path(str(path))
        if self.exclude and self.exclude.search(clean):
            return None, True
        visitor = None
        ip = client_ip(xff, ip)  # 로드밸런서 · 앞단 프록시 뒤에서는 X-Forwarded-For 의 실제 접속자 IP 를 쓴다
        if ip:
            # 날짜를 섞어 하루가 지나면 같은 사람도 다른 값이 된다. IP 원문은 보내지 않는다.
            day = time.strftime("%Y%m%d")
            visitor = hashlib.sha256((self.salt + day + str(ip) + ua).encode("utf-8", "replace")).hexdigest()[:16]
        event = {"t": int(time.time() * 1000), "s": status, "m": str(method)[:8], "p": clean}
        ms = to_ms(rt, self.rt_unit) if rt is not None else None
        if ms is not None:
            event["ms"] = ms
        if visitor:
            event["v"] = visitor
        if clean.lower().endswith(STATIC_EXT) or clean.startswith(STATIC_PREFIX):
            event["x"] = True
        return event, True

    # ---- 파일 따라 읽기 (logrotate 의 새 파일 · copytruncate 둘 다 따라간다) ----
    def open(self, from_start=False):
        try:
            self.file = open(self.path, "rb")
        except OSError:
            self.file = None
            return
        if not from_start:
            self.file.seek(0, os.SEEK_END)
        self.inode = os.fstat(self.file.fileno()).st_ino
        self.buffer = b""

    def read_new(self):
        current = self.resolve_path()
        if current != self.path:  # 날짜가 바뀌어 새 파일로 넘어갔다
            if self.file is not None:
                self.file.close()
            self.path = current
            self.open(from_start=True)
        if self.file is None:
            self.open()
            if self.file is None:
                return []
        chunk = self.file.read(1024 * 1024)
        if not chunk:
            try:
                st = os.stat(self.path)
            except OSError:
                return []
            if st.st_ino != self.inode:
                self.file.close()
                self.open(from_start=True)
            elif st.st_size < self.file.tell():
                self.file.seek(0)
                self.buffer = b""
            return []
        data = self.buffer + chunk
        lines = data.split(b"\n")
        self.buffer = lines.pop()
        if len(self.buffer) > 65536:
            self.buffer = b""
        events = []
        for raw in lines:
            event = self.parse(raw.decode("utf-8", "replace"))
            if event:
                events.append(event)
        return events


class SysStats:
    """서버 자원(CPU · 메모리 · 디스크 사용률 %). /proc 과 statvfs 를 읽기만 한다."""

    def __init__(self, disks):
        self.disks = disks or ["/"]
        self.prev = self.cpu_times()

    @staticmethod
    def cpu_times():
        try:
            with open("/proc/stat") as f:
                parts = [int(x) for x in f.readline().split()[1:]]
            idle = parts[3] + (parts[4] if len(parts) > 4 else 0)
            return sum(parts), idle
        except (OSError, ValueError, IndexError):
            return None

    def read(self):
        out = {}
        cur = self.cpu_times()
        if cur and self.prev and cur[0] > self.prev[0]:
            out["cpu"] = round(100.0 * (1 - (cur[1] - self.prev[1]) / float(cur[0] - self.prev[0])), 1)
        self.prev = cur
        try:
            info = {}
            with open("/proc/meminfo") as f:
                for line in f:
                    k, v = line.split(":", 1)
                    info[k] = int(v.split()[0])
            if info.get("MemTotal") and "MemAvailable" in info:
                out["mem"] = round(100.0 * (1 - info["MemAvailable"] / float(info["MemTotal"])), 1)
        except (OSError, ValueError):
            pass
        disk = {}
        for mount in self.disks:
            try:
                st = os.statvfs(mount)
                used = st.f_blocks - st.f_bfree
                if used + st.f_bavail > 0:
                    disk[mount] = round(100.0 * used / float(used + st.f_bavail), 1)  # df 의 Use% 와 같은 계산
            except OSError:
                pass
        if disk:
            out["disk"] = disk
        try:
            out["load1"] = round(os.getloadavg()[0], 2)
        except OSError:
            pass
        return out


class Alive:
    """접속 로그가 없는 서비스(웹소켓 서버 등)의 생존 확인. 같은 서버 안의 주소를 10초마다 한 번 불러
    5xx 가 아닌 응답이 3초 안에 오면 살아 있는 것으로 보고 그때만 "살아 있음" 신호를 보낸다.
    응답이 없으면 신호를 멈춰 화면 · 알림에서 이 서버가 끊김으로 보이게 한다."""

    def __init__(self, conf):
        self.service = conf["service"]
        self.url = conf["url"]
        self.timeout = float(conf.get("timeout_sec", 3))
        self.last = None

    def probe(self):
        """(살아 있음, 설명)"""
        try:
            with urllib.request.urlopen(urllib.request.Request(self.url, headers={"User-Agent": USER_AGENT}), timeout=self.timeout) as res:
                code = res.status
        except urllib.error.HTTPError as e:  # 404 도 앱이 응답한 것이다
            code = e.code
        except Exception as e:
            return False, T("응답 없음(%s)", "no response (%s)") % type(e).__name__
        return code < 500, T("응답 %d", "HTTP %d") % code

    def ok(self):
        alive, why = self.probe()
        if alive != self.last:
            sys.stderr.write("[%s] %s: %s\n" % (self.service, T("살아 있음", "alive") if alive else T("응답 없음 — 신호를 멈춤", "no response — heartbeat paused"), why))
            sys.stderr.flush()
            self.last = alive
        return alive


def send(url, token, payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Tailpulse-Token", token)
    req.add_header("User-Agent", USER_AGENT)
    with urllib.request.urlopen(req, timeout=3) as res:
        return res.status == 200


def check(sources, alive=None):
    ok = True
    for src in sources:
        try:
            with open(src.path, "rb") as f:
                f.seek(0, os.SEEK_END)
                start = max(0, f.tell() - 200000)
                f.seek(start)
                lines = f.read().decode("utf-8", "replace").split("\n")
                lines = (lines[1:] if start > 0 else lines)[-200:]  # 중간부터 읽었으면 잘린 첫 줄은 버린다
        except OSError as e:
            print(T("[%s] 읽을 수 없음: %s (%s)", "[%s] cannot read %s (%s)") % (src.service, src.path, e))
            ok = False
            continue
        lines = [x for x in lines if x.strip()]
        parsed = [src.parse_line(x) for x in lines]
        matched = [x for x in parsed if x[1]]
        hit = [x[0] for x in parsed if x[0]]
        timed = [x for x in hit if "ms" in x]
        visitors = len(set(x["v"] for x in hit if "v" in x))
        print(T("[%s] %s: 최근 %d줄 중 형식 맞음 %d줄(보낼 요청 %d · 상태 확인 등 건너뜀 %d), 응답 시간 있음 %d줄, 서로 다른 방문자 %d",
                "[%s] %s: %d recent lines, %d match the format (%d to send, %d skipped e.g. health checks), %d with response time, %d distinct visitors")
              % (src.service, src.path, len(lines), len(matched), len(hit), len(matched) - len(hit), len(timed), visitors))
        if hit:
            print(T("    예: %s", "    e.g. %s") % json.dumps({k: v for k, v in hit[-1].items() if k != "v"}, ensure_ascii=False))
        if lines and not matched:
            ok = False
    for a in alive or []:
        up, why = a.probe()
        print(T("[%s] 생존 확인 %s: %s", "[%s] alive probe %s: %s") % (a.service, a.url, why))
        ok = ok and up
    return ok


def main():
    ap = argparse.ArgumentParser(description="tailpulse agent")
    ap.add_argument("--config", required=True)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(args.config, encoding="utf-8") as f:
        conf = json.load(f)
    token = ""
    if conf.get("token_file"):
        with open(conf["token_file"], encoding="utf-8") as f:
            token = f.read().strip()
    host = conf.get("host") or re.sub(r"[^a-z0-9_-]", "-", socket.gethostname().lower())[:40]
    sources = [Source(s, token) for s in conf.get("sources", [])]
    alive = {a.service: a for a in (Alive(x) for x in conf.get("alive", []))}

    if args.check:
        sys.exit(0 if check(sources, list(alive.values())) else 1)

    queues = {}
    last_sent = {}
    fail_until = 0
    sys_stats = SysStats(conf.get("disks"))
    sys_sent = 0
    for src in sources:
        src.open()
        queues.setdefault(src.service, [])
        last_sent.setdefault(src.service, 0)
    for service in alive:
        queues.setdefault(service, [])
        last_sent.setdefault(service, 0)
    while True:
        for src in sources:
            events = src.read_new()
            if events:
                q = queues[src.service]
                q.extend(events)
                if len(q) > MAX_QUEUE:  # 수집 서버가 죽어도 메모리가 불지 않게 오래된 것부터 버린다
                    del q[: len(q) - MAX_QUEUE]
        now = time.time()
        if now >= fail_until:
            for service, q in queues.items():
                # 요청이 없어도 10초마다 빈 묶음을 보내 "수집기 살아 있음"을 알린다
                if not q and now - last_sent[service] < 10:
                    continue
                if not q and service in alive and not alive[service].ok():
                    last_sent[service] = now  # 10초 뒤에 다시 본다
                    continue
                batch, rest = q[:MAX_BATCH], q[MAX_BATCH:]
                if args.dry_run:
                    for e in batch:
                        print(service, json.dumps(e, ensure_ascii=False))
                    sys.stdout.flush()
                    queues[service] = rest
                    last_sent[service] = now
                    continue
                payload = {"service": service, "host": host, "events": batch}
                if now - sys_sent >= 10:  # 서버 자원은 10초에 한 번, 가장 먼저 나가는 묶음에 싣는다
                    payload["sys"] = sys_stats.read()
                try:
                    send(conf["collector"], token, payload)
                    if "sys" in payload:
                        sys_sent = now
                    queues[service] = rest
                    last_sent[service] = now
                except Exception as e:  # 수집 서버 문제는 서비스와 무관하다. 조용히 잠깐 쉬었다 다시 보낸다.
                    fail_until = now + 5
                    sys.stderr.write(T("전송 실패(5초 뒤 재시도): %s\n", "send failed (retry in 5s): %s\n") % e)
                    sys.stderr.flush()
                    break
        time.sleep(0.5)


if __name__ == "__main__":
    main()
