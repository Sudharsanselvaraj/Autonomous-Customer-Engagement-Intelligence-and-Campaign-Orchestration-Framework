<div align="center">

<img src="assets/ChatGPT Image Jun 12, 2026, 07_00_08 PM (1).png" alt="AsterCRM Logo" width="280"/>

### Autonomous Customer Engagement Intelligence Platform

*An AI-native Mini CRM built for the Xeno Engineering Take-Home Assignment*

<br/>

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Celery](https://img.shields.io/badge/Celery-5-37814A?logo=celery)](https://docs.celeryq.dev)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Railway](https://img.shields.io/badge/Deployed%20on-Railway-0B0D0E?logo=railway)](https://railway.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## The Bet I Made

The Xeno brief was intentionally open. Rather than building a shallow feature list, I made one opinionated architectural bet: **make the AI the primary interface, not a sidebar**.

AsterCRM is built around a conversational copilot that can plan, create, and execute entire campaign workflows from a single natural-language goal — with a human approval gate before anything irreversible happens. The marketer describes intent; the AI figures out the segment, generates the campaign copy, recommends the channel, and launches — while the marketer stays in control.

The rest of the stack (two-service async delivery loop, materialized analytics, WebSocket streaming) exists to make that AI interaction feel real and trustworthy.

---

## Live Demo

| Surface | URL |
|----------|----------|
| **Frontend Application** | https://astercrm.up.railway.app |
| **Walkthrough Video** | https://www.loom.com/share/21362c509cd749ea875047d165d9c671 |
| **Architecture Diagram** | https://tinyurl.com/ArchitectureAstercrm |

> **Seed data:** 10,000 customers · 50,000 orders · 7 pre-built smart segments — all generated with realistic Indian demographics, purchase history, and multi-channel engagement patterns.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The AI-Native Core — Agentic Copilot](#the-ai-native-core--agentic-copilot)
3. [Campaign Delivery Loop](#campaign-delivery-loop)
4. [Data Model](#data-model)
5. [Feature Walkthrough](#feature-walkthrough)
6. [API Reference](#api-reference)
7. [System Design Decisions](#system-design-decisions)
8. [Scalability Analysis](#scalability-analysis)
9. [Running Locally](#running-locally)
10. [Tests](#tests)
11. [Architecture Decision Records](#architecture-decision-records)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (port 3000)                  │
│  Dashboard · Customers · Segments · Campaigns · Analytics        │
│  AI Copilot (plan → approve → execute) · Mission Control         │
│  WebSocket client — live campaign event streaming                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼─────────────────────────────────────┐
│                FastAPI CRM Service (port 8000)                   │
│                                                                  │
│  /api/customers    /api/orders      /api/segments                │
│  /api/campaigns    /api/analytics   /api/copilot                 │
│  /api/receipts     /ws/campaigns/{id}                            │
│                                                                  │
│  Services: CustomerSvc · SegmentSvc · CampaignSvc · AISvc        │
│  Workers:  CampaignWorker  ·  AnalyticsWorker                    │
├──────────────┬──────────────────────────┬────────────────────────┤
│  PostgreSQL  │  Redis                   │  OpenRouter / Groq     │
│  (8 tables)  │  Task broker + cache     │  NL→SQL · Campaign gen │
│              │                          │  Copilot · Insights    │
└──────────────┴──────────┬───────────────┴────────────────────────┘
                          │ POST /send (per communication)
┌─────────────────────────▼────────────────────────────────────────┐
│            Channel Simulator Service (port 8001)                 │
│                                                                  │
│  POST /send  →  Celery task  →  simulate delivery lifecycle      │
│                                                                  │
│  Per-channel probability profiles:                               │
│  WhatsApp  delivered 92% · opened 78% · clicked 22%              │
│  Email     delivered 88% · opened 35% · clicked 12%              │
│  SMS       delivered 95% · opened 90% · clicked  8%              │
│  RCS       delivered 85% · opened 60% · clicked 18%              │
└─────────────────────────┬────────────────────────────────────────┘
                          │ POST /api/receipts/webhook (async callbacks)
                          └──────────────▶ CRM closes the event loop
```

**Seven Docker services:** `postgres` · `redis` · `crm` (FastAPI) · `crm-worker` (Celery) · `channel-simulator` (FastAPI) · `channel-worker` (Celery) · `frontend` (Next.js 15)

All services deployed on **Railway** via Docker Compose.

---

## The AI-Native Core — Agentic Copilot

This is where I spent the most design effort. The copilot (Ask Aster) is a Groq-powered agent with **six registered tools** that perform real CRM operations, with Gemini as automatic fallback on rate limits.

### Available Tools

| Tool | What it does |
|------|-------------|
| `plan_workflow` | Takes a high-level goal, queries live analytics, returns a complete execution plan — requires human approval before proceeding |
| `create_segment` | Translates natural language into a safe PostgreSQL WHERE clause, counts the audience, saves the segment |
| `create_campaign` | AI-generates campaign name, copy, channel recommendation, and expected engagement — saves to DB |
| `launch_campaign` | Enqueues the Celery dispatch task; transitions status to RUNNING |
| `get_analytics` | Fetches live dashboard KPIs for the AI to reason about |
| `list_segments` | Returns current segments with audience sizes |

### Agentic Loop

The copilot runs a **standard tool-calling loop** (up to 3 iterations). The `plan_workflow` tool is the only one that returns `requires_approval: true` — this is the human-in-the-loop gate before any multi-step irreversible action.

```
Marketer: "Re-engage beauty shoppers who haven't bought in 45 days"

AI calls: plan_workflow(goal="...")
  → Returns plan:
    {
      "segment": { "name": "Lapsed Beauty Shoppers", "nl": "customers who bought in beauty
                    category but have no orders in the last 45 days" },
      "campaign": { "name": "We Miss You", "channel": "whatsapp", "confidence": 0.87 },
      "expected_outcomes": { "audience_size": "~1,240", "open_rate": 0.72 },
      "steps": ["create_segment", "create_campaign", "launch_campaign"],
      "requires_approval": true
    }

Marketer: "Looks good, go ahead"

AI calls: create_segment(...)   → segment_id
AI calls: create_campaign(...)  → campaign_id
AI calls: launch_campaign(...)  → status: running

AI: "Done. Campaign launched to 1,247 lapsed beauty shoppers via WhatsApp.
     Estimated 900 opens and 272 clicks based on current channel benchmarks."
```

### NL → SQL Safety

When creating segments from natural language, the LLM generates **only a WHERE clause** — no SELECT, no DDL. The backend validates through four layers before execution:

1. **DDL/DML blocklist** — rejects `DROP`, `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`, `ALTER`, `CREATE`
2. **Semicolon rejection** — prevents statement chaining
3. **Comment sequence rejection** — blocks `--`, `/*`, `*/`
4. **Schema exfiltration rejection** — blocks `information_schema`, `pg_catalog`, `pg_class`

The resulting clause is wrapped in a read-only CTE and executed against a schema-scoped query.

---

## Campaign Delivery Loop

```
Marketer           Frontend           CRM API            Celery            Channel Sim
    │                  │                  │               Worker                │
    │── launch ───────▶│                  │                  │                  │
    │                  │── POST /launch ─▶│                  │                  │
    │                  │                  │── enqueue ──────▶│                  │
    │                  │◀─ status:RUNNING─│  dispatch_       │                  │
    │                  │                  │  campaign        │                  │
    │                  │                  │                  │── POST /send ───▶│
    │                  │                  │                  │  (per customer)  │
    │                  │                  │                  │                  │── Celery task
    │                  │                  │◀─────────────────────────────────── │  (async)
    │                  │                  │  POST /receipts/webhook SENT        │
    │                  │                  │── update analytics                  │
    │                  │◀─ WS broadcast ──│  broadcast SENT                     │
    │  live dashboard  │                  │                  │                  │
    │  updates         │                  │◀──────────────────── DELIVERED ────▶│
    │                  │◀─ WS broadcast ──│  DELIVERED                          │
    │                  │                  │                  │   ... OPENED, CLICKED, CONVERTED
```

**Idempotency:** Each communication has a `campaign_id:customer_id` idempotency key — prevents duplicate sends on Celery retry. Receipt events skip duplicates; status transitions are forward-only (PENDING → SENT → DELIVERED, never backwards).

**Bulk webhook:** `POST /api/receipts/webhook/bulk` handles batch event ingestion with per-event failure isolation — one bad event doesn't abort the batch.

---

## Data Model

```
customers
│ id · name · email (unique) · phone · city · gender · age · created_at
│
│  1:N
▼
orders                         segments
│ id · customer_id (FK)        │ id · name · description
│ amount · category            │ query_definition (JSON WHERE clause)
│ purchase_date                │ estimated_size · is_smart · created_at
│ channel · status             │
                               │ 1:N
                               ▼
                            campaigns
                            │ id · name · description · channel (enum)
                            │ segment_id (FK) · status (enum)
                            │ message_template · ai_generated
                            │ expected_open_rate · expected_conversion_rate
                            │ started_at · completed_at
                            │
                            │ 1:N
                            ▼
                         communications ◄──── customers (FK)
                         │ id · campaign_id (FK) · customer_id (FK)
                         │ message · status (enum) · channel
                         │ sent_at · idempotency_key (unique)
                         │
                         ├──▶ communication_events
                         │    │ id · communication_id (FK)
                         │    │ event_type (SENT|DELIVERED|OPENED|READ|CLICKED|CONVERTED)
                         │    │ event_time · metadata (JSON)
                         │
                         └──▶ channel_logs
                              │ id · communication_id (FK)
                              │ payload · response (JSON)

campaigns ──▶ campaign_analytics  (1:1 materialized row)
             │ campaign_id (FK, unique)
             │ total_sent · total_delivered · total_failed
             │ total_opened · total_read · total_clicked · total_converted
             │ delivery_rate · open_rate · click_rate · conversion_rate
             │ updated_at
```

---

## Feature Walkthrough

### Customer & Order Ingestion
REST API for individual records + CSV bulk import with validation. Paginated list view with search by name/email and filter by city. VIP/Active/At Risk/Dormant/New tiering computed from purchase frequency and recency. Customer detail page shows full order history and communication timeline.

### AI Segment Builder
Describe an audience in plain English — "high-value customers from Mumbai who bought electronics in the last 90 days" — and AsterCRM translates it to SQL, previews audience size and estimated revenue, and stores the segment with its query definition for full auditability.

### Campaign Engine
- **AI Generate:** Give a campaign goal; the LLM returns a structured JSON with name, message copy, recommended channel, and expected engagement rates
- **Templates:** Win-Back, VIP Loyalty, Festival Sale, Cart Recovery, Product Launch, Birthday Rewards — each with pre-computed benchmarks
- **Launch:** Enqueues Celery task; transitions to RUNNING immediately; WebSocket streams real-time delivery events to the dashboard

### Real-Time Analytics Dashboard
WebSocket connection to `/ws/campaigns/{id}` streams events as they arrive from the channel simulator. Dashboard updates delivery/open/click/conversion funnels without polling.

### Predictions
Statistical revenue forecast (next 6 months, 95% confidence), churn risk segmentation, segment growth projections, and AI insight cards that surface the next best action.

### Mission Control
Unified command center with live campaign status, running KPIs, quick-action shortcuts, and a live alerts feed.

---

## API Reference

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/customers` | Paginated list — search, city filter |
| `POST` | `/api/customers` | Create customer |
| `GET` | `/api/customers/{id}` | Customer + full order history |
| `PATCH` | `/api/customers/{id}` | Update customer |
| `POST` | `/api/customers/import/csv` | Bulk CSV import |

### Segments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/segments` | List segments |
| `POST` | `/api/segments/from-nl` | **Natural language → segment** |
| `GET` | `/api/segments/{id}/customers` | Audience members |
| `POST` | `/api/segments/{id}/refresh-size` | Recount audience |

### Campaigns
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/campaigns` | List with status filter |
| `POST` | `/api/campaigns` | Create campaign |
| `POST` | `/api/campaigns/generate` | **AI-generate campaign details** |
| `GET` | `/api/campaigns/{id}` | Campaign + analytics |
| `POST` | `/api/campaigns/{id}/launch` | Launch campaign |
| `GET` | `/api/campaigns/{id}/analytics` | Full funnel metrics |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/dashboard` | Global KPIs, trends, channel breakdown |
| `GET` | `/api/analytics/insights` | **AI-generated actionable insights** |

### AI Copilot
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/copilot` | Multi-turn chat with tool-calling |

### Receipts (Channel Callbacks)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/receipts/webhook` | Single event callback |
| `POST` | `/api/receipts/webhook/bulk` | Batch event ingestion with per-event isolation |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `WS /ws/campaigns/{campaign_id}` | Live event stream for a campaign |

---

## System Design Decisions

### Why two separate services?

Real channel providers (Twilio, MSG91, SendGrid) are **not synchronous**. You fire a request; they acknowledge receipt; delivery events trickle in asynchronously over minutes. Merging the simulator into the CRM would let me cheat — I'd have direct function calls instead of the actual async callback pattern. The two-service loop forces proper queuing, retries, and event ordering the way production code must handle it.

See [ADR-001](docs/adr/ADR-001-two-service-channel-architecture.md).

### Why Celery + Redis, not background threads?

Campaign dispatch against 10,000 customers cannot block an HTTP request. Celery gives retry logic (`max_retries=3, default_retry_delay=30`), queue isolation (`campaigns` and `analytics` are separate queues so a slow analytics recompute can't starve campaign dispatch), and horizontal scaling without touching application code.

See [ADR-002](docs/adr/ADR-002-celery-redis-async-workers.md).

### Idempotency everywhere

- **Dispatch:** `idempotency_key = campaign_id:customer_id` on the `communications` table. A second enqueue on retry hits a UNIQUE constraint and no-ops.
- **Receipts:** Duplicate event detection checks `communication_events` before insert. Status transitions are forward-only — a late SENT event after DELIVERED is silently discarded.

### Materialized analytics

Rather than aggregating `communication_events` on every dashboard read, a Celery `update_analytics` task recomputes one `campaign_analytics` row per event. Dashboard reads are O(1) — a single lookup. Tradeoff: brief lag between event arrival and dashboard update (typically < 1 second).

See [ADR-003](docs/adr/ADR-003-materialized-analytics-pattern.md).

### AI model routing

Primary: Groq (Llama) via tool-calling loop. Fallback: Gemini on 429s. `_call_with_fallback` handles the switch transparently. This lets me swap models per endpoint without changing application code.

See [ADR-004](docs/adr/ADR-004-ai-copilot-tool-calling.md).

---

## Scalability Analysis

### Current scope
10,000 customers · 50,000 orders — all queries sub-second with existing composite indexes.

### Bottlenecks at 10× (100K customers, 50+ concurrent campaigns)

| Bottleneck | Current approach | At 10× |
|------------|-----------------|--------|
| Campaign dispatch | Single Celery queue, HTTP per message | Partition by channel; replace HTTP with SQS/Kafka |
| Analytics recompute | Full row update on each event | Incremental Redis counters; flush to Postgres in batch |
| NL→SQL latency | ~1.5s LLM call | Cache identical queries 30-min TTL in Redis |
| WebSocket broadcasting | In-memory `ConnectionManager` | Redis pub/sub for multi-instance fanout |
| Audience ID fetch | All IDs into Python memory | Cursor pagination with `LIMIT/OFFSET` batching |

### What I consciously did not build
Rate limiting on the receipt webhook, dead-letter queues for failed Celery tasks, read replicas, Redis pub/sub for WebSocket, and JWT auth — all clear next steps at production scale.

---

## Running Locally

### Docker Compose (recommended)

```bash
# 1. Configure
cp backend/.env.example backend/.env
# Set OPENROUTER_API_KEY and GROQ_API_KEY in backend/.env

# 2. Start all 7 services
docker compose up -d

# 3. Run migrations + seed 10K customers + 50K orders
docker compose exec crm alembic upgrade head
docker compose exec crm python -m scripts.seed

# 4. Open http://localhost:3000
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL 15 |
| `redis` | 6379 | Redis 7 |
| `crm` | 8000 | FastAPI CRM API + WebSocket |
| `crm-worker` | — | Celery (campaigns + analytics queues) |
| `channel-simulator` | 8001 | Channel delivery simulator |
| `channel-worker` | — | Celery for delivery simulation |
| `frontend` | 3000 | Next.js 15 |

### Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/astercrm
REDIS_URL=redis://localhost:6379/0
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
CHANNEL_SIMULATOR_URL=http://localhost:8001
CRM_WEBHOOK_URL=http://localhost:8000
```

---

## Tests

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest -v
```

| Test module | Coverage |
|-------------|---------|
| `test_customers.py` | CRUD, pagination, search, 409 on duplicate email |
| `test_segments.py` | NL creation (mocked AI), SQL safety blocklist |
| `test_campaigns.py` | Full lifecycle: create → AI generate → launch; double-launch rejection |
| `test_receipts.py` | Idempotency, forward-only status, bulk webhook, unknown comm 404 |
| `test_analytics.py` | Dashboard structure, insights endpoint, health check |
| `test_copilot.py` | Chat with and without history, AI error handling, validation |

---

## Architecture Decision Records

| ADR | Decision | Rationale |
|-----|----------|-----------|
| [ADR-001](docs/adr/ADR-001-two-service-channel-architecture.md) | Two-service channel architecture | Mirrors real async delivery; forces proper callback handling |
| [ADR-002](docs/adr/ADR-002-celery-redis-async-workers.md) | Celery + Redis for async workers | Non-blocking dispatch; retry logic; independent queue scaling |
| [ADR-003](docs/adr/ADR-003-materialized-analytics-pattern.md) | Materialized analytics rows | O(1) dashboard reads vs slow event aggregation |
| [ADR-004](docs/adr/ADR-004-ai-copilot-tool-calling.md) | Claude tool-calling for copilot | Structured real operations, not just text responses |

---

## Assignment Requirement → Implementation Mapping

| # | Requirement | Implementation | Key Files |
|---|------------|----------------|-----------|
| 1 | Customer ingestion | `POST /api/customers` · CSV bulk import | `routes/customers.py` · `services/customer_service.py` |
| 2 | Order ingestion | `POST /api/orders` · automatic aggregation | `routes/orders.py` · `models/models.py` |
| 3 | Audience segmentation | NL→SQL via LLM with 4-layer safety validation | `services/segment_service.py` · `services/ai_service.py` |
| 4 | AI-generated campaigns | LLM produces name, copy, channel, expected engagement | `routes/campaigns.py` · `services/ai_service.py` |
| 5 | Campaign delivery | Celery → HTTP → Channel Simulator per customer | `workers/campaign_worker.py` · `channel-simulator/` |
| 6 | Delivery receipts | Webhook → idempotency check → forward-only status guard | `routes/receipts.py` · `workers/analytics_worker.py` |
| 7 | Campaign analytics | Materialized `CampaignAnalytics` updated per event | `models/models.py` · `workers/analytics_worker.py` |
| 8 | Dashboard / reporting | Overview, Analytics, Predictions pages | `frontend/src/app/(crm)/` |
| 9 | Real-time updates | WebSocket `/ws/campaigns/{id}` with auto-reconnect | `core/ws_manager.py` · `routes/websocket.py` |
| 10 | AI Copilot | 6 tools, 3-iteration agentic loop, plan_workflow approval gate | `routes/ai_copilot.py` · `services/ai_service.py` |
| 11 | Channel simulation | Separate FastAPI + Celery service, per-channel probability profiles | `channel-simulator/app/` |
| 12 | Scalability clarity | Two-service async delivery, queue separation, materialized analytics, 4 ADRs | `docs/adr/` |

---

## Tradeoffs I'd Change at Scale

1. **Webhook ingestion** — currently a synchronous FastAPI endpoint. At high volume I'd front it with a Kafka topic and have the analytics worker consume idempotently.
2. **NL→SQL caching** — identical queries hit the LLM every time. A 30-minute Redis cache keyed on the normalized query string would cut cost and latency significantly.
3. **WebSocket fanout** — the in-memory `ConnectionManager` doesn't work across multiple CRM instances. Redis pub/sub is the obvious fix.
4. **Audience ID fetch** — `get_audience_ids` loads all matching IDs into Python memory. At 100K+ rows this needs cursor-based batching.
5. **Auth** — deliberately omitted for this assignment. Production would need JWT/session auth before the first PR merges.

---

<div align="center">

Built for the Xeno Engineering Take-Home Assignment · June 2026

</div>
