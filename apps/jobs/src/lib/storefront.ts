import { env } from "../env";

/**
 * POST во внутренний эндпоинт сайта с общим секретом. Бросает ошибку при
 * не-2xx, чтобы Hatchet повторил задание. Эндпоинты сайта идемпотентны.
 */
export async function postToStorefront<T>(
  path: string,
  { timeoutMs }: { timeoutMs: number },
): Promise<T> {
  const res = await fetch(`${env.STOREFRONT_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.JOBS_SECRET}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    throw new Error(
      `POST ${path}: HTTP ${res.status}, ${JSON.stringify(body)}`,
    );
  }
  return body;
}
