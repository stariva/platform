import { createORPCClient, ORPCError } from "@orpc/client";
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

/**
 * Ответ сервера не удался (не сеть): что показать посетителю. Первая ошибка
 * в полях формы — тексты из схем контракта; своя ошибка контракта или отказ
 * в данных — её текст; иначе запасная фраза.
 */
export function formErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ORPCError)) return fallback;
  const data = error.data as { issues?: Array<{ message?: string }> };
  const issue = data?.issues?.[0]?.message;
  if (issue) return issue;
  return error.defined || error.code === "BAD_REQUEST"
    ? error.message
    : fallback;
}

/**
 * Отказ кабинета (видео, файлы курса): что показать покупателю. Вход и
 * покупку объясняем сами, у своих ошибок контракта есть текст, остальное —
 * запасная фраза.
 */
export function accessErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ORPCError)) return fallback;
  if (error.code === "UNAUTHORIZED") return "Требуется вход";
  if (error.code === "FORBIDDEN") return "Нет доступа к этому курсу";
  return error.defined ? error.message : fallback;
}

/** Ответил ли сервер (в отличие от обрыва сети). */
export function isServerError(
  error: unknown,
): error is ORPCError<string, unknown> {
  return error instanceof ORPCError;
}
