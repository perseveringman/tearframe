import json, re
t = json.load(open("/Users/ryanbzhou/.tearframe/samples/smp_01KSW9VWHNAM6ESPZC3QAFXX5Q/resources/transcript.json"))
segs = t["segments"]
# Reconstruct full text by tracking growth of rolling captions.
words = []  # list of (time, word)
last_full = ""
for s in segs:
    txt = s["text"].strip()
    start = s["start_sec"]
    if txt == last_full:
        continue
    # find longest suffix of accumulated that is prefix of txt -> append remainder
    if txt.startswith(last_full):
        remainder = txt[len(last_full):].strip()
    else:
        # find overlap
        remainder = txt
        for k in range(min(len(last_full), len(txt)), 0, -1):
            if last_full[-k:] == txt[:k]:
                remainder = txt[k:].strip()
                break
    for w in remainder.split():
        words.append((start, w))
    last_full = txt
# group into ~ lines by time buckets of phrase boundaries: emit every N words with their start time
lines = []
buf = []
buf_start = None
for time, w in words:
    if buf_start is None:
        buf_start = time
    buf.append(w)
    if len(buf) >= 14:
        lines.append("%.1f\t%s" % (buf_start, " ".join(buf)))
        buf = []
        buf_start = None
if buf:
    lines.append("%.1f\t%s" % (buf_start, " ".join(buf)))
open("/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/.session_tmps/39dd4ebd-9c17-47fb-beca-a2cbcd5a3e37/transcript_clean.txt", "w").write("\n".join(lines))
print("clean lines", len(lines), "words", len(words))
