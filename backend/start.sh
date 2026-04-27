#!/bin/bash

# Exit on error
set -e

echo "[START] Running database migrations..."
# Run migrations using Alembic
# Note: Ensure DATABASE_URL is set in your environment variables
alembic upgrade head

echo "[START] Starting SnapMind Production Backend..."
# Start the uvicorn server
# Using 0.0.0.0 for cloud visibility and port 10000 for Render default
exec uvicorn main:app --host 0.0.0.0 --port 10000 --workers 1
