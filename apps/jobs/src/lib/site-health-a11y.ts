import type { SiteHealthFinding } from "@stariva/web-api/contract";
import axe from "axe-core";
import ruLocale from "axe-core/locales/ru.json";
import { JSDOM, VirtualConsole } from "jsdom";
import { limitText } from "./site-health-html";

const AXE_TIMEOUT_MS = 10_000;
const MAX_NODES_PER_RULE = 5;
const TARGET_PREVIEW_COUNT = 3;
const JSDOM_UNSUPPORTED_RULES = {
  "color-contrast": { enabled: false },
} as const;

interface AccessibilityAuditOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function severity(impact: axe.ImpactValue): SiteHealthFinding["severity"] {
  if (impact === "critical") return "critical";
  if (impact === "serious") return "warning";
  return "notice";
}

function ruleCode(id: string): string {
  return `axe_${id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`;
}

function selectorParts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(selectorParts);
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return [
      ...selectorParts(record.fromShadowDom),
      ...selectorParts(record.fromFrames),
    ];
  }
  return [];
}

function targetText(target: unknown): string {
  return limitText(selectorParts(target).join(" "), 500) ?? "";
}

function cleanHtml(html: string): string | null {
  return limitText(html.replace(/\s+/g, " ").trim(), 500);
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("axe_timeout"));
    }, timeoutMs);
    const abort = () => {
      cleanup();
      reject(signal?.reason ?? new Error("aborted"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    signal?.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function violationFinding(violation: axe.Result): SiteHealthFinding {
  const targetPreviews = [
    ...new Set(
      violation.nodes.map((node) => targetText(node.target)).filter(Boolean),
    ),
  ];
  const nodes = violation.nodes.slice(0, MAX_NODES_PER_RULE).map((node) => ({
    target: targetText(node.target),
    html: cleanHtml(node.html),
    failureSummary: limitText(node.failureSummary ?? null, 1000),
  }));

  return {
    severity: severity(violation.impact ?? null),
    code: ruleCode(violation.id),
    message:
      limitText(
        `Доступность: ${violation.help}. Затронуто элементов: ${violation.nodes.length}`,
        1000,
      ) ?? "Доступность: нарушение axe-core",
    target: limitText(
      targetPreviews.slice(0, TARGET_PREVIEW_COUNT).join("; ") +
        (targetPreviews.length > TARGET_PREVIEW_COUNT
          ? `; +${targetPreviews.length - TARGET_PREVIEW_COUNT}`
          : ""),
      2000,
    ),
    details: {
      engine: `axe-core ${axe.version}`,
      ruleId: violation.id,
      impact: violation.impact ?? null,
      description: violation.description,
      helpUrl: violation.helpUrl,
      tags: violation.tags,
      nodeCount: violation.nodes.length,
      nodesTruncated: violation.nodes.length > MAX_NODES_PER_RULE,
      nodes,
    },
  };
}

export async function auditAccessibilityHtml(
  html: string,
  pageUrl: string,
  options: AccessibilityAuditOptions = {},
): Promise<SiteHealthFinding[]> {
  const dom = new JSDOM(html, {
    url: pageUrl,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
  });

  try {
    dom.window.eval(axe.source);
    const injected = (dom.window as unknown as { axe?: typeof axe }).axe;
    if (!injected) throw new Error("axe_not_injected");
    injected.configure({ locale: ruLocale as unknown as axe.Locale });
    const results = await withTimeout(
      injected.run(dom.window.document, {
        resultTypes: ["violations"],
        iframes: false,
        preload: false,
        rules: JSDOM_UNSUPPORTED_RULES,
      }),
      options.timeoutMs ?? AXE_TIMEOUT_MS,
      options.signal,
    );
    return results.violations.map(violationFinding);
  } finally {
    dom.window.close();
  }
}
