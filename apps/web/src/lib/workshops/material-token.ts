import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Пропуск к материалу курса в адресе ссылки. Приложение входит bearer-токеном,
 * а не cookie, и открывает файл обычным переходом — заголовок туда не попадёт.
 * Пропуск выдаёт account.materialUrl после проверки покупки; маршрут файла
 * проверяет подпись, срок и ещё раз — покупку его владельца.
 */
export interface MaterialGrant {
  slug: string;
  /** Идентификатор файла из адреса. */
  file: string;
  userId: string;
  /** Срок действия, unix-секунды. */
  expiresAt: number;
}

/** Ссылку открывают сразу после выдачи — дольше ей жить незачем. */
export const MATERIAL_GRANT_TTL_SECONDS = 5 * 60;

/** Отдельный ключ из секрета авторизации, чтобы подписи не пересекались. */
function sign(payload: string, secret: string): Buffer {
  const key = createHmac("sha256", secret)
    .update("stariva:workshop-material")
    .digest();
  return createHmac("sha256", key).update(payload).digest();
}

export function signMaterialGrant(grant: MaterialGrant, secret: string) {
  const payload = Buffer.from(
    JSON.stringify({
      s: grant.slug,
      f: grant.file,
      u: grant.userId,
      e: grant.expiresAt,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret).toString("base64url")}`;
}

/** Разбирает пропуск. null — подделан, повреждён или истёк. */
export function verifyMaterialGrant(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): MaterialGrant | null {
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
  const { s, f, u, e } = (data ?? {}) as Record<string, unknown>;
  if (typeof s !== "string" || typeof f !== "string") return null;
  if (typeof u !== "string" || typeof e !== "number") return null;
  if (e <= nowSeconds) return null;
  return { slug: s, file: f, userId: u, expiresAt: e };
}
