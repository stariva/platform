"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
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

interface OrderData {
  status: string;
  paymentMethod: string;
  amountTotal: number;
  amountDelivery: number;
  createdAt: string;
  deliveryMethod: string;
  items: { name: string; quantity: number; price: number }[];
  postings: { postingNumber: string; status: string }[];
}

export function OrderStatus({ orderId }: { orderId: string }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Заказ не найден");
        return;
      }
      setOrder(data);
    } catch {
      toast.error("Не удалось загрузить заказ");
    } finally {
      setLoading(false);
    }
  }

  if (!order) {
    return (
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4 max-w-md mx-auto"
      >
        <p className="text-taupe text-sm">
          Введите телефон, указанный при оформлении заказа.
        </p>
        <div>
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
        >
          {loading ? <Spinner /> : "Показать заказ"}
        </Button>
      </form>
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

      {order.status === "pending" && order.paymentMethod === "seller_link" && (
        <p className="text-taupe text-xs bg-sand/60 rounded-lg p-3">
          Заказ принят без online-оплаты. Продавец свяжется с вами и пришлёт
          ссылку на оплату лично.
        </p>
      )}

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
