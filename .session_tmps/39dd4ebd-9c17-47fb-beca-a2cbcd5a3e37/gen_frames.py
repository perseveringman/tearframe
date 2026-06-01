#!/usr/bin/env python3
"""Agent-side frame generation fallback for AV1/non-full-range sources.

Tearframe's built-in FramesPipeline fails on this sample because the source is
AV1 with non-standard YUV range and the system ffmpeg mjpeg encoder rejects it.
We reproduce the exact same output contract (filenames + index.json schema) so the
result can be registered through sample.upload_resource (the protocol-sanctioned
agent-generated-resource path), without bypassing Tearframe's data model.
"""
import json
import os
import subprocess
import sys

DATA_ROOT = os.path.expanduser("~/.tearframe")
SAMPLE_ID = "smp_01KSW9VWHNAM6ESPZC3QAFXX5Q"
SAMPLE_DIR = os.path.join(DATA_ROOT, "samples", SAMPLE_ID)
VIDEO = os.path.join(SAMPLE_DIR, "source.mp4")
FRAMES_DIR = os.path.join(SAMPLE_DIR, "resources", "frames")
SHOTS = os.path.join(SAMPLE_DIR, "resources", "shots.json")

os.makedirs(FRAMES_DIR, exist_ok=True)

with open(SHOTS) as f:
    shots = json.load(f)


def round_ts(v):
    return round(v * 1000) / 1000


def fmt_ts(v):
    # mirror FramesPipeline.formatTimestamp
    if float(v).is_integer():
        return str(int(v))
    s = ("%f" % v).rstrip("0").rstrip(".")
    return s


index = []
errors = 0
for shot in shots:
    ts = round_ts((shot["start_sec"] + shot["end_sec"]) / 2)
    fname = "shot_%03d_t%ss.jpg" % (shot["index"], fmt_ts(ts))
    fpath = os.path.join(FRAMES_DIR, fname)
    rel = os.path.relpath(fpath, DATA_ROOT)
    if not os.path.exists(fpath):
        cmd = [
            "ffmpeg", "-y", "-ss", str(ts), "-i", VIDEO,
            "-frames:v", "1", "-vf", "format=yuvj420p",
            "-pix_fmt", "yuvj420p", "-q:v", "2", fpath,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(fpath):
            errors += 1
            sys.stderr.write("FAIL shot %d\n%s\n" % (shot["index"], r.stderr[-400:]))
            continue
    index.append({
        "shot_index": shot["index"],
        "timestamp_sec": ts,
        "path": rel,
    })

with open(os.path.join(os.path.dirname(__file__), "frames_index.json"), "w") as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print("generated", len(index), "frames, errors", errors)
