import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Нативная оболочка «Stariva». Веб-бандл (`dist`) лежит внутри
 * приложения и обновляется по воздуху: см. `src/lib/updates.ts` и
 * `scripts/release.ts`.
 *
 * Идентификатор приложения (appId) после публикации в магазинах не
 * меняется — это уже другое приложение.
 */
const config: CapacitorConfig = {
  appId: "ru.stariva.workshops",
  appName: "Stariva",
  webDir: "dist",
  server: {
    // Бандл открывается как https://localhost (а не http://), иначе WebView
    // Android режет запросы к https-сайту как смешанное содержимое
    androidScheme: "https",
  },
  plugins: {
    CapacitorUpdater: {
      // Ручной режим: что и когда ставить, решает наш API (`latestRelease`),
      // а не облако Capgo
      autoUpdate: false,
      // Не слать статистику установок на plugin.capgo.app
      statsUrl: "",
      // Бандл должен сказать «я живой» (notifyAppReady) за это время, иначе
      // плагин откатится на предыдущий рабочий. Миллисекунды
      appReadyTimeout: 10_000,
      // Упавший бандл остаётся в списке со статусом «error»: по нему
      // `decideUpdate` не предлагает ту же версию по кругу
      autoDeleteFailed: false,
      // Обновили приложение из магазина — старые OTA-бандлы сбрасываются, чтобы
      // не запускать веб-код старше новой оболочки
      resetWhenUpdate: true,
    },
  },
};

export default config;
