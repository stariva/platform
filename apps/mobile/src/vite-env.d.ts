/// <reference types="vite/client" />

/** Версия веб-бандла из package.json (подставляет vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Адрес сайта для API; пусто — тот же адрес (браузер, dev-прокси). */
  readonly VITE_API_URL?: string;
  /** Страница приложения в App Store: куда вести iOS, когда оболочка устарела. */
  readonly VITE_IOS_STORE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
