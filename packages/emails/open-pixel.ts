import { randomBytes } from "node:crypto";

/** Куда ведёт пиксель, если адрес витрины не задан. */
const DEFAULT_SITE_URL = "https://stariva.ru";

/** Новый токен пикселя: как у получателей рассылок, 24 символа base64url. */
export function newOpenToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Адрес пикселя: тот же маршрут, что у рассылок, он ищет токен в обеих таблицах. */
export function openPixelUrl(token: string, siteUrl?: string): string {
  const base = (siteUrl ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
  return `${base}/api/m/o/${token}`;
}

/**
 * Вставляет в HTML письма невидимую картинку 1×1 перед закрывающим </body>,
 * а без него — в конец. Почтовик подгрузил картинку — письмо, скорее всего,
 * открыли.
 */
export function withOpenPixel(html: string, src: string): string {
  const img = `<img src="${src}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;
  const at = html.toLowerCase().lastIndexOf("</body>");
  return at === -1
    ? `${html}${img}`
    : `${html.slice(0, at)}${img}${html.slice(at)}`;
}
