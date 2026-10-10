# Lumi integration checklist

1. Preserve the existing `chatbot.py` and `company_info.py`. Do not rebuild Lumi.
2. Person 1: implement `POST /v1/messages` Anthropic-compatible non-streaming gateway. Parse `model`, `max_tokens`, `system`, `messages`; return Anthropic-style `id`, `type`, `role`, `model`, `content`, `stop_reason`, and `usage`. Unsupported features must return clear errors.
3. In `chatbot.py`, change client construction to `anthropic.Anthropic(api_key=TOKENGUARD_API_KEY, base_url=TOKENGUARD_BASE_URL)`. Keep provider API keys only in the gateway environment.
4. Replace `with client.beta.messages.stream(**kwargs)` with `final = client.messages.create(**supported_kwargs)`; extract `reply = "".join(block.text for block in final.content if block.type == "text")`. Use `st.markdown(reply)`. Do not send unsupported `betas`, `extra_body`, `output_config`, `cache_control` until implemented.
5. Use a real supported provider model identifier, verified at integration time. Keep the pricing configuration centrally on the gateway; do not treat demo prices as authoritative.
6. Person 2: enforce tenant/app isolation and approved stateless FAQ eligibility; multi-turn and personalised requests bypass semantic response cache.
7. Person 3: record actual provider usage and cache usage fields separately, distinguish response-cache hit from provider prompt-cache hit, and show simulated history as simulated.
8. Person 4: retain Lumi Streamlit as the existing-customer demo, and build a separate TokenGuard settings/analytics dashboard.
9. Test direct-vs-gateway response, safe cache hit, unsafe bypass, model/usage metering, adaptive thresholds, budget alerts and optional hard stop.
10. Only after the MVP passes, add Anthropic SSE streaming and advanced beta features if time remains.

## Existing code-specific changes
Current `chatbot.py` uses `anthropic`, `streamlit`, `COMPANY_NAME`, `SYSTEM_PROMPT`, `client.beta.messages.stream`, `output_config={"effort": effort}`, `cache_control={"type":"ephemeral"}`, and optional beta fallbacks. Preserve original in git before editing.

1. Add `TOKENGUARD_BASE_URL` and `TOKENGUARD_API_KEY` to environment or Streamlit secrets; **do not** reuse `ANTHROPIC_API_KEY` in the client. Use `anthropic.Anthropic(api_key=..., base_url=...)` only after the gateway is compatible with the SDK.
2. Use `client.messages.create(model=..., max_tokens=..., system=SYSTEM_PROMPT, messages=api_messages)` for the initial text-only non-streaming gateway. Extract text blocks from `final.content`. Do not pass unsupported beta fallback, `output_config`, or top-level `cache_control` in this MVP; document which original controls are temporarily disabled.
3. Keep the session chat history and UI, but display **TokenGuard's** actual metered costs separately from the chatbot's local estimate. Use `final.model` for any model-specific pricing, not just the user's selected model.
4. Current `estimate_cost` assumes manually entered prices and a 1.25 cache-write multiplier; these are illustrative and may not reflect real provider billing. Verify current provider model IDs, token pricing and prompt-cache fields before a live cost demo.
5. Existing `max_tokens=64000` may be unsupported or wasteful for this use case; choose a tested, configurable bound and do not confuse `max_tokens` with actual output tokens. Preserve correctness of handbook answers.
6. `SYSTEM_PROMPT` embeds the full handbook. Its stable prefix is a potential provider-native prompt-caching opportunity when the provider supports the chosen API mode. Gateway response caching remains separate and needs eligibility checks.
7. Use the knowledge-base version/hash in cache keys and invalidate on edits. For repeated chat turns, never reuse a response merely because the latest question text matches.
