import { orders } from "../procedures";

const view = orders.view.handler(async ({ input, context, errors }) => {
  const order = await context.services.orders.view(input);
  if (!order) throw errors.ORDER_NOT_FOUND();
  return order;
});

const updateDetails = orders.updateDetails.handler(
  async ({ input, context, errors }) => {
    const result = await context.services.orders.updateDetails(input);
    if (result === "not_found") throw errors.ORDER_NOT_FOUND();
    if (result === "locked") throw errors.ORDER_DETAILS_LOCKED();
  },
);

const pay = orders.pay.handler(async ({ input, context, errors }) => {
  const result = await context.services.orders.startPayment({
    orderId: input.orderId,
    phone: input.phone,
    returnTo: input.returnTo,
    headers: context.headers,
  });
  switch (result.status) {
    case "ok":
      return { confirmationUrl: result.confirmationUrl };
    case "not_found":
      throw errors.ORDER_NOT_FOUND();
    case "unavailable":
      throw errors.PAYMENTS_UNAVAILABLE();
    case "nothing_to_pay":
      throw errors.NOTHING_TO_PAY();
    case "overdue":
      throw errors.PAYMENT_OVERDUE();
    case "failed":
      throw errors.PAYMENT_CREATE_FAILED();
  }
});

export const ordersRouter = { view, updateDetails, pay };
