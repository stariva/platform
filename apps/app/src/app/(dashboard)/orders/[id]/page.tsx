import { notFound } from "next/navigation";
import { OrderCostsSection } from "~/components/crm/order-costs-section";
import { SiteHeader } from "~/components/layout";
import { OrderEditor } from "~/components/orders/order-editor";
import { toOrderView } from "~/components/orders/order-meta";
import { OrderWorkshopAccess } from "~/components/orders/order-workshop-access";
import { VisitorCard } from "~/components/visitors/visitor-card";
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
  const [access, workshops] = await Promise.all([
    api.admin.workshops.orderAccess({ orderId: order.id }),
    api.admin.workshops.list(),
  ]);

  return (
    <>
      <SiteHeader title={`Заказ №${order.number}`} />
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
          costs={<OrderCostsSection kind="product" orderId={order.id} />}
          workshopAccess={
            <OrderWorkshopAccess
              orderId={order.id}
              workshops={workshops
                .filter((w) => w.status !== "archived")
                .map(({ slug, title }) => ({ slug, title }))}
              email={access.email}
              gift={access.gift}
              linked={access.linked}
              granted={access.granted.map((row) => ({
                workshopSlug: row.workshopSlug,
                email: row.email,
                accessSentAt: row.accessSentAt,
              }))}
              codes={access.codes.map((row) => ({
                id: row.id,
                code: row.code,
                workshopSlug: row.workshopSlug,
                workshopTitle: row.workshopTitle,
                redeemed: row.redeemedAt !== null,
              }))}
            />
          }
        />
        <VisitorCard visitor={order.visitor} />
      </div>
    </>
  );
}
