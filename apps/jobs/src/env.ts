import { z } from "zod";

const schema = z.object({
  /** Адрес сайта, у которого воркер дёргает внутренние эндпоинты. */
  STOREFRONT_URL: z.url(),
  /** Общий с сайтом секрет для внутренних вызовов: `openssl rand -hex 32`. */
  JOBS_SECRET: z.string().min(32),
  /** ffmpeg и ffprobe для нарезки видео в HLS; в Trigger.dev их ставит расширение. */
  FFMPEG_PATH: z.string().default("ffmpeg"),
  FFPROBE_PATH: z.string().default("ffprobe"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Падаем при старте, а не посреди задания: под перезапустится с понятной причиной
  throw new Error(
    `Некорректное окружение воркера: ${z.prettifyError(parsed.error)}`,
  );
}

export const env = {
  ...parsed.data,
  STOREFRONT_URL: parsed.data.STOREFRONT_URL.replace(/\/$/, ""),
};
