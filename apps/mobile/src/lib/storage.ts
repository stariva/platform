import { Preferences } from "@capacitor/preferences";

/**
 * Локальный кеш (Capacitor Preferences; в браузере и Telegram Mini App это
 * localStorage). Сбой хранилища не должен ронять плеер, поэтому ошибки
 * глотаем: кеш — удобство, а не источник правды.
 */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await Preferences.set({ key, value: JSON.stringify(value) });
  } catch {
    // хранилище недоступно — работаем без кеша
  }
}
