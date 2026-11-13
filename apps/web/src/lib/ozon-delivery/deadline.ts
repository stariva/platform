/**
 * Ждёт `promise` не дольше, чем до срабатывания `signal`. Сам `promise`
 * не прерывается: им могут пользоваться другие (например, общее обновление
 * токена, которого ждут параллельные запросы покупателей) — обрывается только
 * ожидание текущего вызывающего.
 */
export function withDeadline<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  onTimeout: () => Error,
): Promise<T> {
  if (signal.aborted) {
    // Результат всё равно не нужен, но ошибка не должна остаться необработанной
    promise.catch(() => {});
    return Promise.reject(onTimeout());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(onTimeout());
    signal.addEventListener("abort", onAbort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}
