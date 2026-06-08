FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# Apply the core schema on a fresh DB (idempotent — no-op if it already exists), then serve.
CMD ["sh", "-c", "python -m backend.db.init && uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
