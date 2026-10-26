import json
import logging
from uuid import uuid4
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from functools import lru_cache

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.services.funds_explorer import FundsExplorerFundData

logger = logging.getLogger(__name__)
_CACHE_PREFIX = "finora:fii:"
_REFRESH_PREFIX = "finora:fii:refresh:"
_SYNC_JOB_PREFIX = "finora:fii:sync-job:"
_RECOMMENDATION_KEY = "finora:recommendations:latest"
_PORTFOLIO_DASHBOARD_KEY = "finora:portfolio-dashboard"
_INTEGRATION_SYNC_HISTORY_KEY = "finora:integrations:sync-history"
_SYNC_JOB_TTL_SECONDS = 3600


@dataclass(frozen=True)
class CachedFundData:
    ticker: str
    name: str
    sector: str | None
    latest_price: Decimal | None
    annual_dividend_yield: Decimal | None
    average_daily_liquidity: Decimal | None
    cached_at: str


class FundCacheError(Exception):
    """Raised when the FII cache cannot be accessed."""


def _sync_job_key(job_id: str) -> str:
    return f"{_SYNC_JOB_PREFIX}{job_id}"


def create_fund_sync_job(tickers: list[str]) -> str:
    job_id = str(uuid4())
    payload = {
        "status": "running",
        "total": len(tickers),
        "processed": 0,
        "failed": 0,
    }
    try:
        get_redis_client().setex(
            _sync_job_key(job_id), _SYNC_JOB_TTL_SECONDS, json.dumps(payload)
        )
    except RedisError as error:
        raise FundCacheError("Não foi possível acompanhar a atualização dos FIIs.") from error
    return job_id


def update_fund_sync_job(job_id: str, *, succeeded: bool) -> None:
    try:
        redis = get_redis_client()
        serialized = redis.get(_sync_job_key(job_id))
        if not serialized:
            return
        payload = json.loads(serialized)
        payload["processed"] = int(payload.get("processed", 0)) + 1
        if not succeeded:
            payload["failed"] = int(payload.get("failed", 0)) + 1
        redis.setex(_sync_job_key(job_id), _SYNC_JOB_TTL_SECONDS, json.dumps(payload))
    except (RedisError, TypeError, ValueError, json.JSONDecodeError):
        logger.warning("Redis is unavailable while updating FII sync job %s", job_id)


def finish_fund_sync_job(job_id: str) -> None:
    try:
        redis = get_redis_client()
        serialized = redis.get(_sync_job_key(job_id))
        if not serialized:
            return
        payload = json.loads(serialized)
        payload["status"] = "completed"
        redis.setex(_sync_job_key(job_id), _SYNC_JOB_TTL_SECONDS, json.dumps(payload))
    except (RedisError, TypeError, ValueError, json.JSONDecodeError):
        logger.warning("Redis is unavailable while completing FII sync job %s", job_id)


def get_fund_sync_job(job_id: str) -> dict[str, int | str] | None:
    try:
        serialized = get_redis_client().get(_sync_job_key(job_id))
    except RedisError as error:
        raise FundCacheError("Não foi possível consultar a atualização dos FIIs.") from error
    if not serialized:
        return None
    try:
        payload = json.loads(serialized)
        return {
            "status": str(payload["status"]),
            "total": int(payload["total"]),
            "processed": int(payload["processed"]),
            "failed": int(payload["failed"]),
        }
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


@lru_cache
def get_redis_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def _key(ticker: str) -> str:
    return f"{_CACHE_PREFIX}{ticker.strip().upper()}"


def get_cached_fund(ticker: str) -> CachedFundData | None:
    try:
        serialized = get_redis_client().get(_key(ticker))
    except RedisError:
        logger.warning("Redis is unavailable while reading FII %s", ticker)
        return None

    if not serialized:
        return None

    try:
        data = json.loads(serialized)
        return CachedFundData(
            ticker=str(data["ticker"]),
            name=str(data["name"]),
            sector=data.get("sector"),
            latest_price=_to_decimal(data.get("latest_price")),
            annual_dividend_yield=_to_decimal(data.get("annual_dividend_yield")),
            average_daily_liquidity=_to_decimal(data.get("average_daily_liquidity")),
            cached_at=str(data["cached_at"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        logger.warning("Ignoring invalid cached FII data for %s", ticker)
        return None


def cache_fund(fund: FundsExplorerFundData) -> None:
    payload = {
        "ticker": fund.ticker,
        "name": fund.name,
        "sector": fund.sector,
        "latest_price": str(fund.latest_price) if fund.latest_price is not None else None,
        "annual_dividend_yield": (
            str(fund.annual_dividend_yield)
            if fund.annual_dividend_yield is not None
            else None
        ),
        "average_daily_liquidity": (
            str(fund.average_daily_liquidity)
            if fund.average_daily_liquidity is not None
            else None
        ),
        "cached_at": datetime.now(UTC).isoformat(),
    }
    try:
        get_redis_client().setex(
            _key(fund.ticker),
            settings.fund_cache_ttl_seconds,
            json.dumps(payload),
        )
    except RedisError:
        logger.warning("Redis is unavailable while caching FII %s", fund.ticker)


def schedule_fund_refresh(tickers: list[str]) -> list[str]:
    scheduled: list[str] = []
    try:
        redis = get_redis_client()
        for ticker in tickers:
            normalized_ticker = ticker.strip().upper()
            if redis.set(
                f"{_REFRESH_PREFIX}{normalized_ticker}",
                "1",
                nx=True,
                ex=300,
            ):
                scheduled.append(normalized_ticker)
    except RedisError:
        logger.warning("Redis is unavailable while scheduling an FII refresh")
    return scheduled


def is_fund_refreshing(ticker: str) -> bool:
    try:
        return bool(get_redis_client().exists(f"{_REFRESH_PREFIX}{ticker.strip().upper()}"))
    except RedisError:
        return False


def finish_fund_refresh(ticker: str) -> None:
    try:
        get_redis_client().delete(f"{_REFRESH_PREFIX}{ticker.strip().upper()}")
    except RedisError:
        logger.warning("Redis is unavailable while completing an FII refresh")


def clear_fund_cache() -> int:
    try:
        redis = get_redis_client()
        keys = list(redis.scan_iter(match=f"{_CACHE_PREFIX}*"))
        keys.append(_RECOMMENDATION_KEY)
        keys.append(_PORTFOLIO_DASHBOARD_KEY)
        return redis.delete(*keys) if keys else 0
    except RedisError as error:
        raise FundCacheError("Não foi possível limpar o cache dos FIIs.") from error


def clear_cached_funds() -> int:
    """Remove only cached FII quotes, preserving planner and dashboard caches."""
    try:
        redis = get_redis_client()
        keys = list(redis.scan_iter(match=f"{_CACHE_PREFIX}*"))
        return redis.delete(*keys) if keys else 0
    except RedisError as error:
        raise FundCacheError("Não foi possível limpar o cache dos FIIs.") from error


def cache_recommendation(payload: dict[str, object]) -> None:
    try:
        get_redis_client().setex(
            _RECOMMENDATION_KEY,
            settings.fund_cache_ttl_seconds,
            json.dumps(payload),
        )
    except RedisError:
        logger.warning("Redis is unavailable while caching FII recommendations")


def get_cached_recommendation() -> dict[str, object] | None:
    try:
        serialized = get_redis_client().get(_RECOMMENDATION_KEY)
    except RedisError:
        logger.warning("Redis is unavailable while reading cached FII recommendations")
        return None

    if not serialized:
        return None

    try:
        payload = json.loads(serialized)
        return payload if isinstance(payload, dict) else None
    except (TypeError, ValueError, json.JSONDecodeError):
        logger.warning("Ignoring invalid cached FII recommendations")
        return None


def clear_recommendation_cache() -> None:
    try:
        get_redis_client().delete(_RECOMMENDATION_KEY)
    except RedisError:
        logger.warning("Redis is unavailable while clearing FII recommendations")


def get_integration_cache_status() -> dict[str, object]:
    """Return the operational data displayed by the integrations settings page."""
    try:
        redis = get_redis_client()
        redis.ping()
        fund_keys = list(redis.scan_iter(match=f"{_CACHE_PREFIX}*"))
        history_raw = redis.lrange(_INTEGRATION_SYNC_HISTORY_KEY, 0, 4)
        history = [json.loads(item) for item in history_raw]
        return {
            "redis_online": True,
            "cached_funds": len(fund_keys),
            "fund_cache_ttl": max(0, redis.ttl(fund_keys[0])) if fund_keys else 0,
            "recommendation_ttl": max(0, redis.ttl(_RECOMMENDATION_KEY)),
            "history": history,
        }
    except (RedisError, TypeError, ValueError, json.JSONDecodeError):
        return {
            "redis_online": False,
            "cached_funds": 0,
            "fund_cache_ttl": 0,
            "recommendation_ttl": 0,
            "history": [],
        }


def append_integration_sync_history(entry: dict[str, object]) -> None:
    try:
        redis = get_redis_client()
        redis.lpush(_INTEGRATION_SYNC_HISTORY_KEY, json.dumps(entry))
        redis.ltrim(_INTEGRATION_SYNC_HISTORY_KEY, 0, 19)
        redis.expire(_INTEGRATION_SYNC_HISTORY_KEY, 60 * 60 * 24 * 30)
    except RedisError:
        logger.warning("Redis is unavailable while recording crawler synchronization history")


def cache_portfolio_dashboard(payload: dict[str, object]) -> None:
    try:
        get_redis_client().setex(
            _PORTFOLIO_DASHBOARD_KEY,
            300,
            json.dumps(payload),
        )
    except RedisError:
        logger.warning("Redis is unavailable while caching portfolio dashboard")


def get_cached_portfolio_dashboard() -> dict[str, object] | None:
    try:
        serialized = get_redis_client().get(_PORTFOLIO_DASHBOARD_KEY)
    except RedisError:
        logger.warning("Redis is unavailable while reading portfolio dashboard")
        return None

    if not serialized:
        return None

    try:
        payload = json.loads(serialized)
        return payload if isinstance(payload, dict) else None
    except (TypeError, ValueError, json.JSONDecodeError):
        logger.warning("Ignoring invalid cached portfolio dashboard")
        return None


def clear_portfolio_dashboard_cache() -> None:
    try:
        get_redis_client().delete(_PORTFOLIO_DASHBOARD_KEY)
    except RedisError:
        logger.warning("Redis is unavailable while clearing portfolio dashboard")


def _to_decimal(value: object) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
