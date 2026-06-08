#!/usr/bin/env python3
"""Download BBC Learning English 'Test Your Level' quizzes and build readable docs."""
import base64, html, json, re, urllib.request, os, sys

BASE = "https://www.bbc.co.uk/learningenglish/english/course/test-your-level/unit-1/session-{}"
OUT = "/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/output/d7f9c40c-a4c5-4c22-a941-ac0ccd5a5237"
os.makedirs(OUT, exist_ok=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")

def b64decode(s):
    s = s.strip()
    # pad
    s += "=" * (-len(s) % 4)
    try:
        return base64.b64decode(s).decode("utf-8", "replace")
    except Exception:
        return ""

def is_correct(feedback):
    fb = feedback.lower()
    markers = ["well done", "great job", "good job", "that's correct", "that\u2019s correct",
               "correct!", "great!", "excellent", "well done!"]
    # avoid "this sentence is correct" inside wrong-answer text? Those still indicate correct.
    return any(m in fb for m in markers)

def extract_quiz(htmltext):
    """Find the JSON quiz data embedded in the page."""
    # BBC embeds quiz as JSON. Look for the quiz question array.
    # Try to locate 'questions' structure.
    m = re.search(r'"questions"\s*:\s*(\[.*?\])\s*,\s*"', htmltext, re.S)
    return m

def main():
    sessions = {}
    for n in (1, 2, 3):
        url = BASE.format(n)
        raw = fetch(url)
        path = os.path.join(OUT, f"_raw_session{n}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(raw)
        sessions[n] = raw
        print(f"session {n}: {len(raw)} chars")

if __name__ == "__main__":
    main()
