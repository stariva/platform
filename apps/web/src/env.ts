import { env as baseEnv } from "@stariva/config";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Серверные переменные окружения (доступны только на сервере)
   */
  server: {
    OZON_API_KEY: z.string().min(1).optional(),
    OZON_CLIENT_ID: z.string().min(1).optional(),

    // Ozon Доставка — приватное приложение (OAuth), отдельно от классического
    // Seller API выше. Нужен для продажи со своего сайта с доставкой Ozon.
    // client_id/client_secret выдаются в личном кабинете продавца при
    // создании частного приложения (Настройки → Управление частными
    // приложениями). refresh_token получаем один раз через authorization_code
    // (см. /api/ozon-delivery/oauth/callback), дальше access_token обновляется
    // автоматически.
    OZON_DELIVERY_CLIENT_ID: z.string().min(1).optional(),
    OZON_DELIVERY_CLIENT_SECRET: z.string().min(1).optional(),
    OZON_DELIVERY_REFRESH_TOKEN: z.string().min(1).optional(),
    OZON_DELIVERY_REDIRECT_URI: z.string().url().optional(),

    // AI-провайдер (OpenAI-совместимый роутер) — единственный провайдер AI-помощника
    AI_API_KEY: z.string().min(1).optional(),
    AI_BASE_URL: z.string().url().default("https://router.cheap/v1"),
    AI_MODEL: z.string().min(1).default("gpt-4o-mini"),

    // Langfuse — трассировка и логирование запросов к AI (опционально)
    // Ключи: https://cloud.langfuse.com → Settings → API Keys
    LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
    LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
    LANGFUSE_BASE_URL: z
      .string()
      .url()
      .default("https://cloud.langfuse.com")
      .optional(),

    // Telegram Bot API — для отправки заявок на индивидуальный заказ
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_CHAT_ID: z.string().min(1).optional(),

    // Resend (HTTP API) — необязательный канал доставки заявок на email
    ORDER_EMAIL_TO: z.string().email().optional(),
    ORDER_EMAIL_FROM: z.string().min(1).optional(),

    // YooKassa — приём онлайн-платежей за мастер-классы
    // shopId и секретный ключ из личного кабинета ЮKassa
    YOOKASSA_SHOP_ID: z.string().min(1).optional(),
    YOOKASSA_SECRET_KEY: z.string().min(1).optional(),
  },

  /**
   * Клиентские переменные окружения (доступны в браузере)
   * Должны начинаться с NEXT_PUBLIC_
   */
  client: {
    // Базовый публичный URL сайта (для ссылок и редиректов после оплаты)
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  },

  /**
   * Переменные, которые используются во время сборки
   * Можно использовать как серверные, так и клиентские переменные
   */
  runtimeEnv: {
    OZON_API_KEY: process.env.OZON_API_KEY,
    OZON_CLIENT_ID: process.env.OZON_CLIENT_ID,
    OZON_DELIVERY_CLIENT_ID: process.env.OZON_DELIVERY_CLIENT_ID,
    OZON_DELIVERY_CLIENT_SECRET: process.env.OZON_DELIVERY_CLIENT_SECRET,
    OZON_DELIVERY_REFRESH_TOKEN: process.env.OZON_DELIVERY_REFRESH_TOKEN,
    OZON_DELIVERY_REDIRECT_URI: process.env.OZON_DELIVERY_REDIRECT_URI,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_BASE_URL: process.env.AI_BASE_URL,
    AI_MODEL: process.env.AI_MODEL,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    ORDER_EMAIL_TO: process.env.ORDER_EMAIL_TO,
    ORDER_EMAIL_FROM: process.env.ORDER_EMAIL_FROM,
    YOOKASSA_SHOP_ID: process.env.YOOKASSA_SHOP_ID,
    YOOKASSA_SECRET_KEY: process.env.YOOKASSA_SECRET_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",

  /**
   * Делает так, что пустые строки считаются undefined
   */
  emptyStringAsUndefined: true,
});

// Re-export base env (POSTGRES_URL, AUTH_*, RESEND_API_KEY, AWS_S3_*, APP_URL, ...)
export { baseEnv };
