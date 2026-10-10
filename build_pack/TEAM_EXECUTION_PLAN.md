# TokenGuard AI — Four-person, 24-hour parallel execution plan

This file assigns **ownership**, not four separate sequential phases. All four people work concurrently, integrate early, and keep the existing MVP scope in `SKILL.md`, `IMPLEMENTATION_PLAN.md`, and `TECHNICAL_SPEC.md`. The 24-hour schedule is a target, not a guarantee.

## Ownership and deliverables

| Owner | Workstream | Owns | Must deliver | Avoid editing |
|---|---|---|---|---|
| Person 1 — Gateway & integration lead | Gateway, authentication, provider adapter, request orchestration | `backend/app/api/gateway.py`, `backend/app/core/auth.py`, `backend/app/services/provider.py`, gateway tests | Authenticated `POST /v1/messages` for Lumi, tenant/app resolution, provider call, error handling, response passthrough, stable hooks for cache/policy/metering | Forecast, frontend, schema migrations without review |
| Person 2 — Optimisation & policy lead | Exact cache, safe semantic FAQ cache, policy evaluation, optional routing/output controls | `backend/app/services/cache.py`, `backend/app/services/policy.py`, cache/policy tests | Exact-cache eligibility + TTL, tenant-safe cache keys, adaptive/manual/always-on policy decisions, optional semantic FAQ after core passes | Gateway endpoint, UI, prediction code |
| Person 3 — Data, prediction & alerts lead | Supabase schema, metering, historical seed, forecasting, anomaly detection, alerts | `backend/app/db/`, `backend/app/services/metering.py`, `forecast.py`, `anomaly.py`, `alerts.py`, `scripts/seed_demo.py`, related tests | Migration + test seed, idempotent usage events, daily/monthly summaries, forecast, anomaly rules, alert dedupe and acknowledgement | Gateway request handler, UI |
| Person 4 — Dashboard, UX & demo lead | React UI, settings, metrics visualization, end-to-end demo and pitch | `frontend/`, UI tests, demo script, screenshots | Dashboard with real APIs, monthly budget input/suggestion, threshold sliders, modes, alerts, acknowledgement, clearly labelled simulated data; live demo script | Backend services except API contract discussion |

**Shared accountability:** Every person tests their own code, writes documentation for their component, and helps integration/QA. Person 1 is integration coordinator; Person 4 owns demo choreography. Neither should become a bottleneck for others.

## Architecture contract — agree in first 45 minutes

Freeze these interfaces early; if changed, announce in team chat and update `API_CONTRACT.md` before merging.

- Gateway: `POST /v1/messages`; Anthropic Messages-compatible non-streaming text subset for existing Lumi first. OpenAI-compatible endpoint optional. TokenGuard gateway key identifies tenant/application.
- Cache interface: `lookup(request, tenant_context, policy) -> hit/miss + response + cache metadata`; `store(...)` only for eligible successful answers.
- Policy interface: `evaluate(tenant_context, settings, spend_snapshot, forecast_snapshot, request_metadata) -> {allow_request, exact_cache_enabled, semantic_cache_enabled, output_policy, model_route, risk_level, reasons}`. **Policy controls future requests; it must not depend on synchronous forecasting.**
- Metering interface: `record_usage(event)` with unique `request_id`, tenant/app IDs, UTC timestamp, source (`real`/`simulated`), model, provider, status, cache type, reported/estimated input/output tokens, actual provider cost, estimated avoided provider cost, latency. Persist one event per request outcome, including cache hit and hard stop.
- Dashboard endpoints: `GET /api/usage/summary`, `GET /api/usage/daily`, `GET/PUT /api/settings`, `GET /api/forecast`, `GET /api/alerts`, `POST /api/alerts/{id}/acknowledge`, `POST /api/savings/simulate` (optional). Authenticated and tenant-scoped.
- Budget configuration: MYR monthly budget, billing period/timezone, actual thresholds (defaults 50/75/90), predictive overrun threshold, optimisation mode, approvals, hard-stop flag. Enforce `0 < preventive < high < critical <= 100`.
- Forecast data: distinguish simulated from real; seeded demo history is labelled and not silently blended into real business actuals.

## Shared repository and integration rules

1. One shared repository with protected `main`; branches: `feature/gateway`, `feature/optimisation`, `feature/prediction-data`, `feature/dashboard`.
2. First commit establishes backend/frontend scaffolds, `.env.example`, schemas, API contract, and **mock provider**. Agree which owner merges it (Person 1 coordinates, Person 3 owns schema).
3. Use pull requests or short peer-reviewed merges; avoid simultaneous edits to the same file. Resolve contract changes before coding against them.
4. Never commit provider credentials, Supabase service-role keys, user prompts or personal data. Frontend uses only safe public config; all server secrets stay backend-side.
5. Use mocks/stubs for another workstream until the implementation is merged. Do not wait idly for dependencies.
6. Run backend tests, frontend build, and one full gateway-to-dashboard smoke test after every integration milestone.
7. Update `BUILD_STATUS.md` with owner, implementation status, test evidence, blockers and integration status. Do not check an item as done before a test.

## Parallel 24-hour schedule

| Time | Person 1 — Gateway | Person 2 — Optimisation | Person 3 — Data/prediction | Person 4 — Dashboard/demo | Integration checkpoint |
|---|---|---|---|---|---|
| 0–1h | Scaffold + gateway contract | Cache/policy interfaces + safety rules | SQL schema + event contract | UI wireframe + dashboard API contract | **1h:** freeze interfaces and choose mock provider |
| 1–4h | Auth + mock/live provider request | Exact cache implementation + tests | Migrations, tenant-safe usage events | React scaffold, settings forms using mocked endpoints | **4h:** gateway returns mock answer; schema applies |
| 4–8h | Wire cache/metering hooks, errors | Exact-cache integration, policy modes | Metering summaries, cost arithmetic | Usage cards/charts + API integration | **8h:** prompt → gateway → usage event → dashboard |
| 8–12h | Reliability + gateway tests | Actual/predictive thresholds, hard-stop, tests | Seed 30–60d, spending forecast | Editable budgets/modes/thresholds + alerts UI | **12h:** budget forecast and settings work end-to-end |
| 12–16h | Integrate alerts/policy; review security | Optional semantic approved-FAQ cache | Anomaly detection, alert dedupe, what-if formula | Forecast, anomaly, savings displays | **16h:** predictive warning changes approved policy |
| 16–19h | Cross-tenant + error testing | Cache quality/negative tests; optional output rules | Data correctness, simulated/real labels | E2E demo rehearsal + UI fixes | **19h:** full rehearsal, feature freeze |
| 19–22h | Integration bug fixes | Integration bug fixes | Integration bug fixes | Demo recording/slides + bug fixes | **22h:** clean install and repeatable demo |
| 22–24h | Support demo | Support demo | Support demo | Present/pitch | **Final:** only critical fixes, no new features |

## Critical dependency chain

1. **Gateway authentication + mock provider** → 2. **Metering event contract + persistence** → 3. **Actual cost dashboard** → 4. **Forecast and risk** → 5. **Policy feedback into gateway** → 6. **Alerts + demo**.

Exact cache can develop in parallel against the agreed gateway interface. The UI can develop against mocked dashboard responses. The semantic cache must never block the core chain.

## Minimum viable demo (must pass before optional work)

1. User sets an RM200 monthly budget and chooses Adaptive, Manual, or Always-on with editable thresholds.
2. A supported safe FAQ goes through the gateway, gets a provider response, and logs real usage/cost.
3. Repeating the exact eligible FAQ returns a cache hit and records avoided downstream LLM spend.
4. Labelled simulated history shows an illustrative RM280 month-end forecast, RM80 overrun and an early alert **even if actual spending is below its trigger**.
5. In Manual mode the dashboard recommends action without activating a new policy; in Adaptive mode only previously approved policies activate.
6. Alert acknowledgement is stored separately from optimisation approval or permission to exceed budget.
7. Optional hard-stop blocks new upstream calls at the budget limit; warn-only continues with alerts.
8. A personalised/order-status request bypasses shared caches; a second tenant cannot read the first tenant's data.

## Cut list if behind schedule

Cut in this order: model routing → prompt compression → semantic caching → fancy anomaly ML → savings scenario UI polish. **Do not cut** gateway, tenant authentication, correct metering, safe exact caching, budget/settings, forecast, predictive warning, policy feedback, or demo data labelling.

## Team communication cadence

- 0:00 kickoff: roles, ownership, contract, credentials policy.
- Every 2–3 hours: 10-minute checkpoint: completed, next, blocker, interface change.
- At 8h, 12h, 16h, 19h: integration demos with one shared test tenant.
- At 19h: feature freeze; remaining time is QA, pitch, and reproducibility.

## Per-person handoff checklist

Each owner hands off: (a) changed files/PR, (b) API/interface and example payloads, (c) setup commands and environment variables, (d) tests run with results, (e) limitations, (f) any pending integration work. No claims of functionality without working tests.


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

## Existing Lumi-specific ownership
- **Person 1:** integrate the supplied `chatbot.py` with `POST /v1/messages`; preserve `company_info.py`; test direct vs gateway; implement a safe temporary non-streaming adapter. Coordinate SDK headers and response schema with Person 3.
- **Person 2:** build tenant/app/version-scoped exact cache and admin-approved FAQ semantic cache. Use `DEMO_TEST_PLAN.md` negative examples (tenure, personalised balances, security/ethics, multilingual) and validate opt-in thresholds.
- **Person 3:** implement real provider usage fields including prompt-cache read/write, cost provenance and historical simulated records. Predict forecast overrun, anomalous request spikes and savings scenarios. Ensure no seed data is counted as real spend.
- **Person 4:** keep the existing Lumi Streamlit interface as the **client demo** and build a separate TokenGuard dashboard. Show editable budget/thresholds, actual vs projected usage, active policies, alerts, acknowledgements and safe request comparison. Own final walkthrough.
- **Integration checkpoints:** by hour 2 freeze SDK payload/response + database types; hour 6 prove Lumi -> gateway -> Claude with mocked/live response; hour 10 show real metering and exact-cache test; hour 16 show policy + forecast feedback; hour 20 freeze and rehearse.


## v3: ML work allocation / dependencies
- **Person 3 owns ML forecasting end-to-end**: request log + daily aggregate, deterministic synthetic seed (90–180 days), past-only feature generation, baseline, Ridge, optional Random Forest, chronological backtest with MAE, month-end forecast, anomaly detection, budget suggestions, prediction endpoints and tests. This is the highest-risk workstream: deliver baseline by hour 8 and validated ML comparison by hour 14.
- **Person 2 owns consumption/forecast trigger policy**: evaluate actual_pct and forecast_pct independently; use the latest persisted forecast, do not retrain in request path. Trigger only approved semantic cache/routing policies; manual mode suggests only. Person 3 supplies forecast snapshot; Person 2 consumes it.
- **Person 4 owns budget setup + prediction UX**: manually set budget or review/accept historically suggested budget; show data source (simulated/real), baseline vs ML, forecast, MAE, anomaly and scenario assumptions. Do not display synthetic metrics as live customer results.
- **Person 1 owns gateway metering**: provider-reported usage when available, precise timestamps/model/cache provenance, USD cost and FX metadata, idempotent events. Deliver records matching `DATA_DICTIONARY.md`.
- Integration checks: H4 event schema; H8 baseline forecast endpoint; H12 budget/policy wiring; H16 model comparison; H19 freeze and demo. Each person works concurrently.
