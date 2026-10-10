# TokenGuard AI — ML Forecasting Specification (v3)

## Purpose
Predict **next-day AI provider spending in MYR** from known historical daily usage, then estimate remaining monthly spend and budget risk. Separate: (a) owner-selected budget, (b) observed historical baseline, (c) statistical/ML forecast, and (d) rules-based optimisation decisions.

## Source data and lineage
1. Gateway logs one idempotent event per request with tenant/app, UTC timestamp, actual provider model, input/output/cache token counts, cache hit, provider charge (USD), estimated avoidance, status, source `real|simulated`.
2. Convert to MYR using recorded USD/MYR exchange rate and timestamp; don't silently hardcode or confuse USD with MYR.
3. Aggregate by **tenant/app and local billing date**; record daily request count, provider spend, tokens, cache-hit rate, optimisation policy, and source.
4. Synthetic data for demo: seeded, reproducible **90–180 days** with weekday variation, growth/seasonality, FAQ repetition, one or two anomalies, and controlled policy changes. Clearly label every row simulated. Never mix simulated history with real operational actuals without an explicit demo mode.

## Feature engineering (past-only)
For a prediction made after day t, target `daily_cost_myr[t+1]`. Candidate predictors: day-of-week for t+1 (known), weekend flag, calendar month, `cost_lag_1`, `cost_lag_7`, trailing 7/14-day mean and std of cost, trailing 7-day request mean, trailing 7-day cache-hit mean, last known optimisation mode. Group shifts by tenant/app. Missing lags: drop training rows or apply documented past-only imputation. Never use actual t+1 request counts/tokens/cache rate/cost. Do not include tenant identifiers as arbitrary numeric magnitudes.

## Models
- Baseline: trailing 7-day mean daily cost; calendar/weekday-adjusted baseline optional.
- ML candidate 1: sklearn Pipeline(SimpleImputer + StandardScaler + Ridge) on numeric features; one-hot encode calendar categories as needed.
- ML candidate 2 (optional): RandomForestRegressor with fixed seed and constrained depth/min_samples_leaf.
- Keep model simple given limited real data. Model choice must be based on chronological validation rather than complexity.

## Evaluation
- Split chronologically, e.g. oldest 70–80% train, most recent 20–30% holdout. No random split. For multiple tenants, evaluate per tenant or use a leakage-safe time cutoff globally.
- Prefer rolling-origin backtests for month-end forecasts; record daily MAE and month-end forecast MAE separately when feasible. Compare to baseline using identical dates.
- Report MAE in MYR, test period, training sample size, and provenance. Synthetic backtest demonstrates mechanics, not real-world accuracy.
- If ML underperforms baseline or history is too short, use baseline and explain fallback. Never present arbitrary hardcoded 'accuracy'.

## Forecast inference
1. Read completed daily actuals through as-of day t; exclude incomplete current day or explicitly prorate/handle it.
2. Predict t+1 using only historical lag features and known calendar features.
3. For later days, recursively update cost lag features using earlier predictions, while treating unknown future request counts/cache rates as forecasted or fixed from trailing historical aggregates. Alternatively use baseline for the multi-day horizon and label the method. Do not sneak actual future features into predictions.
4. Sum `month_to_date_actual + predicted_remaining_days`; clamp daily forecasts to >=0; emit as-of time, horizon, method, fallback reason and model version.
5. Calculate `actual_budget_pct=100*actual/budget` and `predicted_budget_pct=100*month_end_forecast/budget`. Crossing date is optional, based on cumulative daily projected costs.
6. Recompute periodically (e.g. after daily rollup or meaningful usage change), not synchronously for every prompt.

## Anomaly detection
Compute prior 7/14-day mean and variability excluding the evaluated day; alert for high ratio/z-score only when sufficient history and meaningful absolute cost. Dedupe alerts. Show 'unusual cost spike', not an unsupported root-cause claim.

## Budget recommendation
Offer a *suggested* budget based on complete prior-month median or average plus optional owner-chosen buffer. Show basis and data availability. Never automatically replace owner-set budget; do not use model prediction as the budget itself.

## Scenario simulation
`gross_savings = expected_eligible_future_requests * expected_cache_hit_rate * average_avoided_provider_cost`; `net_estimate = gross_savings - estimated_incremental_cost`. Use historical measured cache eligibility where available; clearly label uncertain assumptions. Do not claim guaranteed savings or train a model for this unless justified.

## Automated policy loop
The prediction service writes a forecast snapshot. Person A's policy service compares *actual* and *predicted* utilisation against editable thresholds. In adaptive mode only **pre-approved** optimisation changes activate. Manual mode alerts only. Always-on respects safety constraints. Acknowledging an alert is not approval or a spending-limit override. Record every activation, reason, forecast version, and timestamp.

## Test cases
- No data: return insufficient-history state, no fabricated forecast.
- 5 days history: use fallback, disclose uncertainty.
- Month rollover and February; timezone boundaries; zero budget rejected.
- Simulated vs real isolation; missing provider usage; FX absent.
- Training features have no future data; shifted target correct.
- Policy changes mid-month; forecast stale; anomaly spike.
- ML worse than baseline: baseline chosen.
- Cross-tenant isolation, alert deduplication, approval semantics.
