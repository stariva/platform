/**
 * Утилиты для отправки событий в Яндекс Метрику
 * Счётчик: 96190087
 */

const COUNTER_ID = 96190087;

/**
 * Отправляет цель в Яндекс Метрику.
 * Безопасно вызывается в любом окружении — если ym не загружен, ничего не происходит.
 */
export function reachGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (typeof window.ym !== "function") return;
  window.ym(COUNTER_ID, "reachGoal", goal, params);
}
