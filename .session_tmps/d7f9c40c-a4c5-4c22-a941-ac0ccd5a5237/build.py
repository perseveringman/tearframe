#!/usr/bin/env python3
"""Parse the fetched BBC quiz markdown and build clean test documents (MD + HTML)."""
import base64, os, re, html

CTX = "/Users/ryanbzhou/.box/ctx/d7f9c40c-a4c5-4c22-a941-ac0ccd5a5237/tool-outputs"
FILES = {1: "VxwA6Jb5.txt", 2: "e6rXMnUw.txt", 3: "X65SHxCG.txt"}
OUT = "/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/output/d7f9c40c-a4c5-4c22-a941-ac0ccd5a5237"
os.makedirs(OUT, exist_ok=True)

B64_RE = re.compile(r'^([A-Za-z0-9+/]{16,}={0,2})$')
OPT_RE = re.compile(r'^([a-c])\s+(.*)$', re.S)
Q_RE = re.compile(r'^Question (\d+) of \d+$')

def b64dec(s):
    s = s.strip()
    s += "=" * (-len(s) % 4)
    try:
        return base64.b64decode(s).decode("utf-8", "replace").strip()
    except Exception:
        return ""

def is_correct(fb):
    f = fb.lower().strip()
    head = re.split(r'[.!]', f, 1)[0]
    neg = ["sorry", "unlucky", "incorrect", "wrong", "not the right",
           "not the best", "common mistake", "doesn\u2019t fit", "doesn't fit",
           "no,", "that isn\u2019t right", "that isn't right"]
    if any(m in head for m in neg):
        return False
    pos = ["well done", "great job", "good job", "great work", "great",
           "excellent", "correct", "that\u2019s right", "that's right",
           "yes", "good", "perfect", "amazing", "fantastic", "brilliant",
           "nice", "spot on", "absolutely"]
    return any(m in head for m in pos)

def split_option(line):
    m = OPT_RE.match(line.strip())
    if not m:
        return None
    letter, rest = m.group(1), m.group(2).strip()
    parts = rest.rsplit(" ", 1)
    if len(parts) == 2 and B64_RE.match(parts[1]):
        text = parts[0].strip()
        fb = b64dec(parts[1])
    else:
        text, fb = rest, ""
    return letter, text, fb

def parse_session(path):
    with open(path, encoding="utf-8") as f:
        lines = [l.rstrip("\n") for l in f]
    questions = []
    i = 0
    n = len(lines)
    cur = None
    while i < n:
        line = lines[i].strip()
        qm = Q_RE.match(line)
        if qm:
            if cur:
                questions.append(cur)
            j = i + 1
            qtext = ""
            while j < n:
                s = lines[j].strip()
                if s and s != "Help":
                    qtext = s
                    break
                j += 1
            cur = {"num": int(qm.group(1)), "q": qtext, "opts": []}
            i = j + 1
            continue
        if cur and OPT_RE.match(line) and len(cur["opts"]) < 3:
            opt = split_option(line)
            if opt:
                cur["opts"].append(opt)
        i += 1
    if cur:
        questions.append(cur)
    seen = {}
    for q in questions:
        if q["num"] not in seen and q["opts"]:
            seen[q["num"]] = q
    return [seen[k] for k in sorted(seen)]

SESSION_TITLES = {
    1: "Test 1 (Session 1)",
    2: "Test 2 (Session 2)",
    3: "Test 3 (Session 3)",
}

def clean(t):
    return html.escape(t)

def build_html(all_sessions, strip_answers=False):
    css = """
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    max-width:860px;margin:0 auto;padding:32px 20px;color:#222;line-height:1.55;background:#fafafa}
    h1{color:#b80000;border-bottom:3px solid #b80000;padding-bottom:8px}
    h2{margin-top:40px;color:#b80000;background:#fff;padding:10px 14px;border-left:5px solid #b80000;border-radius:4px}
    .src{color:#666;font-size:14px}
    .q{background:#fff;border:1px solid #e3e3e3;border-radius:8px;padding:16px 20px;margin:18px 0;box-shadow:0 1px 3px rgba(0,0,0,.05)}
    .qtitle{font-weight:600;margin-bottom:10px}
    .opt{padding:8px 12px;margin:6px 0;border-radius:6px;background:#f5f5f5}
    .letter{font-weight:700;margin-right:6px}
    """
    title = "BBC Learning English — Test Your Level"
    subtitle = "3 tests · 15 questions each" if strip_answers else "3 tests · 15 questions each · correct answers highlighted"
    parts = ['<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
             '<meta name="viewport" content="width=device-width,initial-scale=1">',
             f'<title>{title}</title>',
             f'<style>{css}</style></head><body>',
             f'<h1>{title}</h1>',
             f'<p class="src">Source: <a href="https://www.bbc.co.uk/learningenglish/english/course/test-your-level">bbc.co.uk/learningenglish</a> · {subtitle}</p>']
    for sn in sorted(all_sessions):
        parts.append(f"<h2>{clean(SESSION_TITLES[sn])}</h2>")
        for q in all_sessions[sn]:
            parts.append('<div class="q">')
            parts.append(f'<div class="qtitle">Q{q["num"]}. {clean(q["q"])}</div>')
            for letter, text, fb in q["opts"]:
                parts.append(f'<div class="opt"><span class="letter">{letter})</span>{clean(text)}</div>')
            parts.append('</div>')
    parts.append('</body></html>')
    return "\n".join(parts)

def main():
    all_sessions = {}
    for sn, fn in FILES.items():
        qs = parse_session(os.path.join(CTX, fn))
        all_sessions[sn] = qs

    # With answers
    htmlout = build_html(all_sessions, strip_answers=False)
    with open(os.path.join(OUT, "BBC_Test_Your_Level_all_tests.html"), "w", encoding="utf-8") as f:
        f.write(htmlout)

    # Without answers (no answer indicators, no feedback)
    htmlout_blank = build_html(all_sessions, strip_answers=True)
    with open(os.path.join(OUT, "BBC_Test_Your_Level_blank.html"), "w", encoding="utf-8") as f:
        f.write(htmlout_blank)

    print("Done. Files in", OUT)

if __name__ == "__main__":
    main()
