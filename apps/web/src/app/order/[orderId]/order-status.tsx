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
import { formatPrice } from "@/lib/products";

const statusLabels: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  canceled: "Отменён",
  refunded: "Возврат",
  ozon_order_failed: "Обрабатывается вручную",
  fulfilling: "Собирается",
  shipped: "В пути",
  delivered: "Доставлен",
};

const orderResponseSchema = z.object({
  paid: z.boolean(),
  status: z.string(),
  amountTotal: z.number().int().nonnegative(),
  amountDelivery: z.number().int().nonnegative(),
  createdAt: z.string(),
  deliveryMethod: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().int().nonnegative(),
    }),
  ),
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

  const form = useForm<OrderLookupFormValues>({
    resolver: zodResolver(orderLookupSchema),
    defaultValues: { phone: "" },
  });

  async function onSubmit(data: OrderLookupFormValues) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      const resData: unknown = await res.json();
      if (!res.ok) {
        const error = z.object({ error: z.string() }).safeParse(resData);
        toast.error(error.success ? error.data.error : "Заказ не найден");
        return;
      }
      const parsed = orderResponseSchema.safeParse(resData);
      if (!parsed.success) {
        toast.error("Не удалось загрузить заказ");
        return;
      }
      setOrder(parsed.data);
      trackPaidOrder(orderId, parsed.data.amountTotal, parsed.data.paid);
    } catch {
      toast.error("Не удалось загрузить заказ");
    } finally {
      setLoading(false);
    }
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

      <div className="space-y-2">
        {order.items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: снапшот позиций заказа, без стабильного id
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-espresso">
              {item.name} × {item.quantity}
            </span>
            <span className="text-espresso">
              {formatPrice((item.price * item.quantity) / 100)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-espresso/8 pt-3 flex items-center justify-between font-medium">
        <span className="text-espresso">Итого</span>
        <span className="text-espresso">
          {formatPrice(order.amountTotal / 100)}
        </span>
      </div>

      {order.postings.length > 0 && (
        <div className="border-t border-espresso/8 pt-3">
          <p className="label-caps text-taupe text-[10px] mb-2">Отправления</p>
          {order.postings.map((p) => (
            <div
              key={p.postingNumber}
              className="flex items-center justify-between text-xs text-taupe"
            >
              <span>{p.postingNumber}</span>
              <span>{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
