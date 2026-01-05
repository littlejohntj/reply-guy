#!/bin/bash
# Start the Reply Guy Paste Server

cd "$(dirname "$0")"

# Check if virtual env exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

python server.py
