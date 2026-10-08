import { notFound } from "next/navigation";
import { SiteHeader } from "~/components/layout";
import { OrderEditor } from "~/components/orders/order-editor";
import { toOrderView } from "~/components/orders/order-meta";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await api.admin.orders.byId({ id }).catch((error) => {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  });

  return (
    <>
      <SiteHeader title={`Заказ ${order.id.slice(0, 8)}`} />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        {/* key: после сохранения форма берёт свежие данные с сервера */}
        <OrderEditor
          key={[
            order.status,
            order.amountTotal,
            order.paymentDueAt?.getTime(),
            order.trackingNumber,
            order.masterNotes,
          ].join(":")}
          order={toOrderView(order)}
        />
      </div>
    </>
  );
}
