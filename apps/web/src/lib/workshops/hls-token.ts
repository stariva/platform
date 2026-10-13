import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Пропуск к кускам HLS-версии урока. Плеер получает его вместе с адресом
 * плейлиста и дальше ходит за каждым куском через сайт: сервер проверяет
 * подпись, срок и то, что запрос пришёл из того же браузера (по cookie
 * сессии), и только тогда отдаёт ссылку на кусок в бакете на минуту.
 *
 * Пропуск лежит прямо в пути (`/api/video/hls/<пропуск>/seg-00001.m4s`),
 * поэтому плейлист из бакета отдаётся как есть: относительные адреса кусков
 * сами разрешаются в пути с пропуском. Базу на каждый кусок не трогаем.
 */
export interface HlsGrant {
  /** Папка HLS-версии в закрытом бакете. */
  prefix: string;
  /** Срок действия, unix-секунды. */
  expiresAt: number;
  /** Отпечаток cookie сессии; null — бесплатное превью без входа. */
  session: string | null;
}

/** Пропуск живёт дольше урока с паузами; истёк — плеер возьмёт новый. */
export const HLS_GRANT_TTL_SECONDS = 6 * 60 * 60;

/** Отдельный ключ из секрета авторизации, чтобы подписи не пересекались. */
function grantKey(secret: string): Buffer {
  return createHmac("sha256", secret).update("stariva:video-hls").digest();
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", grantKey(secret)).update(payload).digest();
}

/** Отпечаток значения cookie сессии: в пропуск попадает не сам токен. */
export function sessionFingerprint(cookieValue: string | null | undefined) {
  if (!cookieValue) return null;
  return createHash("sha256")
    .update(cookieValue)
    .digest("base64url")
    .slice(0, 22);
}

export function signHlsGrant(grant: HlsGrant, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ p: grant.prefix, e: grant.expiresAt, s: grant.session }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret).toString("base64url")}`;
}

/** Разбирает пропуск. null — подделан, повреждён или истёк. */
export function verifyHlsGrant(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): HlsGrant | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const actual = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = sign(payload, secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  const { p, e, s } = (data ?? {}) as Record<string, unknown>;
  if (typeof p !== "string" || typeof e !== "number") return null;
  if (s !== null && typeof s !== "string") return null;
  if (e <= nowSeconds) return null;
  return { prefix: p, expiresAt: e, session: s };
}
