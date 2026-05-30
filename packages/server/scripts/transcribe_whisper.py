#!/usr/bin/env python3
import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper and emit Tearframe transcript JSON.")
    parser.add_argument("audio_path")
    parser.add_argument("--model", default="base")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        print(f"Failed to import faster_whisper: {exc}", file=sys.stderr)
        return 1

    try:
        model = WhisperModel(args.model)
        segments, info = model.transcribe(args.audio_path)
        output = {
            "language": getattr(info, "language", None),
            "segments": [
                {"start": segment.start, "end": segment.end, "text": segment.text.strip()}
                for segment in segments
            ],
        }
        print(json.dumps(output, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(f"Whisper transcription failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
