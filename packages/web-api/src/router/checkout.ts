import { checkout } from "../procedures";

const checkPhone = checkout.checkPhone.handler(
  async ({ input, context, errors }) => {
    const result = await context.services.checkout.checkPhone(input.phone);
    switch (result.status) {
      case "ok":
        return result.check;
      case "unconfigured":
        throw errors.DELIVERY_UNAVAILABLE();
      case "check_failed":
        throw errors.CHECKOUT_CHECK_FAILED({
          message: "Не удалось проверить доступность доставки",
        });
    }
  },
);

const quote = checkout.quote.handler(async ({ input, context, errors }) => {
  const result = await context.services.checkout.quote(input);
  switch (result.status) {
    case "ok":
      return result.quote;
    case "unconfigured":
      throw errors.DELIVERY_UNAVAILABLE();
    case "items_unavailable":
      throw errors.ITEMS_UNAVAILABLE({
        data: { unavailableProductSlugs: result.unavailableProductSlugs },
      });
    case "check_failed":
      throw errors.CHECKOUT_CHECK_FAILED({
        message: "Не удалось рассчитать стоимость доставки",
      });
  }
});

const create = checkout.create.handler(async ({ input, context, errors }) => {
  const session = await context.getSession();
  const result = await context.services.checkout.create({
    ...input,
    userId: session?.user.id ?? null,
    headers: context.headers,
  });
  switch (result.status) {
    case "ok":
      return result.order;
    case "unconfigured":
      throw errors.PAYMENTS_UNAVAILABLE();
    case "items_unavailable":
      throw errors.ITEMS_UNAVAILABLE({
        data: { unavailableProductSlugs: result.unavailableProductSlugs },
      });
    case "check_failed":
      throw errors.CHECKOUT_CHECK_FAILED();
    case "delivery_unavailable":
      throw errors.DELIVERY_NOT_AVAILABLE();
    case "payment_failed":
      throw errors.PAYMENT_CREATE_FAILED();
  }
});

const requestMadeToOrder = checkout.requestMadeToOrder.handler(
  async ({ input, context, errors }) => {
    const session = await context.getSession();
    const result = await context.services.checkout.requestMadeToOrder({
      ...input,
      userId: session?.user.id ?? null,
      headers: context.headers,
    });
    switch (result.status) {
      case "ok":
        return result.request;
      case "items_unavailable":
        throw errors.ITEMS_UNAVAILABLE({
          data: { unavailableProductSlugs: result.unavailableProductSlugs },
        });
      case "options_unavailable":
        throw errors.OPTIONS_UNAVAILABLE();
      case "check_failed":
        throw errors.CHECKOUT_CHECK_FAILED({
          message: "Не удалось проверить заявку",
        });
    }
  },
);

export const checkoutRouter = { checkPhone, quote, create, requestMadeToOrder };
