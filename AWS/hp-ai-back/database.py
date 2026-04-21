"""Postgres connection pool (asyncpg).

Do not use DSN strings: DB_PASSWORD may contain '#' which breaks URL parsing.
Always pass host, port, user, password, database as separate arguments.
"""
import asyncio

import asyncpg
import prometheus_client
from config import settings

_pool: asyncpg.Pool | None = None

# Prometheus gauges for EKS ServiceMonitor (low cardinality only)
_GAUGE_POOL_SIZE = prometheus_client.Gauge(
    "aiops_db_pool_size",
    "Total number of connections in the asyncpg pool",
)
_GAUGE_POOL_FREE = prometheus_client.Gauge(
    "aiops_db_pool_free",
    "Number of idle connections in the asyncpg pool",
)
_GAUGE_POOL_IN_USE = prometheus_client.Gauge(
    "aiops_db_pool_in_use",
    "Number of connections in use (size - free)",
)


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # Separate args only (no DSN): safe when password contains #, ?, &
        _pool = await asyncpg.create_pool(
            host=settings.db_host,
            port=int(settings.db_port),
            user=settings.db_user,
            password=settings.db_password,
            database=settings.db_name,
            min_size=1,
            max_size=10,
            command_timeout=60,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def update_pool_metrics_loop() -> None:
    """Background task: every 5s update pool gauges. Cancel on app shutdown."""
    while True:
        try:
            pool = await get_pool()
            size = pool.get_size()
            free = pool.get_idle_size()
            in_use = max(size - free, 0)
            _GAUGE_POOL_SIZE.set(size)
            _GAUGE_POOL_FREE.set(free)
            _GAUGE_POOL_IN_USE.set(in_use)
        except Exception:
            # DB unreachable (e.g. local dev): expose gauges as 0 for /metrics
            _GAUGE_POOL_SIZE.set(0)
            _GAUGE_POOL_FREE.set(0)
            _GAUGE_POOL_IN_USE.set(0)
        try:
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            break
