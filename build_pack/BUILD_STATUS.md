# TokenGuard AI — Build status

Update this file after each phase; check a box only after implementation and testing.

- [ ] Phase 0: scaffold + schema + seed
- [ ] Phase 1: authenticated gateway + provider response
- [ ] Phase 2: usage/cost metering
- [ ] Phase 3: safe exact cache
- [ ] Phase 4: dashboard + editable policy settings
- [ ] Phase 5: forecast + anomaly + deduplicated alerts
- [ ] Phase 6: optional semantic FAQ cache + scenarios + routing
- [ ] Phase 7: integration/security tests + demo

## Current blockers
None recorded.

## Test results
Person A backend (Next.js, LLM_MOCK=1, `next start`), 2026-10-10 — manual curl smoke tests, all passed:
- Gateway: valid key 200 (Anthropic shape); bad key 401; `stream:true` / `tools` rejected 400.
- Exact cache: repeat FAQ miss -> exact_hit; personal question and multi-turn -> bypass; cache off in settings -> bypass.
- Metering: one event per request; /api/usage/daily and /summary keep real vs simulated separate.
- Settings: bad threshold order rejected 400; saved settings apply to the next request.
- Forecast (simulated history, 120 days): Ridge chosen, holdout MAE RM1.98 vs baseline RM2.92 (95 train / 24 holdout days),
  matches an independent numpy implementation. Month-end RM261 (131%) vs RM200 budget; actual 41%. Real source with no history -> no forecast + reason.
- Policy/alerts: predictive early warning while actual is below threshold; adaptive turns on approved reply cap; manual only recommends;
  acknowledge marks seen only; alerts deduped; hard stop blocks with 403 and logs `blocked`.
- `npm run build` and `npm run lint` pass. Not yet verified on the live Vercel link or with the real Anthropic SDK.

## Deferred items
- Second tenant / tenant-isolation test: skipped by team decision (demo runs one tenant). Code keys cache, usage, settings and alerts by tenant, but isolation is untested.
- Dashboard auth: dashboard APIs are scoped to the single demo tenant, no login.
- Durable storage: in-memory store; data resets on restart and is not shared across Vercel instances.
- Cut from the start: semantic cache, model routing, prompt compression, savings what-if UI, Random Forest.

## Two-person ownership (see TEAM_EXECUTION_PLAN.md)
- [ ] Person A — System logic (gateway, cache, policy, metering, forecast, alerts): implementation / tests / integrated
- [ ] Person B — Dashboard, seed data, Lumi adapter, demo: implementation / tests / integrated

## Integration checkpoints
- [ ] Hour 1: API contract frozen
- [ ] Hour 4: Lumi → gateway → mock answer
- [ ] Hour 8: gateway → metering → dashboard
- [ ] Hour 12: forecast + settings
- [ ] Hour 16: policy feedback + alerts
- [ ] Hour 19: full rehearsal + feature freeze
- [ ] Hour 22: clean setup and demo verified

## Lumi integration
- [ ] Existing chatbot.py and company_info.py preserved
- [ ] Anthropic-compatible non-streaming /v1/messages endpoint tested
- [ ] Lumi routed through TokenGuard scoped gateway key
- [ ] Provider usage, model, caching and costs validated
- [ ] Unsupported beta/streaming features rejected or disabled explicitly
- [ ] Full Lumi → gateway → dashboard smoke test passed

## Latest integration acceptance checklist
- [ ] Existing original `chatbot.py` and `company_info.py` are present, unchanged except approved gateway client adapter.
- [ ] SDK non-streaming Anthropic-compatible gateway round-trip passes.
- [ ] First approved FAQ request provider call + second exact cache hit verified.
- [ ] Conditional leave and personal-balance requests bypass shared semantic cache.
- [ ] Handbook version/hash invalidates response cache.
- [ ] Forecast seeded history is visibly marked simulated.
- [ ] Manual/Adaptive/Always-on and threshold settings verified.
- [ ] Alerts, acknowledgement, optional hard-stop and policy consent verified.
- [ ] Two-person end-to-end demo and security tests pass.


## v3 prediction acceptance checklist
- [ ] Request events have unique IDs, tenant/app scope, source, provider usage, FX provenance and UTC timestamp.
- [ ] Synthetic seed is reproducible, labelled, and isolated from real operational totals.
- [ ] Daily aggregates and past-only features verified (no future leakage).
- [ ] Baseline rolling forecast implemented and tested on calendar-month rollover.
- [ ] Ridge model trained, chronological holdout MAE computed, baseline compared.
- [ ] Low-data fallback and negative-forecast clipping tested.
- [ ] Budget manual input + historical suggestion requiring approval verified.
- [ ] Actual and predicted trigger percentages independently tested.
- [ ] Anomaly detection uses past-only trailing baseline and suppresses low-data false alerts.
- [ ] Scenario simulation labels assumptions and differentiates gross/net estimated savings.
- [ ] Dashboard labels real vs simulated, model method, as-of date, MAE and limitations.
