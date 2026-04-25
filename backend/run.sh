#!/bin/bash
# Narc Kart - Backend Run Script
# Starts the FastAPI server with uvicorn

cd "$(dirname "$0")/.." || exit 1

export DATABASE_PATH="narc_kart.db"
export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"

echo "[NARC KART] Starting API server..."
echo "[NARC KART] Database: $DATABASE_PATH"
echo "[NARC KART] Docs available at http://localhost:8000/docs"

python -m uvicorn backend.api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level info