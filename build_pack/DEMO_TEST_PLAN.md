# TokenGuard AI — End-to-end demo and acceptance tests

## Golden path (use fictional/test data only)
1. Start FastAPI, Supabase and dashboard; run migrations. Confirm tenant A, app Lumi and scoped gateway key exist.
2. Run existing Lumi `chatbot.py` with its original `company_info.py`. Confirm its original direct-provider baseline in a controlled run, then switch the client to TokenGuard.
3. Ask 'What are Lumora's core working hours?' and validate the handbook-based answer: **10:00am–4:00pm**. First approved FAQ call is a cache miss and records provider-reported tokens.
4. Repeat the same request in a fresh stateless context with identical system prompt and settings: exact cache hit; **no downstream LLM call**; one cache-hit usage event.
5. Ask 'When must I be reachable on Slack?' in the same approved FAQ context: semantic hit only if pre-approved, similarity/eligibility checks pass and answer quality is verified; otherwise a safe miss is acceptable.
6. Ask 'How many annual leave days do I get?' and 'How much leave do I have left?': no unsafe shared semantic reuse; explain conditional tenure and inability to see personal records.
7. Ask in Malay or Chinese: check response language, no incorrect cross-language reuse.
8. Change handbook version/hash: stale FAQ caches must miss or invalidate.
9. Seed **labelled simulated** 30–60 day history; display forecast, anomalies, budget suggestion and savings what-if separately from actual usage.
10. Set manual budget RM200 and actual thresholds 50/75/90%; demonstrate a predictive risk alert before actual spending reaches 50%, then an authorised adaptive policy activation. Ensure acknowledgement alone never authorises a change.
11. Set mode Manual: show recommendation without automatic activation. Set Always-on: enable only selected, eligible policies. Set opt-in hard stop: demonstrate blocked request and recorded blocked event.
12. Validate multi-tenant isolation, revoked key 401, duplicate request idempotency, provider error handling and safe dashboard authentication.

## Quality and cost scorecard
- Record test case, expected section/answer, direct result, gateway result, cache type, provider call count, token fields, price source/version, latency, correctness, and quality notes.
- Compare matched model/prompt/settings. Report actual provider spend separately from estimated avoided provider spend and estimated overhead. Never assert zero total operating cost on cache hits.
- Forecast backtest: use chronological split of simulated daily data; show MAE (and optionally MAPE only when denominators valid). Do not claim performance on real users.

## Demo stop conditions
Do not present as working if provider integration, token metering, budget logic, tenant isolation, or one of the three modes fails. Defer model routing and prompt compression before sacrificing these.


## v3 — ML and budget demo (clearly synthetic)
1. Show user manually choosing RM200 monthly budget; show a historical recommendation separately, without silently applying it.
2. Show seeded simulated 120-day daily costs and explain provenance.
3. Display rolling-average baseline versus trained Ridge prediction and **chronological holdout MAE**. If Ridge is worse, show baseline as selected method.
4. Show actual utilisation below 50% while predicted month-end utilisation exceeds 100%, triggering an **early** warning.
5. In Manual mode, alert without automatic policy activation; in Adaptive mode, enable only a pre-approved semantic FAQ policy.
6. Demonstrate a personal leave-balance query bypassing semantic cache even when risk is high.
7. Show cost spike anomaly, recommended action, acknowledged alert, and distinct explicit approval control.
8. Show savings what-if assumptions, gross avoided provider cost, and estimated overhead; do not claim guaranteed net savings.
9. Show real Lumi request flowing through gateway and logged as `real`, separate from simulated history.
