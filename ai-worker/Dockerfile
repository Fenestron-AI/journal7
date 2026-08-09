FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi uvicorn pydantic pydantic-settings httpx \
    psycopg2-binary striprtf python-docx pypdf

COPY src/ /app/src/
COPY .env.example /app/.env.example

ENV PYTHONPATH=/app/src
EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
