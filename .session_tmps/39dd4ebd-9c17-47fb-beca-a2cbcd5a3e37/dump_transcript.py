import json
t = json.load(open("/Users/ryanbzhou/.tearframe/samples/smp_01KSW9VWHNAM6ESPZC3QAFXX5Q/resources/transcript.json"))
segs = t["segments"]
prev = ""
out = []
for s in segs:
    txt = s["text"].strip()
    if txt == prev:
        continue
    out.append("%.1f-%.1f\t%s" % (s["start_sec"], s["end_sec"], txt))
    prev = txt
open("/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/.session_tmps/39dd4ebd-9c17-47fb-beca-a2cbcd5a3e37/transcript.txt", "w").write("\n".join(out))
print("lines", len(out))
