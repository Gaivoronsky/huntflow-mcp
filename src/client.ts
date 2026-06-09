const BASE_URL = (process.env.HUNTFLOW_BASE_URL || "https://api.huntflow.ru/v2").replace(/\/+$/, "");
// HuntFlow v2 требует заголовок User-Agent — без него 400 bad_user_agent.
// Рекомендованный формат: App/version (контактный email). Настраивается через env.
const USER_AGENT = process.env.HUNTFLOW_USER_AGENT || "huntflow-mcp/1.3.0 (+https://github.com/theYahia/huntflow-mcp)";
const TIMEOUT = 10_000;
const MAX_RETRIES = 3;

function getToken(): string {
  const token = process.env.HUNTFLOW_TOKEN;
  if (!token) {
    throw new Error("HUNTFLOW_TOKEN обязателен. Получите в настройках HuntFlow: Настройки → API.");
  }
  return token;
}

// HuntFlow возвращает тело ошибки в виде { errors: [{ type, title?, detail?, value? }] }.
// Достаём человекочитаемую причину, чтобы пробросить её наружу (а не глотать).
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
      /* нечитаемое тело */
    }
  }
  return "";
}

// Универсальный запрос к HuntFlow API.
// ВАЖНО: ретраи (429/5xx, abort) применяются ТОЛЬКО к идемпотентным GET-запросам.
// POST не ретраим намеренно — иначе авто-повтор создаст дубликаты записей (комментариев).
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

      // Ретраи только для GET (429 rate limit / 5xx). Учитываем Retry-After.
      if (isIdempotent && (response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers?.get?.("retry-after"));
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 30_000)
            : Math.min(1000 * 2 ** (attempt - 1), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Пробрасываем тело ошибки апстрима.
      let detail = "";
      try {
        const ct = response.headers?.get?.("content-type") || "";
        detail = extractErrorDetail(ct.includes("json") ? await response.json() : await response.text());
      } catch {
        /* тело недоступно или не парсится (часто на 5xx) */
      }

      if (response.status === 401) {
        throw new Error(
          `HuntFlow: неверный или истёкший токен (HTTP 401). Проверьте HUNTFLOW_TOKEN${detail ? ` — ${detail}` : ""}.`,
        );
      }

      throw new Error(`HuntFlow HTTP ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`);
    } catch (error) {
      clearTimeout(timer);
      // Таймаут до ответа повторяем только для идемпотентных запросов.
      if (isIdempotent && error instanceof DOMException && error.name === "AbortError" && attempt < MAX_RETRIES) continue;
      throw error;
    }
  }
  throw new Error("HuntFlow: все попытки исчерпаны");
}

export function hfGet(path: string): Promise<unknown> {
  return hfRequest("GET", path);
}
