import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import structlog

from app.core.config import settings
from app.db.session import engine, Base
from app.api.routes import customers, orders, segments, campaigns, analytics, ai_copilot, receipts
from app.api.routes import websocket as ws_routes

logger = structlog.get_logger()

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("startup", service="crm", env=settings.ENVIRONMENT)
    yield
    logger.info("shutdown", service="crm")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Injects a unique request_id into every log entry for traceability."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


app.include_router(customers.router, prefix="/api/customers", tags=["customers"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(segments.router, prefix="/api/segments", tags=["segments"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(ai_copilot.router, prefix="/api/copilot", tags=["ai-copilot"])
app.include_router(receipts.router, prefix="/api/receipts", tags=["receipts"])
app.include_router(ws_routes.router, prefix="/ws", tags=["websocket"])


@app.get("/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}
