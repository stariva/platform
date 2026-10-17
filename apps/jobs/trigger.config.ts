import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

/**
 * Trigger.dev: нарезка видео в HLS идёт у них в облаке, а не на нашем VPS
 * (workflows Hatchet остаются там, где были). ffmpeg ставит расширение и
 * сам выставляет FFMPEG_PATH / FFPROBE_PATH.
 *
 * Переменные окружения (STOREFRONT_URL, JOBS_SECRET) задаются в дашборде
 * Trigger.dev: Project → Environment variables.
 */
export default defineConfig({
  // ID проекта из дашборда (proj_…); для деплоя берётся из TRIGGER_PROJECT_REF
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_ctglskhjxwkysbtuzgxo",
  dirs: ["./src/trigger"],
  // Верхний предел для любой задачи; у нарезки свой, см. maxDuration в ней
  maxDuration: 6 * 60 * 60,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },
  build: {
    extensions: [ffmpeg()],
  },
});
