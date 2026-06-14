# Stage 1: Build Next.js frontend (standalone)
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# Stage 2: Node runtime for Next.js + Python for FastAPI
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv gcc nginx supervisor \
    && rm -rf /var/lib/apt/lists/*

# Python venv
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# Next.js standalone
COPY --from=frontend-builder /frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /frontend/public ./frontend/public

COPY nginx-combined.conf /etc/nginx/sites-enabled/default
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 8080
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
