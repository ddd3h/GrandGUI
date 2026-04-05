#!/bin/bash
# GrandGUI startup script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
DATA_DIR="$SCRIPT_DIR/data"

# Create data directories
mkdir -p "$DATA_DIR/maps"

# Function to check if port is in use
check_port() {
  lsof -i ":$1" > /dev/null 2>&1
}

# Start backend
echo "Starting backend..."
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt -q
fi

export DATABASE_URL="sqlite:///$DATA_DIR/grandgui.db"
export MAPS_DIR="$DATA_DIR/maps"

.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "Backend started (PID: $BACKEND_PID)"
echo "API: http://localhost:8000"
echo "Docs: http://localhost:8000/docs"

# Wait for backend
sleep 2

# Open browser (macOS)
if command -v open &> /dev/null; then
  open "http://localhost:8000"
fi

# Keep running
wait $BACKEND_PID
