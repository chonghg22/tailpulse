"""python3 -m unittest discover -s agent/tests"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import tailpulse_agent as agent  # noqa: E402

# 예시 주소는 문서용 대역(RFC 5737: 192.0.2.0/24 · 198.51.100.0/24 · 203.0.113.0/24, RFC 3849: 2001:db8::/32)만 쓴다


class ParseTest(unittest.TestCase):
    def source(self, **conf):
        base = {"service": "s", "path": "x", "format": "combined_rt"}
        base.update(conf)
        return agent.Source(base, "salt")

    def test_combined_rt_strips_query_and_masks_ids(self):
        e = self.source().parse('192.0.2.4 - - [21/Nov/2026:10:00:01 +0900] "GET /products/view/123?name=x HTTP/1.1" 200 5 "-" "UA" 0.231')
        self.assertEqual((e["p"], e["ms"], e["s"], e["m"]), ("/products/view/:n", 231, 200, "GET"))
        self.assertNotIn("192.0.2.4", str(e))

    def test_token_segment_is_masked(self):
        self.assertEqual(agent.normalize_path("/share/a8Fk29dLmQ0pZx71Bc3TyU9w"), "/share/:token")
        self.assertEqual(agent.normalize_path("/assets/app.3f9a8b7c6d5e4f3a2b1c.js"), "/assets/:token.js")

    def test_health_checker_and_garbage_are_skipped(self):
        s = self.source()
        self.assertIsNone(s.parse('192.0.2.4 - - [x] "GET /healthz HTTP/1.1" 200 2 "-" "ELB-HealthChecker/2.0" 0.000'))
        self.assertIsNone(s.parse("garbage"))

    def test_skipped_lines_still_count_as_matching_format(self):
        s = self.source()
        self.assertEqual(s.parse_line('192.0.2.4 - - [x] "GET /healthz HTTP/1.1" 200 2 "-" "ELB-HealthChecker/2.0" 0.000'), (None, True))
        self.assertEqual(s.parse_line("garbage"), (None, False))

    def test_head_and_own_probe_are_skipped_and_common_format_parses(self):
        s = self.source(format="combined")
        self.assertIsNone(s.parse('192.0.2.4 - - [x] "HEAD / HTTP/1.1" 200 0'))
        self.assertIsNone(s.parse('192.0.2.4 - - [x] "GET /?tailpulse_probe=1 HTTP/1.1" 200 10'))
        self.assertIsNone(s.parse('192.0.2.4 - - [x] "GET / HTTP/1.1" 200 10 "-" "tailpulse"'))
        e = s.parse('192.0.2.4 - - [x] "POST /api/save HTTP/1.1" 200 440')
        self.assertEqual((e["m"], e["p"], e["s"]), ("POST", "/api/save", 200))

    def test_plain_combined_has_no_response_time(self):
        e = self.source(format="combined").parse('192.0.2.4 - - [x] "POST /a HTTP/1.1" 500 2 "-" "UA"')
        self.assertNotIn("ms", e)
        self.assertEqual(e["s"], 500)

    def test_apache_microseconds_and_static(self):
        e = self.source(rt_unit="us").parse('192.0.2.4 - - [x] "GET /img/a.png HTTP/1.1" 200 2 "-" "UA" 45000')
        self.assertEqual(e["ms"], 45)
        self.assertTrue(e["x"])

    def test_json_format(self):
        e = self.source(format="json").parse('{"remote_addr":"192.0.2.4","request_method":"GET","request_uri":"/a?b=1","status":"200","request_time":"1.5","http_user_agent":"UA"}')
        self.assertEqual((e["p"], e["ms"]), ("/a", 1500))


class RegexAndDatedPathTest(unittest.TestCase):
    def test_custom_regex_reads_rt_field(self):
        s = agent.Source({"service": "s", "path": "x", "rt_unit": "s", "regex":
                          r'^(?P<ip>\S+) \S+ \S+ \[[^\]]+\] "(?P<method>[A-Z]+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+ "[^"]*" "(?P<ua>[^"]*)" rt=(?P<rt>[\d.]+)'}, "salt")
        e = s.parse('192.0.2.4 - - [x] "GET /a/12 HTTP/1.1" 302 5 "-" "UA" rt=0.087 urt=0.087 uht=0.087')
        self.assertEqual((e["p"], e["ms"], e["s"]), ("/a/:n", 87, 302))

    def test_builtin_timed_format_matches_recommended_log_format(self):
        nginx = agent.Source({"service": "s", "path": "x", "format": "timed", "rt_unit": "s"}, "salt")
        line = '172.18.0.3 - - [21/Nov/2026:10:00:01 +0000] "GET /cart/7 HTTP/1.1" 200 5 "-" "UA" rt=0.120 xff="203.0.113.5, 10.0.1.2"'
        e = nginx.parse(line)
        self.assertEqual((e["p"], e["ms"], e["s"]), ("/cart/:n", 120, 200))
        self.assertNotEqual(e["v"], nginx.parse(line.replace("203.0.113.5", "198.51.100.7"))["v"], "xff 의 실제 접속자로 센다")
        apache = agent.Source({"service": "s", "path": "x", "format": "timed", "rt_unit": "us"}, "salt")
        self.assertEqual(apache.parse('10.0.1.2 - - [x] "GET / HTTP/1.1" 200 5 "-" "UA" rt=45000 xff="-"')["ms"], 45)

    def test_dated_path_follows_timezone_offset(self):
        s = agent.Source({"service": "s", "path": "/logs/access.%Y-%m-%d.log", "path_tz_offset_hours": 9}, "salt")
        import time as t
        self.assertEqual(s.path, t.strftime("/logs/access.%Y-%m-%d.log", t.gmtime(t.time() + 9 * 3600)))


class RealIpTest(unittest.TestCase):
    NGINX = (r'^(?P<ip>\S+) \S+ \S+ \[[^\]]+\] "(?P<method>[A-Z]+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+ "[^"]*" "(?P<ua>[^"]*)" '
             r'rt=(?P<rt>[\d.]+)(?:.*? xff="(?P<xff>[^"]*)")?')
    APACHE = (r'^(?P<ip>\S+) \S+ \S+ \[[^\]]+\] "(?P<method>[A-Z]+) (?P<path>\S+)[^"]*" (?P<status>\d{3}) \S+ "[^"]*" "(?P<ua>[^"]*)" '
              r'rt=(?P<rt>\d+) xff="(?P<xff>[^"]*)" vhost=(?P<vhost>\S+)')

    def test_client_ip_takes_rightmost_public_address(self):
        self.assertEqual(agent.client_ip("203.0.113.5, 10.0.1.2", "172.18.0.3"), "203.0.113.5")
        self.assertEqual(agent.client_ip("192.0.2.1, 203.0.113.5, 10.0.1.2", "172.18.0.3"), "203.0.113.5", "앞쪽 값은 위조될 수 있어 믿지 않는다")
        self.assertEqual(agent.client_ip("2001:db8::1, 10.0.1.2", "x"), "2001:db8::1")
        self.assertEqual(agent.client_ip("-", "172.18.0.3"), "172.18.0.3")
        self.assertEqual(agent.client_ip("10.0.0.1, 192.168.0.2", "127.0.0.1"), "127.0.0.1")
        self.assertEqual(agent.client_ip(None, "192.0.2.4"), "192.0.2.4")

    def test_nginx_timed_with_xff_counts_visitors_by_real_ip(self):
        s = agent.Source({"service": "s", "path": "x", "rt_unit": "s", "regex": self.NGINX}, "salt")
        line = '172.18.0.3 - - [x] "GET /a HTTP/1.1" 200 5 "-" "UA" rt=0.120 urt=0.119 uht=0.119 xff="%s"'
        a, b = s.parse(line % "203.0.113.5, 10.0.1.2"), s.parse(line % "198.51.100.7, 10.0.1.9")
        self.assertEqual(a["ms"], 120)
        self.assertNotEqual(a["v"], b["v"], "앞단 프록시 주소가 같아도 실제 접속자가 다르면 다른 방문자")
        self.assertNotIn("203.0.113.5", str(a))
        old = s.parse('172.18.0.3 - - [x] "GET /a HTTP/1.1" 200 5 "-" "UA" rt=0.120 urt=0.119 uht=0.119')
        self.assertEqual(old["ms"], 120, "xff 가 붙기 전 형식도 읽는다")

    def test_apache_format_skips_other_vhost_and_cron(self):
        s = agent.Source({"service": "www", "path": "x", "rt_unit": "us", "regex": self.APACHE,
                          "require": {"vhost": "^www\\.example\\.com$"}, "exclude_path": "^/cron$"}, "salt")
        line = '10.0.1.2 - - [x] "GET /posts/123?x=1 HTTP/1.1" 200 512 "-" "Mozilla/5.0" rt=45000 xff="203.0.113.5" vhost=%s'
        e = s.parse(line % "www.example.com")
        self.assertEqual((e["p"], e["ms"]), ("/posts/:n", 45))
        self.assertEqual(s.parse_line(line % "ws.example.com"), (None, True))
        self.assertEqual(s.parse_line('127.0.0.1 - - [x] "POST /cron HTTP/1.1" 200 440 "-" "curl/8.5" rt=900 xff="-" vhost=www.example.com'), (None, True))

    def test_require_on_path_splits_admin_api_from_user_api(self):
        s = agent.Source({"service": "admin-api", "path": "x", "rt_unit": "us", "regex": self.APACHE,
                          "require": {"path": "^/admin(/|$)"}}, "salt")
        line = '10.0.1.2 - - [x] "GET %s HTTP/1.1" 200 97 "-" "Mozilla/5.0" rt=9388 xff="203.0.113.5" vhost=api.example.com'
        e = s.parse(line % "/admin/api/v1/members/77?page=2")
        self.assertEqual((e["p"], e["ms"]), ("/admin/api/v1/members/:n", 9))
        self.assertEqual(s.parse_line(line % "/site-settings"), (None, True))


class SysStatsTest(unittest.TestCase):
    def test_reads_percentages(self):
        st = agent.SysStats(["/"])
        out = st.read()
        self.assertIn("/", out.get("disk", {}))
        self.assertTrue(0 <= out["disk"]["/"] <= 100)
        for key in ("cpu", "mem"):
            if key in out:  # 맥에는 /proc 이 없다
                self.assertTrue(0 <= out[key] <= 100)


class TailTest(unittest.TestCase):
    LINE = b'192.0.2.4 - - [x] "GET /a HTTP/1.1" 200 2 "-" "UA" 0.010\n'

    def test_follows_append_truncate_and_rotation(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "access.log")
            with open(path, "wb") as f:
                f.write(self.LINE)  # 시작 전에 있던 줄은 읽지 않는다
            s = agent.Source({"service": "s", "path": path, "format": "combined_rt"}, "salt")
            s.open()
            self.assertEqual(s.read_new(), [])
            with open(path, "ab") as f:
                f.write(self.LINE * 2)
            self.assertEqual(len(s.read_new()), 2)
            with open(path, "wb") as f:  # copytruncate
                f.write(self.LINE)
            self.assertEqual(s.read_new(), [])
            self.assertEqual(len(s.read_new()), 1)
            os.rename(path, path + ".1")  # 새 파일로 교체
            with open(path, "wb") as f:
                f.write(self.LINE * 3)
            self.assertEqual(s.read_new(), [])
            self.assertEqual(len(s.read_new()), 3)


class CheckTest(unittest.TestCase):
    def test_check_counts_every_line_of_a_small_log(self):
        import contextlib
        import io
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "access.log")
            with open(path, "wb") as f:
                f.write(TailTest.LINE * 3)
            out, saved = io.StringIO(), agent.LANG
            try:
                agent.LANG = "en"
                with contextlib.redirect_stdout(out):
                    ok = agent.check([agent.Source({"service": "s", "path": path, "format": "combined_rt"}, "salt")])
            finally:
                agent.LANG = saved
            self.assertTrue(ok)
            self.assertIn("3 recent lines, 3 match the format", out.getvalue(), "작은 로그의 첫 줄도 센다")


class AliveTest(unittest.TestCase):
    """접속 로그가 없는 서비스: 응답(404 포함)이 오면 살아 있음, 5xx · 연결 실패면 아님."""

    def serve(self, code):
        import http.server
        import threading

        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(code)
                self.end_headers()

            def log_message(self, *a):
                pass

        srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        return "http://127.0.0.1:%d/" % srv.server_port

    def test_any_answer_below_500_is_alive(self):
        up, why = agent.Alive({"service": "s", "url": self.serve(404)}).probe()
        self.assertTrue(up)
        self.assertIn("404", why)
        self.assertFalse(agent.Alive({"service": "s", "url": self.serve(502)}).probe()[0])

    def test_refused_is_not_alive(self):
        import socket as so

        s = so.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        up, why = agent.Alive({"service": "s", "url": "http://127.0.0.1:%d/" % port, "timeout_sec": 1}).probe()
        self.assertFalse(up)
        self.assertIn("Error", why)


class LangTest(unittest.TestCase):
    def test_messages_follow_language(self):
        saved = agent.LANG
        try:
            agent.LANG = "ko"
            self.assertEqual(agent.T("응답", "HTTP"), "응답")
            agent.LANG = "en"
            self.assertEqual(agent.T("응답", "HTTP"), "HTTP")
        finally:
            agent.LANG = saved


if __name__ == "__main__":
    unittest.main()
