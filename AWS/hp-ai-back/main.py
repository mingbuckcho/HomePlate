"""AIOps portal: Alertmanager webhook + cases/snapshots API."""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette_exporter import PrometheusMiddleware, handle_metrics

from config import settings
from database import close_pool, get_pool, update_pool_metrics_loop
from routers import cases, reports, snapshots, summary, webhook


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pool is created lazily on first use so app can start without DB (e.g. local /metrics)
    pool_metrics_task = asyncio.create_task(update_pool_metrics_loop())
    try:
        yield
    finally:
        pool_metrics_task.cancel()
        try:
            await pool_metrics_task
        except asyncio.CancelledError:
            pass
        await close_pool()


app = FastAPI(title="AIOps Portal", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.97:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    PrometheusMiddleware,
    app_name="aiops-backend",
    prefix="aiops",
    group_paths=True,
    skip_paths=["/health", "/metrics"],
    skip_methods=["OPTIONS"],
)

app.add_route("/metrics", handle_metrics)
app.include_router(webhook.router, tags=["webhook"])
app.include_router(cases.router, tags=["cases"])
app.include_router(snapshots.router, tags=["snapshots"])
app.include_router(summary.router)
app.include_router(reports.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.app_port,
        reload=True,
    )
