#!/bin/bash
# Watch the watcher. If tailpulse itself dies, its "server down" alerts stop too.
# Run this on ANOTHER server: every minute it checks tailpulse's /healthz and, after N failures in a row,
# posts one alert to a Slack incoming webhook; when it answers again, it posts one recovery message.
# (Tip: also run a tailpulse agent on that server, so tailpulse alerts you if the watchdog's server dies.)
#
#   sudo bash tailpulse-watchdog.sh install --url https://monitor.example.com/healthz --webhook-file <file> [--fails 3] [--lang en|ko]
#       Installs /usr/local/bin/tailpulse-watchdog, /etc/tailpulse-watchdog/{config,webhook} (root, 600)
#       and a cron entry (every minute). Safe to run again to change settings.
#       <file> holds the Slack webhook URL on one line (it is never put on a command line or in logs).
#   sudo tailpulse-watchdog status         current state and recent log lines
#   tailpulse-watchdog                     one check (what cron runs; logs only when the state changes)
#   DRY_RUN=1 URL=http://127.0.0.1:1/healthz STATE_DIR=/tmp/wd CONF_DIR=/tmp/wd tailpulse-watchdog
#                                          try it out: prints the alert instead of posting it
set -uo pipefail
CONF_DIR=${CONF_DIR:-/etc/tailpulse-watchdog}
# shellcheck disable=SC1091
[ -r "$CONF_DIR/config" ] && . "$CONF_DIR/config"
URL=${URL:-}
FAILS_TO_ALERT=${FAILS_TO_ALERT:-3}
ALERT_LANG=${ALERT_LANG:-en}
STATE_DIR=${STATE_DIR:-/var/lib/tailpulse-watchdog}
LOG=/var/log/tailpulse-watchdog.log
HOOK=$CONF_DIR/webhook
STATE=$STATE_DIR/state
HOST=$(hostname -s)
now() { date '+%m-%d %H:%M'; }
t() { if [ "$ALERT_LANG" = ko ]; then printf '%s' "$1"; else printf '%s' "$2"; fi; }

install_self() {
  local url="" hook="" fails=3 lang=en
  while [ $# -gt 0 ]; do
    case "$1" in
    --url) url=${2:-}; shift 2 ;;
    --webhook-file) hook=${2:-}; shift 2 ;;
    --fails) fails=${2:-3}; shift 2 ;;
    --lang) lang=${2:-en}; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
  done
  [ "$(id -u)" = 0 ] || { echo "Run with sudo" >&2; exit 1; }
  [ -n "$url" ] && [ -n "$hook" ] && [ -s "$hook" ] || { echo "usage: sudo bash $0 install --url <https://.../healthz> --webhook-file <file with the webhook URL> [--fails 3] [--lang en|ko]" >&2; exit 2; }
  [[ $fails =~ ^[0-9]+$ ]] || { echo "--fails must be a number" >&2; exit 2; }
  [ "$lang" = en ] || [ "$lang" = ko ] || { echo "--lang must be en or ko" >&2; exit 2; }
  if ! command -v curl >/dev/null || ! command -v python3 >/dev/null; then echo "curl and python3 are required" >&2; exit 2; fi
  install -m 755 "$0" /usr/local/bin/tailpulse-watchdog
  install -d -m 700 "$CONF_DIR" "$STATE_DIR"
  install -m 600 "$hook" "$HOOK"
  printf 'URL=%q\nFAILS_TO_ALERT=%q\nALERT_LANG=%q\n' "$url" "$fails" "$lang" > "$CONF_DIR/config"
  chmod 600 "$CONF_DIR/config"
  printf '# tailpulse self-watchdog: check /healthz every minute\n* * * * * root /usr/local/bin/tailpulse-watchdog >>%s 2>&1\n' "$LOG" > /etc/cron.d/tailpulse-watchdog
  chmod 644 /etc/cron.d/tailpulse-watchdog
  echo "installed: /usr/local/bin/tailpulse-watchdog, $CONF_DIR/{config,webhook} (600), /etc/cron.d/tailpulse-watchdog (every minute)"
  /usr/local/bin/tailpulse-watchdog && /usr/local/bin/tailpulse-watchdog status
}

send() { # $1 color (danger|good) $2 title $3 text
  local body code
  body=$(TITLE="$2" TEXT="$3" COLOR="$1" python3 -c 'import json,os;print(json.dumps({"username":"tailpulse watchdog","icon_emoji":":satellite:","attachments":[{"color":os.environ["COLOR"],"title":os.environ["TITLE"],"text":os.environ["TEXT"],"fallback":os.environ["TITLE"]}]}, ensure_ascii=False))')
  if [ -n "${DRY_RUN:-}" ]; then echo "[would send] $2 / $3"; return 0; fi
  # Pass the webhook URL through a curl config on stdin so it never shows up in ps or logs
  # (with pipefail, `| grep -q` can fail on SIGPIPE, so compare the captured value instead)
  code=$(printf 'url = "%s"\n' "$(head -n 1 "$HOOK" | tr -d '\r\n ')" | curl -sS -m 15 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data-binary "$body" -K - 2>/dev/null)
  [ "$code" = 200 ]
}

check() {
  [ -n "$URL" ] || { echo "URL is not set. Run: sudo bash $0 install --url ... --webhook-file ..." >&2; exit 2; }
  mkdir -p "$STATE_DIR"
  local fails=0 alerted=0 since="" code ok=0 resp
  # shellcheck disable=SC1090
  [ -f "$STATE" ] && . "$STATE"
  resp=$(curl -s -m 10 -w '\n%{http_code}' "$URL" 2>/dev/null || true)
  code=$(printf '%s' "$resp" | tail -n 1)
  [ "$code" = 200 ] && [[ $resp == *'"UP"'* ]] && ok=1
  if [ $ok = 1 ]; then
    if [ "$alerted" = 1 ]; then
      if send good "$(t '✅ 복구 · tailpulse 모니터링 화면' '✅ Recovered · tailpulse dashboard')" \
        "$(t "발생 $since → 복구 $(now) · $URL 다시 응답합니다. (감시: $HOST)" "Started $since → recovered $(now) · $URL answers again. (watchdog: $HOST)")"; then
        echo "$(date '+%F %T') recovery alert sent"; alerted=0
      else
        echo "$(date '+%F %T') recovery alert failed (will retry next minute)"
      fi
    elif [ "$fails" -gt 0 ]; then
      echo "$(date '+%F %T') answering again (after ${fails} failures, no alert)"
    fi
    [ "$alerted" = 0 ] && { fails=0; since=""; }
  else
    fails=$((fails + 1))
    [ -n "$since" ] || since=$(now)
    echo "$(date '+%F %T') failure #${fails} (HTTP ${code:-none})"
    if [ "$fails" -ge "$FAILS_TO_ALERT" ] && [ "$alerted" = 0 ]; then
      if send danger "$(t '🚨 장애 · tailpulse 모니터링 화면 응답 없음' '🚨 Critical · tailpulse dashboard is not responding')" \
        "$(t "$URL 이 ${fails}분째 응답하지 않습니다(응답 코드 ${code:-없음}). 이 동안 서버 끊김 · 장애 알림이 오지 않습니다.
확인: tailpulse 서버 상태, systemctl status tailpulse 또는 docker compose ps, 앞단 프록시
발생 $since (감시: $HOST)" "$URL has not answered for ${fails} minutes (HTTP ${code:-none}). Server-down and other alerts will not arrive meanwhile.
Check: the tailpulse host, systemctl status tailpulse or docker compose ps, the reverse proxy
Since $since (watchdog: $HOST)")"; then
        alerted=1; echo "$(date '+%F %T') alert sent"
      else
        echo "$(date '+%F %T') alert failed (will retry next minute)"
      fi
    fi
  fi
  printf 'fails=%s\nalerted=%s\nsince="%s"\n' "$fails" "$alerted" "$since" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
}

case "${1:-}" in
install) shift; install_self "$@" ;;
status)
  echo "watching: ${URL:-<not set>} (alert after $FAILS_TO_ALERT failures, lang $ALERT_LANG)"
  if [ -f "$STATE" ]; then cat "$STATE"; else echo "no state file yet (not run)"; fi
  echo "recent log:"; tail -n 5 "$LOG" 2>/dev/null || echo "(none)" ;;
"") check ;;
*) echo "usage: $0 [install --url <url> --webhook-file <file> [--fails N] [--lang en|ko] | status]"; exit 2 ;;
esac
