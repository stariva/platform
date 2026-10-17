import type { PostHog } from "posthog-node";
import { analyticsPath, maskContacts } from "@/lib/analytics";

/** PostHog EU Cloud, тот же проект, что и у браузерного SDK. */
const POSTHOG_HOST = "https://eu.i.posthog.com";
/** Серверные ошибки не принадлежат посетителю: один общий id без профиля человека. */
const SERVER_DISTINCT_ID = "stariva-web-server";

/** Не больше стольких событий в минуту: при падении БД ошибки сыплются тысячами. */
const MAX_PER_MINUTE = 30;
/** Одна и та же ошибка доходит и из onRequestError, и из console.error Next. */
const DUPLICATE_WINDOW_MS = 10_000;
const MAX_LOG_LENGTH = 1000;

export interface ServerErrorRequest {
  path: string;
  method: string;
}

export interface ServerErrorContext {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
}

function enabled() {
  return (
    !!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

let clientPromise: Promise<PostHog | undefined> | undefined;

function client() {
  clientPromise ??= import("posthog-node")
    .then(({ PostHog }) => {
      const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
      if (!token) return undefined;
      return new PostHog(token, {
        host: POSTHOG_HOST,
        // IP сервера в геолокации не нужен.
        disableGeoip: true,
        // Необработанные исключения и промисы процесса.
        enableExceptionAutocapture: true,
      });
    })
    .catch(() => undefined);
  return clientPromise;
}

/** Ключи в сообщении ошибки: почта и телефон покупателя не должны уйти в аналитику. */
export function sanitizeError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(maskContacts(String(error)));
  const copy = new Error(maskContacts(error.message));
  copy.name = error.name;
  if (error.stack) copy.stack = maskContacts(error.stack);
  return copy;
}

/** Только путь: query и токены из адреса в аналитику не идут. */
export function requestProperties(
  request?: ServerErrorRequest,
  context?: ServerErrorContext,
) {
  const properties: Record<string, string> = {};
  if (request) {
    properties.request_path = analyticsPath(
      request.path.split(/[?#]/)[0] ?? "",
    );
    properties.request_method = request.method;
  }
  if (context?.routePath) properties.route_path = context.routePath;
  if (context?.routeType) properties.route_type = context.routeType;
  if (context?.routerKind) properties.router_kind = context.routerKind;
  if (context?.renderSource) properties.render_source = context.renderSource;
  return properties;
}

function stringifyLogArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

/** Из аргументов console.error: ошибка (если есть) и текст для группировки. */
export function parseLogArgs(args: unknown[]) {
  const text = maskContacts(args.map(stringifyLogArg).join(" ")).slice(
    0,
    MAX_LOG_LENGTH,
  );
  const error = args.find((arg) => arg instanceof Error) ?? new Error(text);
  return { error, text };
}

const seen = new WeakSet<object>();
const recent = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

function isDuplicate(error: unknown, now: number) {
  if (error && typeof error === "object") {
    if (seen.has(error)) return true;
    seen.add(error);
  }
  const text = error instanceof Error ? error.message : String(error);
  const key = `${error instanceof Error ? error.name : ""}|${text}`;
  for (const [entry, at] of recent)
    if (now - at > DUPLICATE_WINDOW_MS) recent.delete(entry);
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

function overLimit(now: number) {
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  return ++windowCount > MAX_PER_MINUTE;
}

export async function reportServerError(
  error: unknown,
  properties: Record<string, unknown> = {},
): Promise<void> {
  if (!enabled()) return;
  try {
    const now = Date.now();
    if (isDuplicate(error, now) || overLimit(now)) return;
    const posthog = await client();
    await posthog?.captureExceptionImmediate(
      sanitizeError(error),
      SERVER_DISTINCT_ID,
      { $process_person_profile: false, ...properties },
    );
  } catch {
    // Мониторинг не должен ронять запрос.
  }
}

/** Хук Next.js onRequestError: ошибки рендера, route handlers и server actions. */
export async function reportRequestError(
  error: unknown,
  request: ServerErrorRequest,
  context: ServerErrorContext,
) {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  await reportServerError(error, {
    source: "onRequestError",
    digest,
    ...requestProperties(request, context),
  });
}

let patched = false;

/** Обработанные ошибки пишутся в console.error по всему коду: пересылаем и их. */
function captureConsoleErrors() {
  if (patched) return;
  patched = true;
  const original = console.error;
  let busy = false;
  console.error = (...args: unknown[]) => {
    original.apply(console, args);
    if (busy) return;
    busy = true;
    try {
      const { error, text } = parseLogArgs(args);
      void reportServerError(error, {
        source: "console.error",
        log_message: text,
      });
    } catch {
      // см. reportServerError
    } finally {
      busy = false;
    }
  };
}

/** Вызывается из register(): поднимает клиент (ловит падения процесса) и console.error. */
export function initServerErrorReporting() {
  if (!enabled()) return;
  void client();
  captureConsoleErrors();
}
