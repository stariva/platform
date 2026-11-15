const VERSION_RE = /^\d+(?:\.\d+){0,2}$/;

/** «1.4.0» → [1, 4, 0]; не версия — null. Короткие номера дополняются нулями. */
export function parseVersion(version: string): [number, number, number] | null {
  const trimmed = version.trim();
  if (!VERSION_RE.test(trimmed)) return null;
  const [major = 0, minor = 0, patch = 0] = trimmed.split(".").map(Number);
  return [major, minor, patch];
}

/** Больше нуля — `a` новее `b`. Нечитаемый номер — null. */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Подходит ли оболочка `native` под требование `min`. Если номер не
 * разобрать, не блокируем пользователя: лучше попробовать обновиться, чем
 * навсегда застрять на просьбе скачать новое приложение.
 */
export function meetsMinVersion(native: string, min: string): boolean {
  const result = compareVersions(native, min);
  return result === null || result >= 0;
}
