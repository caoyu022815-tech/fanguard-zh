# -*- coding: utf-8 -*-
"""Extract static English UI strings from the saved FANGUARD page (outside scripts)."""
import json
import re
import sys
from html.parser import HTMLParser

HTML = sys.argv[1] if len(sys.argv) > 1 else "d:/Download/FANGUARD \u00b7 D Fight Simulator2.html"
raw = open(HTML, encoding="utf-8", errors="replace").read()

# Only the body before the boot script matters for static markup.
start = raw.find("<body")
end = raw.find("<script>", start)
if end < 0:
    end = len(raw)
body = raw[start:end]

LATIN = re.compile(r"[A-Za-z]")
CJK = re.compile(r"[\u4e00-\u9fff\uac00-\ud7a3]")
SKIP_TAGS = {"SCRIPT", "STYLE", "TEXTAREA"}


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.texts = []
        self.attrs = []

    def handle_starttag(self, tag, attrs):
        if tag.upper() in SKIP_TAGS:
            self.skip += 1
            return
        for name, value in attrs:
            if name in ("title", "aria-label", "placeholder", "alt") and value:
                self.attrs.append(value)

    def handle_endtag(self, tag):
        if tag.upper() in SKIP_TAGS and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.texts.append(data)


parser = Parser()
parser.feed(body)

candidates = []
for value in parser.texts + parser.attrs:
    text = " ".join(value.split())
    if len(text) < 2 or not LATIN.search(text) or CJK.search(text):
        continue
    candidates.append(text)

# Drop card names and card effects that are merely placeholders in the static deck preview.
cards = json.load(open("build/cards.json", encoding="utf-8"))
names = {c["en"].strip() for c in cards if c.get("en")}
filtered = []
for text in candidates:
    if text in names:
        continue
    if text.startswith("ID ") or "[" in text:
        continue
    filtered.append(text)

seen = []
for text in filtered:
    if text not in seen:
        seen.append(text)

json.dump(seen, open("build/static-en.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("static strings", len(seen))
for text in seen[:40]:
    print("  ", text)
