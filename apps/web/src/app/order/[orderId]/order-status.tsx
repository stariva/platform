"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { trackPaidOrder } from "@/lib/analytics";
import { describeMadeToOrderOptions } from "@/lib/commerce/made-to-order-options";
import { formatPrice } from "@/lib/products";
import {
  MadeToOrderDetails,
  madeToOrderItemSchema,
} from "./made-to-order-details";

const statusLabels: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  canceled: "Отменён",
  refunded: "Возврат",
  ozon_order_failed: "Обрабатывается вручную",
  fulfilling: "Собирается",
  shipped: "В пути",
  delivered: "Доставлен",
  awaiting_details: "Оплачен · уточняем детали",
  in_production: "Изготавливается",
  ready_to_ship: "Готов к отправке",
};

/** Что дальше, для заказа под заказ: по статусу. */
const madeToOrderHints: Record<string, string> = {
  awaiting_details:
    "Оплата получена. Мастер свяжется с вами, чтобы уточнить мерки, цвет и доставку. Детали можно указать ниже.",
  in_production: "Детали согласованы — мастер плетёт ваше изделие.",
  ready_to_ship:
    "Изделие готово. Мастер согласует с вами доставку и отправит заказ.",
  shipped: "Заказ отправлен — детали отправки пришлёт мастер.",
  delivered: "Заказ получен. Спасибо!",
};

const postingStatusLabels: Record<string, string> = {
  awaiting_packaging: "Ожидает сборки",
  awaiting_deliver: "Ожидает отгрузки",
  delivering: "В пути",
  delivered: "Доставлено",
  cancelled: "Отменено",
  unknown: "Статус уточняется",
};

const orderResponseSchema = z.object({
  kind: z.enum(["stock", "made_to_order"]),
  paid: z.boolean(),
  status: z.string(),
  amountTotal: z.number().int().nonnegative(),
  amountDelivery: z.number().int().nonnegative(),
  createdAt: z.string(),
  deliveryMethod: z.string(),
  customerNotes: z.string().nullable(),
  deliveryNote: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  items: z.array(madeToOrderItemSchema),
  postings: z.array(
    z.object({
      postingNumber: z.string(),
      status: z.string(),
    }),
  ),
});

type OrderData = z.infer<typeof orderResponseSchema>;

const orderLookupSchema = z.object({
  phone: z.string().trim().min(1, "Введите телефон"),
});

type OrderLookupFormValues = z.infer<typeof orderLookupSchema>;

export function OrderStatus({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);
  // Телефон нужен и для повторной загрузки заказа, и для дополнения деталей
  const [phone, setPhone] = useState("");

  const form = useForm<OrderLookupFormValues>({
    resolver: zodResolver(orderLookupSchema),
    defaultValues: { phone: "" },
  });

  /** Загружает заказ по телефону; возвращает false, если загрузить не удалось. */
  async function loadOrder(phoneValue: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue }),
      });
      const resData: unknown = await res.json();
      if (!res.ok) {
        const error = z.object({ error: z.string() }).safeParse(resData);
        toast.error(error.success ? error.data.error : "Заказ не найден");
        return false;
      }
      const parsed = orderResponseSchema.safeParse(resData);
      if (!parsed.success) {
        toast.error("Не удалось загрузить заказ");
        return false;
      }
      setOrder(parsed.data);
      setPhone(phoneValue);
      trackPaidOrder(orderId, parsed.data.amountTotal, parsed.data.paid);
      return true;
    } catch {
      toast.error("Не удалось загрузить заказ");
      return false;
    }
  }

  async function onSubmit(data: OrderLookupFormValues) {
    setLoading(true);
    await loadOrder(data.phone);
    setLoading(false);
  }

  if (!order) {
    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4 max-w-md mx-auto"
        >
          <p className="text-taupe text-sm">
            Введите телефон, указанный при оформлении заказа.
          </p>
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Телефон</FormLabel>
                <FormControl>
                  <Input type="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
          >
            {loading ? <Spinner /> : "Показать заказ"}
          </Button>
        </form>
      </Form>
    );
  }

  const madeToOrder = order.kind === "made_to_order";
  const canEditDetails =
    order.status === "awaiting_details" || order.status === "in_production";

  return (
    <div className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <span className="label-caps text-terracotta text-xs">
          {statusLabels[order.status] ?? order.status}
        </span>
        <span className="text-taupe text-xs">
          {new Date(order.createdAt).toLocaleDateString("ru-RU")}
        </span>
      </div>

      {madeToOrder && madeToOrderHints[order.status] && (
        <p className="rounded-xl bg-sand px-4 py-3 text-sm text-espresso leading-relaxed">
          {madeToOrderHints[order.status]}
        </p>
      )}

      <div className="space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-espresso">
                {item.name} × {item.quantity}
              </span>
              <span className="text-espresso">
                {formatPrice((item.price * item.quantity) / 100)}
              </span>
            </div>
            {item.options && (
              <p className="text-taupe text-xs mt-0.5">
                {describeMadeToOrderOptions({
                  ...item.options,
                  comment: undefined,
                })}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-espresso/8 pt-3 flex items-center justify-between font-medium">
        <span className="text-espresso">Итого</span>
        <span className="text-espresso">
          {formatPrice(order.amountTotal / 100)}
        </span>
      </div>
      {madeToOrder && (
        <p className="-mt-2 text-right text-xs text-taupe">
          Без учёта доставки — её согласует мастер
        </p>
      )}

      {madeToOrder && order.trackingNumber && (
        <div className="rounded-xl bg-sand px-4 py-3 text-sm">
          <p className="text-taupe text-xs">Отправление</p>
          <p className="text-espresso">{order.trackingNumber}</p>
        </div>
      )}

      {madeToOrder && canEditDetails && (
        <MadeToOrderDetails
          orderId={orderId}
          phone={phone}
          items={order.items}
          customerNotes={order.customerNotes}
          deliveryNote={order.deliveryNote}
          onSaved={async () => {
            await loadOrder(phone);
          }}
        />
      )}

      {order.postings.length > 0 && (
        <div className="border-t border-espresso/8 pt-3">
          <p className="label-caps text-taupe text-[11px] mb-2">Отправления</p>
          {order.postings.map((p) => (
            <div
              key={p.postingNumber}
              className="flex items-center justify-between text-xs text-taupe"
            >
              <span>{p.postingNumber}</span>
              <span>
                {postingStatusLabels[p.status] ?? "Статус уточняется"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
