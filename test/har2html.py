#!/usr/bin/env python3
# coding: utf-8

from __future__ import annotations
import json, sys

har = json.loads(sys.stdin.read())
entries = har["log"]["entries"]

imgs = [
    e["response"]["content"]
    for e in entries
    if e["response"]["content"]["mimeType"].startswith("image/")
]

parts = []
for c in imgs:
    mime = c["mimeType"]
    text = c["text"]
    enc = c.get("encoding", "")
    if enc == "base64":
        src = f"data:{mime};base64,{text}"
    else:
        src = text
    parts.append(f'<img src="{src}">')

print("<!DOCTYPE html><html><body>")
print("\n".join(parts))
print("</body></html>")
