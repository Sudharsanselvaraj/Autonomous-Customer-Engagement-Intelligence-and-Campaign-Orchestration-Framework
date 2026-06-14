# Stage 1: Build Next.js frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
# No NEXT_PUBLIC_API_URL needed — frontend uses relative /api/ URLs
RUN npm run build

# Stage 2: Python backend + bundled frontend
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy built frontend into backend/dist so FastAPI can serve it
COPY --from=frontend-builder /frontend/dist ./dist

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
