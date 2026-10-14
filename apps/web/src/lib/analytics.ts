import type { CaptureResult, PostHog, Properties } from "posthog-js";
import { hasAnalyticsConsent } from "@/lib/cookie-consent";

/** Product data only: never pass buyer contact details to analytics. */
export const COUNTER_ID = 96190087;
/** Пиксель VK Рекламы: просмотры и цели для оптимизации рекламных кампаний. */
export const VK_PIXEL_ID = "3800855";
/** Umami Cloud — запасная аналитика на случай блокировки Метрики. */
export const UMAMI_WEBSITE_ID = "49773ca8-3f5e-426e-8276-fe833b9b13ba";
/** PostHog EU Cloud — воронки, записи сессий и ошибки. Без ключа канал выключен. */
const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

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
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "yclid",
    ]) {
      const entry = url.searchParams.get(key);
      if (entry) query.set(key, entry);
    }
    const path = analyticsPath(url.pathname);
    return `${url.origin}${path}${query.size ? `?${query}` : ""}`;
  } catch {
    return "";
  }
}

/** По этим ссылкам открывают заказ или видео без входа — id в них работает как пароль. */
const SECRET_PATHS: Array<[RegExp, string]> = [
  [/^\/order\/[^/]+/, "/order/status"],
  [/^\/api\/orders\/[^/]+/, "/api/orders/:id"],
  [/^\/api\/video\/hls\/[^/]+/, "/api/video/hls/:token"],
  [/^\/api\/workshops\/access\/[^/]+/, "/api/workshops/access/:token"],
];

export function analyticsPath(pathname: string): string {
  for (const [pattern, replacement] of SECRET_PATHS) {
    if (pattern.test(pathname)) return pathname.replace(pattern, replacement);
  }
  return pathname;
}

const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;
/** Десять и больше цифр подряд (можно с пробелами, скобками и дефисами): телефон или номер карты. */
const LONG_NUMBER = /\+?\d(?:[\s()-]*\d){9,}/g;

/** Email и телефоны из текста страницы не должны попасть в записи сессий и тексты кликов. */
export function maskContacts(text: string): string {
  return text.replace(EMAIL, "***").replace(LONG_NUMBER, "***");
}

type QueuedMetrika = NonNullable<Window["ym"]> & {
  a?: unknown[][];
  l?: number;
};
let initialized = false;
let vkPixelLoaded = false;
let umamiLoaded = false;
const umamiQueue: Array<(umami: NonNullable<Window["umami"]>) => void> = [];
let previousPage = "";
const recordedOrders = new Set<string>();

function analyticsAllowed() {
  return (
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "production" &&
    isAnalyticsHost(window.location.hostname) &&
    hasAnalyticsConsent()
  );
}

function metrika() {
  if (!analyticsAllowed()) return;
  try {
    if (!initialized) {
      window.dataLayer ??= [];
      if (!window.ym) {
        const queue: QueuedMetrika = (...args) => {
          (queue.a ??= []).push(args);
        };
        queue.l = Date.now();
        window.ym = queue;
      }
      window.ym(COUNTER_ID, "init", {
        defer: true,
        ecommerce: "dataLayer",
        webvisor: true,
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
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

/** Same consent rules as Metrika: the pixel stays off after «Отказаться». */
function vkPixel() {
  if (!analyticsAllowed()) return;
  try {
    window._tmr ??= [];
    if (!vkPixelLoaded) {
      const script = document.createElement("script");
      script.src = "https://top-fwz1.mail.ru/js/code.js";
      script.async = true;
      script.id = "tmr-code";
      document.head.appendChild(script);
      vkPixelLoaded = true;
    }
    return window._tmr;
  } catch {
    return;
  }
}

/**
 * Запасная аналитика. Тот же consent, что у Метрики. Автотрекинг выключен:
 * иначе в Umami уйдёт сырой путь /order/<token>, поэтому хиты шлём вручную.
 * Вызовы до загрузки скрипта ждут в очереди.
 */
function umami(send: (umami: NonNullable<Window["umami"]>) => void) {
  if (!analyticsAllowed()) return;
  try {
    if (window.umami) return send(window.umami);
    umamiQueue.push(send);
    if (umamiLoaded) return;
    const script = document.createElement("script");
    script.src = "https://cloud.umami.is/script.js";
    script.defer = true;
    script.dataset.websiteId = UMAMI_WEBSITE_ID;
    script.dataset.autoTrack = "false";
    script.onload = () => {
      if (!analyticsAllowed()) {
        umamiQueue.length = 0;
        return;
      }
      const { umami } = window;
      if (umami) for (const queued of umamiQueue.splice(0)) queued(umami);
    };
    document.head.appendChild(script);
    umamiLoaded = true;
  } catch {
    /* optional */
  }
}

const URL_PROPERTY = /(url|referrer)$/i;
const PATH_PROPERTY = /pathname$/i;
const ELEMENT_PROPERTY = new Set(["$elements_chain", "$el_text"]);

/** $current_url, $initial_referrer, $prev_pageview_pathname и т. п. — по тем же правилам, что хиты Метрики. */
function scrubProperties(properties: Properties | undefined) {
  if (!properties) return;
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== "string" || !value) continue;
    if (PATH_PROPERTY.test(key)) properties[key] = analyticsPath(value);
    else if (URL_PROPERTY.test(key) && /^https?:\/\//.test(value))
      properties[key] = analyticsUrl(value);
    else if (ELEMENT_PROPERTY.has(key))
      properties[key] = maskContacts(value).replace(
        /\/order\/[^/"?#\s]+/g,
        "/order/status",
      );
  }
}

function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  scrubProperties(event.properties);
  scrubProperties(event.$set);
  scrubProperties(event.$set_once);
  return event;
}

/** Блок с data-analytics-private в записи сессии виден только как звёздочки. */
function maskReplayText(text: string, element?: HTMLElement | null) {
  if (element?.closest?.("[data-analytics-private]"))
    return text.replace(/\S/g, "*");
  return maskContacts(text);
}

const IGNORE_PARAM = "ph_ignore";
const IGNORE_KEY = "stariva:posthog-ignore";

/** `?ph_ignore=1` включает игнорирование, `?ph_ignore=0` выключает, остальное — не трогает. */
export function ignoreParam(search: string): boolean | null {
  const value = new URLSearchParams(search).get(IGNORE_PARAM);
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

let memoryIgnore: boolean | null = null;

/**
 * Свои сессии не пишем: один раз открываем сайт с ?ph_ignore=1, флаг лежит в
 * localStorage этого браузера. Пока он есть, PostHog даже не загружается.
 */
function postHogIgnored(): boolean {
  if (typeof window === "undefined") return false;
  const requested = ignoreParam(window.location.search);
  if (requested !== null) {
    memoryIgnore = requested;
    try {
      if (requested) window.localStorage.setItem(IGNORE_KEY, "1");
      else window.localStorage.removeItem(IGNORE_KEY);
    } catch {
      /* storage blocked — флаг живёт до закрытия вкладки */
    }
  }
  if (memoryIgnore !== null) return memoryIgnore;
  try {
    return window.localStorage.getItem(IGNORE_KEY) === "1";
  } catch {
    return false;
  }
}

let postHogClient: Promise<PostHog | undefined> | undefined;
let loadedPostHog: PostHog | undefined;

/**
 * PostHog: тот же consent и те же хосты, что у Метрики. SDK — отдельный чанк,
 * он грузится только когда аналитика разрешена. Запросы идут через /ingest
 * на нашем домене (rewrites в next.config.ts), чтобы их не резали блокировщики.
 * Просмотры страниц PostHog считает сам по смене history.
 */
function postHog(send?: (posthog: PostHog) => void) {
  const token = POSTHOG_TOKEN;
  if (!token || !analyticsAllowed() || postHogIgnored()) return;
  postHogClient ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(token, {
        api_host: "/ingest",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-05-30",
        person_profiles: "identified_only",
        capture_exceptions: true,
        before_send: scrubEvent,
        session_recording: {
          maskAllInputs: true,
          // Каждый текст проходит через maskReplayText: прячем контакты и приватные блоки.
          maskTextSelector: "*",
          maskTextFn: maskReplayText,
          // Применяется и к адресу страницы в записи, не только к запросам.
          maskCapturedNetworkRequestFn: (request) => ({
            ...request,
            name: analyticsUrl(request.name),
          }),
        },
      });
      loadedPostHog = posthog;
      return posthog;
    })
    .catch(() => undefined);
  if (!send) return;
  void postHogClient.then((posthog) => {
    if (!posthog || !analyticsAllowed() || postHogIgnored()) return;
    try {
      send(posthog);
    } catch {
      /* optional */
    }
  });
}

/** Ранний старт из instrumentation-client: ловим ошибки до гидрации. */
export function initPostHog() {
  postHog();
}

/**
 * После «Отказаться»: больше ничего не отправлять (даже $pageleave при
 * перезагрузке) и не дописывать ph_* в хранилище после того, как баннер его очистит.
 */
export function stopPostHog() {
  try {
    loadedPostHog?.opt_out_capturing();
    loadedPostHog?.set_config({ disable_persistence: true });
  } catch {
    /* optional */
  }
}

/**
 * Связывает события с аккаунтом после входа и отвязывает после выхода.
 * Передаём только внутренний id: контакты в аналитику не уходят.
 */
export function identifyUser(userId: string | null) {
  postHog((posthog) => {
    if (userId) {
      if (posthog.get_distinct_id() !== userId) posthog.identify(userId);
    } else if (posthog.get_property("$user_state") === "identified") {
      posthog.reset();
    }
  });
}

export function trackPageView() {
  postHog();
  const ym = metrika();
  if (!ym) return;
  const url = analyticsUrl(window.location.href);
  if (url === previousPage) return;
  ym(COUNTER_ID, "hit", url, {
    title: document.title,
    referer: previousPage || analyticsUrl(document.referrer),
  });
  const referrer = previousPage || analyticsUrl(document.referrer);
  const { pathname, search } = new URL(url);
  umami((u) =>
    u.track((props: object) => ({
      ...props,
      url: pathname + search,
      referrer,
      title: document.title,
    })),
  );
  vkPixel()?.push({
    id: VK_PIXEL_ID,
    type: "pageView",
    url,
    start: Date.now(),
  });
  previousPage = url;
}

/** Goals go to both counters; a price or order sum becomes the VK goal value. */
export function reachGoal(goal: string, params?: Record<string, unknown>) {
  try {
    metrika()?.(COUNTER_ID, "reachGoal", goal, params);
    umami((u) => u.track(goal, params));
    postHog((posthog) => posthog.capture(goal, params));
    const value = params?.order_price ?? params?.price;
    vkPixel()?.push({
      id: VK_PIXEL_ID,
      type: "reachGoal",
      goal,
      ...(typeof value === "number" ? { value } : {}),
    });
  } catch {
    /* optional */
  }
}

/** У Метрики это ecommerce-действия, в PostHog — отдельные события для воронок. */
const PRODUCT_EVENTS = {
  detail: "product_viewed",
  add: "product_added",
  remove: "product_removed",
} as const;

export function trackProductEvent(
  event: "detail" | "add" | "remove",
  products: AnalyticsProduct[],
) {
  try {
    if (!products.length) return;
    postHog((posthog) =>
      posthog.capture(PRODUCT_EVENTS[event], {
        products,
        value: products.reduce(
          (sum, product) => sum + product.price * (product.quantity ?? 1),
          0,
        ),
        currency: "RUB",
      }),
    );
    if (!metrika()) return;
    window.dataLayer?.push({
      ecommerce: { currencyCode: "RUB", [event]: { products } },
    });
  } catch {
    /* optional */
  }
}

function recordOnce(key: string, send: () => void) {
  if (!metrika() || recordedOrders.has(key)) return false;
  try {
    if (window.localStorage.getItem(key)) return false;
  } catch {
    /* memory fallback */
  }
  send();
  recordedOrders.add(key);
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* memory fallback */
  }
  return true;
}

/** Placed, not paid. Allow the counter time to flush before leaving for payment. */
export function trackCreatedOrder(order: AnalyticsOrder): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 800);
    const done = () => {
      clearTimeout(timeout);
      resolve();
    };
    try {
      const sent = recordOnce(`stariva:analytics:created:${order.id}`, () => {
        window.dataLayer?.push({
          ecommerce: {
            currencyCode: "RUB",
            purchase: {
              actionField: { id: order.id, revenue: order.revenue },
              products: order.products,
            },
          },
        });
        window.ym?.(
          COUNTER_ID,
          "reachGoal",
          "order_created",
          { order_id: order.id, order_price: order.revenue, currency: "RUB" },
          done,
        );
        vkPixel()?.push({
          id: VK_PIXEL_ID,
          type: "reachGoal",
          goal: "order_created",
          value: order.revenue,
        });
        // send_instantly: следом уходим на оплату, ждать пакетной отправки нельзя.
        postHog((posthog) =>
          posthog.capture(
            "order_created",
            {
              order_id: order.id,
              order_price: order.revenue,
              currency: "RUB",
              products: order.products,
            },
            { send_instantly: true },
          ),
        );
      });
      if (!sent) done();
    } catch {
      done();
    }
  });
}

/** paid comes from the authenticated server response, never payment=success. */
export function trackPaidOrder(
  orderId: string,
  amountKopecks: number,
  paid: boolean,
) {
  if (!paid) return;
  try {
    recordOnce(`stariva:analytics:paid:${orderId}`, () => {
      reachGoal("order_paid", {
        order_id: orderId,
        order_price: amountKopecks / 100,
        currency: "RUB",
      });
    });
  } catch {
    /* optional */
  }
}
