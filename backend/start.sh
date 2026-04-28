#!/bin/bash

# Exit on error
set -e

# Port configuration
APP_PORT=${PORT:-7860}

echo "[DEBUG] Current Directory: $(pwd)"
echo "[DEBUG] Files in Directory:"
ls -F

echo "[START] Running database migrations..."
# Run migrations using Alembic with explicit config path
if [ -f "alembic.ini" ]; then
    alembic -c alembic.ini upgrade head
else
    echo "[WARNING] alembic.ini not found in $(pwd). Skipping migrations."
fi

echo "[START] Starting SnapMind Production Backend on Port $APP_PORT..."
# Start the uvicorn server
# Using 0.0.0.0 for cloud visibility and the assigned PORT
exec uvicorn main:app --host 0.0.0.0 --port $APP_PORT --workers 1
