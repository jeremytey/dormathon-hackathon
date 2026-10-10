# TokenGuard AI dashboard demo

A business-owner dashboard for predicting AI chatbot costs before the monthly budget is exhausted. Approved scope: SPEC.md. Original backend plans: build_pack/.

## Run

Node.js 24+ is required for native TypeScript tests.

```sh
npm install
npm run dev
```

Open http://localhost:3000/dashboard. No API key, database or login is required. LLM_MOCK=1 is compatible; this milestone makes no LLM calls.

## Demo

Overview shows RM73.95 observed spending against a RM200 budget, with a calculated RM252.43 month-end forecast as of 10 October 2026. Forecast explains the seven completed days baseline, budget crossing, anomalies and chronological synthetic backtest. Acknowledge a warning separately from changing budget or policy.

Five routes: Overview, Usage & Costs, Forecast, Alerts, Budget & Policies. Settings and acknowledgements persist across navigation and reset on refresh. All data is simulated. Controls do not activate real caching or pause provider requests.

## Architecture

- lib/forecast.ts: deterministic arithmetic, dates, budget crossing and past-only backtest.
- lib/demo-data.ts: 120 reproducible simulated days, anomalies and historical budget suggestion.
- lib/policy.ts: Zod validation and independent actual/forecast risk.
- app/dashboard/: Next.js App Router pages and shared layout.
- components/dashboard/: responsive shell, charts and demo state.
- components/ui/: adapted shadcn/ui primitives.

Forecast = observed month spending + unrounded recent daily mean times remaining calendar days. Sparse history is labelled; no recent history produces no forecast. Backtest MAE describes simulated daily predictions, not real-world accuracy. No AI-generated numbers or fabricated measured savings.

## Verification

```sh
npm test
npm run lint
npm run build
```

Deploy as a Next.js project on Vercel; no environment variables required for this demo. The project delivery rule requires live deployment verification. Future authentication, tenant isolation, FastAPI gateway and Supabase integration remain separate milestones.

The shadcn CLI registry request failed certificate verification. Cached dependencies and adapted primitives were used without disabling TLS checks.
