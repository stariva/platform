import { logger } from "@stariva/config";
import { LogBudget, parseCspReports } from "@/lib/csp-report";
import { readJsonBody } from "@/lib/read-json";

export const runtime = "nodejs";

/** Один отчёт report-uri — около 1 КБ (в нём вся политика), пачка Reporting API — несколько. */
const MAX_BODY_BYTES = 32 * 1024;
const CONTENT_TYPES = [
  "application/csp-report",
  "application/reports+json",
  "application/json",
];
const budget = new LogBudget(60);

/**
 * Приёмник отчётов о нарушениях CSP страниц (report-uri и report-to из
 * csp.ts). Каждое нарушение — строка `csp.violation` в логе. Отвечаем 204
 * всем, кто прислал отчёт в правильном формате: браузеру ответ не нужен.
 */
export async function POST(request: Request) {
  const type = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (!type || !CONTENT_TYPES.includes(type.toLowerCase())) {
    return new Response(null, { status: 415 });
  }
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (body === "too_large") return new Response(null, { status: 413 });
  if (body === null) return new Response(null, { status: 400 });

  const userAgent = request.headers.get("user-agent")?.slice(0, 200);
  for (const violation of parseCspReports(body)) {
    const { allowed, droppedBefore } = budget.take(Date.now());
    if (droppedBefore > 0) {
      logger.warn("csp.violation.dropped", { count: droppedBefore });
    }
    if (allowed) {
      const { sample: _sample, ...fields } = violation;
      logger.warn("csp.violation", { ...fields, userAgent });
    }
  }
  return new Response(null, { status: 204 });
}
