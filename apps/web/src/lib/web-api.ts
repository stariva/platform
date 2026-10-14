import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { WEB_RPC_PATH, type WebClient } from "@stariva/web-api/contract";

interface WebApiCallContext {
  /**
   * Запрос должен уйти, даже если вкладку закрывают (прогресс урока):
   * браузер отправит его с fetch keepalive.
   */
  keepalive?: boolean;
}

/**
 * Типизированный клиент API витрины для браузера. Ходит на тот же сайт,
 * cookie сессии уходят сами. Свои ошибки контракта — через `instanceof`
 * (например, `LessonNotFoundError`), общие — по `code` (`UNAUTHORIZED`).
 */
export const webApi: WebClient<WebApiCallContext> = createORPCClient(
  new RPCLink<WebApiCallContext>({
    url: WEB_RPC_PATH,
    fetch: (url, init, { context }) =>
      fetch(url, { ...init, keepalive: context.keepalive ?? false }),
  }),
);
