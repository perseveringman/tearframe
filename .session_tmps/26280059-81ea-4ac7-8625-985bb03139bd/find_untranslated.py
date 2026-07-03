#!/usr/bin/env python3
"""Find entries in ja/ko that are identical to en (likely untranslated)."""
import re, sys

def parse_strings(path):
    """Parse a .strings file into a dict of key -> value."""
    entries = {}
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Match "key" = "value";
    pattern = r'"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;'
    for m in re.finditer(pattern, content):
        entries[m.group(1)] = m.group(2)
    return entries

base = "/Users/ryanbzhou/Developer/vibe-coding/freedom/travel-log/Honi/Resources"

en = parse_strings(f"{base}/en.lproj/Localizable.strings")
ja = parse_strings(f"{base}/ja.lproj/Localizable.strings")
ko = parse_strings(f"{base}/ko.lproj/Localizable.strings")
zh = parse_strings(f"{base}/zh-Hans.lproj/Localizable.strings")

print(f"Total keys: en={len(en)}, ja={len(ja)}, ko={len(ko)}, zh={len(zh)}")
print()

# Keys in en but missing in ja/ko
ja_missing = set(en.keys()) - set(ja.keys())
ko_missing = set(en.keys()) - set(ko.keys())
if ja_missing:
    print(f"Keys in en but MISSING in ja ({len(ja_missing)}):")
    for k in sorted(ja_missing)[:20]:
        print(f"  {k[:60]}")
if ko_missing:
    print(f"Keys in en but MISSING in ko ({len(ko_missing)}):")
    for k in sorted(ko_missing)[:20]:
        print(f"  {k[:60]}")

# Entries where ja == en (untranslated to Japanese)
ja_same_as_en = []
for key in sorted(ja.keys()):
    if key in en and ja[key] == en[key]:
        # Skip keys that are inherently untranslatable (numbers, proper nouns, format strings)
        val = en[key]
        # Skip if value is just numbers, symbols, or very short technical strings
        if re.match(r'^[\d¥%.:/\s]+$', val):
            continue
        if val == key:  # zh-Hans style where key==value
            continue
        ja_same_as_en.append((key, val))

ko_same_as_en = []
for key in sorted(ko.keys()):
    if key in en and ko[key] == en[key]:
        val = en[key]
        if re.match(r'^[\d¥%.:/\s]+$', val):
            continue
        if val == key:
            continue
        ko_same_as_en.append((key, val))

print(f"\n=== JA entries identical to EN ({len(ja_same_as_en)}) ===")
for key, val in ja_same_as_en:
    print(f"  KEY: {key[:80]}")
    print(f"  EN:  {val[:80]}")
    print()

print(f"\n=== KO entries identical to EN ({len(ko_same_as_en)}) ===")
for key, val in ko_same_as_en:
    print(f"  KEY: {key[:80]}")
    print(f"  EN:  {val[:80]}")
    print()
