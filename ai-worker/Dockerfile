# journal7 AI worker — everything in one container:
#   FastAPI worker (sync/ingest/QA) + pix2text OCR server (formula recognition)
#   + LibreOffice (WMF/EMF -> PNG) + poppler (PDF page -> PNG).
#
# Build:   docker build -t journal7/worker:gpu --build-arg P2T_DEVICE=gpu ai-worker
# Default: CPU (onnxruntime). GPU profile installs onnxruntime-gpu (needs
# nvidia-container-toolkit on the host; falls back to CPU EP without GPU).

FROM python:3.12-slim

ARG P2T_DEVICE=cpu
ENV P2T_DEVICE=${P2T_DEVICE}
ENV PYTHONPATH=/app/src
ENV FORMULA_OCR_URL=http://localhost:8001
ENV WATCH_DIR=/app/data/legal-docs

# LibreOffice for WMF/EMF rasterization (writer = DOCX, draw = WMF/EMF filters),
# poppler for PDF pages, curl for healthchecks.
# libgl1/libglib2.0-0 — runtime deps of opencv (pulled by pix2text)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice-writer \
        libreoffice-draw \
        poppler-utils \
        fonts-dejavu-core \
        libgl1 \
        libglib2.0-0 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# pix2text (formula OCR server) — pinned to the version validated in the pilot.
# Installed BEFORE worker deps so that edits to the worker layer don't
# invalidate the heavy pix2text layer (torch ~500MB) on every rebuild.
RUN pip install --no-cache-dir pix2text==1.1.6

# ONNX runtime: CPU by default; GPU variant when building the gpu profile
RUN if [ "$P2T_DEVICE" = "gpu" ]; then \
        pip install --no-cache-dir --upgrade onnxruntime-gpu; \
    else \
        pip install --no-cache-dir onnxruntime; \
    fi

# Bake pix2text models (~0.5-1 GB) into the image layer.
# NOTE: heredocs/multi-line RUN do not work with the legacy builder — script file.
# Best effort: if HuggingFace is unreachable during build, models are
# downloaded lazily on first startup instead (pipeline tolerates it).
# Kept BEFORE worker deps so edits to the worker layer don't invalidate the bake.
COPY bake_models.py /app/bake_models.py
RUN python /app/bake_models.py

# Worker dependencies (lxml comes with python-docx, pinned explicitly)
RUN pip install --no-cache-dir \
    fastapi uvicorn pydantic pydantic-settings httpx \
    psycopg2-binary striprtf python-docx pypdf lxml \
    python-multipart beautifulsoup4 python-dotenv

COPY src/ /app/src/
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000 8001

CMD ["/app/entrypoint.sh"]
