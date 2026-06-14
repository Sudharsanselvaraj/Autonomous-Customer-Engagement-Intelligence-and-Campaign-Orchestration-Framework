# Railway Deployment Guide — AsterCRM

## Services to create (7 total)

| Service name | Source | Dockerfile |
|---|---|---|
| `postgres` | Railway managed | — |
| `redis` | Railway managed | — |
| `crm-api` | GitHub repo | `backend/Dockerfile` |
| `crm-worker` | GitHub repo | `backend/Dockerfile.worker` |
| `channel-simulator` | GitHub repo | `channel-simulator/Dockerfile` |
| `channel-worker` | GitHub repo | `channel-simulator/Dockerfile.worker` |
| `frontend` | GitHub repo | `frontend/Dockerfile` |

---

## Step 1 — Create project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Empty project**
3. Name it `astercrm`

---

## Step 2 — Add managed databases

### PostgreSQL
- Click **+ New** → **Database** → **PostgreSQL**
- Railway auto-provisions it and sets `DATABASE_URL`

### Redis
- Click **+ New** → **Database** → **Redis**
- Railway auto-provisions it and sets `REDIS_URL`

---

## Step 3 — Deploy backend services from GitHub

### crm-api
1. **+ New** → **GitHub Repo** → select your repo
2. Service name: `crm-api`
3. Root directory: `backend`
4. Railway auto-detects `railway.toml` → uses `backend/Dockerfile`

### crm-worker
1. **+ New** → **GitHub Repo** → same repo
2. Service name: `crm-worker`
3. Root directory: `backend`
4. Override config file: `railway.worker.toml`
   - In Railway dashboard → Settings → Config file path → `railway.worker.toml`

### channel-simulator
1. **+ New** → **GitHub Repo** → same repo
2. Service name: `channel-simulator`
3. Root directory: `channel-simulator`
4. Uses `channel-simulator/railway.toml`

### channel-worker
1. **+ New** → **GitHub Repo** → same repo
2. Service name: `channel-worker`
3. Root directory: `channel-simulator`
4. Override config file: `channel-simulator/railway.worker.toml`

### frontend
1. **+ New** → **GitHub Repo** → same repo
2. Service name: `frontend`
3. Root directory: `frontend`
4. Uses `frontend/railway.toml`

---

## Step 4 — Set environment variables

### crm-api + crm-worker (both need these)

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CELERY_BROKER_URL=${{Redis.REDIS_URL}}
CELERY_RESULT_BACKEND=${{Redis.REDIS_URL}}
CHANNEL_SIMULATOR_URL=http://channel-simulator.railway.internal:${{channel-simulator.PORT}}
CRM_RECEIPT_URL=http://crm-api.railway.internal:${{crm-api.PORT}}
OPENROUTER_API_KEY=<your_groq_key>
OPENROUTER_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=<your_gemini_key>
GEMINI_MODEL=gemini-2.0-flash
SECRET_KEY=<generate_32_char_random_string>
ENVIRONMENT=production
```

### channel-simulator + channel-worker

```
REDIS_URL=${{Redis.REDIS_URL}}
CELERY_BROKER_URL=${{Redis.REDIS_URL}}
CELERY_RESULT_BACKEND=${{Redis.REDIS_URL}}
CRM_RECEIPT_URL=http://crm-api.railway.internal:${{crm-api.PORT}}
```

### frontend

```
NEXT_PUBLIC_API_URL=https://<crm-api-public-url>.railway.app
API_HOST=crm-api.railway.internal:${{crm-api.PORT}}
```

> **Note:** `NEXT_PUBLIC_API_URL` is baked into the static build at build time.
> After setting it, trigger a redeploy of the frontend service.

---

## Step 5 — Seed the database

After `crm-api` is running, open a Railway shell or run via CLI:

```bash
railway run --service crm-api python -c "
from app.db.session import engine
from app.models.models import Base
Base.metadata.create_all(bind=engine)
print('Tables created')
"

# Then seed data
railway run --service crm-api python seed.py
```

Or use the Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway link  # select your project
railway run --service crm-api python seed.py
```

---

## Step 6 — Verify

Check each service is healthy:
- `crm-api` → `https://<crm-api>.railway.app/health` → `{"status": "healthy"}`
- `channel-simulator` → `https://<channel-sim>.railway.app/health`
- `frontend` → open the public URL

---

## Internal networking

Railway services in the same project communicate via private DNS:
```
crm-api           → crm-api.railway.internal
channel-simulator → channel-simulator.railway.internal
postgres          → resolved via ${{Postgres.DATABASE_URL}}
redis             → resolved via ${{Redis.REDIS_URL}}
```

Only the frontend and crm-api need public URLs. All other services are internal only.

---

## Estimated cost

| Resource | Free credit usage |
|---|---|
| PostgreSQL | ~$0.10/GB/month |
| Redis | ~$0.05/GB/month |
| 5 compute services (512MB each) | ~$0.50/service/month |
| **Total** | ~$3-4/month (within $5 free credit) |
