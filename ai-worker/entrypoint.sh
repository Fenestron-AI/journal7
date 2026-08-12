#!/usr/bin/env bash
# journal7 worker entrypoint:
#   1. start pix2text OCR server (formula recognition) in background
#   2. wait for it (bounded; worker starts anyway if OCR is down)
#   3. start FastAPI worker as the main process
set -uo pipefail

P2T_DEVICE="${P2T_DEVICE:-cpu}"

echo "[entrypoint] starting pix2text serve (device=$P2T_DEVICE)"
p2t serve --device "$P2T_DEVICE" --host 0.0.0.0 --port 8001 \
    --enable-formula --disable-table &
P2T_PID=$!

# Bounded wait: models may download on first run (takes minutes)
for i in $(seq 1 180); do
    if curl -s -o /dev/null --max-time 2 http://127.0.0.1:8001/docs 2>/dev/null; then
        echo "[entrypoint] pix2text ready (${i}s)"
        break
    fi
    if [ $((i % 15)) -eq 0 ]; then
        echo "[entrypoint] pix2text still starting... (${i}s)"
    fi
    sleep 1
done

echo "[entrypoint] starting worker (uvicorn :8000)"
exec uvicorn src.main:app --host 0.0.0.0 --port 8000
