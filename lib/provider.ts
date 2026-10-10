// Provider adapter. LLM_MOCK=1 (or no LLM_API_KEY) returns a cached reply,
// so the app runs without a key. Real replies are validated with Zod, retried once,
// then fall back to the cached reply.
import { randomUUID } from "crypto";
import { AnthropicResponse, type AnthropicRequest } from "./schema";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// fallback = real provider failed twice and the cached reply was served instead.
export type ProviderResult = { response: AnthropicResponse; mocked: boolean; fallback: boolean };

export function mockResponse(req: AnthropicRequest): AnthropicResponse {
  return {
    id: `msg_mock_${randomUUID()}`,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: "This is a cached mock reply from TokenGuard (LLM_MOCK=1). Office hours are 9am to 6pm, Monday to Friday.",
      },
    ],
    model: req.model,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 120, output_tokens: 40 },
  };
}

async function callAnthropic(req: AnthropicRequest, apiKey: string): Promise<AnthropicResponse> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Provider returned ${res.status}`);
  return AnthropicResponse.parse(await res.json());
}

export async function callProvider(req: AnthropicRequest): Promise<ProviderResult> {
  const apiKey = process.env.LLM_API_KEY;
  if (process.env.LLM_MOCK === "1" || !apiKey) {
    return { response: mockResponse(req), mocked: true, fallback: false };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { response: await callAnthropic(req, apiKey), mocked: false, fallback: false };
    } catch (err) {
      console.error(`Provider attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return { response: mockResponse(req), mocked: true, fallback: true };
}
