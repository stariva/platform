/**
 * Токен сессии приложения (bearer-токен better-auth). Приложение входит им, а
 * не cookie: cookie сайта из WebView другого origin не доходят.
 *
 * Хранилище подставляется снаружи: в приложении это Capacitor Preferences, в
 * тестах — память.
 */
export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface TokenStore {
  /** Токен или `null`, если не входили. Читает хранилище один раз. */
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export const SESSION_TOKEN_KEY = "stariva.session-token";

export function createTokenStore(
  storage: KeyValueStorage,
  key = SESSION_TOKEN_KEY,
): TokenStore {
  // undefined — ещё не читали. Запись в память идёт раньше записи в хранилище:
  // следующий запрос уже должен уйти с новым токеном (или без старого).
  let cached: string | null | undefined;
  let loading: Promise<string | null> | undefined;

  return {
    async get() {
      if (cached !== undefined) return cached;
      loading ??= storage
        .get(key)
        .catch(() => null)
        .then((value) => {
          // set/clear могли отработать, пока читали — их значение новее
          if (cached === undefined) cached = value || null;
          return cached;
        });
      return loading;
    },
    async set(token) {
      cached = token;
      await storage.set(key, token);
    },
    async clear() {
      cached = null;
      // Сбой хранилища не должен мешать выйти: токен в памяти уже сброшен
      await storage.remove(key).catch(() => {});
    },
  };
}
