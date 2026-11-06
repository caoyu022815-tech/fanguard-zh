# -*- coding: utf-8 -*-
"""Translate the UI dictionary from the English column (cleaner, keeps {0} placeholders)."""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "ui-text.json")
CACHE = os.path.join(ROOT, "build", "ui-zh-en-cache.json")
OUT = os.path.join(ROOT, "build", "ui-zh-en.json")
ENDPOINT = "https://translate.googleapis.com/translate_a/single"


def translate_batch(lines, tries=4):
    query = "\n".join(lines)
    url = ENDPOINT + "?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": "en", "tl": "zh-CN", "dt": "t", "q": query}
    )
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            raw = urllib.request.urlopen(req, timeout=90).read().decode("utf-8")
            data = json.loads(raw)
            out = "".join(part[0] for part in data[0] if part and part[0])
            return out.split("\n")
        except Exception as error:  # noqa: BLE001
            wait = 3 * (attempt + 1)
            print("error: %s (retry in %ss)" % (error, wait), file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("translation failed")


def main():
    entries = json.load(open(SRC, encoding="utf-8"))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = [en for _ko, en, _ja in entries if en not in cache]
    print("todo", len(todo))
    batch_size = 15
    for start in range(0, len(todo), batch_size):
        chunk = todo[start : start + batch_size]
        try:
            out = translate_batch(chunk)
        except Exception as error:  # noqa: BLE001
            print("batch failed: %s" % error, file=sys.stderr)
            out = []
        if len(out) != len(chunk):
            print("batch mismatch %d/%d, one by one" % (len(out), len(chunk)), file=sys.stderr)
            out = []
            for line in chunk:
                attempt = None
                for _ in range(3):
                    try:
                        single = translate_batch([line])
                        if len(single) == 1:
                            attempt = single[0]
                            break
                    except Exception:  # noqa: BLE001
                        time.sleep(2)
                    time.sleep(0.5)
                out.append(attempt or line)
                time.sleep(0.4)
        for source, target in zip(chunk, out):
            cache[source] = target.strip() or source
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        print("%d/%d" % (min(start + len(chunk), len(todo)), len(todo)), flush=True)
        time.sleep(1.0)

    result = [[ko, cache.get(en, en)] for ko, en, _ja in entries]
    json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)

    # Report entries whose translation still contains Hangul (the English source should not).
    leftovers = [(ko, zh) for ko, zh in result if re.search(r"[\uac00-\ud7a3]", zh)]
    print("wrote", OUT, len(result), "leftover Hangul", len(leftovers))
    for ko, zh in leftovers[:20]:
        print("  ", repr(ko), "=>", repr(zh))


if __name__ == "__main__":
    main()
