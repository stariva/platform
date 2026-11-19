import { buttonVariants, Card, CardContent } from "@stariva/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { rubles } from "~/components/crm/crm-meta";
import { SiteHeader } from "~/components/layout";
import { STATUS_LABELS } from "~/components/orders/order-meta";
import { ArchiveRequest } from "~/components/requests/archive-request";
import { InvoiceRequest } from "~/components/requests/invoice-request";
import { RemoveRequest } from "~/components/requests/remove-request";
import { DeliveryBadge } from "~/components/requests/requests-table";
import { VisitorCard } from "~/components/visitors/visitor-card";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function RequestPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const number = Number((await params).number);
  if (!Number.isSafeInteger(number) || number < 1) notFound();
  const [request, sale] = await Promise.all([
    api.admin.requests.byNumber({ number }).catch((error) => {
      if ((error as { code?: string }).code === "NOT_FOUND") notFound();
      throw error;
    }),
    api.admin.crm.saleForRequest({ number }),
  ]);

  return (
    <>
      <SiteHeader title="Заявки" />
      <div className="max-w-3xl space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <Link
            href="/requests"
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Все заявки
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            Заявка №{request.number}
            <DeliveryBadge
              deliveredAt={request.deliveredAt}
              attempts={request.attempts}
              lockedUntil={request.lockedUntil}
            />
          </h1>
          <p className="text-muted-foreground text-sm">
            {dateFormat.format(request.createdAt)}
            {request.deliveredAt
              ? ` · ушла в Telegram или на почту ${dateFormat.format(request.deliveredAt)}`
              : ` · попыток отправить уведомление: ${request.attempts}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {request.order ? (
            <>
              <span className="text-sm">
                Счёт выставлен: заказ №{request.order.number} ·{" "}
                {STATUS_LABELS[request.order.status] ?? request.order.status} ·{" "}
                {rubles.format(request.order.amountTotal)}
              </span>
              <Link
                href={`/orders/${request.order.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Открыть заказ
              </Link>
            </>
          ) : sale ? (
            <>
              <span className="text-sm">
                Заказ записан: {rubles.format(sale.amount)}
                {sale.campaignName && ` · ${sale.campaignName}`}
              </span>
              <Link
                href={`/crm/orders/${sale.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Открыть заказ
              </Link>
              <Link
                href={`/crm/clients/${encodeURIComponent(sale.clientId)}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Открыть клиента
              </Link>
            </>
          ) : (
            <>
              <InvoiceRequest number={request.number} />
              <Link
                href={`/crm/orders/new?request=${request.number}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Записать заказ в CRM
              </Link>
              <ArchiveRequest
                number={request.number}
                archived={request.archivedAt !== null}
              />
              <RemoveRequest number={request.number} />
              <span className="text-muted-foreground text-sm">
                {request.archivedAt
                  ? "Заявка в архиве и не висит в «Новых» на доске заказов"
                  : "По заявке пока не оформлен заказ"}
              </span>
            </>
          )}
        </div>

        <Card>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap break-words">
              {request.message}
            </p>
          </CardContent>
        </Card>

        <VisitorCard visitor={request.visitor} />

        {request.photoUrl && (
          <Card>
            <CardContent>
              {/* biome-ignore lint/performance/noImgElement: фото лежит в базе как data URL, оптимизатору Next отдать нечего */}
              <img
                src={request.photoUrl}
                alt={`Фото к заявке №${request.number}`}
                className="max-h-[640px] rounded-lg object-contain"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
