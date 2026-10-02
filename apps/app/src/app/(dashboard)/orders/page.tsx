import { SiteHeader } from "~/components/layout";
import { OrdersTable } from "~/components/orders/orders-table";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await api.admin.orders.list({});

  return (
    <>
      <SiteHeader title="Заказы" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>
          <p className="text-muted-foreground text-sm">
            «Уточнить детали» — оплаченный заказ под заказ: свяжитесь с
            покупателем, уточните мерки, цвет и доставку, затем переведите заказ
            в работу. Готовые изделия отправляет Ozon Доставка.
          </p>
        </div>
        <OrdersTable
          orders={orders.map((order) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
            paidAt: order.paidAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </>
  );
}
