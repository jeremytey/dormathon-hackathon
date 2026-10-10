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
| `app/page.tsx` | Dashboard |
| `lib/` | System logic: auth, cache, metering, pricing, forecast (baseline + Ridge), policy, risk, alerts, store, seed |
| `build_pack/` | Spec. Start with `build_pack/README.md`; progress is in `build_pack/BUILD_STATUS.md` |
| `tokenguard-project/` | Jo Ee's Python forecast that `lib/forecast.ts` and `lib/ridge.ts` were ported from (not used by the app) |
| `*.csv` | Sample usage data for the Python forecast |
| `AGENTS.md` | Team rules for coding agents |
