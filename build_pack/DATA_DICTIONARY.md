# TokenGuard AI — Dataset & Feature Dictionary (v3)

## 1. Raw gateway events: `usage_events`
| Field | Type | Notes |
|---|---|---|
| request_id | UUID/string | Unique, idempotency key |
| tenant_id, app_id | UUID | Strictly scoped |
| timestamp_utc | timestamp | Time request completed |
| source | enum | `real` or `simulated` |
| provider, model_requested, model_used | string | Track routing/fallback |
| status | enum | success/cache_hit/error/blocked |
| cache_type | enum | miss/exact_hit/semantic_hit/bypass |
| input_tokens, output_tokens | int | Provider reported if available |
| cache_creation_input_tokens, cache_read_input_tokens | int | Provider-native prompt cache |
| token_count_source | enum | provider_reported/estimated/unavailable |
| provider_cost_usd | decimal | Nullable; cost of actual provider call |
| estimated_avoided_cost_usd | decimal | Counterfactual estimate, separate |
| usd_to_myr_rate, fx_rate_timestamp | decimal, timestamp | Conversion provenance |
| provider_cost_myr | decimal | Derived using recorded rate |
| latency_ms | int | Observed request duration |
| optimisation_policy_id, policy_version | string | Audit policy change effects |

Avoid raw prompt/response logging by default. Provider prompt-cache reads are **not** TokenGuard response-cache hits.

## 2. Daily aggregate: `daily_usage`
| Field | Type | Meaning |
|---|---|---|
| local_date | date | Billing timezone date |
| tenant_id, app_id, source | key | Never combine tenants/sources implicitly |
| daily_requests | int | Total attempts, optionally success count separately |
| daily_provider_cost_myr | decimal | **Observed spend** (prediction target series) |
| daily_input_tokens, daily_output_tokens | int | Observed tokens |
| daily_exact_hits, daily_semantic_hits | int | Cache outcomes |
| cache_hit_rate | float | (eligible or all) denominator documented |
| avg_cost_per_request_myr | decimal | Derived |
| active_policy_level | string | Observed policy at that time |

## 3. ML training table: `forecast_features`
| Field | Known at prediction time? | Role |
|---|---|---|
| forecast_origin_date (t) | Yes | Observation cutoff |
| target_date (t+1), day_of_week, is_weekend, month | Yes | Future calendar features |
| cost_lag_1, cost_lag_7 | Yes | Historical spending |
| cost_rolling_mean_7, cost_rolling_std_7 | Yes | Past-only rolling costs |
| requests_rolling_mean_7 | Yes | Historical traffic |
| cache_hit_rate_rolling_mean_7 | Yes | Historical cache effectiveness |
| last_known_policy | Yes | Current policy, not future action |
| next_day_cost_myr | **No** | **Target y**, never feature X |

For a row at origin t, features may use dates <=t only. A training row must not be included if target t+1 is beyond the training cutoff.

## 4. Forecast snapshots
`as_of`, `tenant_id`, `app_id`, `source`, `model_version`, `method`, `train_cutoff`, `backtest_mae_myr`, `actual_mtd_myr`, `predicted_remaining_myr`, `predicted_month_end_myr`, `actual_budget_pct`, `predicted_budget_pct`, `fallback_reason`.

## 5. Policy and budget
`monthly_budget_myr`, `budget_source` (`user_set|historical_suggestion_accepted`), `timezone`, `actual_thresholds` (50/75/90 defaults), `predictive_threshold_pct`, `mode` (`adaptive|manual|always_on`), `semantic_cache_approved`, `model_routing_approved`, `hard_stop_enabled`. Budget suggestions are not active until user accepts.
