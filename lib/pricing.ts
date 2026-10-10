// Provider cost in MYR. Plain code, no LLM.
// USD prices per 1M tokens: Anthropic first-party list prices (as of 2026-10-06).
// Haiku 5.5 price applies to prompts up to 100K tokens.
const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

// ASSUMPTION: fixed demo rate; override with USD_TO_MYR. Verify before the pitch.
export function usdToMyrRate(): number {
  const fromEnv = Number(process.env.USD_TO_MYR);
  return fromEnv > 0 ? fromEnv : 4.2;
}

// Returns null when the model has no known price (never guess a number).
export function costMyr(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = PRICES_USD_PER_MTOK[model];
  if (!price) return null;
  const usd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return usd * usdToMyrRate();
}
