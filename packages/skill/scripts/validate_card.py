#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path


def self_test() -> int:
    payload = {"summary": "ok", "evidence": [{"timestamp_sec": 0, "note": "ok"}]}
    if "summary" not in payload or not payload["evidence"]:
        return 1
    print("validate_card self-test passed")
    return 0


def validate_file(path: Path) -> int:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Invalid JSON: {exc}", file=sys.stderr)
        return 1

    if not isinstance(data, dict):
        print("Card payload must be an object", file=sys.stderr)
        return 1
    if not data.get("summary"):
        print("Missing required field: summary", file=sys.stderr)
        return 1
    evidence = data.get("evidence")
    if not isinstance(evidence, list) or not evidence:
        print("Missing required field: evidence", file=sys.stderr)
        return 1
    print("Card payload passed basic validation")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Tearframe card payloads.")
    parser.add_argument("path", nargs="?", help="Path to a card JSON file")
    parser.add_argument("--self-test", action="store_true", help="Run built-in smoke test")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if not args.path:
        parser.error("path is required unless --self-test is set")
    return validate_file(Path(args.path))


if __name__ == "__main__":
    raise SystemExit(main())
