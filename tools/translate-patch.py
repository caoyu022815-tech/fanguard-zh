# -*- coding: utf-8 -*-
"""Translate build/patch-ko.json (Korean patch notes) -> build/patch-zh.json."""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "patch-ko.json")
CACHE = os.path.join(ROOT, "build", "patch-zh-cache.json")
OUT = os.path.join(ROOT, "build", "patch-zh.json")
ENDPOINT = "https://translate.googleapis.com/translate_a/single"


def translate(lines, tries=4):
    url = ENDPOINT + "?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": "ko", "tl": "zh-CN", "dt": "t", "q": "\n".join(lines)}
    )
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            raw = urllib.request.urlopen(req, timeout=120).read().decode("utf-8")
            data = json.loads(raw)
            out = "".join(part[0] for part in data[0] if part and part[0])
            return out.split("\n")
        except Exception as error:  # noqa: BLE001
            wait = 4 * (attempt + 1)
            print("error: %s (retry %ss)" % (error, wait), file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("translation failed")


def main():
    items = json.load(open(SRC, encoding="utf-8"))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = [x for x in items if x not in cache]
    print("todo", len(todo))
    for start in range(0, len(todo), 10):
        chunk = todo[start : start + 10]
        try:
            out = translate(chunk)
        except Exception as error:  # noqa: BLE001
            print("batch failed", error, file=sys.stderr)
            out = []
        if len(out) != len(chunk):
            out = []
            for line in chunk:
                try:
                    single = translate([line])
                    out.append(single[0] if len(single) == 1 else line)
                except Exception:  # noqa: BLE001
                    out.append(line)
                time.sleep(0.5)
        for source, target in zip(chunk, out):
            cache[source] = target.strip() or source
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        print("%d/%d" % (min(start + len(chunk), len(todo)), len(todo)), flush=True)
        time.sleep(1.0)
    json.dump(cache, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote", OUT, len(cache))


if __name__ == "__main__":
    main()
