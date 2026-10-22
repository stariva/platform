import { analyticsPath } from "@/lib/analytics";
import { cartId } from "@/lib/cart/events";
import { type ContactChannel, contactChannelOf } from "@/lib/contacts";
import { currentEntry } from "./entry";

/** Как в схеме запроса (click-log.ts): блок — латиница, цифры, _ и -. */
const SOURCE = /^[\w-]{1,60}$/;

/**
 * Отправляет переход в мессенджер или звонок в журнал для админки. Ничего
 * не ждёт и не бросает; keepalive — ссылка tel: или мессенджер может сразу
 * увести со страницы.
 */
export function logContactClick(channel: ContactChannel, source?: string) {
  try {
    void fetch("/api/contact/clicks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browserId: cartId(),
        channel,
        ...(source && SOURCE.test(source) ? { source } : {}),
        page: analyticsPath(window.location.pathname).slice(0, 200),
        entry: currentEntry(),
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* optional */
  }
}

/**
 * Клик (в том числе колёсиком) по ссылке к мастеру где угодно на сайте:
 * в окне «Написать мастеру», в подвале, в чате. Блок — ближайший data-location.
 */
export function handleContactClick(event: MouseEvent) {
  if (event.type === "auxclick" && event.button !== 1) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;
  const channel = contactChannelOf(link.href);
  if (!channel) return;
  const source =
    link.closest("[data-location]")?.getAttribute("data-location") ?? undefined;
  logContactClick(channel, source);
}
