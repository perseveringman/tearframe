#!/usr/bin/env python3
"""Generate interactive HTML quiz with correct answers baked in."""
import json, html as hmodule, os, re, base64

CTX = "/Users/ryanbzhou/.box/ctx/d7f9c40c-a4c5-4c22-a941-ac0ccd5a5237/tool-outputs"
FILES = {1: "VxwA6Jb5.txt", 2: "e6rXMnUw.txt", 3: "X65SHxCG.txt"}
OUT = "/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/output/d7f9c40c-a4c5-4c22-a941-ac0ccd5a5237"

B64_RE = re.compile(r'^([A-Za-z0-9+/]{16,}={0,2})$')
OPT_RE = re.compile(r'^([a-c])\s+(.*)$', re.S)
Q_RE = re.compile(r'^Question (\d+) of \d+$')

def b64dec(s):
    s = s.strip() + "=" * (-len(s) % 4)
    try: return base64.b64decode(s).decode("utf-8", "replace").strip()
    except: return ""

def is_correct(fb):
    f = fb.lower().strip()
    head = re.split(r'[.!]', f, 1)[0]
    neg = ["sorry","unlucky","incorrect","wrong","not the right","not the best","common mistake","doesn't fit","doesn\u2019t fit","that isn't right","that isn\u2019t right"]
    if any(m in head for m in neg): return False
    pos = ["well done","great job","good job","great work","great","excellent","correct","that's right","that\u2019s right","yes","good","perfect","amazing","fantastic","brilliant","nice","spot on","absolutely"]
    return any(m in head for m in pos)

def parse_session(path):
    with open(path, encoding="utf-8") as f:
        lines = [l.rstrip("\n") for l in f]
    questions, i, n, cur = [], 0, len(lines), None
    while i < n:
        line = lines[i].strip()
        qm = Q_RE.match(line)
        if qm:
            if cur: questions.append(cur)
            j = i + 1
            qtext = ""
            while j < n:
                s = lines[j].strip()
                if s and s != "Help": qtext = s; break
                j += 1
            cur = {"num": int(qm.group(1)), "q": qtext, "opts": []}
            i = j + 1; continue
        if cur and OPT_RE.match(line) and len(cur["opts"]) < 3:
            m = OPT_RE.match(line.strip())
            if m:
                letter, rest = m.group(1), m.group(2).strip()
                parts = rest.rsplit(" ", 1)
                if len(parts) == 2 and B64_RE.match(parts[1]):
                    text, fb = parts[0].strip(), b64dec(parts[1])
                else:
                    text, fb = rest, ""
                cur["opts"].append((letter, text, fb))
        i += 1
    if cur: questions.append(cur)
    seen = {}
    for q in questions:
        if q["num"] not in seen and q["opts"]:
            seen[q["num"]] = q
    return [seen[k] for k in sorted(seen)]

TITLES = {1: "Test 1 (Session 1)", 2: "Test 2 (Session 2)", 3: "Test 3 (Session 3)"}

data = []
for sn, fn in FILES.items():
    qs = parse_session(os.path.join(CTX, fn))
    test = {"title": TITLES[sn], "questions": []}
    for q in qs:
        opts = []
        correct_letter = ""
        for letter, text, fb in q["opts"]:
            if is_correct(fb): correct_letter = letter
            opts.append([letter, text, fb])
        test["questions"].append({"q": q["q"], "options": opts, "correct": correct_letter})
    data.append(test)

DATA_JSON = json.dumps(data, ensure_ascii=False)

HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BBC Test Your Level — Interactive</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    color:#222;line-height:1.55;background:#f2f2f2}
  .container{max-width:820px;margin:0 auto;padding:24px 16px}
  h1{color:#b80000;border-bottom:3px solid #b80000;padding-bottom:8px;font-size:24px}
  .src{color:#666;font-size:13px;margin:6px 0 20px}
  .src a{color:#b80000}
  .test-tabs{display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap}
  .test-tab{padding:10px 24px;border:2px solid #b80000;border-radius:8px;
    cursor:pointer;font-weight:600;font-size:15px;background:#fff;color:#b80000;transition:all .15s}
  .test-tab:hover{background:#ffe5e5}
  .test-tab.active{background:#b80000;color:#fff}
  .question{background:#fff;border:1px solid #e0e0e0;border-radius:10px;padding:18px 22px;
    margin:16px 0;box-shadow:0 1px 4px rgba(0,0,0,.06)}
  .q-title{font-weight:600;margin-bottom:12px;font-size:15px}
  .opt{display:block;width:100%;padding:11px 14px;margin:6px 0;border-radius:8px;
    border:2px solid #e8e8e8;background:#fafafa;cursor:pointer;text-align:left;
    font-size:14px;transition:all .12s;line-height:1.4}
  .opt:hover{background:#f0f0f0;border-color:#ccc}
  .opt.selected{border-color:#b80000;background:#fff5f5}
  .opt.correct{background:#e6f4ea;border-color:#34a853;color:#1e7e34}
  .opt.wrong{background:#fce8e6;border-color:#ea4335;color:#c5221f}
  .opt.disabled{cursor:default;opacity:.85}
  .opt.disabled:hover{background:inherit;border-color:inherit}
  .lbl{font-weight:700;margin-right:8px;min-width:18px;display:inline-block}
  .fb{display:block;font-size:13px;color:#555;margin-top:8px;
    padding-top:8px;border-top:1px dashed #ddd;font-style:italic;line-height:1.45}
  .submit-row{text-align:center;margin:24px 0}
  .btn{padding:12px 36px;border:none;border-radius:8px;font-size:16px;
    font-weight:600;cursor:pointer;transition:all .12s;background:#b80000;color:#fff}
  .btn:hover{background:#900000}
  .btn:disabled{background:#ccc;cursor:default}
  .result{background:#fff;border:2px solid #b80000;border-radius:12px;padding:28px;
    text-align:center;margin:20px 0}
  .result h2{font-size:24px;color:#b80000}
  .result .score{font-size:48px;font-weight:800;color:#b80000;margin:8px 0;letter-spacing:-1px}
  .result .msg{font-size:16px;color:#555;margin-bottom:12px}
  .review-btn{padding:10px 24px;border:2px solid #b80000;border-radius:8px;
    color:#b80000;font-weight:600;cursor:pointer;background:#fff;margin:4px}
  .review-btn:hover{background:#ffe5e5}
  .retry-btn{padding:10px 24px;border:none;border-radius:8px;
    color:#fff;font-weight:600;cursor:pointer;background:#666;margin:4px}
  .retry-btn:hover{background:#444}
  .nav-dots{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 0 20px}
  .nav-dot{width:30px;height:30px;border-radius:50%;border:2px solid #ddd;cursor:default;
    display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600}
  .nav-dot.correct{border-color:#34a853;color:#1e7e34;background:#e6f4ea}
  .nav-dot.wrong{border-color:#ea4335;color:#c5221f;background:#fce8e6}
  .nav-dot.current{border-color:#b80000;background:#fff5f5}
  .score-bar{height:8px;border-radius:4px;background:#eee;margin:12px auto;max-width:300px;overflow:hidden}
  .score-bar-inner{height:100%;border-radius:4px;background:#34a853;transition:width .4s}
</style>
</head>
<body>
<div class="container" id="app">
  <h1>BBC Learning English — Test Your Level</h1>
  <p class="src">Source: <a href="https://www.bbc.co.uk/learningenglish/english/course/test-your-level" target="_blank">bbc.co.uk/learningenglish</a> · select a test to begin</p>
  <div class="test-tabs" id="testTabs"></div>
  <div id="quizArea"></div>
</div>
<script>
// ====== QUIZ DATA ======
const DATA = ''' + DATA_JSON + r''';

let currentTest = 0;
let answers = {};
let submitted = false;
let reviewMode = false;
let feedbackVisible = false;

const quizArea = document.getElementById('quizArea');
const testTabs = document.getElementById('testTabs');

function initTabs() {
  DATA.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'test-tab' + (i === 0 ? ' active' : '');
    btn.textContent = t.title;
    btn.onclick = () => switchTest(i);
    testTabs.appendChild(btn);
  });
}

function switchTest(idx) {
  currentTest = idx;
  answers = {};
  submitted = false;
  reviewMode = false;
  feedbackVisible = false;
  document.querySelectorAll('.test-tab').forEach((el, i) => {
    el.className = 'test-tab' + (i === idx ? ' active' : '');
  });
  renderQuiz();
}

function renderQuiz() {
  const test = DATA[currentTest];
  const qs = test.questions;
  const correctAns = qs.map((_, i) => getCorrect(i));
  let html = '';

  // navigation dots
  html += '<div class="nav-dots">';
  qs.forEach((_, i) => {
    const ans = answers[i];
    let cls = 'nav-dot';
    if (submitted) cls += ans === correctAns[i] ? ' correct' : ' wrong';
    html += `<div class="${cls}">${i + 1}</div>`;
  });
  html += '</div>';

  // questions
  qs.forEach((q, i) => {
    const sel = answers[i];
    const corr = correctAns[i];
    html += `<div class="question" id="q${i}">`;
    html += `<div class="q-title">Q${i + 1}. ${esc(q.q)}</div>`;
    q.options.forEach(([letter, text, fb]) => {
      let cls = 'opt';
      let showFb = false;
      if (submitted) {
        cls += ' disabled';
        if (letter === corr) cls += ' correct';
        else if (letter === sel) cls += ' wrong';
        showFb = feedbackVisible && (letter === sel || letter === corr);
      } else {
        if (letter === sel) cls += ' selected';
      }
      const onclick = submitted ? '' : `selectOpt(${i},'${letter}')`;
      html += `<div class="${cls}" onclick="${onclick}">`;
      html += `<span class="lbl">${letter})</span>${esc(text)}`;
      if (showFb) html += `<span class="fb">${esc(fb)}</span>`;
      html += '</div>';
    });
    html += '</div>';
  });

  // submit / result
  const allAnswered = qs.every((_, i) => answers[i]);
  if (submitted) {
    const score = qs.filter((_, i) => answers[i] === correctAns[i]).length;
    const pct = Math.round(score / qs.length * 100);
    let msg = '';
    if (pct === 100) msg = 'Perfect score! Excellent work!';
    else if (pct >= 80) msg = 'Great job! Keep practising!';
    else if (pct >= 60) msg = 'Not bad — review the wrong answers below.';
    else msg = 'Keep studying! Check the explanations below.';
    html += `<div class="result">`;
    html += `<h2>${esc(test.title)} — Complete!</h2>`;
    html += `<div class="score">${score} / ${qs.length}</div>`;
    html += `<div class="score-bar"><div class="score-bar-inner" style="width:${pct}%"></div></div>`;
    html += `<div class="msg">${msg}</div>`;
    html += `<button class="review-btn" onclick="toggleReview()">${feedbackVisible ? 'Hide Explanations' : 'Show Explanations'}</button>`;
    html += `<button class="retry-btn" onclick="switchTest(${currentTest})">Retry</button>`;
    html += `</div>`;
  } else {
    html += `<div class="submit-row">`;
    html += `<button class="btn" onclick="submitQuiz()" ${allAnswered ? '' : 'disabled'}>Submit Test</button>`;
    if (!allAnswered) html += `<p style="color:#888;font-size:13px;margin-top:8px">Answer all 15 questions to submit</p>`;
    html += `</div>`;
  }

  quizArea.innerHTML = html;
}

function getCorrect(qIdx) {
  return DATA[currentTest].questions[qIdx].correct;
}

function selectOpt(qIdx, letter) {
  if (submitted) return;
  answers[qIdx] = letter;
  renderQuiz();
}

function submitQuiz() {
  submitted = true;
  feedbackVisible = true;
  renderQuiz();
}

function toggleReview() {
  feedbackVisible = !feedbackVisible;
  renderQuiz();
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

initTabs();
renderQuiz();
</script>
</body>
</html>'''

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "BBC_Test_Your_Level_interactive.html"), "w", encoding="utf-8") as f:
    f.write(HTML)
print(f"Written ({len(HTML)} bytes)")
