# TokenGuard AI — Shared integration contract

This is the team agreement to freeze during the first hour. Types are illustrative and must be validated against the final Pydantic models and SQL schema.

## Request path
`POST /v1/messages` (Lumi Anthropic Messages subset) → gateway key auth → tenant/app lookup → current saved policy snapshot → hard-stop check → safe exact cache → optional approved semantic FAQ cache → provider adapter → metering event → response.

The gateway reads the **latest saved forecast/risk snapshot**, not a new forecast per prompt. An asynchronous/periodic worker updates forecasts, anomalies, alerts and risk snapshots. Policy reads the snapshot on subsequent requests.

## Suggested usage event JSON
```json
{
  "request_id": "unique-id",
  "tenant_id": "uuid",
  "application_id": "uuid",
  "source": "real",
  "timestamp": "2026-10-10T06:00:00Z",
  "status": "success",
  "provider": "openai",
  "model": "configured-model",
  "cache_type": "miss",
  "input_tokens": 120,
  "output_tokens": 80,
  "token_count_source": "provider_reported",
  "actual_provider_cost_usd": 0.0,
  "estimated_avoided_provider_cost_usd": 0.0,
  "latency_ms": 650
}
```
Amounts shown are placeholders; never assume a universal price. `cache_type`: `miss`, `exact_hit`, `semantic_hit`, `bypass`. `status`: `success`, `provider_error`, `blocked`, `cache_hit`. Costs may be nullable if not known. Never store raw prompts by default.

## Suggested settings JSON
```json
{
  "monthly_budget_myr": 200,
  "budget_source": "user_set",
  "mode": "adaptive",
  "actual_thresholds": {"preventive": 50, "high": 75, "critical": 90},
  "predictive_threshold_pct": 100,
  "exact_cache_approved": true,
  "semantic_cache_approved": false,
  "model_routing_approved": false,
  "hard_stop_enabled": false
}
```

## Semantics
- `adaptive`: automatic changes only among pre-approved, request-eligible policies when actual or forecast risk reaches a configured trigger.
- `manual`: alert and recommend, but do not activate new policies automatically.
- `always_on`: user-selected safe policies active irrespective of risk, subject to request eligibility.
- Budget suggestion based on history **never** overwrites a user-set budget without confirmation.
- Alert acknowledgement **does not** grant permission for policy changes or extra spending.
- Actual and predicted budget percentages are separate values; evaluate both, with the higher applicable risk triggering an early warning.
- Hard stop is an opt-in, explicit budget enforcement setting, checked before provider calls.
- For the hackathon, avoid auto model downgrades; if added, require task allowlists, user approval, and quality tests.

## Anthropic SDK compatibility: precise MVP boundary
- The existing client is `anthropic.Anthropic(...)` and sends `POST /v1/messages` with `x-api-key` plus Anthropic headers. Accept scoped TokenGuard key; do not forward it to Anthropic. Inject the real provider credential server-side.
- Non-streaming text only at first: request fields `model`, `max_tokens`, `system` (string; optionally structured blocks after validation), `messages` (text blocks), and supported generation options. Explicitly reject unsupported `stream=true`, tools, images, beta fallback parameters and unknown settings rather than ignoring them.
- Response fields: `id`, `type:"message"`, `role:"assistant"`, `content:[{"type":"text","text":"..."}]`, `model`, `stop_reason`, `stop_sequence`, and `usage` including `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` when available. Test with the actual Anthropic Python SDK, not only curl.
- On gateway cache hit, distinguish `provider_tokens=0` from **estimated logical response tokens**; do not report provider usage as if Anthropic generated a new answer. Provide TokenGuard-specific cache and cost metadata via separate headers or `/api/usage` rather than inventing Anthropic billing fields.
- Errors must preserve useful HTTP status codes and safe messages. Record failed/blocked/cache-hit events exactly once via unique request ID.
- Align UI endpoints to `TECHNICAL_SPEC.md`: use `/api/policy`, `/api/forecast`, `/api/scenarios/savings` consistently; do not implement duplicate competing paths.


## v3 — Prediction API contract (canonical additions)
All endpoints require authenticated tenant scope; JSON examples are illustrative.
- `GET /api/forecast?app_id=...`: `{as_of, period_start, period_end, timezone, source, actual_spend_myr, budget_myr, actual_budget_pct, predicted_remaining_myr, predicted_month_end_myr, predicted_budget_pct, projected_overrun_myr, projected_crossing_date, method, model_version, train_cutoff, backtest_mae_myr, fallback_reason}`. `projected_crossing_date` may be null. Source identifies simulated demo versus real operational data.
- `GET /api/budget/suggestion?app_id=...`: `{suggested_budget_myr, basis:"median_completed_months", completed_months, buffer_pct, source, limitations}`. This is a suggestion, not an automatic update.
- `PUT /api/settings`: user approval required to change `monthly_budget_myr` or optimisation approvals. Preserve existing settings schema.
- `GET /api/anomalies?app_id=...`: daily anomaly records with date, observed cost, trailing baseline, score/threshold, and explanation.
- `POST /api/scenarios/savings`: inputs include eligible_future_requests, expected_hit_rate, average_avoided_provider_cost_myr, estimated_incremental_cost_myr; output gross and net **estimated** savings with assumptions.
Never expose another tenant's usage. Freeze endpoint names in team kickoff; update consumers together if changed.
