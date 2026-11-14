export interface Breaker {
  /** Открыт — Ozon недавно подряд не отвечал, ходить в него пока не стоит. */
  isOpen: () => boolean;
  recordSuccess: () => void;
  recordFailure: () => void;
}

/**
 * Предохранитель: после `threshold` сбоев подряд на `cooldownMs` отвечает
 * «открыт», чтобы покупатель не ждал таймаут на каждом клике. По истечении
 * паузы пропускает запросы снова: удача закрывает, сбой открывает ещё раз.
 */
export function createBreaker(
  options: { threshold?: number; cooldownMs?: number; now?: () => number } = {},
): Breaker {
  const { threshold = 3, cooldownMs = 30_000, now = Date.now } = options;
  let failures = 0;
  let openUntil = 0;

  return {
    isOpen: () => now() < openUntil,
    recordSuccess: () => {
      failures = 0;
      openUntil = 0;
    },
    recordFailure: () => {
      failures += 1;
      if (failures >= threshold) openUntil = now() + cooldownMs;
    },
  };
}
