# TokenGuard AI — Two-person, 24-hour parallel execution plan

Two people build in parallel: **Person A owns all system logic (backend)**, **Person B owns the dashboard and demo**. Extra helpers, if any, take tasks from the "Helper tasks" list and never own core files. Scope stays as defined in `SKILL.md`, `IMPLEMENTATION_PLAN.md`, and `TECHNICAL_SPEC.md`, but with two people the cut list below is applied **from the start**, not only when behind. The 24-hour schedule is a target, not a guarantee.

## Ownership and deliverables

| Owner | Workstream | Owns | Must deliver | Avoid editing |
|---|---|---|---|---|
| Person A — System logic lead | Gateway, auth, provider adapter, exact cache, policy engine, metering, schema, forecast, anomaly, alerts, dashboard API | `backend/` (gateway, auth, provider, cache, policy, metering, forecast, anomaly, alerts, db), backend tests | Authenticated `POST /v1/messages` for Lumi; tenant/app resolution; provider call + passthrough; safe exact cache; Manual/Adaptive/Always-on policy decisions; idempotent usage events; daily summaries; baseline forecast (Ridge as stretch); anomaly rule; deduped alerts + acknowledgement; all dashboard endpoints in `API_CONTRACT.md` | `frontend/`, demo client adapter |
| Person B — Dashboard, data & demo lead | React dashboard, settings UI, simulated history seed, Lumi client adapter, demo and pitch | `frontend/`, `scripts/seed_demo.py`, Lumi non-streaming adapter, mock API fixtures, demo script, screenshots, slides | Dashboard on real APIs (mocked until merged): monthly RM budget + suggestion, threshold sliders, modes, actual vs forecast chart, alerts + acknowledge, clearly labelled simulated data; reproducible 90–120-day seed; Lumi pointed at the gateway; rehearsed live demo | Backend services (propose contract changes instead) |

**Why this split:** Person A's work is one connected request path plus one background loop, so it stays in one head. Person B takes everything that only consumes the contract (UI, seed data, Lumi client, demo), which balances load and keeps Person A from being the bottleneck.

**Shared accountability:** each person tests their own code and writes a short README for it. Person A coordinates integration and owns the schema; Person B owns demo choreography and final QA.

## Architecture contract — agree in first 45 minutes

Freeze these interfaces early; if changed, tell the other person and update `API_CONTRACT.md` before merging.

- Gateway: `POST /v1/messages`; Anthropic Messages-compatible non-streaming text subset for existing Lumi. TokenGuard gateway key identifies tenant/application.
- Cache (internal to A): `lookup(request, tenant_context, policy) -> hit/miss + response + cache metadata`; `store(...)` only for eligible successful answers.
- Policy (internal to A): `evaluate(tenant_context, settings, spend_snapshot, forecast_snapshot, request_metadata) -> {allow_request, exact_cache_enabled, semantic_cache_enabled, output_policy, model_route, risk_level, reasons}`. **Policy controls future requests; it must not depend on synchronous forecasting.**
- Metering event: unique `request_id`, tenant/app IDs, UTC timestamp, source (`real`/`simulated`), model, provider, status, cache type, input/output tokens, actual provider cost, estimated avoided cost, latency. One event per request outcome, including cache hit and hard stop. **Person B's seed script writes rows in this exact shape** (see `DATA_DICTIONARY.md`).
- Dashboard endpoints: `GET /api/usage/summary`, `GET /api/usage/daily`, `GET/PUT /api/settings`, `GET /api/forecast`, `GET /api/alerts`, `POST /api/alerts/{id}/acknowledge`. Authenticated and tenant-scoped. Person B commits example JSON responses as mock fixtures on day one.
- Budget configuration: MYR monthly budget, billing period/timezone, actual thresholds (defaults 50/75/90), predictive overrun threshold, mode, approvals, hard-stop flag. Enforce `0 < preventive < high < critical <= 100`.
- Forecast data: simulated and real are distinguished; seeded history is labelled and never silently blended into real actuals.

## Shared repository and integration rules

1. One repository with protected `main`; branches `feature/system` (A) and `feature/dashboard` (B).
2. First commit: backend/frontend scaffolds, `.env.example`, schema, API contract, **mock provider**, and mock API fixtures. Person A merges it.
3. Small PRs, reviewed by the other person when possible. Never edit the other person's files without telling them.
4. Never commit provider credentials, Supabase service-role keys, user prompts or personal data. Frontend uses only safe public config.
5. Code against mocks until the real implementation is merged. Do not wait idly.
6. After every checkpoint: backend tests, frontend build, one gateway-to-dashboard smoke test.
7. Update `BUILD_STATUS.md` only after a test passes.

## Parallel 24-hour schedule

| Time | Person A — System logic | Person B — Dashboard, data & demo | Integration checkpoint |
|---|---|---|---|
| 0–1h | Scaffold, schema, gateway + policy contract, mock provider | Wireframe, mock API fixtures, seed data shape | **1h:** contract frozen |
| 1–4h | Auth + `/v1/messages` with mock/live provider | React scaffold, settings forms on mocks; Lumi non-streaming adapter | **4h:** Lumi → gateway → mock answer |
| 4–8h | Metering events + daily summaries; exact cache + tests | Usage cards/charts; seed script (90–120 days, labelled simulated) | **8h:** prompt → gateway → usage event → dashboard |
| 8–12h | Baseline forecast (7-day rolling avg) + forecast endpoint; settings API with validation | Editable budget/modes/thresholds wired to real API; forecast chart | **12h:** budget + forecast work end-to-end |
| 12–16h | Policy modes + predictive threshold → alerts (dedupe, acknowledge); hard stop; anomaly rule | Alerts UI, acknowledge vs approve controls, anomaly display | **16h:** predictive warning changes approved policy |
| 16–19h | Stretch: Ridge vs baseline MAE; tenant isolation + cache-bypass tests | E2E rehearsal, UI fixes, MAE/method display if Ridge lands | **19h:** full rehearsal, feature freeze |
| 19–22h | Integration bug fixes | Demo recording/slides + bug fixes | **22h:** clean install and repeatable demo |
| 22–24h | Support demo | Present/pitch | **Final:** critical fixes only |

## Critical dependency chain

1. **Gateway auth + mock provider** (A) → 2. **Metering event + persistence** (A) → 3. **Actual cost dashboard** (B) → 4. **Forecast and risk** (A) → 5. **Policy feedback into gateway** (A) → 6. **Alerts + demo** (A + B).

Person B is never blocked: every UI piece is built against mock fixtures first, and the seed script only depends on the agreed event shape.

## Minimum viable demo (must pass before any stretch work)

1. User sets an RM200 monthly budget and picks Adaptive, Manual, or Always-on with editable thresholds.
2. A safe FAQ goes through the gateway, gets a provider response, and logs real usage/cost.
3. Repeating the exact FAQ returns a cache hit and records avoided provider spend.
4. Labelled simulated history shows an illustrative RM280 month-end forecast, RM80 overrun, and an early alert **even though actual spend is below its trigger**.
5. Manual mode recommends without activating; Adaptive activates only pre-approved policies.
6. Alert acknowledgement is stored separately from approval or permission to exceed budget.
7. Optional hard stop blocks new upstream calls at the budget limit; warn-only continues with alerts.
8. A personalised request (e.g. leave balance) bypasses the cache; a second tenant cannot read the first tenant's data.

## Scope for two people

**Cut from the start:** model routing, prompt compression, OpenAI-compatible endpoint, savings what-if UI, Random Forest.

**Stretch only after the MVP demo passes (in this order):** Ridge vs baseline with chronological MAE → approved-FAQ semantic cache → savings scenario.

**Never cut:** gateway, tenant auth, correct metering, safe exact cache, budget/settings, baseline forecast, predictive warning, policy feedback, simulated-data labelling.

## Helper tasks (if a third or fourth person joins part-time)

Helpers take from this list and hand results to the owner; they do not own core files.
- Run `DEMO_TEST_PLAN.md` cases and log results in `BUILD_STATUS.md`.
- Write negative cache examples (tenure, personal balance, multilingual) as test fixtures for Person A.
- Draft slides, pitch script and screenshots for Person B.
- Verify Claude pricing table and USD→MYR rate assumptions.

## Team communication cadence

- 0:00 kickoff: roles, contract, credentials policy.
- Every 2–3 hours: 5-minute sync — done, next, blocker, interface change.
- At 4h, 8h, 12h, 16h, 19h: integration demo on one shared test tenant.
- At 19h: feature freeze; remaining time is QA, pitch and reproducibility.

## Handoff checklist

Each owner hands off: (a) changed files/PR, (b) API/interface and example payloads, (c) setup commands and env vars, (d) tests run with results, (e) limitations, (f) pending integration work. No claims of functionality without working tests.

## Existing Lumi chatbot integration (required)

- Existing application: Streamlit `chatbot.py` and `company_info.py` with `SYSTEM_PROMPT`; Anthropic SDK uses `client.beta.messages.stream`, `output_config.effort`, `cache_control`, and optional `betas` / `extra_body` fallbacks.
- **MVP:** keep Lumi UI, system prompt and history. Replace direct provider credentials with a TokenGuard gateway key and `base_url` pointing to the gateway. The gateway implements the Anthropic SDK's `/v1/messages` request/response shape for the non-streaming subset, including content blocks, model, usage and stop reason. Handle or explicitly reject Anthropic-specific headers.
- Temporarily replace `client.beta.messages.stream(...)` with non-streaming `client.messages.create(...)` in the demo adapter. Re-enable streaming only if the gateway implements Anthropic SSE event framing correctly.
- Temporarily omit unsupported `output_config`, `betas`, `extra_body` fallback, and provider cache-control options, or implement validated passthrough. Do not silently discard them.
- The gateway owns provider credentials server-side. The client receives a scoped TokenGuard key only.
- Preserve multi-turn context. Exact caching requires a safe canonical key including system prompt/version, messages, model, parameters, tenant and app.
- Token accounting uses returned actual model and usage fields. Provider prompt-cache reads/writes are distinct from TokenGuard response-cache hits.
- **Person A** owns the gateway, cache eligibility, and usage/cost storage. **Person B** owns the Lumi client adapter, dashboard and live demo.
- Smoke test: direct Lumi request works; same request via gateway works; safe repeat FAQ is cached; personalised/multi-turn question bypasses the cache; usage and budget alerts appear in the dashboard.

## Prediction work allocation

- **Person A owns forecasting and the policy loop:** daily aggregates, past-only features, 7-day rolling baseline (required), Ridge with chronological holdout MAE (stretch), month-end forecast, anomaly rule, alert dedupe, prediction endpoints and tests. Policy reads the latest persisted forecast snapshot; it never retrains in the request path. Manual mode suggests only.
- **Person B owns the simulated history and prediction UX:** deterministic seed (90–120 days, weekday variation, growth, one or two spikes, every row labelled `simulated`); budget input and accept-suggestion flow; display of data source, method (baseline/Ridge), as-of date, MAE when available, anomaly and limitations. Never present synthetic metrics as live customer results.
- Integration checks: H4 event schema + seed shape; H8 summaries on dashboard; H12 baseline forecast + budget wiring; H16 policy feedback; H19 freeze and demo.
