#!/usr/bin/env python3
"""Compatibility entrypoint for the Tearframe storyline validator."""

from pathlib import Path
import runpy


ROOT = Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT / "packages" / "skill" / "scripts" / "validate_storyline.py"), run_name="__main__")
