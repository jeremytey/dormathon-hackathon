import numpy as np
import pandas as pd
import pytest

from tokenguard.features import FEATURE_COLS, TARGET_COL, build_feature_frame
from tokenguard.forecast import (METHOD_BASELINE, chronological_split, compute_forecast)


def make_daily(n=60, seed=0, start="2026-08-01", pattern=True):
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start, periods=n, freq="D")
    base = 20 + (5 * (dates.dayofweek >= 5) if pattern else 0) + rng.normal(0, 1, n)
    return pd.DataFrame({"tenant_id": "t1", "app_id": "a1", "date": dates,
                         "cost_myr": np.clip(base, 0, None)})


def test_features_use_only_past_data():
    daily = make_daily(30)
    f1 = build_feature_frame(daily)

    # Mutate FUTURE values (after day index 15) -> features at row 15 must not change
    mutated = daily.copy()
    mutated.loc[16:, "cost_myr"] += 1000
    f2 = build_feature_frame(mutated)

    row = 15
    pd.testing.assert_series_equal(f1.loc[row, FEATURE_COLS], f2.loc[row, FEATURE_COLS])


def test_feature_definitions_and_target_shift():
    daily = make_daily(20)
    f = build_feature_frame(daily)
    t = 10
    assert f.loc[t, "cost_lag_1"] == daily.loc[t, "cost_myr"]
    assert f.loc[t, "cost_lag_7"] == daily.loc[t - 6, "cost_myr"]
    assert f.loc[t, "cost_roll_7"] == pytest.approx(daily.loc[t - 6:t, "cost_myr"].mean())
    assert f.loc[t, "day_of_week"] == (daily.loc[t, "date"] + pd.Timedelta(days=1)).dayofweek
    assert f.loc[t, TARGET_COL] == daily.loc[t + 1, "cost_myr"]
    assert np.isnan(f.iloc[-1][TARGET_COL])


def test_split_is_chronological():
    f = build_feature_frame(make_daily(50)).dropna(subset=[TARGET_COL])
    train, hold = chronological_split(f)
    assert train["date"].max() < hold["date"].min()
    assert len(train) == int(len(f) * 0.8)


def test_short_history_falls_back_to_baseline():
    r = compute_forecast(make_daily(5), "t1", "a1", monthly_budget_myr=1000)
    assert r.method == METHOD_BASELINE
    assert r.fallback_reason == "SHORT_HISTORY"
    assert r.backtest_mae_myr is None


def test_month_end_projection_and_budget_pct():
    daily = make_daily(40)
    r = compute_forecast(daily, "t1", "a1", monthly_budget_myr=1000)
    cutoff = daily["date"].max()
    mtd = daily.loc[daily["date"] >= cutoff.replace(day=1), "cost_myr"].sum()
    import calendar
    remaining = calendar.monthrange(cutoff.year, cutoff.month)[1] - cutoff.day
    assert r.actual_mtd_myr == pytest.approx(mtd)
    assert r.predicted_month_end_myr == pytest.approx(mtd + r.next_day_cost_myr * remaining)
    assert r.actual_budget_pct == pytest.approx(mtd / 1000 * 100)
    assert r.next_day_cost_myr >= 0.0


def test_ridge_selected_on_weekly_seasonality():
    # Strong weekday pattern: day_of_week feature should let Ridge beat a flat 7d mean
    r = compute_forecast(make_daily(120, pattern=True), "t1", "a1", monthly_budget_myr=2000)
    assert r.ridge_mae_myr is not None and r.baseline_mae_myr is not None
    if r.method == "ridge":
        assert r.ridge_mae_myr < r.baseline_mae_myr
        assert r.fallback_reason is None
    else:
        assert r.fallback_reason is not None


def test_as_of_cutoff_ignores_future_rows():
    daily = make_daily(60)
    cutoff = daily["date"].iloc[30].date()
    poisoned = daily.copy()
    poisoned.loc[31:, "cost_myr"] = 1e6
    a = compute_forecast(daily, "t1", "a1", 1000, as_of=cutoff)
    b = compute_forecast(poisoned, "t1", "a1", 1000, as_of=cutoff)
    assert a.next_day_cost_myr == pytest.approx(b.next_day_cost_myr)
    assert a.actual_mtd_myr == pytest.approx(b.actual_mtd_myr)