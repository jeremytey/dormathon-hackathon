# TokenGuard AI — Technical specification and decision rules

## 1. Request flow
```text
Lumi Anthropic SDK -> POST /v1/messages -> authenticate gateway key -> resolve tenant/app
  -> read policy & actual spend -> check hard-stop (if enabled)
  -> classify cache eligibility -> exact cache lookup
  -> if approved and active: semantic FAQ cache lookup
  -> if miss: apply safe configured output controls; optionally approved model routing
  -> LiteLLM -> provider -> compatible response
  -> meter event (success/hit/error/block) -> return response

Background worker/scheduled job:
usage events -> daily aggregates -> forecast + anomaly detection
 -> actual/predictive threshold evaluation -> deduplicated alert
 -> recommendation/savings scenario -> policy activation if authorised
 -> dashboard/acknowledgement -> next gateway requests use updated policy
```
Request logging should be reliable but not require a forecast to finish before responding. Use a transactional outbox or durable write strategy if background jobs are asynchronous; do not silently lose metering events.

## 2. Modes and policy precedence
- **Manual:** no *new* risk-triggered optimisations without explicit approval; user-selected always-on exact cache can remain active. Notify and recommend.
- **Adaptive (default):** safe exact cache for eligible requests always; risk thresholds may activate only pre-approved semantic cache, output policy, or routing; record activation.
- **Always-on:** user-selected eligible optimisations apply regardless of risk; safety exclusions still win.
- **Priority:** invalid auth -> block; optional hard budget stop -> block; safety/compatibility exclusion -> bypass optimisation; explicit user approval -> policy availability; mode and risk -> activation; cache lookup -> provider fallback.
- **Alerts:** acknowledgement means warning seen, not consent to increase budget, change model, or ignore hard stop.
- **Hard limit:** opt-in, checked against authoritative actual provider spend, with concurrency caveat: multiple in-flight calls may exceed cap. For strict cap, implement reservations/preflight estimates and reconciliation; label basic MVP as approximate cap.

## 3. Budget & risk calculations
```
actual_pct = 100 * current_billing_month_actual_provider_cost / configured_budget
forecast_pct = 100 * forecast_month_end_cost / configured_budget
projected_overrun = max(0, forecast_month_end_cost - configured_budget)
```
- Configurable actual thresholds default 50%, 75%, 90%; predicted threshold default 100% of budget for an early warning, independently configurable.
- Never combine actual and forecast percentages by addition; compare separately and take highest applicable risk level.
- If budget <= 0, reject config. If insufficient history, show 'low confidence' or 'insufficient data' rather than inventing certainty.
- Billing month boundaries use configured timezone and reset date; currency conversions must use documented FX assumptions.
- Risk thresholds are **examples**, not claims of optimal values.

## 4. Minimal database model
- `tenants(id, name, created_at)`
- `applications(id, tenant_id, name, provider, created_at)`
- `gateway_keys(id, tenant_id, app_id, key_hash, last_used_at, revoked_at)`
- `provider_credentials(id, tenant_id, provider, encrypted_secret_ref)`
- `policies(id, tenant_id, app_id, monthly_budget, currency, timezone, mode, preventive_pct, high_pct, critical_pct, predictive_pct, exact_cache_enabled, semantic_approved, routing_approved, output_policy_approved, hard_stop_enabled, updated_at)`
- `usage_events(id, request_id UNIQUE, tenant_id, app_id, timestamp, source, provider, model, outcome, input_tokens, output_tokens, token_source, provider_cost, estimated_baseline_cost, estimated_optimisation_overhead, cache_type, latency_ms, price_version)`
- `cache_entries(id, tenant_id, app_id, cache_key_hash, cache_kind, faq_version, model, response_json, expires_at, created_at)`
- `daily_usage(id, tenant_id, app_id, day, source, request_count, provider_cost, input_tokens, output_tokens)`
- `forecast_runs(id, tenant_id, app_id, run_at, method, history_days, forecast_cost, projected_overrun, crossing_date, source)`
- `alerts(id, tenant_id, app_id, billing_period, alert_type, severity, dedupe_key UNIQUE, message, forecast_run_id, created_at, acknowledged_at)`
- `alert_actions(id, alert_id, tenant_id, action_type, authorised_by, timestamp, details_json)`

Use UUID primary keys, foreign keys, indexes on `(tenant_id, app_id, timestamp)`, tenant-scoped RLS, and server-side access checks. Avoid logging personal prompt content by default. `source` values: `real` or `simulated`.

## 5. Proposed endpoints
- `POST /v1/messages` — supported Anthropic Messages-compatible non-streaming text subset for Lumi; optional `POST /v1/chat/completions` later.
- `GET /api/usage/summary`, `GET /api/usage/daily` — actual and labelled simulated series.
- `GET /api/forecast`, `POST /api/forecast/recompute` — forecast snapshot and admin refresh.
- `GET /api/policy`, `PATCH /api/policy` — validated budget, modes, thresholds, approvals.
- `GET /api/alerts`, `POST /api/alerts/{id}/acknowledge` — alert history and acknowledgement.
- `POST /api/scenarios/savings` — assumption-driven savings estimate.
- `GET /health` — service health.

Dashboard auth must be separate from gateway API-key authentication; never allow browser-held gateway key to grant unrestricted admin access.

## 6. Cache rules
- Cache key: hash of canonical JSON containing tenant/app, provider/model, instructions, message history, sampling/output params, response format, and FAQ/data version.
- Cache eligibility: stateless, public, deterministic FAQ with no personal identifiers or dynamic information; do not rely only on regex to decide safety. Prefer app-side `cache_eligible=true` opt-in or admin-approved FAQ collection.
- Exact cache response must preserve expected API shape; usage metadata should distinguish upstream tokens from cached response size.
- Semantic cache only compares against approved FAQ entries from same tenant/app and knowledge version. Expire/rebuild when FAQ source changes. Similarity threshold tuned on negative examples, not chosen as an accuracy guarantee.
- Provider-native prompt caching is separate from gateway response caching; count provider-reported cached input tokens and applicable discounts when available. Do not claim provider cache avoids an entire call.

## 7. Quality and security tests
- Different tenants never share cache/usage/policies; different system prompts never collide.
- Dynamic/private queries bypass semantic cache even when wording is similar.
- Unsupported streaming/tools/multimodal return explicit errors in MVP.
- Model routing and output limits cannot override explicit formatting constraints.
- Provider failures do not produce fabricated successful responses or savings.
- Alert dedupe prevents spam; forecast risk can trigger below actual threshold.
- User acknowledgement is distinct from approval, policy update, and spend override.
- Secrets never appear in API JSON, browser logs, or git.

## 8. Explicitly deferred unless time remains
Full streaming, function/tool calling, multimodal, all provider-native APIs, universal no-code plugin, enterprise billing reconciliation, robust FX service, advanced ML anomaly detection, automatic prompt rewriting, and production-grade concurrency-safe hard budget caps.


## Existing Lumi chatbot integration (required)

- Existing application: Streamlit `chatbot.py` and `company_info.py` with `SYSTEM_PROMPT`; Anthropic SDK uses `client.beta.messages.stream`, `output_config.effort`, `cache_control`, and optional `betas` / `extra_body` fallbacks.
- **MVP:** keep Lumi UI, system prompt and history. Replace direct provider credentials with a TokenGuard gateway key and `base_url` pointing to the FastAPI gateway. The gateway must implement the Anthropic SDK's `/v1/messages` request/response shape for the supported non-streaming subset, including content blocks, model, usage and stop reason. The SDK may send Anthropic-specific headers; handle or reject explicitly.
- Temporarily replace `client.beta.messages.stream(...)` with a supported non-streaming `client.messages.create(...)` call in the demo adapter; show the returned text using Streamlit. Re-enable streaming only if the gateway correctly implements Anthropic SSE event framing, not just text chunks.
- Temporarily omit unsupported `output_config`, `betas`, `extra_body` fallback, and provider cache-control options, or implement validated passthrough for each. Do not silently discard them.
- The gateway owns provider credentials server-side. Client receives a scoped TokenGuard key. Never put a real provider secret in Streamlit browser state.
- Preserve multi-turn context; shared semantic caching only for explicitly approved stateless public FAQs. Exact caching requires a safe canonical key including system prompt/version, messages, model, parameters, tenant and app.
- Token accounting must use returned actual model and usage fields. Provider prompt cache reads/writes are distinct from TokenGuard response-cache hits. Verify the pricing table and model availability against the live provider before claiming costs.
- Person 1 owns gateway and Lumi adapter; Person 2 owns cache eligibility; Person 3 owns usage/cost storage; Person 4 owns dashboard and Lumi live demo.
- Smoke test: direct Lumi request works; same request via gateway works; safe repeat FAQ is cached; personalised/multi-turn question bypasses shared semantic cache; usage and budget alerts appear in dashboard.


## v3 — Forecast and budget rules
`monthly_budget_myr` is a user decision. Optional suggested budget = e.g. median of complete prior months (plus configurable buffer), shown with sample count and accepted manually; do not derive from an incomplete month without warning. Monthly period timezone and FX conversion must be explicit; store original USD cost and converted MYR with rate and timestamp.
Daily target `next_day_cost_myr` is created by shifting observed `daily_provider_cost_myr` by -1 within the same tenant/app series. Use past-only lags and rolling features, calendar features known ahead, and **historically observed** policy state. For multi-step horizons, avoid future-known usage variables; generate daily future values with valid recursive features or use a transparent calendar-adjusted baseline. Clip negative predictions to zero, log fallback and model provenance.
Prediction is not the same as risk policy. Forecast engine emits a snapshot; policy engine reads the most recent snapshot asynchronously and compares actual_pct and forecast_pct independently. Acknowledging an alert does not grant authorisation; budget hard-stop is optional and approximate unless reservations/concurrency controls are implemented.
`ML_FORECASTING_SPEC.md` and `DATA_DICTIONARY.md` define the full evaluation contract.
