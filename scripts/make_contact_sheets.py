#!/usr/bin/env python3
"""Compatibility entrypoint for the Tearframe contact sheet generator."""

import os
import sys
from pathlib import Path
import runpy


ROOT = Path(__file__).resolve().parents[1]
LOCAL_PYTHON = ROOT / ".venv" / "bin" / "python"
if LOCAL_PYTHON.exists() and Path(sys.prefix).resolve() != (ROOT / ".venv").resolve():
    os.execv(str(LOCAL_PYTHON), [str(LOCAL_PYTHON), *sys.argv])

runpy.run_path(str(ROOT / "packages" / "skill" / "scripts" / "make_contact_sheets.py"), run_name="__main__")
