import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { TimeoutLinkPlugin } from "@orpc/client/plugins";
import {
  AttemptLostError,
  WEB_RPC_PATH,
  type WebClient,
} from "@stariva/web-api/contract";
import { env } from "../env";

interface WebApiContext {
  /** Таймаут вызова, мс; по умолчанию DEFAULT_TIMEOUT_MS. */
  timeout?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Типизированный клиент API сайта (@stariva/web-api). Свои ошибки контракта
 * проверяются через `instanceof` (например, `AttemptLostError`). Процедуры
 * сайта идемпотентны, повторы ведёт Hatchet.
 */
export const webApi: WebClient<WebApiContext> = createORPCClient(
  new RPCLink<WebApiContext>({
    origin: env.STOREFRONT_URL,
    url: WEB_RPC_PATH,
    headers: { authorization: `Bearer ${env.JOBS_SECRET}` },
    plugins: [
      new TimeoutLinkPlugin({
        timeout: ({ context }) => context.timeout ?? DEFAULT_TIMEOUT_MS,
      }),
    ],
  }),
);

const RETRY_TIMEOUT_MS = 15_000;
const RETRY_ATTEMPTS = 4;

/**
 * Вызов API сайта с повторами: зависший сокет рвётся коротким таймаутом, и
 * повтор идёт по новому, а разовый 502 не роняет нарезку. Только для
 * процедур, которые можно повторять. Если попытка уже не наша
 * (`AttemptLostError`), повторять бессмысленно.
 */
export async function withRetry<T>(
  name: string,
  call: (context: WebApiContext) => Promise<T>,
): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await call({ timeout: RETRY_TIMEOUT_MS });
    } catch (error) {
      if (error instanceof AttemptLostError || n >= RETRY_ATTEMPTS) {
        throw error;
      }
      console.warn(
        `[web-api] ${name}, попытка ${n}/${RETRY_ATTEMPTS}:`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, n * 2000));
    }
  }
}
