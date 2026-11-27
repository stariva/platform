import { logger } from "@stariva/config";
import { admin } from "../procedures";
import {
  isOzonSellerConfigured,
  pushStockToOzon,
} from "../services/ozon-stock";

const pushStock = admin.ozon.pushStock.handler(async ({ input, errors }) => {
  if (!isOzonSellerConfigured()) throw errors.OZON_NOT_CONFIGURED();
  try {
    return await pushStockToOzon(input.slugs, {
      visibilityOnly: input.visibilityOnly,
    });
  } catch (error) {
    // Процедуру вызывает только своя админка, поэтому отдаём текст
    // первопричины: иначе мастер видит голый ozon_request_failed и идёт
    // в логи сайта за каждой мелочью
    logger.error("ozon.stock.push_error", error);
    const message = error instanceof Error ? error.message : String(error);
    throw errors.OZON_REQUEST_FAILED({
      message: message.slice(0, 500),
      cause: error,
    });
  }
});

const revalidate = admin.revalidate.handler(({ input, context }) => {
  context.services.revalidatePaths(input.paths);
  return { revalidated: input.paths.length };
});

const notifyBoostyOrder = admin.notifyBoostyOrder.handler(
  async ({ input, context }) => {
    return { sent: await context.services.notifyBoostyOrder(input.orderId) };
  },
);

const issueBoostyReceipt = admin.issueBoostyReceipt.handler(
  async ({ input, context }) => {
    return { issued: await context.services.issueBoostyReceipt(input.orderId) };
  },
);

const sweepMadeToOrder = admin.madeToOrder.sweep.handler(({ context }) =>
  context.services.sweepMadeToOrderDeliveries(),
);

export const adminRouter = {
  ozon: { pushStock },
  madeToOrder: { sweep: sweepMadeToOrder },
  revalidate,
  notifyBoostyOrder,
  issueBoostyReceipt,
};
