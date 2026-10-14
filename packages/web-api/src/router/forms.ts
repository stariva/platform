import { ORPCError } from "@orpc/server";
import { logger } from "@stariva/config";
import { forms } from "../procedures";

const formToken = forms.formToken.handler(async ({ context }) => ({
  token: await context.services.issueFormToken(),
}));

const subscribeNewsletter = forms.subscribeNewsletter.handler(
  async ({ input, context, errors }) => {
    try {
      await context.services.subscribeToNewsletter(input.email, input.source);
    } catch (error) {
      logger.error("newsletter.subscribe_failed", error);
      throw errors.NEWSLETTER_FAILED({ cause: error });
    }
  },
);

const submitCustomOrder = forms.submitCustomOrder.handler(
  async ({ input, context, errors }) => {
    const { photo, website, ...request } = input;
    // Человек поле-ловушку не видит; заполнил — значит, бот. Ответ тот же,
    // что и на любую ошибку в данных, без подсказки
    if (website) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Не удалось принять заявку",
      });
    }
    const orders = context.services.customOrders;
    if (!orders.isAccepting()) throw errors.CUSTOM_ORDER_UNAVAILABLE();

    let saved: Awaited<ReturnType<typeof orders.save>>;
    try {
      saved = await orders.save(request, photo ?? null, context.headers);
    } catch (error) {
      // Текст ошибки не логируем: в нём могут быть данные заявки
      logger.error("custom_order.save_failed");
      throw errors.CUSTOM_ORDER_SAVE_FAILED({ cause: error });
    }
    if (saved === "conflict") throw errors.CUSTOM_ORDER_CONFLICT();

    // Заявка уже в базе: уведомление уходит после ответа и повторяется само
    orders.dispatchLater(saved.id);
    return { requestId: saved.id, requestNumber: saved.number };
  },
);

export const formsRouter = {
  formToken,
  subscribeNewsletter,
  submitCustomOrder,
};
