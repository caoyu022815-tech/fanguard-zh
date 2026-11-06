# -*- coding: utf-8 -*-
"""Translate the FANGUARD UI dictionary (Korean -> Simplified Chinese).

Reads build/ui-text.json ([[ko, en, ja], ...]) and writes build/ui-zh.json
([[ko, zh], ...]). Results are cached in build/ui-zh-cache.json so reruns are
cheap. Machine translation is only a starting point; data/ui-overrides.json is
applied afterwards by tools/build.mjs / the userscript.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "ui-text.json")
CACHE = os.path.join(ROOT, "build", "ui-zh-cache.json")
OUT = os.path.join(ROOT, "build", "ui-zh.json")
ENDPOINT = "https://translate.googleapis.com/translate_a/single"
PUA = re.compile("[\ue000-\ue00f]")


def protect(text):
    index = 0

    def repl(_match):
        nonlocal index
        ch = chr(0xE000 + index)
        index += 1
        return ch

    return re.sub(r"\{\d*\}", repl, text)


def restore(text):
    return PUA.sub(lambda m: "{%d}" % (ord(m.group(0)) - 0xE000), text)


def translate_batch(lines, tries=4):
    query = "\n".join(protect(line) for line in lines)
    url = ENDPOINT + "?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": "ko", "tl": "zh-CN", "dt": "t", "q": query}
    )
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            raw = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
            data = json.loads(raw)
            out = "".join(part[0] for part in data[0] if part and part[0])
            return [restore(x) for x in out.split("\n")]
        except Exception as error:  # noqa: BLE001 - retry network errors
            wait = 3 * (attempt + 1)
            print("translate error: %s (retry in %ss)" % (error, wait), file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("translation failed")


def translate_one(text):
    for _ in range(3):
        out = translate_batch([text])
        if len(out) == 1:
            return out[0]
        time.sleep(1)
    return text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--batch", type=int, default=20)
    args = parser.parse_args()

    entries = json.load(open(SRC, encoding="utf-8"))
    cache = {}
    if os.path.exists(CACHE):
        cache = json.load(open(CACHE, encoding="utf-8"))

    todo = [ko for ko, _en, _ja in entries if ko not in cache]
    if args.limit:
        todo = todo[: args.limit]
    print("entries %d, cached %d, todo %d" % (len(entries), len(cache), len(todo)))

    for start in range(0, len(todo), args.batch):
        chunk = todo[start : start + args.batch]
        try:
            out = translate_batch(chunk)
        except Exception as error:  # noqa: BLE001
            print("batch failed (%s), falling back to single lines" % error, file=sys.stderr)
            out = []
        if len(out) != len(chunk):
            print("batch mismatch %d/%d, translating one by one" % (len(out), len(chunk)), file=sys.stderr)
            out = [translate_one(line) for line in chunk]
        for source, target in zip(chunk, out):
            target = target.strip()
            cache[source] = target or source
        with open(CACHE, "w", encoding="utf-8") as handle:
            json.dump(cache, handle, ensure_ascii=False, indent=0)
        done = min(start + len(chunk), len(todo))
        print("%d/%d" % (done, len(todo)), flush=True)
        time.sleep(1.2)

    result = [[ko, cache.get(ko, ko)] for ko, _en, _ja in entries]
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=0)
    print("wrote %s (%d entries)" % (OUT, len(result)))
    missing = sum(1 for ko, zh in result if ko == zh)
    print("untranslated %d" % missing)


if __name__ == "__main__":
    main()
