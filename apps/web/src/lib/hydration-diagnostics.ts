/**
 * React #418 в продакшене не говорит, какой текст разошёлся. Снимаем тексты
 * серверной разметки до гидрации, а при ошибке сравниваем с тем, что
 * нарисовал клиент: строки, пропавшие и появившиеся, уходят в PostHog.
 */

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

/** Строки, которые есть только на сервере или только у клиента. */
export function textDiff(server: string[], client: string[]) {
  const serverSet = new Set(server);
  const clientSet = new Set(client);
  const only = (lines: string[], other: Set<string>) =>
    [...new Set(lines)]
      .filter((line) => !other.has(line))
      .slice(0, MAX_LINES)
      .map((line) => line.slice(0, MAX_LENGTH));
  return {
    server_only: only(server, clientSet),
    client_only: only(client, serverSet),
  };
}

export function watchHydrationMismatch(
  report: (properties: Record<string, unknown>) => void,
) {
  if (typeof document === "undefined") return;
  // Скрипты бывают раньше конца потока: дочитываем серверный текст к DOMContentLoaded.
  // Строки, которые гидрация уже не тронула, совпадут и в разницу не попадут.
  const server = new Set(textLines(document.body));
  const snapshot = () => {
    for (const line of textLines(document.body)) server.add(line);
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
          ...textDiff([...server], textLines(document.body)),
          html_lang: html.lang,
          html_class: html.className.slice(0, MAX_LENGTH),
          path: window.location.pathname,
        });
      } catch {
        /* optional */
      }
    }, 0);
  };
  window.addEventListener("error", onError);
}
