---
name: tokenguard-ai-builder
description: Build TokenGuard AI, a multi-tenant, budget-aware AI gateway with safe caching, usage metering, predictive spending alerts, and configurable optimisation policies. Use for implementing, testing, or extending the TokenGuard AI hackathon MVP.
---

# TokenGuard AI — Coding Agent Skill

## Mission
Build a working, demoable **TokenGuard AI** MVP for a 24-hour hackathon, Track 1: **Predict Early, Decide Better**. Users connect an existing AI chatbot by changing its compatible API base URL and supplying a TokenGuard gateway key. The gateway tracks actual AI usage and costs, safely avoids repeat LLM calls, predicts monthly spend, flags anomalies, and applies **pre-authorised** budget-aware policies. Provide a dashboard for settings, forecasts, alerts, acknowledgement, and what-if savings.

**Read `IMPLEMENTATION_PLAN.md` and `TECHNICAL_SPEC.md` in this folder before coding.** Follow their milestones in order. Do not pretend optional features are finished. If assumptions are needed, document them in README.

## Hard requirements
1. **Working end-to-end first:** request -> authenticated gateway -> cache/provider -> response -> usage event -> dashboard. Do not build an attractive dashboard with fake live metrics instead of the real pipeline.
2. **Safe caching:** exact caching only for explicitly eligible deterministic, stateless requests with a cache key incorporating tenant, application, provider/model, instructions, relevant parameters, and canonical request content. Bypass caching for tool calls, personal information, conversations, streaming, volatile data, and unknown cases. Semantic caching is **opt-in for approved public FAQ collections only**, isolated by tenant/application/FAQ version; confidence alone is never a safety guarantee.
3. **No invisible quality loss:** preserve requested response format and user instructions. Never silently downgrade models or truncate answers. Model routing is off by default until user explicitly approves eligible task classes and fallback behavior. Output optimisation may cap verbose output only where configured and compatible.
4. **Budget-aware control:** configurable monthly budget, self-set or historically suggested (never automatically increase a budget). Modes: Adaptive (default), Manual, Always-on. Configurable preventive/high/critical actual-spend triggers (defaults 50/75/90%), plus predictive overrun triggers. All thresholds are editable; validate 0 < preventive < high < critical <= 100. Apply only approved policies. Default budget enforcement is warn-and-continue; hard stop at 100% is opt-in.
5. **Prediction and action:** aggregate daily costs; show current actual spend, projected end-of-month spend, projected budget percentage, estimated overrun, and estimated crossing date if supported. Detect anomalies using explainable rolling baselines. Recommend interventions and simulate potential savings with transparent assumptions. Trigger alerts and record acknowledgement separately from permission to optimise or continue spending.
6. **Cost integrity:** record provider-reported token counts when available; otherwise mark estimates. Cache hits consume zero *downstream generation* tokens, but have gateway/embedding/database costs. Separate baseline estimated provider spend, actual provider spend, gross avoided provider spend, and estimated net savings. Do not claim net savings without accounting for overhead assumptions.
7. **Multi-tenancy/security:** never expose provider API keys to browser; encrypt secrets at rest or use a secure secrets manager. Gateway keys are hashed and scoped. Every database query must be tenant-scoped, with RLS where applicable. Do not log raw prompts/responses by default; log minimal metadata and hashed cache keys. Rate limit, set timeouts, and fail closed on auth errors.
8. **Demo data honesty:** seed 30–60 days of labelled simulated historical usage for forecasting, clearly separated from real gateway events. No fabricated benchmark results or unsupported accuracy/savings claims.

## Default stack
- Python 3.11+, FastAPI gateway; LiteLLM as provider adapter; httpx; Pydantic.
- Supabase Postgres for tenants, apps, usage, policies, alerts, and forecasts.
- Exact cache: Postgres for MVP (Redis optional); semantic cache: SentenceTransformers embeddings + pgvector (preferred if available) or ChromaDB with strict tenant isolation. Keep optional dependency behind feature flag.
- Prediction: pandas + scikit-learn or transparent rolling baseline. React + Vite + TypeScript dashboard (Streamlit fallback only if time-critical).
- Tests: pytest + FastAPI TestClient, frontend smoke tests. Local `.env.example`, Docker optional.

## Work sequence
**Phase 0 — Scaffold:** repository, env example, schema/migrations, README, scripts, test harness.
**Phase 1 — Gateway:** `POST /v1/messages` (non-streaming Anthropic Messages-compatible subset for existing Lumi chatbot); OpenAI-compatible `/v1/chat/completions` is optional after Lumi works, tenant/app key validation, upstream provider call, response passthrough, provider error handling, request ID. Explicitly reject unsupported request types rather than returning malformed data.
**Phase 2 — Metering:** capture token usage/cost and request metadata (cache hit/miss, latency, provider, model, app), write idempotent events; per-day aggregation and actual-spend API.
**Phase 3 — Exact cache:** strict eligibility, safe key construction, TTL, cache-hit logging, clear savings estimate.
**Phase 4 — Dashboard/settings:** real usage data, budget configuration, three modes, editable actual/predictive thresholds, cache toggles, alert acknowledgement, hard-stop toggle.
**Phase 5 — Forecasting/alerts:** seed simulated history; daily forecast, budget-crossing risk, anomaly detection, deduplicated alerts and recommendations.
**Phase 6 — Optional advanced:** approved-FAQ semantic cache, quality tests, opt-in model routing, what-if savings simulations, user-facing action approval.
**Phase 7 — Demo/reliability:** scripted baseline-vs-optimised demo, simulated spike, risk-triggered policy, hard-stop demonstration, screenshots, test report.

## Agent operating rules
- Implement one phase at a time. Run tests and report actual pass/fail status before proceeding.
- For each phase, state files changed, API behavior, verification command, and limitations.
- Prefer deterministic rules over extra LLM calls for risk policies.
- No silent provider-specific assumptions; verify supported LiteLLM response semantics in the installed version.
- **Existing demo first:** Preserve `chatbot.py` and `company_info.py`; use the Anthropic SDK against a compatible TokenGuard base URL. Do not rebuild Lumi. Begin with non-streaming messages and disable unsupported beta/fallback/effort options until explicitly implemented. Preserve the system prompt and conversation history. Test provider usage, cache-read/write fields, model identifiers and cost accounting against actual returned values.
- Distinguish **request-path** logic (auth, policy, cache, provider, meter) from **background** logic (aggregation, forecast, anomaly, alerts). Request completion must not wait for forecasting.
- Ensure policy updates affect **future** requests; do not retroactively change historical records.
- Treat a forecast as a projection with assumptions, not a guarantee. Avoid retraining on simulated data as if it were genuine customer history.
- Maintain `BUILD_STATUS.md` with checkboxes for implemented, tested, deferred, and known issues.

## Definition of done
A new tenant can configure a gateway key, budget and thresholds; send a supported prompt through TokenGuard; see a correct upstream response; repeat a safe FAQ and get an exact cache hit; see usage/cost events; view forecast and anomaly alerts using clearly labelled seed data; adjust policies and see changes applied to subsequent eligible requests; acknowledge an alert; and demonstrate optional budget hard-stop. Automated tests prove tenant isolation, cache safety, forecast arithmetic, and policy precedence. Optional semantic caching/model routing must be explicitly marked if not implemented.

## Two-person team execution (mandatory)
This is a **two-person parallel 24-hour build**, not one agent sequentially doing every phase. Read `TEAM_EXECUTION_PLAN.md` and `API_CONTRACT.md` before coding. Respect file ownership and shared interfaces; Person A owns all system logic (gateway, cache, policy, metering, forecast, alerts); Person B owns dashboard, simulated seed data, Lumi client adapter and demo. Merge working vertical slices at 4h, 8h, 12h, 16h, and 19h. Each owner must report passing tests and blockers. Freeze optional features at 19h and prioritise the demo. If acting as a coding agent for one person, only modify that person's owned files unless an interface change is explicitly agreed.


## Existing Lumi chatbot integration (required)

- Existing application: Streamlit `chatbot.py` and `company_info.py` with `SYSTEM_PROMPT`; Anthropic SDK uses `client.beta.messages.stream`, `output_config.effort`, `cache_control`, and optional `betas` / `extra_body` fallbacks.
- **MVP:** keep Lumi UI, system prompt and history. Replace direct provider credentials with a TokenGuard gateway key and `base_url` pointing to the FastAPI gateway. The gateway must implement the Anthropic SDK's `/v1/messages` request/response shape for the supported non-streaming subset, including content blocks, model, usage and stop reason. The SDK may send Anthropic-specific headers; handle or reject explicitly.
- Temporarily replace `client.beta.messages.stream(...)` with a supported non-streaming `client.messages.create(...)` call in the demo adapter; show the returned text using Streamlit. Re-enable streaming only if the gateway correctly implements Anthropic SSE event framing, not just text chunks.
- Temporarily omit unsupported `output_config`, `betas`, `extra_body` fallback, and provider cache-control options, or implement validated passthrough for each. Do not silently discard them.
- The gateway owns provider credentials server-side. Client receives a scoped TokenGuard key. Never put a real provider secret in Streamlit browser state.
- Preserve multi-turn context; shared semantic caching only for explicitly approved stateless public FAQs. Exact caching requires a safe canonical key including system prompt/version, messages, model, parameters, tenant and app.
- Token accounting must use returned actual model and usage fields. Provider prompt cache reads/writes are distinct from TokenGuard response-cache hits. Verify the pricing table and model availability against the live provider before claiming costs.
- Person A owns gateway, cache eligibility and usage/cost storage; Person B owns the Lumi client adapter, dashboard and live demo.
- Smoke test: direct Lumi request works; same request via gateway works; safe repeat FAQ is cached; personalised/multi-turn question bypasses shared semantic cache; usage and budget alerts appear in dashboard.

## Existing Lumi knowledge base: authoritative demo context
The user has supplied `company_info.py`, containing fictional **Lumora Technologies Sdn. Bhd. Employee Handbook v3.2, updated 1 July 2026**, and `SYSTEM_PROMPT` for Lumi. This is the demo application's source of truth. **Never regenerate, summarise, replace, or edit the handbook without user approval.** `chatbot.py` and `company_info.py` are existing user-owned files, not files the agent should invent. If absent from the repository, ask for them. Read `LUMI_KNOWLEDGE_BASE.md`, `LUMI_INTEGRATION.md`, and `DEMO_TEST_PLAN.md` before implementation.

Critical implementation constraints: employee tenure changes annual leave entitlement (16/18/22 days); do not semantic-cache a single entitlement response for all employees. Employee-specific leave balances and salary are unavailable to Lumi. Requests about sensitive incidents, medical/mental health issues, or private records must bypass semantic caching. Language is user-selected (English/Malay/Chinese); cache keys and semantic FAQ approvals must respect language and output policy. Handbook version/hash invalidates stale entries. Avoid logging raw employee prompts. Provider-native prompt caching and gateway response caching are different. `max_tokens=64000` in the current chatbot is not a sensible default for cost optimisation; cap only with user-approved, model-compatible limits, and never silently truncate a response.

Use the existing chatbot for a **before vs after** demo, but compare identical prompts, models, system instructions, output requirements and equivalent cache state. Clearly label provider-billed versus estimated costs and real versus seeded usage. All customer demo data is fictional; do not suggest that this fictional company's HR contacts or policies are real.


## Forecasting specification — authoritative v3 addition
- **Budget is not the forecast:** the business sets `monthly_budget_myr`, or explicitly accepts a suggestion from historical completed-month spending. Never silently change budget or use a prediction as the limit.
- Build a **mathematical rolling-average baseline AND trained ML candidate(s)** (Ridge Regression; RandomForestRegressor optional). ML is trained on historical *daily* observations and evaluated against the baseline using chronological holdout / rolling-origin validation. Never call the rolling average ML.
- Primary target: **next-day provider spend in MYR**; forecast remaining days recursively or via calendar-aware daily projections; sum predicted future daily costs plus month-to-date actual spend. If insufficient reliable history, fall back to baseline and disclose this.
- At inference, use only known calendar features and historical lag/rolling features. No future request count, future token counts, future cache hit rate or future daily cost. Never use actual future data when computing features or evaluating.
- Track provenance (`real` versus `simulated`), training cutoff, model version, evaluation MAE, and forecast generation timestamp. Demo synthetic history must never be passed off as real-world validation.
- Trigger decisions from **actual budget utilisation and predicted month-end budget utilisation independently**; policy engine acts only on pre-authorised settings. Prediction never directly mutates approvals.
- Anomaly detection uses a trailing-window baseline and explicit minimum-history/low-volume safeguards. Savings scenarios are assumption-based simulations, not measured savings or a separately trained ML model.
- See `ML_FORECASTING_SPEC.md`, `DATA_DICTIONARY.md`, `TEAM_EXECUTION_PLAN.md`, and `API_CONTRACT.md` before implementing prediction.
