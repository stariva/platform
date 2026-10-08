import { randomUUID } from "node:crypto";

/**
 * Перехват ссылки better-auth magic link вместо отправки письма.
 *
 * Плагин отдаёт готовую ссылку только в sendMagicLink. Чтобы сервер мог
 * сразу перенаправить по ней (вход по личной ссылке из письма о мастер-классе),
 * вызывающий код заводит id, передаёт его в metadata, а sendMagicLink кладёт
 * ссылку сюда и письмо не шлёт. Id из запроса клиента сюда не попадает: в
 * карте лежат только id, заведённые сервером на время одного вызова.
 */
const pending = new Map<string, string | null>();

export function beginMagicLinkCapture(): string {
  const id = randomUUID();
  pending.set(id, null);
  return id;
}

/** Забирает перехваченную ссылку и закрывает перехват. */
export function finishMagicLinkCapture(id: string): string | null {
  const url = pending.get(id) ?? null;
  pending.delete(id);
  return url;
}

/** Для sendMagicLink: true — ссылка перехвачена, письмо не отправляем. */
export function captureMagicLink(
  metadata: Record<string, unknown> | undefined,
  url: string,
): boolean {
  const id = metadata?.captureId;
  if (typeof id !== "string" || !pending.has(id)) return false;
  pending.set(id, url);
  return true;
}
