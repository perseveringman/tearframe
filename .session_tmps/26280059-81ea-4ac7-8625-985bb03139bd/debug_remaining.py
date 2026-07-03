#!/usr/bin/env python3
"""
Handle the last 18 remaining entries.
- LLM prompt strings (multi-line) need locale translation
- Spread entries with \\( interpolation
- 好/OK: keep as OK for ja, translate to 확인 for ko
"""

BASE = "/Users/ryanbzhou/Developer/vibe-coding/freedom/travel-log/Honi/Resources"

def patch_exact(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    count = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            count += 1
        else:
            print(f"  NOT FOUND: {old[:60]}...")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return count

# ===== JA =====
ja_path = f"{BASE}/ja.lproj/Localizable.strings"

# Let me read the actual file content for the remaining entries
with open(ja_path, 'r', encoding='utf-8') as f:
    ja_content = f.read()

# Find lines that still have English values
import re
en_dict = {}
with open(f"{BASE}/en.lproj/Localizable.strings", 'r', encoding='utf-8') as f:
    en_content = f.read()

# Find the actual lines for remaining entries by searching for specific EN values
# Let's print the actual content around line 3-9 (multi-line prompt strings)
lines = ja_content.split('\n')
for i, line in enumerate(lines):
    if 'Scene: travel journal material' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
    elif 'Scene: home storage' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
    elif 'Scene: recipe material' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
    elif 'Choose from existing tags first' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
    elif 'item quantity or null' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
    elif '"好"' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
    elif '\\(Int(outlineWidth))' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
    elif 'currentSpread + 1' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
    elif 'spreadIndex + 1' in line:
        print(f"JA Line {i+1}: {line[:120]}...")
