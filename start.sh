#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== journal7 startup ==="

# Kill only the app JVM process, never by project name
pkill -f 'journal7.ApplicationKt' 2>/dev/null || true
pkill -f 'gradlew :app:run' 2>/dev/null || true
pkill -f 'uvicorn src.main:app' 2>/dev/null || true
pkill -f 'node_modules/.bin/vite' 2>/dev/null || true
sleep 2

# Docker
docker-compose up -d

# Wait for DB
echo "Waiting for PostgreSQL..."
until docker exec journal7-db pg_isready -U journal7 2>/dev/null; do sleep 1; done
echo "PostgreSQL ready"

# Backend
nohup bash -c './gradlew :app:run' &>/tmp/backend.log & disown

# Frontend
nohup bash -c 'cd frontend && exec npx vite --host 0.0.0.0 --port 5173' &>/tmp/frontend.log & disown

# AI Worker (uses setsid to survive shell timeouts)
setsid bash -c 'cd ai-worker && exec env PYTHONPATH=src ./venv/bin/python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8000' </dev/null &>/tmp/ai-worker.log & disown

echo ""
echo "Waiting for backend (Kotlin compilation + start)..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:8080/ 2>/dev/null; then
    echo "Backend ready"
    break
  fi
  sleep 2
done

echo ""
echo "=== Services ==="
echo "Frontend : http://localhost:5173"
echo "Backend  : http://localhost:8080"
echo "Worker   : http://localhost:8000/docs"
echo "Login    : admin / admin123"
echo "=== Ready ==="
