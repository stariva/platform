import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stariva/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientDeals } from "~/components/crm/client-deals";
import { ClientForm } from "~/components/crm/client-form";
import { dateTime, rubles, utmLabel } from "~/components/crm/crm-meta";
import { RemoveClient } from "~/components/crm/remove-client";
import { SourceBadge } from "~/components/crm/source-badge";
import { SiteHeader } from "~/components/layout";
import { Field } from "~/components/orders/order-details";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const iso = (date: Date | null) => date?.toISOString() ?? null;

/** Показывает контакты, источник и сделки клиента с формой правки карточки. */
export default async function CrmClientPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const client = await api.admin.crm.client({ key }).catch((error) => {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  });

  const hasSiteOrders = client.deals.some((deal) => deal.kind !== "manual");
  const record = client.record;
  const source = !record?.sourceManual ? "auto" : (record.campaignId ?? "none");

  return (
    <>
      <SiteHeader title={client.name} />
      <div className="grid gap-4 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:px-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{client.name}</CardTitle>
              <CardDescription>
                <Link href="/crm/clients" className="hover:underline">
                  ← Все клиенты
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Field label="Телефон">
                  {client.phones.map((phone) => `+${phone}`).join(", ")}
                </Field>
                <Field label="Почта">{client.emails.join(", ")}</Field>
                <Field label="Принёс">{rubles.format(client.revenue)}</Field>
                <Field label="Оплачено заказов">
                  {`${client.paidDeals} из ${client.deals.length}`}
                </Field>
                <Field label="Впервые">
                  {dateTime.format(client.firstSeenAt)}
                </Field>
                <Field label="Первая оплата">
                  {client.firstPaidAt
                    ? dateTime.format(client.firstPaidAt)
                    : "ещё не платил"}
                </Field>
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Откуда</dt>
                  <dd className="mt-0.5">
                    <SourceBadge source={client.source} />
                  </dd>
                </div>
                {client.touch && (
                  <Field label="Первый заход по метке">
                    {[
                      utmLabel(
                        client.touch.utm_source ?? null,
                        client.touch.utm_campaign ?? null,
                      ),
                      client.touch.utm_content &&
                        `объявление: ${client.touch.utm_content}`,
                      client.touch.utm_term &&
                        `запрос: ${client.touch.utm_term}`,
                      `страница: ${client.touch.landing}`,
                      client.touch.referrer &&
                        `пришёл с ${client.touch.referrer}`,
                      dateTime.format(new Date(client.touch.at)),
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </Field>
                )}
                {client.userIds[0] && (
                  <Field label="Аккаунт на сайте">
                    <Link
                      href={`/users/${client.userIds[0]}`}
                      className="hover:underline"
                    >
                      Открыть пользователя
                    </Link>
                  </Field>
                )}
              </dl>
            </CardContent>
          </Card>

          <ClientDeals
            clientKey={client.key}
            deals={client.deals.map((deal) => ({
              ...deal,
              createdAt: deal.createdAt.toISOString(),
              lastPaidAt: iso(deal.lastPaidAt),
            }))}
            campaigns={client.campaigns}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Карточка</CardTitle>
              {!record && (
                <CardDescription>
                  Клиент собран из заказов на сайте. Карточка появится, когда вы
                  сохраните источник или заметки.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {/* key: после сохранения форма берёт свежие данные с сервера */}
              <ClientForm
                key={[record?.id, record?.notes, source, client.name].join(":")}
                clientKey={client.key}
                hasSiteOrders={hasSiteOrders}
                campaigns={client.campaigns}
                initial={{
                  name: client.name,
                  phone: record?.phone
                    ? `+${record.phone}`
                    : client.phones[0]
                      ? `+${client.phones[0]}`
                      : "",
                  email: record?.email ?? client.emails[0] ?? "",
                  source,
                  notes: record?.notes ?? "",
                }}
              />
            </CardContent>
          </Card>

          {record && (
            <Card>
              <CardHeader>
                <CardTitle>Удаление</CardTitle>
                <CardDescription>
                  Для дублей и ошибочных записей.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RemoveClient
                  id={record.id}
                  name={client.name}
                  hasSiteOrders={hasSiteOrders}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
