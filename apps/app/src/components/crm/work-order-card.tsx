import { Badge } from "@stariva/ui";
import Link from "next/link";
import type { api } from "~/orpc/server";
import { formatDay, rubles } from "./crm-meta";
import {
  CHANNEL_LABELS,
  days,
  statusLabel,
  TYPE_LABELS,
  type WorkChannel,
  type WorkType,
} from "./work-meta";

export type WorkOrderRow = Awaited<
  ReturnType<typeof api.admin.crm.orders>
>["items"][number];

/** Деньги заказа: сумма и сколько из неё уже пришло. */
export function OrderMoney({ order }: { order: WorkOrderRow }) {
  if (order.kind === "request") {
    return <span className="text-muted-foreground">цена не согласована</span>;
  }
  if (order.amount === 0) {
    return <span className="text-muted-foreground">сумма не указана</span>;
  }
  return (
    <span className="tabular-nums">
      {rubles.format(order.amount)}
      {order.toCollect > 0 && order.paid > 0 && (
        <span className="text-muted-foreground">
          {" "}
          · оплачено {rubles.format(order.paid)}
        </span>
      )}
      {order.toCollect > 0 && order.paid === 0 && (
        <span className="text-muted-foreground"> · не оплачен</span>
      )}
    </span>
  );
}

/** Площадка и вид заказа значками. */
export function OrderBadges({
  channel,
  type,
}: {
  channel: WorkChannel;
  type: WorkType;
}) {
  return (
    <>
      <Badge variant="outline">{CHANNEL_LABELS[channel]}</Badge>
      {type !== "external" && (
        <Badge variant="secondary">{TYPE_LABELS[type]}</Badge>
      )}
    </>
  );
}

/** Карточка заказа на доске: что, кто, сколько и сколько дней ждёт. */
export function WorkOrderCard({ order }: { order: WorkOrderRow }) {
  return (
    <Link
      href={order.href}
      className={`bg-card hover:border-foreground/30 block space-y-1.5 rounded-lg border p-3 text-sm shadow-xs transition-colors ${
        order.overdue ? "border-destructive/60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {order.number && (
          <span className="font-mono text-xs font-medium">{order.number}</span>
        )}
        <OrderBadges channel={order.channel} type={order.type} />
      </div>
      <div className="line-clamp-2 font-medium">{order.title}</div>
      <div className="text-muted-foreground text-xs">
        {order.clientName}
        {order.kind !== "request" && ` · ${statusLabel(order)}`}
      </div>
      <div className="text-xs">
        <OrderMoney order={order} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {order.overdue && <Badge variant="destructive">просрочен</Badge>}
        {order.dueOn && (
          <span className={order.overdue ? "text-destructive" : ""}>
            срок {formatDay(order.dueOn)}
          </span>
        )}
        <span className="text-muted-foreground">
          {order.daysInStage !== null
            ? `на этапе ${days(order.daysInStage)}`
            : `с заказа ${days(order.daysOpen)}`}
        </span>
      </div>
    </Link>
  );
}
