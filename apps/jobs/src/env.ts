import { z } from "zod";

const schema = z.object({
  /** JWT-токен воркера из Hatchet (Settings → API Tokens). Читает SDK. */
  HATCHET_CLIENT_TOKEN: z.string().min(1),
  /** Адрес сайта, у которого воркер дёргает внутренние эндпоинты. */
  STOREFRONT_URL: z.url(),
  /** Общий с сайтом секрет для внутренних вызовов: `openssl rand -hex 32`. */
  JOBS_SECRET: z.string().min(32),
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
