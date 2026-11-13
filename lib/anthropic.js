// Minimal server-only client for the Anthropic Messages API. The project has
// no AI SDK, so this uses plain fetch. Never import this from client code.
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2026-10-21";
export const VISION_MODEL = "claude-sonnet-5-5";

export class ModelError extends Error {
  constructor(message, { retryable = false, status = 502 } = {}) {
    super(message);
    this.retryable = retryable;
    this.status = status;
  }
}

export function isModelConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Sends one user turn and returns the parsed JSON object constrained by `schema`.
export async function requestStructuredJson({ system, content, schema, maxTokens = 16000 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ModelError("Extraction is not configured: ANTHROPIC_API_KEY is missing on the server.", { status: 503 });
  }
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        // Lets the API retry a safety-classifier refusal on a recommended fallback model.
        "anthropic-beta": "server-side-fallback-2026-07-01"
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: maxTokens,
        fallbacks: "default",
        system,
        output_config: { effort: "medium", format: { type: "json_schema", schema } },
        messages: [{ role: "user", content }]
      }),
      signal: AbortSignal.timeout(100_000)
    });
  } catch (error) {
    throw new ModelError(error?.name === "TimeoutError" ? "The extraction model timed out." : "Could not reach the extraction model.", { retryable: true });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payload?.error?.message === "string" ? payload.error.message.slice(0, 300) : `HTTP ${response.status}`;
    const retryable = response.status === 429 || response.status >= 500;
    throw new ModelError(`Extraction model error: ${detail}`, { retryable, status: response.status === 401 || response.status === 403 ? 503 : 502 });
  }
  if (payload?.stop_reason === "refusal") throw new ModelError("The extraction model declined this input.");
  if (payload?.stop_reason === "max_tokens") throw new ModelError("The extraction output was cut off. Try a tighter crop.", { retryable: true });

  const text = (payload?.content || []).filter((block) => block.type === "text").map((block) => block.text).join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new ModelError("The extraction model returned invalid JSON.", { retryable: true });
  }
}

export function imageBlock(base64, mediaType) {
  return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
}

export function pdfBlock(base64) {
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
}
