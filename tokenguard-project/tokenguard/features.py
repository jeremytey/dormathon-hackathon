"""
Past-only feature engineering.

For a cutoff day t, predicting cost on day t+1:
    cost_lag_1   = cost on day t
    cost_lag_7   = cost on day t-6
    cost_roll_7  = mean(cost[t-6 .. t])
    day_of_week  = weekday of the TARGET day (t+1)   <- a calendar fact, not leakage
    target_next_day = cost on day t+1  (shift(-1), label only)

No tokens, request counts, or costs from t+1 or later are ever used as features.
"""
import pandas as pd

from .config import ROLLING_WINDOW
from .models import UsageEvent

FEATURE_COLS = ["cost_lag_1", "cost_lag_7", "cost_roll_7", "day_of_week"]
TARGET_COL = "target_next_day"


def events_to_frame(events: list[UsageEvent]) -> pd.DataFrame:
    """Raw events -> DataFrame (only the columns needed for daily cost)."""
    return pd.DataFrame(
        [{
            "tenant_id": e.tenant_id,
            "app_id": e.app_id,
            "timestamp": e.timestamp,
            "cost_myr": e.actual_provider_cost_myr,
        } for e in events],
        columns=["tenant_id", "app_id", "timestamp", "cost_myr"],
    )


def to_daily_costs(events_df: pd.DataFrame, as_of: pd.Timestamp | None = None) -> pd.DataFrame:
    """
    Aggregate to daily MYR cost per (tenant_id, app_id), on a CONTINUOUS calendar
    (missing days = 0 spend). A continuous calendar is required so that
    shift(-1) / shift(6) really mean 'next day' / 'six days ago'.

    If `as_of` is given, any data after that date is discarded (anti-leakage).
    """
    cols = ["tenant_id", "app_id", "date", "cost_myr"]
    if events_df.empty:
        return pd.DataFrame(columns=cols)

    df = events_df.copy()
    df["date"] = pd.to_datetime(df["timestamp"], utc=True).dt.tz_localize(None).dt.normalize()
    if as_of is not None:
        as_of = pd.Timestamp(as_of).tz_localize(None).normalize() if pd.Timestamp(as_of).tzinfo \
            else pd.Timestamp(as_of).normalize()
        df = df[df["date"] <= as_of]

    out = []
    for (tenant, app), g in df.groupby(["tenant_id", "app_id"], sort=False):
        daily = g.groupby("date")["cost_myr"].sum().sort_index()
        end = as_of if as_of is not None else daily.index.max()
        full_idx = pd.date_range(daily.index.min(), end, freq="D")
        daily = daily.reindex(full_idx, fill_value=0.0)
        out.append(pd.DataFrame({
            "tenant_id": tenant, "app_id": app,
            "date": full_idx, "cost_myr": daily.values,
        }))
    return pd.concat(out, ignore_index=True)[cols] if out else pd.DataFrame(columns=cols)


def build_feature_frame(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Input : daily frame [tenant_id, app_id, date, cost_myr]
    Output: same rows + FEATURE_COLS + TARGET_COL (+ baseline_pred).
    The last row of each group has NaN target (it is the row we forecast from).
    """
    frames = []
    for _, g in daily.groupby(["tenant_id", "app_id"], sort=False):
        g = g.sort_values("date").reset_index(drop=True).copy()
        c = g["cost_myr"]

        g["cost_lag_1"] = c                                   # spend on day t
        g["cost_lag_7"] = c.shift(ROLLING_WINDOW - 1)         # spend on day t-6
        g["cost_roll_7"] = c.rolling(ROLLING_WINDOW, min_periods=ROLLING_WINDOW).mean()
        g["day_of_week"] = (g["date"] + pd.Timedelta(days=1)).dt.dayofweek  # target day

        # Label: next-day actual cost, shifted BACKWARD within the group
        g[TARGET_COL] = c.shift(-1)

        # Baseline prediction for t+1: trailing 7-day mean ending at t
        g["baseline_pred"] = g["cost_roll_7"].fillna(g["cost_lag_1"])
        frames.append(g)

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)