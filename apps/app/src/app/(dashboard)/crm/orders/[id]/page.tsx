import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stariva/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateTime, formatDay, rubles } from "~/components/crm/crm-meta";
import {
  OrderEditForm,
  OrderPayments,
  OrderStageControl,
  RemoveOrder,
} from "~/components/crm/order-manage";
import {
  CHANNEL_LABELS,
  CRM_STATUS_LABELS,
  days,
  plural,
} from "~/components/crm/work-meta";
import { SiteHeader } from "~/components/layout";
import { Field } from "~/components/orders/order-details";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

/** Заказ вне сайта: этап, деньги, клиент и всё, что о нём известно. */
export default async function CrmOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await api.admin.crm.order({ id }).catch((error) => {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  });
  const label = [CHANNEL_LABELS[order.channel], order.externalNumber]
    .filter(Boolean)
    .join(" №");
  const sinceStatus = Math.floor(
    (Date.now() - order.statusChangedAt.getTime()) / 86_400_000,
  );

  return (
    <>
      <SiteHeader title="Заказ" />
      <div className="grid gap-4 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:px-6">
        <div className="space-y-4">
          <div>
            <Link
              href="/crm/orders"
              className="text-muted-foreground text-sm hover:underline"
            >
              ← Заказы в работе
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {order.description}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{label}</Badge>
              <Badge
                variant={order.status === "canceled" ? "outline" : "default"}
              >
                {CRM_STATUS_LABELS[order.status]}
              </Badge>
              {order.overdue && <Badge variant="destructive">просрочен</Badge>}
              <span className="text-muted-foreground">
                от {formatDay(order.soldOn)} · на этапе {days(sinceStatus)}
              </span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Этап</CardTitle>
              <CardDescription>
                Передвигайте заказ по мере работы — доска «Заказы в работе»
                покажет, где он сейчас.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderStageControl id={order.id} status={order.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Заказ</CardTitle>
            </CardHeader>
            <CardContent>
              {/* key: после сохранения форма берёт свежие данные с сервера */}
              <OrderEditForm
                key={`${order.id}:${order.updatedAt.getTime()}`}
                id={order.id}
                campaigns={order.campaigns}
                initial={{
                  channel: order.channel,
                  externalNumber: order.externalNumber ?? "",
                  description: order.description,
                  amount: order.amount ? String(order.amount) : "",
                  soldOn: order.soldOn,
                  dueOn: order.dueOn ?? "",
                  fee: order.fee ? String(order.fee) : "",
                  campaignId: order.campaignId,
                  trackingNumber: order.trackingNumber ?? "",
                  notes: order.notes ?? "",
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Деньги</CardTitle>
              <CardDescription>
                {order.amount > 0
                  ? `Сумма заказа ${rubles.format(order.amount)} · оплачено ${rubles.format(order.paid)}`
                  : `Сумма не согласована · оплачено ${rubles.format(order.paid)}`}
                {order.toCollect > 0 &&
                  ` · ещё придёт ${rubles.format(order.toCollect)}`}
                {order.fee > 0 && ` · комиссия ${rubles.format(order.fee)}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderPayments
                key={order.payments.map((p) => p.id).join()}
                saleId={order.id}
                payments={order.payments}
                toCollect={order.toCollect}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Клиент</CardTitle>
            </CardHeader>
            <CardContent>
              {order.client ? (
                <dl className="grid gap-3">
                  <Field label="Имя">
                    <Link
                      href={`/crm/clients/${encodeURIComponent(order.client.key)}`}
                      className="hover:underline"
                    >
                      {order.client.name}
                    </Link>
                  </Field>
                  {order.client.phones.length > 0 && (
                    <Field label="Телефон">
                      {order.client.phones.map((p) => `+${p}`).join(", ")}
                    </Field>
                  )}
                  {order.client.emails.length > 0 && (
                    <Field label="Почта">
                      {order.client.emails.join(", ")}
                    </Field>
                  )}
                  <Field label="Всего">
                    {`${order.client.orders} ${plural(order.client.orders, "заказ", "заказа", "заказов")} · ${rubles.format(order.client.revenue)}`}
                  </Field>
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Клиент не найден
                </p>
              )}
              {order.requestNumber && (
                <p className="mt-3 text-sm">
                  Вырос из{" "}
                  <Link
                    href={`/requests/${order.requestNumber}`}
                    className="underline"
                  >
                    заявки №{order.requestNumber}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Удаление</CardTitle>
              <CardDescription>
                Заведён {dateTime.format(order.createdAt)}
                {order.closedAt &&
                  ` · закрыт ${dateTime.format(order.closedAt)}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RemoveOrder id={order.id} label={order.description} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
