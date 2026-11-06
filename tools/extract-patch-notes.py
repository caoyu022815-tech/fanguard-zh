# -*- coding: utf-8 -*-
"""Extract the PATCH_NOTES Korean strings from the saved page."""
import json
import re

HTML = "d:/Download/FANGUARD \u00b7 D Fight Simulator2.html"
raw = open(HTML, encoding="utf-8", errors="replace").read()
start = raw.find("const PATCH_NOTES=[")
if start < 0:
    raise SystemExit("PATCH_NOTES not found")
end = raw.find("return {installPatchNotes", start)
if end < 0:
    end = start + 200000
chunk = raw[start:end]
notes = []
for match in re.finditer(r"'((?:[^'\\]|\\.)*)'", chunk):
    text = match.group(1).replace("\\'", "'").replace("\\\\", "\\")
    if re.search(r"[\uac00-\ud7a3]", text):
        notes.append(text)
unique = []
for text in notes:
    if text not in unique:
        unique.append(text)
json.dump(unique, open("build/patch-ko.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("patch notes", len(unique), "chars", sum(len(x) for x in unique))
