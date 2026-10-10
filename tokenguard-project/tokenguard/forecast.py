"""
Forecasting + chronological backtesting engine.

Flow per (tenant, app):
  1. daily costs (<= as_of)  ->  past-only features
  2. chronological 80/20 split -> MAE for Baseline (7d rolling mean) and Ridge
  3. choose method (fallback to baseline on short history / worse MAE)
  4. predict next-day cost, project month-end, compute budget %
  5. persist ForecastSnapshot (sync or async)
"""
import asyncio
import calendar
import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sqlmodel import Session, select

from .config import MIN_HISTORY_DAYS, RIDGE_ALPHA, ROLLING_WINDOW, TRAIN_FRACTION
from .db import engine
from .features import FEATURE_COLS, TARGET_COL, build_feature_frame, events_to_frame, to_daily_costs
from .models import ForecastSnapshot, PolicySettings, UsageEvent

log = logging.getLogger(__name__)

METHOD_BASELINE = "baseline_rolling_7d"
METHOD_RIDGE = "ridge"


@dataclass
class ForecastResult:
    tenant_id: str
    app_id: str
    as_of: date
    method: str
    next_day_cost_myr: float
    actual_mtd_myr: float
    predicted_month_end_myr: float
    actual_budget_pct: float
    predicted_budget_pct: float
    backtest_mae_myr: Optional[float]          # MAE of the selected method on holdout
    baseline_mae_myr: Optional[float]
    ridge_mae_myr: Optional[float]
    fallback_reason: Optional[str]
    n_train: int
    n_holdout: int


# ---------------------------------------------------------------- model pieces
def build_ridge_pipeline() -> Pipeline:
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
        ("scaler", StandardScaler()),
        ("ridge", Ridge(alpha=RIDGE_ALPHA)),
    ])


def mae(y_true, y_pred) -> float:
    return float(np.mean(np.abs(np.asarray(y_true, float) - np.asarray(y_pred, float))))


def chronological_split(supervised: pd.DataFrame, train_frac: float = TRAIN_FRACTION):
    """Oldest `train_frac` -> train, newest rest -> holdout. NO shuffling."""
    supervised = supervised.sort_values("date").reset_index(drop=True)
    n = len(supervised)
    split = min(max(int(n * train_frac), 1), n - 1)
    return supervised.iloc[:split], supervised.iloc[split:]


# ------------------------------------------------------------- core (pure) fn
def compute_forecast(
    daily: pd.DataFrame,
    tenant_id: str,
    app_id: str,
    monthly_budget_myr: float,
    as_of: Optional[date] = None,
) -> ForecastResult:
    """
    `daily` = daily cost frame for ONE tenant/app (columns: date, cost_myr, ...).
    Everything after `as_of` is discarded before any feature is built.
    """
    if daily.empty:
        raise ValueError("No usage history for this tenant/app")

    daily = daily.sort_values("date").reset_index(drop=True)
    cutoff = pd.Timestamp(as_of) if as_of else daily["date"].max()
    daily = daily[daily["date"] <= cutoff].copy()
    # Make sure calendar is continuous up to cutoff (zero-fill trailing days)
    full_idx = pd.date_range(daily["date"].min(), cutoff, freq="D")
    daily = (daily.set_index("date")["cost_myr"].reindex(full_idx, fill_value=0.0)
             .rename_axis("date").reset_index())
    daily["tenant_id"], daily["app_id"] = tenant_id, app_id

    frame = build_feature_frame(daily)
    n_days = len(daily)
    latest = frame.iloc[[-1]]                          # row for cutoff day t (target unknown)
    supervised = frame.dropna(subset=[TARGET_COL])     # rows with a real t+1 label

    fallback_reason: Optional[str] = None
    ridge_mae = baseline_mae = None
    n_train = n_holdout = 0
    method = METHOD_BASELINE

    # ---- Backtest + selection
    if n_days < MIN_HISTORY_DAYS or len(supervised) < 3:
        fallback_reason = "SHORT_HISTORY"
    else:
        train, holdout = chronological_split(supervised)
        n_train, n_holdout = len(train), len(holdout)

        baseline_mae = mae(holdout[TARGET_COL], holdout["baseline_pred"])

        model = build_ridge_pipeline()
        model.fit(train[FEATURE_COLS], train[TARGET_COL])
        ridge_pred = np.clip(model.predict(holdout[FEATURE_COLS]), 0.0, None)
        ridge_mae = mae(holdout[TARGET_COL], ridge_pred)

        if ridge_mae < baseline_mae:
            method = METHOD_RIDGE
        elif ridge_mae > baseline_mae:
            fallback_reason = "ML_PERFORMED_WORSE_THAN_BASELINE"
        else:
            fallback_reason = "ML_NO_IMPROVEMENT_OVER_BASELINE"

    # ---- Inference for t+1
    if method == METHOD_RIDGE:
        final_model = build_ridge_pipeline()
        final_model.fit(supervised[FEATURE_COLS], supervised[TARGET_COL])  # refit on all history
        next_day = float(final_model.predict(latest[FEATURE_COLS])[0])
        selected_mae = ridge_mae
    else:
        next_day = float(daily["cost_myr"].tail(ROLLING_WINDOW).mean())
        selected_mae = baseline_mae
    next_day = max(next_day, 0.0)                      # clip negative outputs

    # ---- Month-end projection
    cutoff_d = cutoff.date()
    month_start = pd.Timestamp(cutoff_d.replace(day=1))
    actual_mtd = float(daily.loc[daily["date"] >= month_start, "cost_myr"].sum())
    days_in_month = calendar.monthrange(cutoff_d.year, cutoff_d.month)[1]
    remaining_days = days_in_month - cutoff_d.day
    predicted_month_end = actual_mtd + next_day * remaining_days

    if monthly_budget_myr <= 0:
        raise ValueError("monthly_budget_myr must be > 0")
    actual_pct = actual_mtd / monthly_budget_myr * 100.0
    predicted_pct = predicted_month_end / monthly_budget_myr * 100.0

    return ForecastResult(
        tenant_id=tenant_id, app_id=app_id, as_of=cutoff_d, method=method,
        next_day_cost_myr=next_day, actual_mtd_myr=actual_mtd,
        predicted_month_end_myr=predicted_month_end,
        actual_budget_pct=actual_pct, predicted_budget_pct=predicted_pct,
        backtest_mae_myr=selected_mae, baseline_mae_myr=baseline_mae,
        ridge_mae_myr=ridge_mae, fallback_reason=fallback_reason,
        n_train=n_train, n_holdout=n_holdout,
    )


# ------------------------------------------------------------------ DB layer
def forecast_for_app(
    session: Session, tenant_id: str, app_id: str, as_of: Optional[date] = None,
    save: bool = True,
) -> ForecastResult:
    policy = session.exec(select(PolicySettings).where(
        PolicySettings.tenant_id == tenant_id, PolicySettings.app_id == app_id)).first()
    if policy is None:
        raise LookupError(f"No PolicySettings for {tenant_id}/{app_id}")

    events = session.exec(select(UsageEvent).where(
        UsageEvent.tenant_id == tenant_id, UsageEvent.app_id == app_id)).all()
    daily = to_daily_costs(events_to_frame(events), as_of=pd.Timestamp(as_of) if as_of else None)
    if daily.empty:
        raise LookupError(f"No usage events for {tenant_id}/{app_id}")

    result = compute_forecast(daily, tenant_id, app_id, policy.monthly_budget_myr, as_of)
    if save:
        save_snapshot(session, result)
    return result


def save_snapshot(session: Session, r: ForecastResult) -> ForecastSnapshot:
    snap = ForecastSnapshot(
        tenant_id=r.tenant_id, app_id=r.app_id,
        as_of=datetime.combine(r.as_of, time.min, tzinfo=timezone.utc),
        actual_spend_myr=round(r.actual_mtd_myr, 4),
        predicted_month_end_myr=round(r.predicted_month_end_myr, 4),
        actual_budget_pct=round(r.actual_budget_pct, 4),
        predicted_budget_pct=round(r.predicted_budget_pct, 4),
        method=r.method,
        backtest_mae_myr=None if r.backtest_mae_myr is None else round(r.backtest_mae_myr, 6),
        fallback_reason=r.fallback_reason,
    )
    session.add(snap)
    session.commit()
    session.refresh(snap)
    return snap


def run_all_forecasts(session: Session, as_of: Optional[date] = None) -> list[ForecastResult]:
    pairs = session.exec(select(PolicySettings.tenant_id, PolicySettings.app_id)).all()
    results = []
    for tenant_id, app_id in pairs:
        try:
            results.append(forecast_for_app(session, tenant_id, app_id, as_of))
        except (LookupError, ValueError) as exc:
            log.warning("Skipping %s/%s: %s", tenant_id, app_id, exc)
    return results


def get_latest_snapshot(session: Session, tenant_id: str, app_id: str) -> Optional[ForecastSnapshot]:
    """Used by the gateway's pre-flight hard-stop check."""
    return session.exec(
        select(ForecastSnapshot)
        .where(ForecastSnapshot.tenant_id == tenant_id, ForecastSnapshot.app_id == app_id)
        .order_by(ForecastSnapshot.as_of.desc(), ForecastSnapshot.id.desc())
    ).first()


# ------------------------------------------------------------- async wrapper
def _refresh_sync(tenant_id: str, app_id: str) -> None:
    with Session(engine) as session:
        try:
            forecast_for_app(session, tenant_id, app_id)
        except Exception:
            log.exception("Forecast refresh failed for %s/%s", tenant_id, app_id)


async def refresh_forecast_async(tenant_id: str, app_id: str) -> None:
    """Fire-and-forget from FastAPI: keeps sklearn work off the event loop and request path."""
    await asyncio.to_thread(_refresh_sync, tenant_id, app_id)