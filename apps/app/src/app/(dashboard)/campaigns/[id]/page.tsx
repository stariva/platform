import type { CampaignTemplateId } from "@stariva/emails";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CampaignPreview,
  RemoveCampaign,
  SendTest,
  StartCampaign,
} from "~/components/campaigns/campaign-actions";
import { CampaignForm } from "~/components/campaigns/campaign-form";
import {
  CAMPAIGN_STATUS_LABELS,
  share,
} from "~/components/campaigns/campaign-meta";
import { DraftStateProvider } from "~/components/campaigns/draft-state";
import { RecipientsTable } from "~/components/campaigns/recipients-table";
import { dateTime } from "~/components/crm/crm-meta";
import { Stat } from "~/components/crm/stat";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

/**
 * Рассылка. Черновик — форма письма, пробная отправка и запуск. Запущенная —
 * счётчики и получатели: кому ушло, кто открыл, перешёл и отписался.
 */
export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { campaign, stats, recipients } = await api.admin.campaigns
    .get({ id })
    .catch((error) => {
      const code = (error as { code?: string }).code;
      if (code === "NOT_FOUND" || code === "BAD_REQUEST") notFound();
      throw error;
    });
  const draft = campaign.status === "draft";
  // Что сообщил Postbox: доставлено, не доставлено, жалоба на спам
  const delivery = {
    delivered: recipients.filter((row) => row.deliveredAt && !row.bouncedAt)
      .length,
    bounced: recipients.filter((row) => row.bouncedAt).length,
    complained: recipients.filter((row) => row.complainedAt).length,
  };
  const [audience, templates] = draft
    ? await Promise.all([
        api.admin.campaigns.audience({ segment: campaign.segment }),
        api.admin.campaigns.templates(),
      ])
    : [null, []];
  const willReceive =
    audience?.members.filter((member) => !member.suppressed).length ?? 0;

  const header = (
    <CardHeader>
      <CardTitle className="flex flex-wrap items-center gap-2">
        {campaign.name}
        <Badge variant="outline">
          {CAMPAIGN_STATUS_LABELS[campaign.status]}
        </Badge>
      </CardTitle>
      <CardDescription>
        <Link href="/campaigns" className="hover:underline">
          ← Все рассылки
        </Link>
      </CardDescription>
    </CardHeader>
  );

  if (draft) {
    return (
      <>
        <SiteHeader title={campaign.name} />
        <DraftStateProvider>
          <div className="grid gap-4 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:px-6">
            <Card>
              {header}
              <CardContent>
                <CampaignForm
                  // После сохранения — новая форма со значениями из базы
                  key={campaign.updatedAt.getTime()}
                  id={campaign.id}
                  templates={templates}
                  initial={{
                    name: campaign.name,
                    // Шаблон, которого уже нет в коде, форма не выделит, а
                    // сохранение попросит выбрать другой
                    template: campaign.template as CampaignTemplateId,
                    params: campaign.params,
                    segment: campaign.segment,
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Отправка</CardTitle>
                <CardDescription>
                  Уйдёт последняя сохранённая версия. Перед запуском пришлите
                  пробное письмо себе.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CampaignPreview id={campaign.id} subject={campaign.subject} />
                <SendTest id={campaign.id} />
                <StartCampaign
                  id={campaign.id}
                  name={campaign.name}
                  recipients={willReceive}
                  disabled={willReceive === 0}
                />
                <RemoveCampaign id={campaign.id} name={campaign.name} />
              </CardContent>
            </Card>
          </div>
        </DraftStateProvider>
      </>
    );
  }

  return (
    <>
      <SiteHeader title={campaign.name} />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <Card>
          {header}
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Тема:</span>{" "}
              {campaign.subject}
            </p>
            {campaign.startedAt && (
              <p>
                <span className="text-muted-foreground">Запущена:</span>{" "}
                {dateTime.format(campaign.startedAt)}
                {campaign.finishedAt &&
                  ` · закончилась ${dateTime.format(campaign.finishedAt)}`}
              </p>
            )}
            <div className="max-w-xs pt-3">
              <CampaignPreview id={campaign.id} subject={campaign.subject} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Stat
            label="Отправлено"
            value={`${stats?.sent ?? 0} из ${stats?.recipients ?? 0}`}
            hint={
              stats && stats.queued + stats.failed > 0
                ? `В очереди ${stats.queued}, не ушло ${stats.failed}`
                : "Почтовый сервис принял письма"
            }
          />
          <Stat
            label="Доставлено"
            value={delivery.delivered}
            hint={
              delivery.bounced + delivery.complained > 0
                ? `Не доставлено ${delivery.bounced}, жалоб ${delivery.complained}`
                : "По данным Postbox: письмо в ящике получателя"
            }
            tone={
              delivery.bounced + delivery.complained > 0
                ? "text-red-600"
                : undefined
            }
          />
          <Stat
            label="Открыли"
            value={stats?.opened ?? 0}
            hint={`${share(stats?.opened ?? 0, stats?.sent ?? 0)} · с запасом: почтовики подгружают картинки сами`}
          />
          <Stat
            label="Перешли по кнопке"
            value={stats?.clicked ?? 0}
            hint={share(stats?.clicked ?? 0, stats?.sent ?? 0)}
          />
          <Stat label="Отписались" value={stats?.unsubscribed ?? 0} />
          <Stat
            label="Не ушло"
            value={stats?.failed ?? 0}
            tone={stats && stats.failed > 0 ? "text-red-600" : undefined}
            hint="Повторю ещё дважды, раз в 15 минут"
          />
        </div>

        <RecipientsTable rows={recipients} />
      </div>
    </>
  );
}
