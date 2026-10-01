/** Фото ещё лежит не у нас (CDN Ozon и т.п.) — его нужно перенести. */
export function isExternalImage(url: string, publicBaseUrl: string): boolean {
  return /^https?:\/\//.test(url) && !url.startsWith(publicBaseUrl);
}
