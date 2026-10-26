import { ORPCError } from "@orpc/server";
import {
  crmSales,
  customOrderRequests,
  eq,
  productOrderItems,
  productOrders,
} from "@stariva/db";
import type { CampaignAttribution } from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { isUniqueViolation } from "../crm/shape";
import { formatPhone } from "../requests/order-draft";
import { toKopecks } from "./stage-math";

/** Так же, как мерки проверяет витрина: до 4 цифр и 2 знаков после запятой. */
const measurementSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z
    .string()
    .trim()
    .regex(/^\d{1,4}(?:[.,]\d{1,2})?$/, "Мерка — положительное число")
    .refine((value) => Number(value.replace(",", ".")) > 0, {
      message: "Мерка — положительное число",
    }),
});

/** Рекламный источник из заявки — только если он в формате витрины. */
function attributionOf(data: Record<string, unknown>) {
  const value = data.attribution as Partial<CampaignAttribution> | undefined;
  return typeof value?.first?.at === "string" &&
    typeof value.last?.at === "string"
    ? (value as CampaignAttribution)
    : null;
}

/**
 * Выставляет счёт по заявке с сайта: заводит заказ под заказ на сайте в
 * статусе «Заявка» с одним изделием. Дальше он идёт обычными этапами —
 * условия и одобрение, предоплата через ЮKassa, изготовление, доплата.
 * Покупатель открывает заказ по ссылке и телефону, поэтому телефон нужен
 * обязательно. Одна заявка — один заказ: на сайте или записанный в CRM.
 *
 * @example client.admin.orders.fromRequest({ number: 1017, ... })
 */
export const fromRequest = adminProcedure
  .input(
    z.object({
      number: z.number().int().positive(),
      contactName: z.string().trim().min(1, "Укажите имя").max(120),
      contactPhone: z.string().trim().max(40),
      contactEmail: z.union([
        z.email("Проверьте почту").max(200),
        z.literal(""),
      ]),
      productSlug: z.string().trim().max(200),
      name: z.string().trim().min(1, "Укажите изделие").max(200),
      price: z
        .number()
        .finite()
        .positive("Укажите цену изделия")
        .max(10_000_000),
      size: z.string().trim().min(1).max(60),
      color: z.string().trim().min(1).max(60),
      measurements: z.array(measurementSchema).max(10),
      comment: z.string().trim().max(1500),
    }),
  )
  .handler(async ({ context, input }) => {
    const contactPhone = formatPhone(input.contactPhone);
    if (!contactPhone) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Нужен российский мобильный: по нему покупатель откроет заказ и оплатит",
      });
    }
    const amount = toKopecks(input.price);

    try {
      return await context.db.transaction(async (tx) => {
        const [request] = await tx
          .select({
            data: customOrderRequests.data,
            visitor: customOrderRequests.visitor,
          })
          .from(customOrderRequests)
          .where(eq(customOrderRequests.number, input.number))
          .for("update");
        if (!request) {
          throw new ORPCError("NOT_FOUND", { message: "Заявка не найдена" });
        }
        const [sale] = await tx
          .select({ id: crmSales.id })
          .from(crmSales)
          .where(eq(crmSales.requestNumber, input.number));
        if (sale) {
          throw new ORPCError("CONFLICT", {
            message: `По заявке №${input.number} уже записан заказ в CRM`,
          });
        }

        const id = crypto.randomUUID();
        const [order] = await tx
          .insert(productOrders)
          .values({
            id,
            kind: "made_to_order",
            requestNumber: input.number,
            attribution: attributionOf(request.data),
            visitor: request.visitor,
            contactName: input.contactName,
            contactPhone,
            contactEmail: input.contactEmail || null,
            status: "requested",
            amountProducts: amount,
            amountDelivery: 0,
            amountTotal: amount,
            currency: "RUB",
            deliveryMethod: "manual",
          })
          .returning({ id: productOrders.id, number: productOrders.number });
        if (!order) throw new Error("product_order_not_created");

        await tx.insert(productOrderItems).values({
          id: crypto.randomUUID(),
          orderId: id,
          productSlug: input.productSlug,
          ozonSku: null,
          name: input.name,
          price: amount,
          quantity: 1,
          options: {
            size: input.size,
            color: input.color,
            measurements: input.measurements,
            ...(input.comment && { comment: input.comment }),
          },
        });
        return order;
      });
    } catch (error) {
      if (isUniqueViolation(error, "product_orders_request_idx")) {
        throw new ORPCError("CONFLICT", {
          message: `Счёт по заявке №${input.number} уже выставлен`,
        });
      }
      throw error;
    }
  });
