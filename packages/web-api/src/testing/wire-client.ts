import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import type { Session } from "@stariva/auth";
import { WEB_RPC_PATH, type WebClient } from "../contract";
import { webErrorStatusMap } from "../errors";
import { createWebORPCContext, type WebServices } from "../orpc";
import { webRouter } from "../router";

/*
 * Клиент для тестов: настоящий RPCLink, но запросы уходят прямо в
 * обработчик витрины, без сети. Проверяем весь путь по проводу: доступ,
 * коды ошибок и HTTP-статусы из errorStatusMap.
 *
 * Модуль тянет за собой роутер, поэтому тест импортирует его динамически,
 * уже после mock.module для сервисов.
 */

const handler = new RPCHandler(webRouter, {
  errorStatusMap: webErrorStatusMap,
});

// Сервисы витрины по умолчанию: ничего не делают. Тест подменяет нужные
const idleServices: WebServices = {
  runWorkshopReminderSweep: async () => ({
    checked: 0,
    delivered: 0,
    failed: 0,
  }),
  issueFormToken: async () => "form-token",
  subscribeToNewsletter: async () => {},
  customOrders: {
    isAccepting: () => true,
    save: async () => ({ id: "request-id", number: 1 }),
    dispatchLater: () => {},
  },
  workshopFiles: {
    signLessonVideo: async () => ({
      status: "ok",
      url: "https://storage.example.test/lesson.mp4",
      type: "mp4",
      expiresIn: 900,
    }),
    signMaterial: async () => ({
      status: "ok",
      url: "https://storage.example.test/brief.pdf",
    }),
  },
  orders: {
    view: async () => null,
    updateDetails: async () => "not_found",
    startPayment: async () => ({ status: "not_found" }),
  },
  revalidatePaths: () => {},
};

let lastResponseStatus = 0;

/** HTTP-статус последнего ответа обработчика. */
export function lastStatus(): number {
  return lastResponseStatus;
}

export interface WireClientOptions {
  /** Заголовок Authorization: секрет воркера или админки. */
  authorization?: string;
  services?: Partial<WebServices>;
  /** Сессия покупателя; по умолчанию — не вошёл. */
  session?: Session | null;
}

export function wireClient(options: WireClientOptions = {}): WebClient {
  return createORPCClient(
    new RPCLink({
      origin: "https://example.test",
      url: WEB_RPC_PATH,
      headers: options.authorization
        ? { authorization: options.authorization }
        : {},
      fetch: async (url, init) => {
        const request = new Request(url, init);
        const { matched, response } = await handler.handle(request, {
          prefix: WEB_RPC_PATH,
          context: createWebORPCContext({
            headers: request.headers,
            services: { ...idleServices, ...options.services },
            getSession: async () => options.session ?? null,
          }),
        });
        const result = matched ? response : new Response(null, { status: 404 });
        lastResponseStatus = result.status;
        return result;
      },
    }),
  );
}
