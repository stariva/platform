import { analyticsPath, maskContacts } from "@/lib/analytics";

/**
 * Отчёты браузеров о нарушениях CSP страниц (см. csp.ts). Приходят в двух
 * форматах: старый report-uri (`application/csp-report`, один отчёт
 * `{"csp-report": {...}}` с ключами через дефис) и Reporting API
 * (`application/reports+json`, массив `{type, url, body}` с camelCase).
 */

/** Нарушение без секретов: адреса без query и токенов, образец кода без контактов. */
export interface CspViolation {
  documentUrl: string;
  blockedUrl: string;
  directive: string;
  disposition: string;
  sourceFile?: string;
  line?: number;
  column?: number;
  sample?: string;
}

/** Больше отчётов из одного запроса не разбираем: Chrome шлёт пачки, но небольшие. */
export const MAX_REPORTS_PER_REQUEST = 20;
const MAX_FIELD_LENGTH = 200;

type Fields = Record<string, unknown>;

function text(value: unknown, max = MAX_FIELD_LENGTH): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return value.slice(0, max);
}

function position(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Адрес из отчёта без query и hash, с заменой секретных путей (ссылки на
 * заказ и видео работают как пароль). Ключевые слова CSP («inline», «eval»)
 * остаются как есть, у data:/blob: — только схема.
 */
export function reportUrl(value: unknown): string | undefined {
  const raw = text(value, 2000);
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return /^[a-z-]+$/i.test(raw) ? raw : "invalid";
  }
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
    return url.protocol;
  }
  return `${url.origin}${analyticsPath(url.pathname)}`.slice(
    0,
    MAX_FIELD_LENGTH,
  );
}

function violation(
  fields: Fields,
  names: {
    document: string;
    blocked: string;
    directive: string;
    source: string;
    line: string;
    column: string;
    sample: string;
  },
): CspViolation | undefined {
  const documentUrl = reportUrl(fields[names.document]);
  const directive =
    text(fields[names.directive], 64) ?? text(fields["violated-directive"], 64);
  if (!documentUrl || !directive) return undefined;
  const sample = text(fields[names.sample], 80);
  return {
    documentUrl,
    blockedUrl: reportUrl(fields[names.blocked]) ?? "",
    directive,
    disposition: text(fields.disposition, 16) ?? "enforce",
    sourceFile: reportUrl(fields[names.source]),
    line: position(fields[names.line]),
    column: position(fields[names.column]),
    sample: sample === undefined ? undefined : maskContacts(sample),
  };
}

const LEGACY = {
  document: "document-uri",
  blocked: "blocked-uri",
  directive: "effective-directive",
  source: "source-file",
  line: "line-number",
  column: "column-number",
  sample: "script-sample",
};

const REPORTING_API = {
  document: "documentURL",
  blocked: "blockedURL",
  directive: "effectiveDirective",
  source: "sourceFile",
  line: "lineNumber",
  column: "columnNumber",
  sample: "sample",
};

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Нарушения из тела отчёта любого из двух форматов; чужие типы отчётов пропускаем. */
export function parseCspReports(body: unknown): CspViolation[] {
  if (Array.isArray(body)) {
    return body
      .slice(0, MAX_REPORTS_PER_REQUEST)
      .flatMap((report) =>
        isFields(report) &&
        report.type === "csp-violation" &&
        isFields(report.body)
          ? (violation(report.body, REPORTING_API) ?? [])
          : [],
      );
  }
  if (isFields(body) && isFields(body["csp-report"])) {
    const parsed = violation(body["csp-report"], LEGACY);
    return parsed ? [parsed] : [];
  }
  return [];
}

/**
 * Сколько отчётов в минуту попадает в лог. Посетителю ответ не важен (браузер
 * шлёт отчёты в фоне), поэтому лишние не отклоняем, а просто не пишем: сломанная
 * политика на популярной странице или поток подделок не забьют лог.
 */
export class LogBudget {
  private windowStart = 0;
  private used = 0;
  private dropped = 0;

  constructor(private readonly perMinute: number) {}

  /** `allowed` — писать ли отчёт; `droppedBefore` — сколько выкинули в прошлом окне. */
  take(now: number): { allowed: boolean; droppedBefore: number } {
    let droppedBefore = 0;
    if (now - this.windowStart >= 60_000) {
      droppedBefore = this.dropped;
      this.windowStart = now;
      this.used = 0;
      this.dropped = 0;
    }
    if (this.used >= this.perMinute) {
      this.dropped++;
      return { allowed: false, droppedBefore };
    }
    this.used++;
    return { allowed: true, droppedBefore };
  }
}
