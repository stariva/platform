import { SiteHeader } from "~/components/layout";
import { toOrderView } from "~/components/orders/order-meta";
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
            Под заказ: «Новая заявка» — свяжитесь с покупателем, согласуйте
            цену, мерки и доставку и одобрите заявку — откроется предоплата 50%.
            Когда изделие готово, выставите доплату. Готовые изделия отправляет
            Ozon Доставка.
          </p>
        </div>
        <OrdersTable orders={orders.map(toOrderView)} />
      </div>
    </>
  );
}
