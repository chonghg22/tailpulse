#!/usr/bin/env python3
"""Fake traffic for the demo. Keeps sending requests of four services to the collector (/ingest).

  python3 tools/demo_traffic.py [http://localhost:8080/ingest]
  DEMO_DOWN=web-2 python3 tools/demo_traffic.py    simulate a dead server (it stops sending; web-1 keeps serving)
  python3 tools/demo_traffic.py --seed data        write synthetic 1-minute history for yesterday and today
                                                   into data/trend/ (only if the files don't exist yet) and exit

Environment: TAILPULSE_INGEST_TOKEN (default demo-token), DEMO_DOWN (comma separated hosts).
"""
import json
import math
import os
import random
import sys
import time
import urllib.request

TOKEN = os.environ.get("TAILPULSE_INGEST_TOKEN", "demo-token")
DOWN = set(h for h in os.environ.get("DEMO_DOWN", "").split(",") if h)
SERVICES = {
    "shop-web": dict(rate=9, base=180, hosts=["web-1", "web-2"],
                     paths=["/products", "/products/:n", "/cart", "/checkout", "/login", "/assets/js/app.js"]),
    "shop-api": dict(rate=6, base=45, hosts=["api-1"], paths=["/v1/products", "/v1/products/:n", "/v1/orders", "/v1/cart/:n"]),
    "blog": dict(rate=12, base=140, hosts=["api-1"], paths=["/posts/:n", "/", "/tags/:n", "/share/:token", "/assets/css/main.css"]),
    "admin-api": dict(rate=2, base=60, hosts=["api-1"], paths=["/admin/members", "/admin/orders", "/admin/stats"]),
}
VISITORS = {name: ["%s-%04d" % (name, i) for i in range(int(conf["rate"] * 14))] for name, conf in SERVICES.items()}


def make(name, conf, now):
    path = random.choice(conf["paths"])
    static = path.endswith((".js", ".css"))
    ms = random.lognormvariate(math.log(conf["base"]), 0.55)
    status = 200
    roll = random.random()
    wave = int(time.time()) % 180
    if name == "blog" and 120 <= wave < 135:  # slow for ~15s every 3 minutes
        ms *= random.uniform(4, 12)
    if roll < 0.004 or (name == "shop-web" and 60 <= wave < 66 and roll < 0.25):  # short 5xx burst every 3 minutes
        status, ms = 500, ms * 2
    elif roll < 0.03:
        status = random.choice([404, 401, 302])
    if static:
        ms = random.uniform(1, 8)
    e = {"t": now, "ms": int(ms), "s": status, "m": "POST" if path in ("/checkout", "/v1/orders") and roll > 0.6 else "GET", "p": path,
         "v": random.choice(VISITORS[name])}
    if static:
        e["x"] = True
    return e


def daily_shape(minute_of_day):
    """0..1: quiet at night, busy around 11:00 and 21:00."""
    h = minute_of_day / 60.0
    return 0.15 + 0.55 * math.exp(-((h - 11) ** 2) / 8) + 0.75 * math.exp(-((h - 21) ** 2) / 5)


def seed(data_dir):
    """Synthetic history so the 'Today' tab has something to show right away.
    Same line format as the server: {"m": epoch minute, "s": {service: [count, static, 5xx, 4xx, sumMs, timed, maxMs, users]}}"""
    trend = os.path.join(data_dir, "trend")
    os.makedirs(trend, exist_ok=True)
    now_min = int(time.time() // 60)
    local = time.localtime()
    today_start = now_min - (local.tm_hour * 60 + local.tm_min)  # local midnight (same TZ as the server container)
    # scale the daily curve so "now" matches the live fake traffic (avoids a jump where history meets live data)
    scale = 1.0 / daily_shape(local.tm_hour * 60 + local.tm_min)
    for start, end in ((today_start - 1440, today_start), (today_start, now_min - 1)):
        name = time.strftime("trend-%Y-%m-%d.jsonl", time.localtime(start * 60 + 3600))
        path = os.path.join(trend, name)
        if os.path.exists(path):
            print("seed: %s already exists, left as is" % path)
            continue
        rnd = random.Random(start)
        with open(path, "w") as f:
            for m in range(start, end):
                shape = daily_shape(m - start) * scale
                row = {}
                for svc, conf in SERVICES.items():
                    count = max(0, int(rnd.gauss(conf["rate"] * 60 * shape, (conf["rate"] * 60 * shape) ** 0.5)))
                    errors = sum(1 for _ in range(count) if rnd.random() < 0.004)
                    client = sum(1 for _ in range(count) if rnd.random() < 0.02)
                    avg = conf["base"] * (0.8 + 0.2 * shape) * rnd.uniform(0.85, 1.15)
                    users = int(min(1.0, shape * rnd.uniform(0.9, 1.05)) * conf["rate"] * 14)
                    row[svc] = [count, count // 6, errors, client, int(avg * count), count, int(avg * rnd.uniform(3, 9)), users]
                f.write(json.dumps({"m": m, "s": row}, separators=(",", ":")) + "\n")
        print("seed: wrote %s (%d minutes)" % (path, end - start))


def run(url):
    failing = False
    while True:
        now = int(time.time() * 1000)
        swing = 1 + 0.5 * math.sin(time.time() / 40)
        for name, conf in SERVICES.items():
            n = max(0, int(random.gauss(conf["rate"] * swing, conf["rate"] ** 0.5)))
            events = [make(name, conf, now - random.randint(0, 900)) for _ in range(n)]
            hosts = [h for h in conf["hosts"] if h not in DOWN]
            if not hosts:
                continue
            host = random.choice(hosts)
            body = {"service": name, "host": host, "events": events,
                    "sys": {"cpu": random.uniform(5, 40), "mem": random.uniform(40, 70), "disk": {"/": 88.0 if host == "web-2" else 61.0}}}
            req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST")
            req.add_header("Content-Type", "application/json")
            req.add_header("X-Tailpulse-Token", TOKEN)
            try:
                urllib.request.urlopen(req, timeout=3).read()
                if failing:
                    print("demo: sending again")
                    failing = False
            except Exception as ex:
                if not failing:  # the server may still be starting; say it once
                    print("demo: send failed, retrying (%s)" % ex)
                    failing = True
        sys.stdout.flush()
        time.sleep(1)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--seed":
        seed(sys.argv[2])
    else:
        run(sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/ingest")
