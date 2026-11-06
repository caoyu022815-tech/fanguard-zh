# -*- coding: utf-8 -*-
"""Re-translate UI pattern strings from the English column (it already uses {0} placeholders).

Run after tools/translate-ui.py, then rebuild. Exact strings keep the Korean-based
translation; only entries with placeholders are replaced here.
"""
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
SLOT = re.compile(r"\{(\d+)\}")


def translate(text, source="en", tries=4):
    url = ENDPOINT + "?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": source, "tl": "zh-CN", "dt": "t", "q": text}
    )
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            raw = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
            data = json.loads(raw)
            return "".join(part[0] for part in data[0] if part and part[0])
        except Exception as error:  # noqa: BLE001
            wait = 3 * (attempt + 1)
            print("error: %s (retry in %ss)" % (error, wait), file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("translation failed")


def tokenize_source(text):
    """Replace {} / {n} with [[0]], [[1]] ... so a reordering machine translation keeps the mapping."""
    index = 0

    def repl(_match):
        nonlocal index
        token = "[[%d]]" % index
        index += 1
        return token

    return re.sub(r"\{\d*\}", repl, text)


def restore_tokens(text):
    return re.sub(r"\[\[(\d+)\]\]", lambda m: "{%s}" % m.group(1), text)


def slots(text):
    return set(SLOT.findall(text))


def placeholder_count(text):
    return len(re.findall(r"\{\d*\}|\{n\}", text))


def valid(source, target):
    count = placeholder_count(source)
    if not count:
        return True
    have = slots(target)
    need = {str(i) for i in range(count)}
    return need <= have


def main():
    entries = json.load(open(SRC, encoding="utf-8"))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}

    patterns = [(ko, en, ja) for ko, en, ja in entries if re.search(r"\{\d*\}|\{n\}", ko)]
    if "--bad-only" in sys.argv:
        patterns = [item for item in patterns if not valid(item[0], cache.get(item[0], item[0]))]
    print("pattern entries", len(patterns))
    done = 0
    for ko, en, ja in patterns:
        target = en if "{" in en else None
        result = None
        if target:
            try:
                out = translate(target).strip()
                if valid(ko, out):
                    result = out
            except Exception as error:  # noqa: BLE001
                print("en translate failed:", error, file=sys.stderr)
        if result is None:
            try:
                out = translate(tokenize_source(ko), source="ko").strip()
                out = restore_tokens(out)
                if valid(ko, out):
                    result = out
            except Exception as error:  # noqa: BLE001
                print("ko translate failed:", error, file=sys.stderr)
        if result is None and placeholder_count(ko) == 1 and "{n}" in cache.get(ko, ""):
            result = cache[ko].replace("{n}", "{0}")
        if result is not None:
            cache[ko] = result
            done += 1
        else:
            print("keep machine translation:", repr(ko), file=sys.stderr)
        time.sleep(0.5)
        if done % 10 == 0:
            print("%d/%d" % (done, len(patterns)), flush=True)
            json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=0)

    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    result = [[ko, cache.get(ko, ko)] for ko, _en, _ja in entries]
    json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("updated", done, "pattern entries ->", OUT)


if __name__ == "__main__":
    main()
