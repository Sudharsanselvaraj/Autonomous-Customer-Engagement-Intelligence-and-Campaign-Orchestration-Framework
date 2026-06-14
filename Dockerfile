# Stage 1: Build Next.js frontend (standalone)
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# Stage 2: Combined image
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc supervisor nginx curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend source
COPY backend/ ./backend/

# Next.js standalone build
COPY --from=frontend-builder /frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /frontend/public ./frontend/public

# nginx config: / → Next.js:3000, /api/ → FastAPI:8000, /ws/ → FastAPI:8000
COPY nginx-combined.conf /etc/nginx/sites-enabled/default

# supervisord config
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 80
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
