// POST /v1/messages — Anthropic-compatible gateway for Lumi (non-streaming text subset).
import { resolveTenant } from "@/lib/auth";
import { callProvider } from "@/lib/provider";
import { AnthropicRequest } from "@/lib/schema";

function anthropicError(status: number, type: string, message: string) {
  return Response.json({ type: "error", error: { type, message } }, { status });
}

export async function POST(request: Request) {
  const tenant = resolveTenant(request.headers);
  if (!tenant) return anthropicError(401, "authentication_error", "Invalid TokenGuard gateway key");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return anthropicError(400, "invalid_request_error", "Body must be JSON");
  }

  const parsed = AnthropicRequest.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return anthropicError(
      400,
      "invalid_request_error",
      `Unsupported or invalid request (${issue.path.join(".") || "body"}): ${issue.message}`,
    );
  }

  // TODO(A, 4–8h): hard-stop check, exact cache lookup, metering event.
  const { response } = await callProvider(parsed.data);
  return Response.json(response);
}
