#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Restaurant Continuity Mode"
echo "Preparing a local Python environment..."
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
(sleep 3; open http://127.0.0.1:8765) &
.venv/bin/python run.py
