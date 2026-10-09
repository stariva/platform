import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Невидимая защита форм, которые отправляют письма или заводят аккаунты
 * (регистрация, вход по ссылке, сброс пароля). Капчи нет: настоящий человек
 * ничего лишнего не делает, а скрипт, бьющий прямо в API, отсеивается.
 */

/** Человек не заполнит форму быстрее: так отсекаем мгновенные отправки. */
const FORM_TOKEN_MIN_AGE_MS = 2_000;
/** Дольше страницу держать открытой незачем; клиент обновляет токен сам. */
const FORM_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function signFormToken(secret: string, issuedAtSec: number): string {
  return createHmac("sha256", secret)
    .update(`form-token|${issuedAtSec}`)
    .digest("base64url");
}

/** Токен формы: время выдачи и HMAC от него. Хранить на сервере нечего. */
export function issueFormToken(secret: string, now = Date.now()): string {
  const issuedAtSec = Math.floor(now / 1000);
  return `${issuedAtSec}.${signFormToken(secret, issuedAtSec)}`;
}

export type FormTokenVerdict =
  | "ok"
  | "missing"
  | "invalid"
  | "too-fast"
  | "expired";

export function checkFormToken(
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): FormTokenVerdict {
  if (!token) return "missing";
  const match = /^(\d{1,12})\.([\w-]+)$/.exec(token);
  if (!match) return "invalid";
  const issuedAtSec = Number(match[1]);
  const expected = Buffer.from(signFormToken(secret, issuedAtSec));
  const actual = Buffer.from(match[2] ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return "invalid";
  }
  const age = now - issuedAtSec * 1000;
  if (age > FORM_TOKEN_MAX_AGE_MS) return "expired";
  if (age < FORM_TOKEN_MIN_AGE_MS) return "too-fast";
  return "ok";
}

/**
 * Имя из подряд идущих латинских букв с хаотичной сменой регистра
 * («NNlWdMsPZXCIGdBXDKlbEmkZ») — так регистрировались боты. Настоящие имена
 * («McDonald», «DeShawn», «Anna-Maria») по этому признаку не проходят: у них
 * одна смена регистра, пробел или дефис. На 187 реальных регистрациях правило
 * ловит ~96% ботов и ни одного человека.
 */
export function looksLikeGibberishName(name: string): boolean {
  const value = name.trim();
  if (value.length < 10 || !/^[A-Za-z]+$/.test(value)) return false;
  let caseSwitches = 0;
  for (let i = 1; i < value.length; i++) {
    const prev = value.charAt(i - 1);
    const cur = value.charAt(i);
    if (prev >= "a" && prev <= "z" && cur >= "A" && cur <= "Z") caseSwitches++;
  }
  // Длинное слитное имя с двумя сменами регистра — тоже не имя человека.
  return caseSwitches >= 3 || (value.length >= 14 && caseSwitches >= 2);
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Один почтовый ящик — один ключ: у Gmail точки в имени ничего не значат, а
 * всё после «+» у любого провайдера уходит в тот же ящик. Нужен только для
 * учёта отправленных писем, адрес пользователя при этом не меняется.
 */
export function canonicalEmail(email: string): string {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1) return value;
  const domain = value.slice(at + 1);
  const withoutTag = value.slice(0, at).split("+")[0] ?? "";
  if (!withoutTag) return value;
  if (GMAIL_DOMAINS.has(domain)) {
    return `${withoutTag.replaceAll(".", "")}@gmail.com`;
  }
  return `${withoutTag}@${domain}`;
}

/**
 * Не чаще одного раза за окно на ключ. Хранится в памяти процесса: реплика у
 * сайта одна, а перезапуск лишь обнуляет окно.
 */
export function createCooldown(windowMs: number, maxEntries = 10_000) {
  const startedAt = new Map<string, number>();

  function prune(now: number) {
    for (const [key, at] of startedAt) {
      if (now - at >= windowMs) startedAt.delete(key);
    }
    while (startedAt.size >= maxEntries) {
      const oldest = startedAt.keys().next();
      if (oldest.done) break;
      startedAt.delete(oldest.value);
    }
  }

  return {
    /** Миллисекунды до конца паузы, либо 0 — и тогда пауза начинается сейчас. */
    take(key: string, now = Date.now()): number {
      const prev = startedAt.get(key);
      if (prev !== undefined && now - prev < windowMs) {
        return windowMs - (now - prev);
      }
      if (startedAt.size >= maxEntries) prune(now);
      startedAt.delete(key);
      startedAt.set(key, now);
      return 0;
    },
  };
}
