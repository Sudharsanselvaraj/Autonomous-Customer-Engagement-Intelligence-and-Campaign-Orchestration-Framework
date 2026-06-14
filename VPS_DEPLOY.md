# AsterCRM — VPS Deployment (No Domain Required)

Deploy using your VPS's public IP address. All services run via Docker Compose.

## Prerequisites

- VPS with Ubuntu/Debian (2GB+ RAM recommended)
- Docker & Docker Compose installed
- Ports 80, 8000, 8001 open in firewall

## Quick Start

### 1. SSH into your VPS

```bash
ssh root@YOUR_VPS_IP
```

### 2. Install Docker & Docker Compose (if not already)

```bash
curl -fsSL https://get.docker.com | sh
```

### 3. Clone the repo

```bash
git clone https://github.com/Sudharsanselvaraj/AI-Native-Customer-Intelligence-Segmentation-and-Campaign-Orchestration-System.git astercrm
cd astercrm
```

### 4. Create environment file

```bash
cp backend/.env backend/.env.production
```

Edit `backend/.env.production`:

```env
ENVIRONMENT=production
DATABASE_URL=postgresql://crm_user:crm_password_2024@postgres:5432/ceip_crm
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
CHANNEL_SIMULATOR_URL=http://channel-simulator:8000
CRM_RECEIPT_URL=http://crm-api:8000
OPENROUTER_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
SECRET_KEY=change-this-to-a-random-32-char-string
```

Same for `channel-simulator/.env`:

```env
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
CRM_RECEIPT_URL=http://crm-api:8000
```

### 5. Update frontend API URL

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP:8000
```

### 6. Build & run

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 7. Seed demo data

```bash
curl -X POST http://YOUR_VPS_IP:8000/api/analytics/seed
```

### 8. Access the app

- **Frontend**: http://YOUR_VPS_IP
- **API Docs**: http://YOUR_VPS_IP:8000/docs
- **API Health**: http://YOUR_VPS_IP:8000/health

---

## Services Architecture (VPS)

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| Frontend | nginx | 80 | Static site + API proxy |
| CRM API | crm-api | 8000 | FastAPI backend |
| CRM Worker | crm-worker | — | Celery worker |
| Channel Simulator | channel-simulator | 8001 | FastAPI channel simulator |
| Channel Worker | channel-worker | — | Celery worker |
| PostgreSQL | postgres | 5432 | Database |
| Redis | redis | 6379 | Queue + cache |

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service
docker compose -f docker-compose.prod.yml logs -f crm-api

# Restart
docker compose -f docker-compose.prod.yml restart

# Stop
docker compose -f docker-compose.prod.yml down

# Update after git pull
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps
```

## SSL with Let's Encrypt (Optional, Free)

If you want HTTPS later, get a free domain from:
- **DuckDNS** (duckdns.org) — free subdomain
- **Freenom** — free .tk/.ml domains
- **Cloudflare** — free DNS + tunnel

Then use Caddy or Traefik for auto SSL:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.ssl.yml up -d
```

## Troubleshooting

**Port already in use:**
```bash
sudo lsof -i :80
sudo systemctl stop apache2  # or nginx
```

**Out of memory:**
```bash
docker compose -f docker-compose.prod.yml down
# Add swap
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

**Database migrations:**
```bash
docker compose -f docker-compose.prod.yml exec crm-api alembic upgrade head
```
