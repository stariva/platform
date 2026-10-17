"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { OrderView } from "@stariva/web-api/contract";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ItemImage } from "@/app/account/orders/order-ui";
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
import { recallOrderPhone } from "@/lib/commerce/order-phone";
import {
  madeToOrderHints,
  postingStatusLabels,
  productOrderStatusLabels as statusLabels,
} from "@/lib/commerce/order-status";
import { formatPrice } from "@/lib/products";
import { formErrorMessage, webApi } from "@/lib/web-api";
import { MadeToOrderDetails } from "./made-to-order-details";
import { MadeToOrderPayment } from "./made-to-order-payment";

const orderLookupSchema = z.object({
  phone: z.string().trim().min(1, "Введите телефон"),
});

type OrderLookupFormValues = z.infer<typeof orderLookupSchema>;

export function OrderStatus({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderView | null>(null);
  // Телефон нужен и для повторной загрузки заказа, и для дополнения деталей
  const [phone, setPhone] = useState("");

  const form = useForm<OrderLookupFormValues>({
    resolver: zodResolver(orderLookupSchema),
    defaultValues: { phone: "" },
  });

  /** Загружает заказ по телефону; возвращает false, если загрузить не удалось. */
  async function loadOrder(phoneValue: string): Promise<boolean> {
    try {
      const data = await webApi.orders.view({ orderId, phone: phoneValue });
      setOrder(data);
      setPhone(phoneValue);
      trackPaidOrder(orderId, data.amountTotal, data.paid);
      return true;
    } catch (error) {
      toast.error(formErrorMessage(error, "Не удалось загрузить заказ"));
      return false;
    }
  }

  async function onSubmit(data: OrderLookupFormValues) {
    setLoading(true);
    await loadOrder(data.phone);
    setLoading(false);
  }

  // Сразу после заявки телефон уже известен — открываем заказ без формы
  const autoLoaded = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: загружаем один раз при открытии страницы
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    const remembered = recallOrderPhone(orderId);
    if (!remembered) return;
    setLoading(true);
    void loadOrder(remembered).finally(() => setLoading(false));
  }, [orderId]);

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
  // После одобрения условия зафиксированы — изменения только через мастера
  const canEditDetails = order.status === "requested";
  const hint =
    order.status === "declined"
      ? `Мастер не сможет выполнить этот заказ${order.declineReason ? `: ${order.declineReason}` : "."}`
      : madeToOrderHints[order.status];

  return (
    <div
      data-analytics-private
      className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4 max-w-md mx-auto"
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="label-caps text-terracotta text-xs">
            {statusLabels[order.status] ?? order.status}
          </span>
          <span className="text-taupe text-xs">
            {new Date(order.createdAt).toLocaleDateString("ru-RU")}
          </span>
        </div>
        <p className="text-espresso font-medium">Заказ №{order.number}</p>
      </div>

      {madeToOrder && hint && (
        <p className="rounded-xl bg-sand px-4 py-3 text-sm text-espresso leading-relaxed">
          {hint}
        </p>
      )}

      <div className="space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 text-sm">
            <ItemImage
              src={item.image}
              alt={item.name}
              sizes="64px"
              className="size-16"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
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
          </div>
        ))}
      </div>

      {madeToOrder ? (
        <MadeToOrderPayment orderId={orderId} phone={phone} terms={order} />
      ) : (
        <div className="border-t border-espresso/8 pt-3 flex items-center justify-between font-medium">
          <span className="text-espresso">Итого</span>
          <span className="text-espresso">
            {formatPrice(order.amountTotal / 100)}
          </span>
        </div>
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
