import { logger } from "@stariva/config";
import { admin } from "../procedures";
import {
  isOzonSellerConfigured,
  pushStockToOzon,
} from "../services/ozon-stock";

const pushStock = admin.ozon.pushStock.handler(async ({ input, errors }) => {
  if (!isOzonSellerConfigured()) throw errors.OZON_NOT_CONFIGURED();
  try {
    return await pushStockToOzon(input.slugs);
  } catch (error) {
    // Текст ответа Ozon остаётся в логе сайта, админке хватает кода
    logger.error("ozon.stock.push_error", error);
    throw errors.OZON_REQUEST_FAILED({ cause: error });
  }
});

const revalidate = admin.revalidate.handler(({ input, context }) => {
  context.services.revalidatePaths(input.paths);
  return { revalidated: input.paths.length };
});

export const adminRouter = {
  ozon: { pushStock },
  revalidate,
};
