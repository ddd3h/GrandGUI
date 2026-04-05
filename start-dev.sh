#!/bin/bash
# GrandGUI development startup (backend + frontend dev server)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
DATA_DIR="$SCRIPT_DIR/data"

mkdir -p "$DATA_DIR/maps"

# Start backend
echo "Starting backend..."
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt -q
fi

export DATABASE_URL="sqlite:///$DATA_DIR/grandgui.db"
export MAPS_DIR="$DATA_DIR/maps"

.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend dev server..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""

cleanup() {
  echo "Stopping..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait
}

trap cleanup EXIT INT TERM
wait
