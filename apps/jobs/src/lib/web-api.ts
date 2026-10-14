import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { WEB_RPC_PATH, type WebClient } from "@stariva/web-api/contract";
import { env } from "../env";

/**
 * Типизированный клиент API сайта (@stariva/web-api). Ошибки приходят как
 * ORPCError: свои коды из контракта отличаются через `isDefinedError`.
 * Процедуры сайта идемпотентны, повторы ведёт Hatchet.
 */
export const webApi: WebClient = createORPCClient(
  new RPCLink({
    url: `${env.STOREFRONT_URL}${WEB_RPC_PATH}`,
    headers: { Authorization: `Bearer ${env.JOBS_SECRET}` },
  }),
);

/** Опции вызова с таймаутом: `webApi.x.y(input, timeout(30_000))`. */
export function timeout(ms: number) {
  return { signal: AbortSignal.timeout(ms) };
}
