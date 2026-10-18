/**
 * React #418 в продакшене не говорит, какой текст разошёлся. Снимаем тексты
 * серверной разметки до гидрации, а при ошибке сравниваем с тем, что
 * нарисовал клиент: строки, пропавшие и появившиеся, уходят в PostHog.
 */

import { analyticsPath } from "./analytics";

const HYDRATION_ERROR = /Minified React error #(418|423|425)|Hydration failed/;
const SKIP_PARENTS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
const MAX_LINES = 8;
const MAX_LENGTH = 160;

/** Непустые тексты страницы, без скриптов и приватных блоков. */
export function textLines(root: Node): string[] {
  const lines: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || SKIP_PARENTS.has(parent.tagName)) continue;
    if (parent.closest("[data-analytics-private]")) continue;
    const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
    if (text) lines.push(text);
  }
  return lines;
}

/** Лишние вхождения строк с учётом их количества в другом снимке. */
function extraLines(lines: string[], other: string[]) {
  const remaining = new Map<string, number>();
  for (const line of other) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  return lines.filter((line) => {
    const count = remaining.get(line) ?? 0;
    if (!count) return true;
    remaining.set(line, count - 1);
    return false;
  });
}

/** Строки, которые есть только на сервере или только у клиента. */
export function textDiff(server: string[], client: string[]) {
  const only = (lines: string[], other: string[]) =>
    extraLines(lines, other)
      .slice(0, MAX_LINES)
      .map((line) => line.slice(0, MAX_LENGTH));
  return {
    server_only: only(server, client),
    client_only: only(client, server),
  };
}

export function watchHydrationMismatch(
  report: (properties: Record<string, unknown>) => void,
) {
  if (typeof document === "undefined") return;
  // Скрипты бывают раньше конца потока: дочитываем серверный текст к DOMContentLoaded.
  // Строки, которые гидрация уже не тронула, совпадут и в разницу не попадут.
  const server = textLines(document.body);
  const snapshot = () => {
    // Общие вхождения уже учтены: сохраняем максимум из двух снимков.
    for (const line of extraLines(textLines(document.body), server))
      server.push(line);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", snapshot, { once: true });

  const onError = (event: ErrorEvent) => {
    const message = String(event.message || event.error?.message || "");
    const code = HYDRATION_ERROR.exec(message);
    if (!code) return;
    window.removeEventListener("error", onError);
    document.removeEventListener("DOMContentLoaded", snapshot);
    // React сообщает об ошибке после того, как перерисовал DOM, но подождём кадр.
    setTimeout(() => {
      try {
        const html = document.documentElement;
        report({
          error_code: code[1] ?? "hydration",
          ...textDiff(server, textLines(document.body)),
          html_lang: html.lang,
          html_class: html.className.slice(0, MAX_LENGTH),
          path: analyticsPath(window.location.pathname),
        });
      } catch {
        /* optional */
      }
    }, 0);
  };
  window.addEventListener("error", onError);
}
