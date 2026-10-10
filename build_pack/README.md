# TokenGuard AI — Latest 4-person Hackathon Build Pack

Track 1: **Predict Early, Decide Better**. 24-hour hackathon, 4 parallel workstreams.

## What you already have
The user has a working Streamlit Lumi chatbot (`chatbot.py`) and fictional Lumora handbook/system prompt (`company_info.py`). **They are not included in this pack because the original source files belong to your existing project.** Copy your originals into the repo. Do not replace them with AI-generated alternatives.

## Start here
1. Unzip into your repository or share this folder with all four coding agents.
2. Add your original `chatbot.py` and `company_info.py` to the demo client folder.
3. Everyone reads `SKILL.md`, `API_CONTRACT.md`, and `TEAM_EXECUTION_PLAN.md`; each member then reads their specific files.
4. Paste `AGENT_START_PROMPT.md` into your coding agent and identify your role.
5. Agree on API/DB contracts in the first 45 minutes. Work in separate branches and integrate at fixed checkpoints.
6. Follow `IMPLEMENTATION_PLAN.md`; use `BUILD_STATUS.md` to record verified progress and `DEMO_TEST_PLAN.md` for acceptance tests.

## Files
- `SKILL.md`: authoritative coding agent instructions.
- `IMPLEMENTATION_PLAN.md`: phases and priorities.
- `TECHNICAL_SPEC.md`: architecture, data, policies, security and predictions.
- `API_CONTRACT.md`: shared endpoint and payload contracts.
- `TEAM_EXECUTION_PLAN.md`: four-person ownership and checkpoints.
- `LUMI_INTEGRATION.md`: exact adaptation instructions for the existing chatbot.
- `LUMI_KNOWLEDGE_BASE.md`: handbook rules and cache safety cases.
- `DEMO_TEST_PLAN.md`: scripted demo and quality checks.
- `AGENT_START_PROMPT.md`: starting instruction for AI agents.
- `BUILD_STATUS.md`: checklist to update after passing tests.

## Scope guardrails
MVP: Anthropic SDK-compatible text `/v1/messages` gateway, auth, real usage, safe exact cache, budget dashboard, simulated-history forecast, alerts, configurable modes/thresholds. Optional: approved semantic FAQ cache, savings scenario, anomaly improvements. Defer full streaming, beta fallback support, broad model routing, prompt compression, and universal provider support until core works.

## Secrets
Keep `ANTHROPIC_API_KEY`, TokenGuard keys and Supabase service role keys in local secrets/environment only. Do not commit credentials. Dashboard browser uses separate user authentication from gateway keys.


## v3 ML-enabled update
This pack now includes `ML_FORECASTING_SPEC.md` and `DATA_DICTIONARY.md`. Person 3 implements a trained Ridge forecasting candidate **and** a rolling-average baseline, with chronological backtesting and honest simulated-data labelling. Budgets are user-set or explicitly accepted from historical suggestions; they are not ML outputs. The existing Lumi source files remain external to this ZIP and must be supplied from your own project.
