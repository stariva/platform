import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { TimeoutLinkPlugin } from "@orpc/client/plugins";
import { WEB_RPC_PATH, type WebClient } from "@stariva/web-api/contract";
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
