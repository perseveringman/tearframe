#!/usr/bin/env python3
"""
Patch ja.lproj/Localizable.strings and ko.lproj/Localizable.strings
with proper translations for all entries currently showing English text.

Strategy: Read each file line by line. For lines matching "key" = "english_value";
where the value is English (same as en.lproj), replace with proper ja/ko translation.
"""
import re, json, sys

BASE = "/Users/ryanbzhou/Developer/vibe-coding/freedom/travel-log/Honi/Resources"

def parse_strings_to_dict(path):
    entries = {}
    with open(path, 'r') as f:
        for line in f:
            m = re.match(r'^"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;', line)
            if m:
                entries[m.group(1)] = m.group(2)
    return entries

en = parse_strings_to_dict(f"{BASE}/en.lproj/Localizable.strings")
ja = parse_strings_to_dict(f"{BASE}/ja.lproj/Localizable.strings")
ko = parse_strings_to_dict(f"{BASE}/ko.lproj/Localizable.strings")

# Find keys where ja/ko value == en value (untranslated)
ja_untranslated = {k: v for k, v in ja.items() if k in en and v == en[k]}
ko_untranslated = {k: v for k, v in ko.items() if k in en and v == en[k]}

# Print just the keys and English values as JSON for review
output = {"ja_untranslated": {k: en[k] for k in sorted(ja_untranslated.keys())},
          "ko_untranslated": {k: en[k] for k in sorted(ko_untranslated.keys())}}

# Write to file for analysis
with open("/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/.session_tmps/26280059-81ea-4ac7-8625-985bb03139bd/untranslated_keys.json", "w") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"JA untranslated: {len(ja_untranslated)}")
print(f"KO untranslated: {len(ko_untranslated)}")
print("Saved to untranslated_keys.json")
