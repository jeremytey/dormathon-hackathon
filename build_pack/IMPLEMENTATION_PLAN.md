# TokenGuard AI — Step-by-step implementation plan

## Build order and 24-hour timebox (targets, not guarantees)
| Window | Phase | Deliverable | Acceptance check |
|---|---|---|---|
| 0–2h | 0 Scaffold | Repo, .env.example, schema, migrations, seed script | App starts; DB migration applies |
| 2–6h | 1 Gateway | Authenticated Anthropic Messages-compatible non-streaming text proxy for Lumi | Live or mocked provider returns compatible response; invalid key 401 |
| 6–8h | 2 Metering | Usage event ingestion + cost estimator | Every request, including cache hits/errors, has status and metadata; no duplicate charges |
| 8–10h | 3 Exact cache | TTL and strict eligibility | Repeated safe request avoids second provider call; unsafe request bypasses |
| 10–13h | 4 Dashboard | Real usage chart, budget and policy settings | Changing a threshold persists and changes subsequent gateway decisions |
| 13–16h | 5 Forecast/alerts | Seed data, forecast, anomaly, alert dedupe | Over-budget projection triggers one actionable alert |
| 16–19h | 6 Advanced | Semantic FAQ cache, savings scenarios (if core stable) | Approved paraphrase hits; personalised query bypasses |
| 19–22h | 7 QA | E2E demo, security tests, error cases | All critical tests pass |
| 22–24h | Demo | Pitch, scripted test cases, README | Demo reproducible from clean setup |

If behind schedule, cut model routing, prompt compression, and sophisticated anomaly ML **before** cutting metering, budget triggers, and forecasting. Prefer one real provider over three broken ones.

## Repository structure
```text
tokenguard/
  backend/
    app/main.py                 # FastAPI bootstrap
    app/api/gateway.py          # compatible chat endpoint
    app/api/dashboard.py        # metrics, settings, alerts
    app/core/auth.py            # gateway key auth and tenant context
    app/core/config.py          # environment/config
    app/services/provider.py    # LiteLLM adapter
    app/services/cache.py       # exact cache and optional FAQ semantic cache
    app/services/policy.py      # modes, risk, authorisation, hard stop
    app/services/metering.py    # usage, cost, baseline, idempotency
    app/services/forecast.py    # daily forecast and risk
    app/services/anomaly.py     # explainable anomaly rules
    app/services/alerts.py      # alert dedup and acknowledgement
    app/db/                    # repositories, SQL migrations
    tests/                     # gateway/cache/policy/forecast/security tests
  frontend/                    # React Vite dashboard
  scripts/seed_demo.py
  .env.example
  README.md
  BUILD_STATUS.md
```

## Concrete tasks
### Phase 0
- Define `tenant`, `application`, `gateway_key`, `provider_credential`, `policy`, `usage_event`, `cache_entry`, `daily_usage`, `forecast_run`, `alert`, `alert_action`.
- Create seed tenant and demo app; clearly tag `source=simulated` versus `source=real`.
- Prepare mocked provider so tests incur no API costs.

### Phase 1
- Accept Anthropic Messages-compatible Lumi payload for a supported non-streaming subset; validate `model`, `messages`, temperature, and output token controls.
- Resolve gateway key to tenant/app; load provider credential server-side; send via LiteLLM; preserve upstream completion shape.
- Record request ID and provider latency. Explicit 4xx for unsupported streaming, tool calls, multimodal input, etc. in MVP.

### Phase 2
- Write an event for success, cache hit, provider failure, and policy block; usage count nullable if unavailable.
- Price by provider/model and effective tariff version; never hardcode one universal price. Track currency and conversion assumptions; budget may be MYR while provider bills USD.
- Implement `GET /api/usage/summary` and `GET /api/usage/daily` scoped to tenant/app.

### Phase 3
- Cache only allowlisted FAQ-type requests with no user-specific context. Include tenant/app, system prompt version, model, parameters, full messages, and relevant knowledge-base version in key.
- Set TTL, store response and baseline token/cost estimates. Record cache hit with actual provider cost zero and estimated avoided provider cost.
- Negative tests: cross-tenant, changed system prompt, dynamic/private question, expired entry.

### Phase 4
- Build settings for budget amount (user-set or suggestion), policy mode (Adaptive/Manual/Always-on), thresholds, per-optimisation approval, and hard-stop opt-in.
- Show current month spend, budget progress, forecast, anomaly count, cache hit rate, cost breakdown, and source badge (simulated vs real).
- Never put provider secrets in browser state or client bundle.

### Phase 5
- Aggregate actual provider spend by day and month. Seed 30–60 days of simulated data as demo series; label every chart.
- Baseline forecast: observed daily average × remaining days + spend to date. Compare with linear regression if enough history. Report forecast as estimate, with history count and method.
- Predict crossing date from daily rate only if positive and meaningful. Trigger when forecast/budget crosses configured predictive percentage or actual/budget crosses actual threshold.
- Rolling median/MAD or simple configurable spike ratio for anomalies; handle zero baselines.
- Deduplicate alert by tenant/app, risk type, threshold band, and billing period; log user acknowledgement independently.

### Phase 6
- Semantic FAQ: embed approved FAQ queries only; store tenant/app/version; require conservative similarity threshold and optional answer provenance. Do not cache account-specific or tool-using conversations.
- Savings simulation: use eligible-request volume × measured average avoided provider cost − assumed incremental optimisation overhead; show assumptions and uncertainty.
- Model routing: optional, explicit user approval, allowlisted task types, never silently route sensitive or format-critical requests; quality regression suite.

### Phase 7
- Run pytest and frontend build; run tenant-isolation tests, invalid-key tests, request failure tests, safe-cache tests, cost arithmetic tests, and risk/policy tests.
- Demo: normal prompt -> exact hit -> spending spike -> forecast overrun -> alert -> adaptive activation -> user acknowledgement -> optional hard-stop.
- Report measured cache hits, real provider spend, latency, and forecast errors only when actually tested.

## Demo acceptance scenarios
1. A FAQ request is forwarded once, then identical safe request hits cache.
2. Paraphrased approved FAQ hits semantic cache if advanced phase implemented.
3. A private order-status query bypasses both shared caches.
4. User sets RM200 budget; simulated projected RM280 shows 140% projected utilisation and RM80 overrun.
5. Actual spend at 30% but forecast at 140% triggers early predictive warning.
6. Manual mode recommends but does not enable a new optimisation; Adaptive activates only approved policies.
7. Acknowledging alert does not automatically approve routing or grant spend permission.
8. Hard-stop enabled blocks new provider calls at or above budget; disabled warns and continues.
9. Tenant A cannot see or reuse tenant B data/cache.
10. Dashboard labels historical seeded data as simulated.

## Parallel team execution
The phase windows above describe **dependency order**, not exclusive sequential work by one developer. For the two-person, 24-hour parallel assignment, file ownership, integration checkpoints, and cut list, follow `TEAM_EXECUTION_PLAN.md`. Freeze interfaces using `API_CONTRACT.md` in the first hour.


## v3 — Prediction milestones (24-hour priority)
1. **H0–4**: Agree `DATA_DICTIONARY.md`, API contracts, monthly timezone, FX approach, request log fields; scaffold deterministic synthetic generator with seed and `source=simulated`.
2. **H4–8**: Persist real gateway events and daily aggregates; implement budget set/suggestion and rolling-average forecast; display actual and projected percentages separately.
3. **H8–12**: Build leakage-safe lag features, Ridge training, chronological holdout and MAE comparison; save model and metrics; integrate `/api/forecast`.
4. **H12–16**: Optional Random Forest, anomalies, prediction-driven adaptive triggers, savings simulation with documented assumptions.
5. **H16–19**: Backtest edge cases (first month, sparse usage, policy change, zero spend, month rollover, no FX rate); end-to-end tests.
6. **H19–24**: Feature freeze, quality assurance, demo with honest synthetic labels and baseline-vs-ML comparison.
If ML is worse than baseline on holdout, ship the baseline as default and show ML as an evaluated experiment. Do not fabricate model accuracy.
