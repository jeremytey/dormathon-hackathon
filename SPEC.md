# TokenGuard AI — approved frontend demo scope

Approved in chat on 10 October 2026. This milestone is a frontend demo, not a working provider gateway.

## User and problem
The business owning an AI chatbot needs to understand provider spending and detect projected monthly budget overruns early. The demo uses fictional Lumora/Lumi data; no measured customer loss is claimed.

## Frontend
Next.js App Router, React, TypeScript, Tailwind and shadcn/ui. Light Notion-inspired design based on the user-supplied DESIGN-notion.md: neutral surfaces, blue actions, fine borders, minimal shadows. Routes: /dashboard, /dashboard/usage, /dashboard/forecast, /dashboard/alerts, /dashboard/settings. Shared responsive sidebar and header.

Review revision: preserve the original appearance, remove Overview's duplicate "Needs your attention" list, and add spending-chart hover/focus/tap details and active point/bar highlights. Keep the existing prediction chart and page structure. Request data fields follow the confirmed CSV headers, including actual_provider_cost_usd, usd_to_myr_rate and estimated_avoided_cost_usd; actual charges and estimated avoidance remain separate. CSV upload and live integration are not part of this revision.

## Data and prediction
Reproducible simulated daily history, explicitly labelled on every page. Daily observations are in MYR and isolated from real usage. No real gateway/API/database or authentication is claimed. Demo settings and alert acknowledgement live in memory and reset on refresh.

Prediction numbers come from deterministic TypeScript in lib/: trailing seven completed days mean, multiplied by remaining calendar days, plus observed month-to-date spending. Display actual and forecast utilisation separately, overrun, crossing date when meaningful, method, as-of date and insufficient-history state. Chronological past-only baseline backtesting reports daily MAE and sample count on simulated data, without claiming real-world accuracy or outperforming an ML model.

Alerts evaluate actual thresholds (50/75/90 default) independently from predicted utilisation (100 default). Show explainable past-only cost anomalies. Manual recommends; Adaptive only describes pre-approved controls; Always-on uses selected controls. No real optimisation executes. Acknowledgement never approves a policy, changes budget or overrides a hard stop.

## User actions
Navigate five pages; inspect costs, forecast and alerts; edit positive MYR budget, mode, ordered actual thresholds and predictive threshold; explicitly accept a complete-month historical suggestion; set exact-cache approval and approximate hard-stop preference; acknowledge alerts. Demo interactions remain consistent across navigation. Zod validates saved settings.

## Demo in three steps
1. Review simulated usage and an owner-selected monthly budget.
2. See actual usage below its warning threshold while calculated month-end prediction exceeds budget; inspect prediction method and synthetic backtest.
3. Acknowledge the early warning separately from editing budget/policy; save settings and see risk recalculate.

## Out of scope
Real authentication, Supabase setup, FastAPI gateway, provider credentials, live metering, real policy activation, streaming, model routing, prompt compression, semantic cache, Ridge/Random Forest training, savings what-if, employee chat UI. Original Lumi files remain user-owned and are not recreated. Backend integration follows agreed API contracts in a later milestone.

## Verification and delivery
Prediction arithmetic, chronological backtests, date boundaries, missing history, policy validation and acknowledgement semantics receive meaningful tests. Lint, type checks, production build and responsive browser smoke checks. Work on a branch, commit and open a PR; live Vercel deployment is the final project verification target. No LLM is used in this milestone; explanations are deterministic, so no API key is needed and LLM_MOCK=1 remains compatible.
