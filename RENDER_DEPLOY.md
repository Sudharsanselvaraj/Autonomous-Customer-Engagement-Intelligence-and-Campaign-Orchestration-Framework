# AsterCRM Render Deployment Guide

This guide deploys AsterCRM to Render using their native services.

## Architecture on Render

| Service | Render Type | Purpose |
|---------|-------------|---------|
| PostgreSQL | Managed PostgreSQL | Primary database |
| Redis | Redis Cloud (Upstash) or KeyDB | Celery broker + cache |
| CRM API | Web Service (Docker) | FastAPI backend |
| CRM Worker | Background Worker (Docker) | Celery worker |
| Channel Simulator | Web Service (Docker) | Stub channel service |
| Channel Worker | Background Worker (Docker) | Celery worker |
| Frontend | Static Site | Next.js exported static |

## Step-by-Step Deployment

### 1. Create PostgreSQL Database
- Go to Render Dashboard → New → PostgreSQL
- Name: `aster-crm-db`
- Plan: Free (or Starter for production)
- Save the **Internal Database URL** — you'll need it

### 2. Create Redis Instance
Option A: Upstash Redis (Free, serverless)
- Go to render.com → Upstash → Create Redis
- Name: `aster-crm-redis`
- Region: same as your PostgreSQL
- Save the **Redis URL** — you'll need it

Option B: KeyDB (Docker service)
- Create a Private Service with Docker image `eqalpha/keydb:latest`
- Command: `keydb-server --appendonly yes`

### 3. Push Code to GitHub
Ensure your repo is public and has all the Render files:
```
render.yaml
backend/Dockerfile
backend/Dockerfile.worker
channel-simulator/Dockerfile
channel-simulator/Dockerfile.worker
frontend/Dockerfile
frontend/nginx.conf
```

### 4. Deploy via Render Blueprint (One-Click)

Go to Render Dashboard → Blueprints → New Blueprint Instance

Paste your GitHub repo URL: `https://github.com/YOUR_USERNAME/aster-crm`

Render will read `render.yaml` and create all services.

### 5. Set Environment Variables (after services are created)

Go to each service → Environment → Add the following:

**CRM API & CRM Worker:**
- `DATABASE_URL` = PostgreSQL internal URL (from step 1)
- `REDIS_URL` = Redis URL (from step 2)
- `CELERY_BROKER_URL` = Redis URL + `/1` (e.g., `redis://.../1`)
- `CELERY_RESULT_BACKEND` = Redis URL + `/2` (e.g., `redis://.../2`)
- `CHANNEL_SIMULATOR_URL` = URL of the Channel Simulator service (e.g., `https://aster-crm-channel.onrender.com`)
- `CRM_RECEIPT_URL` = URL of the CRM API service (e.g., `https://aster-crm-api.onrender.com`)
- `OPENROUTER_API_KEY` = Your OpenRouter API key
- `GEMINI_API_KEY` = Your Gemini API key (optional fallback)
- `SECRET_KEY` = Generate a random 32+ char string

**Channel Simulator & Channel Worker:**
- `CELERY_BROKER_URL` = Same as above
- `CELERY_RESULT_BACKEND` = Same as above
- `CRM_RECEIPT_URL` = URL of CRM API service

**Frontend:**
- `NEXT_PUBLIC_API_URL` = URL of CRM API service + `/api` (e.g., `https://aster-crm-api.onrender.com`)

### 6. Seed Data

After the CRM API is deployed, run the seed scripts:

```bash
# Seed customers and orders
curl -X POST https://aster-crm-api.onrender.com/api/seed/customers

# Seed campaigns with events
curl -X POST https://aster-crm-api.onrender.com/api/seed/campaigns
```

Or use Render Shell to run:
```bash
cd /app && python -m scripts.seed
python -m scripts.seed_campaigns
```

### 7. Verify Deployment

- Frontend: `https://aster-crm-frontend.onrender.com`
- API Health: `https://aster-crm-api.onrender.com/health`
- Channel Health: `https://aster-crm-channel.onrender.com/health`

## Important Notes

1. **Free tier limitations**: Render free services spin down after 15 min of inactivity. First request may take 30-60 seconds to wake up.

2. **WebSocket on Render**: Render free tier doesn't support WebSockets well. The app works without them (polling fallback).

3. **Custom domain**: Add a custom domain on Render for production use.

4. **Database migrations**: The app uses `Base.metadata.create_all()` on startup. For production, switch to Alembic migrations.

5. **Logs**: Check Render dashboard logs for each service.
