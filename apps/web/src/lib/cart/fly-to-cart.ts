/**
 * Анимация «изделие улетает в корзину». Копия фото поднимается с карточки,
 * сжимается в кружок и по дуге летит к значку корзины в шапке, где
 * растворяется. Значок и панель «Добавлено в корзину» подписываются на
 * приземление: счётчик меняется ровно тогда, когда изделие «долетело».
 *
 * Разметка:
 * - `data-cart-target` — значок корзины, куда летит изделие;
 * - `data-cart-fly-scope` — карточка товара, внутри которой кнопка;
 * - `data-cart-fly-source` — блок с фото внутри карточки, откуда взлетает копия.
 *
 * Если фото карточки не видно на экране, кружок вылетает из самой кнопки.
 */

const CART_TARGET_ATTR = "data-cart-target";
const FLY_SCOPE_ATTR = "data-cart-fly-scope";
const FLY_SOURCE_ATTR = "data-cart-fly-source";

/** Что показать в панели «Добавлено в корзину». */
export interface AddedToCart {
  lineKey: string;
  name: string;
  image: string;
  /** В копейках */
  price: number;
}

type LandListener = (item: AddedToCart) => void;

const listeners = new Set<LandListener>();
let pendingFlights = 0;
/** Изделие из последнего нажатия — его и покажет панель. */
let latestItem: AddedToCart | null = null;

/**
 * Подписка на момент, когда изделие «долетело» до корзины. Если подряд
 * добавили несколько, сигнал один — когда приземлилось последнее.
 */
export function onCartLanded(listener: LandListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Летит ли сейчас хоть одно изделие — счётчик корзины ждёт приземления. */
export function isFlightPending(): boolean {
  return pendingFlights > 0;
}

/** В системе включено «уменьшение движения». */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function landOne() {
  pendingFlights = Math.max(0, pendingFlights - 1);
  if (pendingFlights > 0 || !latestItem) return;
  const item = latestItem;
  latestItem = null;
  for (const listener of listeners) listener(item);
}

/** Доля прямоугольника, попавшая в окно браузера. */
function visibleRatio(rect: DOMRect): number {
  if (rect.width === 0 || rect.height === 0) return 0;
  const w =
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
  const h =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (rect.width * rect.height);
}

function findTarget(): HTMLElement | null {
  const targets = document.querySelectorAll<HTMLElement>(
    `[${CART_TARGET_ATTR}]`,
  );
  for (const el of targets) {
    if (visibleRatio(el.getBoundingClientRect()) > 0.5) return el;
  }
  return null;
}

function findSource(trigger: HTMLElement): HTMLElement | null {
  const scope = trigger.closest(`[${FLY_SCOPE_ATTR}]`);
  const source = scope?.querySelector<HTMLElement>(`[${FLY_SOURCE_ATTR}]`);
  if (!source) return null;
  return visibleRatio(source.getBoundingClientRect()) >= 0.35 ? source : null;
}

/**
 * Кадр, который сейчас видит покупатель: в карточке с листалкой фото это
 * не обязательно первое. Берём уже загруженный адрес — он в кеше браузера.
 */
function visibleImageSrc(source: HTMLElement): string | null {
  const box = source.getBoundingClientRect();
  let best: { src: string; area: number } | null = null;
  for (const img of source.querySelectorAll("img")) {
    const src = img.currentSrc || img.src;
    if (!src || Number(getComputedStyle(img).opacity) < 0.5) continue;
    const r = img.getBoundingClientRect();
    const w = Math.min(r.right, box.right) - Math.max(r.left, box.left);
    const h = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
    const area = Math.max(w, 0) * Math.max(h, 0);
    if (!best || area > best.area) best = { src, area };
  }
  return best && best.area > 0 ? best.src : null;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

/** Доля времени, за которую копия «отрывается» от карточки. */
const LIFT = 0.2;
/** Диаметр кружка в начале полёта и у самой корзины. */
const FLIGHT_DIAMETER = 88;
const LANDING_DIAMETER = 14;
const KEYFRAMES = 48;

/**
 * Запускает полёт и сообщает о приземлении. Без значка корзины на экране
 * или при «уменьшении движения» в системе приземление наступает сразу.
 */
export function flyToCart({
  trigger,
  item,
}: {
  trigger: HTMLElement;
  item: AddedToCart;
}): void {
  latestItem = item;
  pendingFlights++;
  const target = findTarget();
  if (!target || prefersReducedMotion()) {
    requestAnimationFrame(landOne);
    return;
  }

  const source = findSource(trigger);
  const fromCard = source !== null;
  const rect = (source ?? trigger).getBoundingClientRect();
  const src = (source && visibleImageSrc(source)) || item.image;

  // С карточки взлетает копия фото в натуральный размер, из кнопки —
  // кружок, который «выпрыгивает» из её середины.
  const w = fromCard ? rect.width : FLIGHT_DIAMETER;
  const h = fromCard ? rect.height : FLIGHT_DIAMETER;
  const left = rect.left + rect.width / 2 - w / 2;
  const top = rect.top + rect.height / 2 - h / 2;
  const d = Math.min(w, h);
  const startRadius = fromCard
    ? Number.parseFloat(getComputedStyle(source).borderTopLeftRadius) || 0
    : d / 2;

  const c0 = { x: left + w / 2, y: top + h / 2 };
  const t = target.getBoundingClientRect();
  const end = { x: t.left + t.width / 2, y: t.top + t.height / 2 };
  const liftY = fromCard ? 16 : 36;
  const start = { x: c0.x, y: c0.y - liftY };
  // Контрольная точка выше значка: изделие по дуге «ныряет» в корзину сверху.
  const control = {
    x: lerp(start.x, end.x, 0.3),
    y: Math.max(Math.min(start.y, end.y) - 90, end.y - 70),
  };
  const flightDiameter = Math.min(d, FLIGHT_DIAMETER);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const duration = clamp(700 + distance * 0.35, 800, 1150);

  const frames: Keyframe[] = [];
  for (let i = 0; i <= KEYFRAMES; i++) {
    const u = i / KEYFRAMES;
    let x: number;
    let y: number;
    let diameter: number;
    let opacity = 1;
    if (u <= LIFT) {
      const k = easeOutCubic(u / LIFT);
      x = c0.x;
      y = c0.y - liftY * k;
      diameter = fromCard
        ? lerp(d, flightDiameter, k)
        : lerp(flightDiameter * 0.3, flightDiameter, k);
      if (!fromCard) opacity = k;
    } else {
      const v = (u - LIFT) / (1 - LIFT);
      const p = easeInOutCubic(v);
      const q = 1 - p;
      x = q * q * start.x + 2 * q * p * control.x + p * p * end.x;
      y = q * q * start.y + 2 * q * p * control.y + p * p * end.y;
      diameter = lerp(flightDiameter, LANDING_DIAMETER, v * v);
      if (v > 0.85) opacity = 1 - (v - 0.85) / 0.15;
    }
    frames.push({
      offset: u,
      opacity,
      transform: `translate(${x - c0.x}px, ${y - c0.y}px) scale(${diameter / d})`,
    });
  }

  const ix = (w - d) / 2;
  const iy = (h - d) / 2;
  const circle = `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${d / 2}px)`;

  const flyer = document.createElement("div");
  flyer.setAttribute("aria-hidden", "true");
  Object.assign(flyer.style, {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: `${w}px`,
    height: `${h}px`,
    zIndex: "70",
    pointerEvents: "none",
    willChange: "transform, opacity",
    filter: "drop-shadow(0 12px 24px rgba(22, 21, 19, 0.28))",
    opacity: fromCard ? "1" : "0",
  });
  const clip = document.createElement("div");
  Object.assign(clip.style, {
    width: "100%",
    height: "100%",
    background: "var(--sand, #f5f3f0)",
    clipPath: fromCard
      ? `inset(0px 0px 0px 0px round ${startRadius}px)`
      : circle,
  });
  const img = document.createElement("img");
  img.alt = "";
  img.src = src;
  // Картинка уже в кеше: синхронная расшифровка показывает её с первого кадра
  img.decoding = "sync";
  Object.assign(img.style, {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  });
  clip.append(img);
  flyer.append(clip);
  document.body.append(flyer);

  let landed = false;
  const land = () => {
    if (landed) return;
    landed = true;
    flyer.remove();
    landOne();
  };

  const flight = flyer.animate(frames, { duration, fill: "forwards" });
  if (fromCard) {
    clip.animate(
      [
        {
          offset: 0,
          clipPath: `inset(0px 0px 0px 0px round ${startRadius}px)`,
          easing: "cubic-bezier(0.33, 1, 0.68, 1)",
        },
        { offset: LIFT, clipPath: circle },
        { offset: 1, clipPath: circle },
      ],
      { duration, fill: "forwards" },
    );
  }
  flight.finished.then(land, land);
  // Страховка: вкладку свернули, и браузер притормозил анимацию.
  window.setTimeout(land, duration + 600);
}
