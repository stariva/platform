/** Product data only: never pass buyer contact details to analytics. */
export const COUNTER_ID = 96190087;

export interface AnalyticsProduct {
  id: string;
  name: string;
  price: number; // RUB, not kopecks
  quantity?: number;
  category?: string;
}

export interface AnalyticsOrder {
  id: string;
  revenue: number; // RUB including delivery
  products: AnalyticsProduct[];
}

export function isAnalyticsHost(hostname: string) {
  return hostname === "stariva.ru" || hostname === "www.stariva.ru";
}

/** Preserve attribution, excluding auth tokens, arbitrary form data and hashes. */
export function analyticsUrl(value: string): string {
  try {
    const url = new URL(value);
    const query = new URLSearchParams();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid"]) {
      const entry = url.searchParams.get(key);
      if (entry) query.set(key, entry);
    }
    const path = url.pathname.replace(/^\/order\/[^/]+/, "/order/status");
    return `${url.origin}${path}${query.size ? `?${query}` : ""}`;
  } catch {
    return "";
  }
}

type QueuedMetrika = NonNullable<Window["ym"]> & { a?: unknown[][]; l?: number };
let initialized = false;
let previousPage = "";
const recordedOrders = new Set<string>();

function metrika() {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production" || !isAnalyticsHost(window.location.hostname)) return;
  try {
    if (!initialized) {
      window.dataLayer ??= [];
      if (!window.ym) {
        const queue: QueuedMetrika = (...args) => { (queue.a ??= []).push(args); };
        queue.l = Date.now();
        window.ym = queue;
      }
      window.ym(COUNTER_ID, "init", {
        defer: true, ecommerce: "dataLayer", webvisor: true,
        clickmap: true, trackLinks: true, accurateTrackBounce: true,
      });
      const script = document.createElement("script");
      script.src = "https://mc.yandex.ru/metrika/tag.js";
      script.async = true;
      document.head.appendChild(script);
      initialized = true;
    }
    return window.ym;
  } catch {
    // Analytics must not prevent shopping when a script or storage is blocked.
    return;
  }
}

export function trackPageView() {
  const ym = metrika();
  if (!ym) return;
  const url = analyticsUrl(window.location.href);
  if (url === previousPage) return;
  ym(COUNTER_ID, "hit", url, { title: document.title, referer: previousPage || analyticsUrl(document.referrer) });
  previousPage = url;
}

export function reachGoal(goal: string, params?: Record<string, unknown>) {
  try { metrika()?.(COUNTER_ID, "reachGoal", goal, params); } catch { /* optional */ }
}

export function trackProductEvent(event: "detail" | "add" | "remove", products: AnalyticsProduct[]) {
  try {
    if (!products.length || !metrika()) return;
    window.dataLayer?.push({ ecommerce: { currencyCode: "RUB", [event]: { products } } });
  } catch { /* optional */ }
}

function recordOnce(key: string, send: () => void) {
  if (!metrika() || recordedOrders.has(key)) return false;
  try { if (window.localStorage.getItem(key)) return false; } catch { /* memory fallback */ }
  send();
  recordedOrders.add(key);
  try { window.localStorage.setItem(key, "1"); } catch { /* memory fallback */ }
  return true;
}

/** Placed, not paid. Allow the counter time to flush before leaving for payment. */
export function trackCreatedOrder(order: AnalyticsOrder): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 800);
    const done = () => { clearTimeout(timeout); resolve(); };
    try {
      const sent = recordOnce(`stariva:analytics:created:${order.id}`, () => {
        window.dataLayer?.push({ ecommerce: { currencyCode: "RUB", purchase: {
          actionField: { id: order.id, revenue: order.revenue }, products: order.products,
        } } });
        window.ym?.(COUNTER_ID, "reachGoal", "order_created", { order_id: order.id, order_price: order.revenue, currency: "RUB" }, done);
      });
      if (!sent) done();
    } catch { done(); }
  });
}

/** paid comes from the authenticated server response, never payment=success. */
export function trackPaidOrder(orderId: string, amountKopecks: number, paid: boolean) {
  if (!paid) return;
  try {
    recordOnce(`stariva:analytics:paid:${orderId}`, () => {
      reachGoal("order_paid", { order_id: orderId, order_price: amountKopecks / 100, currency: "RUB" });
    });
  } catch { /* optional */ }
}
