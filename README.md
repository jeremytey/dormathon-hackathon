# TokenGuard AI

AI spend gateway and budget dashboard for the Lumi chatbot. One Next.js app (API routes + dashboard), deployed on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # LLM_MOCK=1 runs without an API key
npm run dev                  # http://localhost:3000
```

## Layout

| Path | What it is |
|---|---|
| `app/v1/messages/` | Anthropic-compatible gateway Lumi calls |
| `app/api/` | Dashboard endpoints: usage, settings, forecast, risk, alerts, anomalies, budget suggestion, demo reset |
| `app/page.tsx` | Redirects to `/dashboard` |
| `app/dashboard/` | Five-page dashboard: Overview, Usage & Costs, Forecast, Alerts, Budget & Policies |
| `lib/` | System logic: auth, cache, metering, pricing, forecast (baseline + Ridge), policy, risk, alerts, store, seed |
| `build_pack/` | Spec. Start with `build_pack/README.md`; progress is in `build_pack/BUILD_STATUS.md` |
| `tokenguard-project/` | Jo Ee's Python forecast that `lib/forecast.ts` and `lib/ridge.ts` were ported from (not used by the app) |
| `*.csv` | Sample usage data for the Python forecast |
| `AGENTS.md` | Team rules for coding agents |

## Dashboard demo status

Open `/dashboard`. The frontend currently uses reproducible simulated history and in-memory settings/acknowledgements, which reset on refresh. It does not yet consume the backend endpoints above. No real provider charges or optimisation effects are claimed by the demo UI.

The dashboard's original baseline and policy helpers are in `lib/demo-forecast.ts` and `lib/demo-policy.ts`. Backend services use `lib/forecast.ts` (baseline/Ridge) and `lib/policy.ts`. Keeping them separate preserves both workstreams until API integration is completed.

The approved frontend milestone is recorded in `build_pack/FRONTEND_DEMO_SCOPE.md`; the overall project specification is the build pack and current team rules in `AGENTS.md`.

## Frontend checks

Node.js 24+ is needed for the native TypeScript test runner.

```sh
npm test
npm run lint
npm run build
```
