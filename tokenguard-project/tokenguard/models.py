from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UsageEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: str = Field(index=True, unique=True)
    tenant_id: str = Field(index=True)
    app_id: str = Field(index=True)
    timestamp: datetime = Field(default_factory=utcnow, index=True)  # UTC
    source: str = Field(default="real")          # "real" | "simulated"
    provider: str
    model: str
    status: str = Field(default="success")       # success|provider_error|exact_hit|blocked
    cache_type: Optional[str] = None             # none|exact
    input_tokens: int = 0
    output_tokens: int = 0
    actual_provider_cost_usd: float = 0.0
    actual_provider_cost_myr: float = 0.0
    estimated_avoided_cost_usd: float = 0.0
    latency_ms: Optional[float] = None


class CacheEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True)
    app_id: str = Field(index=True)
    cache_key_hash: str = Field(index=True, unique=True)
    faq_version: str
    response_json: str
    created_at: datetime = Field(default_factory=utcnow)


class PolicySettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True)
    app_id: str = Field(index=True)
    monthly_budget_myr: float
    mode: str = Field(default="adaptive")        # adaptive|manual|always_on
    preventive_pct: float = 50.0
    high_pct: float = 75.0
    critical_pct: float = 90.0
    predictive_threshold_pct: float = 100.0
    exact_cache_approved: bool = False
    semantic_cache_approved: bool = False
    hard_stop_enabled: bool = False


class ForecastSnapshot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True)
    app_id: str = Field(index=True)
    as_of: datetime = Field(index=True)
    actual_spend_myr: float
    predicted_month_end_myr: float
    actual_budget_pct: float
    predicted_budget_pct: float
    method: str                                   # "ridge" | "baseline_rolling_7d"
    backtest_mae_myr: Optional[float] = None
    fallback_reason: Optional[str] = None