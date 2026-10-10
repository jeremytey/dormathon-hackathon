import itertools
import time

import anthropic
import streamlit as st

SYSTEM_PROMPT = "You are a helpful, friendly assistant. Answer clearly and concisely, and say so when you are unsure."
AVATARS = {"user": "🧑", "assistant": "🤖"}

# USD per 1M tokens: (input, output, cache read)
PRICING = {
    "claude-opus-5-5": (4.00, 20.00, 0.20),
    "claude-sonnet-5-5": (2.00, 10.00, 0.20),
    "claude-haiku-5-5": (0.10, 0.50, 0.01),
}
# Models that support server-side refusal fallbacks
FALLBACK_MODELS = {"claude-opus-5-5", "claude-sonnet-5-5"}


def estimate_cost(model: str, usage: dict) -> float:
    inp, out, cache_read = PRICING[model]
    return (
        usage["input_tokens"] * inp
        + usage["cache_creation_input_tokens"] * inp * 1.25
        + usage["cache_read_input_tokens"] * cache_read
        + usage["output_tokens"] * out
    ) / 1_000_000


def render_usage(usage: dict) -> None:
    total = usage["input_tokens"] + usage["cache_creation_input_tokens"] + usage["cache_read_input_tokens"] + usage["output_tokens"]
    st.caption(
        f"🔢 **{total:,} tokens** — input: {usage['input_tokens']:,} · "
        f"output: {usage['output_tokens']:,} · "
        f"cache write: {usage['cache_creation_input_tokens']:,} · "
        f"cache read: {usage['cache_read_input_tokens']:,} · "
        f"≈ ${usage['cost']:.5f} ({usage['model']})"
        + (f" · ⏱️ {usage['seconds']:.1f}s" if "seconds" in usage else "")
    )


st.set_page_config(page_title="Chatbot", page_icon="💬")
st.title("💬 Chatbot")
st.caption("Ask me anything.")

if "messages" not in st.session_state:
    st.session_state.messages = []  # {"role", "content", "usage"?}

with st.sidebar:
    with st.expander("⚙️ Settings"):
        model = st.selectbox("Model", list(PRICING))
        effort = st.selectbox("Effort", ["low", "medium", "high"], index=0)

    usages = [m["usage"] for m in st.session_state.messages if m.get("usage")]
    st.divider()
    st.subheader("Session totals")
    st.metric("Input tokens", f"{sum(u['input_tokens'] + u['cache_creation_input_tokens'] + u['cache_read_input_tokens'] for u in usages):,}")
    st.metric("Output tokens", f"{sum(u['output_tokens'] for u in usages):,}")
    st.metric("Estimated cost", f"${sum(u['cost'] for u in usages):.4f}")
    if st.button("🗑️ Clear chat", use_container_width=True):
        st.session_state.messages = []
        st.session_state.toast = "Chat cleared"
        st.rerun()
    if toast := st.session_state.pop("toast", None):
        st.toast(toast, icon="🧹")

# Replay history
for msg in st.session_state.messages:
    with st.chat_message(msg["role"], avatar=AVATARS[msg["role"]]):
        st.markdown(msg["content"])
        if msg.get("usage"):
            render_usage(msg["usage"])

# Greeting on an empty chat
if not st.session_state.messages:
    st.markdown("#### 👋 Hi! What would you like to talk about?")

if prompt := st.chat_input("Type a message..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user", avatar=AVATARS["user"]):
        st.markdown(prompt)

    api_messages = [{"role": m["role"], "content": m["content"]} for m in st.session_state.messages]

    with st.chat_message("assistant", avatar=AVATARS["assistant"]):
        try:
            # Key from .streamlit/secrets.toml, else fall back to the ANTHROPIC_API_KEY env var
            api_key = st.secrets.get("ANTHROPIC_API_KEY") if st.secrets.load_if_toml_exists() else None
            client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
            kwargs = dict(
                model=model,
                max_tokens=64000,
                system=SYSTEM_PROMPT,
                messages=api_messages,
                output_config={"effort": effort},
                cache_control={"type": "ephemeral"},
            )
            if model in FALLBACK_MODELS:
                kwargs["betas"] = ["server-side-fallback-2026-07-01"]
                kwargs["extra_body"] = {"fallbacks": "default"}

            start = time.perf_counter()
            with client.beta.messages.stream(**kwargs) as stream:
                text = iter(stream.text_stream)
                # Spinner until the first words arrive, then stream the rest
                with st.spinner("Thinking...", show_time=True):
                    first = next(text, "")
                reply = st.write_stream(itertools.chain([first], text))
                final = stream.get_final_message()
            elapsed = time.perf_counter() - start

            if final.stop_reason == "refusal":
                reply = (reply or "") + "\n\n_⚠️ The model declined to answer this request._"
                st.markdown("_⚠️ The model declined to answer this request._")

            u = final.usage
            usage = {
                "model": final.model,
                "input_tokens": u.input_tokens,
                "output_tokens": u.output_tokens,
                "cache_creation_input_tokens": u.cache_creation_input_tokens or 0,
                "cache_read_input_tokens": u.cache_read_input_tokens or 0,
                "seconds": elapsed,
            }
            usage["cost"] = estimate_cost(model, usage)
            render_usage(usage)

            st.session_state.messages.append({"role": "assistant", "content": reply or "", "usage": usage})
            st.rerun()  # refresh sidebar totals
        except anthropic.AuthenticationError:
            st.error("Invalid or missing API key. Add it to .streamlit/secrets.toml.")
            st.session_state.messages.pop()
        except anthropic.RateLimitError:
            st.error("Rate limited — please wait a moment and try again.")
            st.session_state.messages.pop()
        except anthropic.APIStatusError as e:
            st.error(f"API error ({e.status_code}): {e.message}")
            st.session_state.messages.pop()
        except anthropic.APIConnectionError:
            st.error("Network error — check your internet connection.")
            st.session_state.messages.pop()
