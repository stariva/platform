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
import { CampaignExpenses } from "~/components/crm/campaign-expenses";
import { CampaignForm } from "~/components/crm/campaign-form";
import {
  CHANNEL_LABELS,
  costPer,
  day,
  payback,
  paybackTone,
  rubles,
} from "~/components/crm/crm-meta";
import { RemoveCampaign } from "~/components/crm/remove-campaign";
import { SiteHeader } from "~/components/layout";
import { Field } from "~/components/orders/order-details";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

/** Показывает кампанию, её расходы, клиентов и форму редактирования. */
export default async function CrmCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await api.admin.crm.campaign({ id }).catch((error) => {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  });
  const { campaign } = data;

  return (
    <>
      <SiteHeader title={campaign.name} />
      <div className="grid gap-4 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:px-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {campaign.name}
                <Badge variant="outline">
                  {CHANNEL_LABELS[campaign.channel]}
                </Badge>
                {campaign.archived && (
                  <Badge variant="secondary">закончилась</Badge>
                )}
              </CardTitle>
              <CardDescription>
                <Link href="/crm/campaigns" className="hover:underline">
                  ← Все кампании
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Field label="Потрачено">{rubles.format(data.spend)}</Field>
                <Field label="Выручка с клиентов">
                  {rubles.format(data.revenue)}
                </Field>
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">Окупаемость</dt>
                  <dd
                    className={`text-sm font-medium ${paybackTone(data.revenue, data.spend)}`}
                  >
                    {payback(data.revenue, data.spend)}
                  </dd>
                </div>
                <Field label="Клиентов">{String(data.leads)}</Field>
                <Field label="Из них купили">{String(data.buyers)}</Field>
                <Field label="Цена покупателя">
                  {costPer(data.spend, data.buyers)}
                </Field>
              </dl>
              <p className="text-muted-foreground mt-3 text-xs">
                За всё время. По месяцам и периодам — в{" "}
                <Link href="/crm" className="underline">
                  сводке
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Расходы</CardTitle>
              <CardDescription>
                Вносите каждое пополнение или оплату — по дате расхода сводка
                считает бюджет за период.
                {campaign.directCampaignId &&
                  " Расход Директа по дням приходит сам каждое утро."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignExpenses
                campaignId={campaign.id}
                expenses={data.expenses.map((expense) => ({
                  id: expense.id,
                  spentOn: expense.spentOn,
                  amount: expense.amount,
                  note: expense.note,
                  source: expense.source,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Клиенты кампании</CardTitle>
            </CardHeader>
            <CardContent>
              {data.clients.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Пока никого. Клиенты появятся, когда закажут на сайте по
                  ссылке с метками кампании или когда вы отметите кампанию в
                  карточке клиента.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.clients.map((client) => (
                    <li
                      key={client.key}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/crm/clients/${encodeURIComponent(client.key)}`}
                          className="font-medium hover:underline"
                        >
                          {client.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">
                          с {day.format(client.firstSeenAt)}
                          {client.manual && " · отмечен вручную"}
                        </div>
                      </div>
                      <span className="tabular-nums">
                        {rubles.format(client.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Настройки</CardTitle>
            </CardHeader>
            <CardContent>
              <CampaignForm
                key={campaign.updatedAt.toISOString()}
                id={campaign.id}
                initial={{
                  name: campaign.name,
                  channel: campaign.channel,
                  utmSource: campaign.utmSource ?? "",
                  utmCampaign: campaign.utmCampaign ?? "",
                  directCampaignId: campaign.directCampaignId?.toString() ?? "",
                  notes: campaign.notes ?? "",
                  archived: campaign.archived,
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Удаление</CardTitle>
            </CardHeader>
            <CardContent>
              <RemoveCampaign id={campaign.id} name={campaign.name} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
