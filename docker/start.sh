#!/bin/sh
set -e

# Create data directories
mkdir -p /app/data /app/files

# Start backend (JSON storage API) on port 3003
cd /app/backend
PORT=3003 npx ts-node src/index.ts &
BACKEND_PID=$!

# Start backend_colab (WebSocket/collaboration) on port 3002
cd /app/backend_colab
PORT=3002 npx ts-node src/index.ts &
BACKEND_COLAB_PID=$!

# Start nginx
nginx -g 'daemon off;' &
NGINX_PID=$!

# Wait for all processes
echo "All services started:"
echo "  - Backend API (PID: $BACKEND_PID, port 3003)"
echo "  - Backend Colab/WS (PID: $BACKEND_COLAB_PID, port 3002)"
echo "  - Nginx (PID: $NGINX_PID, port 80)"

# Trap signals to gracefully shutdown
trap "kill $BACKEND_PID $BACKEND_COLAB_PID $NGINX_PID; exit 0" SIGTERM SIGINT

# Wait for all processes
wait
