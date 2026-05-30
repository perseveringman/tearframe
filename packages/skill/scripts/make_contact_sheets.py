#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path


def load_cv2():
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception as exc:
        local_python = next((parent / ".venv" / "bin" / "python" for parent in Path(__file__).resolve().parents if (parent / ".venv" / "bin" / "python").exists()), None)
        if local_python and Path(sys.prefix).resolve() != local_python.parents[1].resolve():
            os.execv(str(local_python), [str(local_python), *sys.argv])
        print(
            "make_contact_sheets requires opencv-python. Install project deps with `.venv/bin/pip install scenedetect[opencv]` or run the Tearframe setup script.",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc
    return cv2, np


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate large storyboard contact sheets from Tearframe frames.")
    parser.add_argument("--frames", required=True, help="Path to resources/frames/index.json")
    parser.add_argument("--shots", required=True, help="Path to resources/shots.json")
    parser.add_argument("--sample-root", required=True, help="Root folder that contains sample-relative frame paths, usually ~/.tearframe")
    parser.add_argument("--out", required=True, help="Output directory for generated sheets")
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--rows", type=int, default=3)
    parser.add_argument("--thumb-width", type=int, default=420)
    parser.add_argument("--thumb-height", type=int, default=236)
    args = parser.parse_args()

    cv2, np = load_cv2()
    frames = json.loads(Path(args.frames).read_text(encoding="utf-8"))
    shots = {int(shot["index"]): shot for shot in json.loads(Path(args.shots).read_text(encoding="utf-8"))}
    sample_root = Path(args.sample_root).expanduser()
    out = Path(args.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)

    cols, rows = args.cols, args.rows
    thumb_w, thumb_h = args.thumb_width, args.thumb_height
    label_h, pad = 50, 18
    sheet_w = cols * thumb_w + (cols + 1) * pad
    sheet_h = rows * (thumb_h + label_h) + (rows + 1) * pad
    bg = np.array([20, 20, 18], dtype=np.uint8)
    label_bg = np.array([34, 34, 30], dtype=np.uint8)
    font = cv2.FONT_HERSHEY_SIMPLEX

    for old in out.glob("*.jpg"):
        old.unlink()

    page_size = cols * rows
    for page_start in range(0, len(frames), page_size):
        page = frames[page_start : page_start + page_size]
        sheet = np.empty((sheet_h, sheet_w, 3), dtype=np.uint8)
        sheet[:] = bg

        for n, frame in enumerate(page):
            r, c = divmod(n, cols)
            x = pad + c * (thumb_w + pad)
            y = pad + r * (thumb_h + label_h + pad)
            img = cv2.imread(str(sample_root / frame["path"]))
            if img is None:
                img = np.zeros((thumb_h, thumb_w, 3), dtype=np.uint8)
            h, w = img.shape[:2]
            scale = min(thumb_w / w, thumb_h / h)
            resized = cv2.resize(img, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
            tile = np.zeros((thumb_h, thumb_w, 3), dtype=np.uint8)
            oy = (thumb_h - resized.shape[0]) // 2
            ox = (thumb_w - resized.shape[1]) // 2
            tile[oy : oy + resized.shape[0], ox : ox + resized.shape[1]] = resized
            sheet[y : y + thumb_h, x : x + thumb_w] = tile
            sheet[y + thumb_h : y + thumb_h + label_h, x : x + thumb_w] = label_bg

            idx = int(frame["shot_index"])
            shot = shots[idx]
            label = f"Shot {idx:03d}  {shot['start_sec']:.3f}-{shot['end_sec']:.3f}s  key {float(frame['timestamp_sec']):.3f}s"
            cv2.putText(sheet, label, (x + 10, y + thumb_h + 20), font, 0.55, (238, 238, 238), 1, cv2.LINE_AA)
            cv2.putText(sheet, Path(frame["path"]).name, (x + 10, y + thumb_h + 40), font, 0.42, (168, 168, 160), 1, cv2.LINE_AA)

        sheet_path = out / f"contact_sheet_{page_start // page_size:02d}_{int(page[0]['shot_index']):03d}-{int(page[-1]['shot_index']):03d}.jpg"
        cv2.imwrite(str(sheet_path), sheet, [int(cv2.IMWRITE_JPEG_QUALITY), 92])

    print(f"Generated {len(list(out.glob('*.jpg')))} contact sheets in {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
