/**
 * Тело запроса как JSON, но не больше `maxBytes`: route handlers Next сами
 * размер не ограничивают, и `request.json()` прочитал бы в память сколько
 * пришлёт клиент. `"too_large"` — тело больше предела, `null` — не JSON.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown | "too_large" | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return "too_large";
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return "too_large";
    }
    chunks.push(value);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}
