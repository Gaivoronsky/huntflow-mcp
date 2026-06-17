const BASE_URL = (process.env.HUNTFLOW_BASE_URL || "https://api.huntflow.ru/v2").replace(/\/+$/, "");
// HuntFlow v2 requires a User-Agent header — without it you get 400 bad_user_agent.
// Recommended format: App/version (contact email). Configurable via env.
const USER_AGENT = process.env.HUNTFLOW_USER_AGENT || "huntflow-mcp/1.5.0 (+https://github.com/Gaivoronsky/huntflow-mcp)";
const TIMEOUT = 10_000;
const UPLOAD_TIMEOUT = 30_000; // file upload + parsing takes longer than a regular request
const MAX_RETRIES = 3;

function getToken(): string {
  const token = process.env.HUNTFLOW_TOKEN;
  if (!token) {
    throw new Error("HUNTFLOW_TOKEN is required. Get it in HuntFlow settings: Settings → API.");
  }
  return token;
}

// HuntFlow returns the error body as { errors: [{ type, title?, detail?, value? }] }.
// We extract a human-readable reason to propagate it outward (instead of swallowing it).
function extractErrorDetail(body: unknown): string {
  if (body && typeof body === "object" && Array.isArray((body as { errors?: unknown[] }).errors)) {
    const errors = (body as { errors: Array<Record<string, unknown>> }).errors;
    const parts = errors
      .map((e) => {
        const label =
          (e.detail as string) ||
          (e.title as string) ||
          (Array.isArray(e.value) ? (e.value as unknown[]).join(", ") : (e.value as string)) ||
          "";
        if (e.type) return label ? `${e.type}: ${label}` : String(e.type);
        return label ? String(label) : "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 500);
  if (body && typeof body === "object") {
    try {
      return JSON.stringify(body).slice(0, 500);
    } catch {
      /* unreadable body */
    }
  }
  return "";
}

// Parses the upstream error response and propagates a human-readable reason outward.
// Always throws (never) — shared code for hfRequest and hfUpload.
async function raiseUpstreamError(response: Response): Promise<never> {
  let detail = "";
  try {
    const ct = response.headers?.get?.("content-type") || "";
    detail = extractErrorDetail(ct.includes("json") ? await response.json() : await response.text());
  } catch {
    /* body unavailable or not parseable (often on 5xx) */
  }

  if (response.status === 401) {
    throw new Error(
      `HuntFlow: invalid or expired token (HTTP 401). Check HUNTFLOW_TOKEN${detail ? ` — ${detail}` : ""}.`,
    );
  }

  throw new Error(`HuntFlow HTTP ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`);
}

// Generic request to the HuntFlow API.
// IMPORTANT: retries (429/5xx, abort) apply ONLY to idempotent GET requests.
// We deliberately do not retry POST — otherwise an auto-retry would create duplicate records (comments).
export async function hfRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = getToken();
  const isIdempotent = method.toUpperCase() === "GET";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
      };
      if (body !== undefined) headers["Content-Type"] = "application/json";

      const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) return response.json();

      // Retries only for GET (429 rate limit / 5xx). We honor Retry-After.
      if (isIdempotent && (response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers?.get?.("retry-after"));
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 30_000)
            : Math.min(1000 * 2 ** (attempt - 1), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Propagate the upstream error body.
      await raiseUpstreamError(response);
    } catch (error) {
      clearTimeout(timer);
      // We retry a timeout-before-response only for idempotent requests.
      if (isIdempotent && error instanceof DOMException && error.name === "AbortError" && attempt < MAX_RETRIES) continue;
      throw error;
    }
  }
  throw new Error("HuntFlow: all retry attempts exhausted");
}

export function hfGet(path: string): Promise<unknown> {
  return hfRequest("GET", path);
}

// File upload (multipart/form-data) — POST /accounts/{id}/upload.
// Differences from hfRequest: the body is FormData (the `file` field), and we do NOT set Content-Type manually
// (fetch sets multipart/form-data + boundary on its own). X-File-Parse enables CV recognition.
// Like any POST — we do NOT retry: a repeat would create a duplicate of the uploaded file.
export async function hfUpload(
  path: string,
  data: Uint8Array,
  filename: string,
  opts?: { parse?: boolean; contentType?: string },
): Promise<unknown> {
  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

  try {
    const form = new FormData();
    // `as BlobPart`: @types/node 22 narrows ArrayBufferView to ArrayBuffer (not SharedArrayBuffer),
    // which is why a plain Uint8Array isn't assignable directly. Has no runtime effect.
    const blob = new Blob([data as BlobPart], { type: opts?.contentType || "application/octet-stream" });
    form.append("file", blob, filename);

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "User-Agent": USER_AGENT,
    };
    if (opts?.parse) headers["X-File-Parse"] = "true";

    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) return response.json();
    await raiseUpstreamError(response);
    throw new Error("HuntFlow upload: unreachable"); // raiseUpstreamError always throws
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}
