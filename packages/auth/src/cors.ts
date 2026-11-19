import { MOBILE_APP_ORIGINS } from "./origins";

/**
 * CORS для мобильного приложения (оболочка Capacitor, другой origin).
 *
 * Схема входа в приложении — bearer-токен better-auth, а не cookie: cookie
 * сайта из WebView другого origin режут и iOS (ITP), и Android (сторонние
 * cookie). Поэтому:
 *
 * - `Access-Control-Allow-Credentials` НЕ отдаём, а клиент приложения шлёт
 *   запросы с `credentials: "omit"`. Cookie сайта из чужого origin не уходят
 *   никогда, и страница на `https://localhost` (любой локальный сервер на
 *   чужой машине) не получит доступа к сессии, открытой на stariva.ru;
 * - `Access-Control-Allow-Origin` — только точный origin из списка, никогда
 *   `*`; всегда с `Vary: Origin`, чтобы кеш не отдал ответ другому origin;
 * - токен сессии уходит клиенту заголовком `set-auth-token`, который нужно
 *   явно открыть через `Access-Control-Expose-Headers`.
 */

/** Заголовки, которые приложение вправе слать (и которые мы разрешаем). */
export const CORS_ALLOWED_HEADERS = [
  "content-type",
  "authorization",
  // Токен формы: без него сервер не отправит код входа (antispam-plugin)
  "x-form-token",
  // Куда вернуть по кнопке из письма (sign-in-shared.ts)
  "x-stariva-sign-in-callback",
] as const;

/** Заголовки ответа, которые приложению нужно прочитать. */
export const CORS_EXPOSED_HEADERS = ["set-auth-token"] as const;

const ALLOWED_METHODS = "GET, POST, OPTIONS";
/** Сколько браузер может помнить ответ на preflight, секунды. */
const PREFLIGHT_MAX_AGE = "600";

/** Origin запроса, если ему разрешён доступ; иначе `null`. */
export function allowedCorsOrigin(
  request: Request,
  allowed: readonly string[] = MOBILE_APP_ORIGINS,
): string | null {
  const origin = request.headers.get("origin");
  return origin && allowed.includes(origin) ? origin : null;
}

function appendVary(headers: Headers, value: string) {
  const current = headers.get("vary");
  if (!current) {
    headers.set("vary", value);
    return;
  }
  const present = current
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (present.includes("*") || present.includes(value.toLowerCase())) return;
  headers.set("vary", `${current}, ${value}`);
}

/**
 * Ответ на preflight (OPTIONS). Разрешённому origin — 204 с заголовками CORS;
 * остальным — 403 без них: браузер всё равно не даст отправить запрос.
 */
export function corsPreflight(
  request: Request,
  allowed: readonly string[] = MOBILE_APP_ORIGINS,
): Response {
  const origin = allowedCorsOrigin(request, allowed);
  const headers = new Headers({ vary: "Origin" });
  if (!origin) return new Response(null, { status: 403, headers });
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", ALLOWED_METHODS);
  headers.set("access-control-allow-headers", CORS_ALLOWED_HEADERS.join(", "));
  headers.set("access-control-max-age", PREFLIGHT_MAX_AGE);
  return new Response(null, { status: 204, headers });
}

/**
 * Добавляет заголовки CORS к ответу на запрос с разрешённого origin. Остальные
 * ответы (в том числе со своего сайта) отдаются как есть, только с `Vary:
 * Origin`.
 */
export function withCors(
  request: Request,
  response: Response,
  allowed: readonly string[] = MOBILE_APP_ORIGINS,
): Response {
  const headers = new Headers(response.headers);
  appendVary(headers, "Origin");
  const origin = allowedCorsOrigin(request, allowed);
  if (!origin) {
    // Токен сессии — только для приложения. Браузеру на сайте хватает
    // HttpOnly-cookie; читаемый из JS токен ослабил бы её защиту от XSS.
    for (const name of CORS_EXPOSED_HEADERS) headers.delete(name);
    const rest = (headers.get("access-control-expose-headers") ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(
        (h) =>
          h &&
          !(CORS_EXPOSED_HEADERS as readonly string[]).includes(
            h.toLowerCase(),
          ),
      );
    if (rest.length > 0) {
      headers.set("access-control-expose-headers", rest.join(", "));
    } else {
      headers.delete("access-control-expose-headers");
    }
  } else {
    headers.set("access-control-allow-origin", origin);
    // better-auth (bearer) уже мог открыть set-auth-token — дополняем, не затираем
    const exposed = new Set(
      (headers.get("access-control-expose-headers") ?? "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    );
    for (const name of CORS_EXPOSED_HEADERS) exposed.add(name);
    headers.set("access-control-expose-headers", [...exposed].join(", "));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
