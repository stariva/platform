"use client";

import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";
import { useState } from "react";
import {
  type AdminOrderView,
  dateTime,
  KIND_LABELS,
  NEEDS_ATTENTION,
  rubles,
  STATUS_LABELS,
  shortId,
  statusVariant,
} from "./order-meta";

type Filter = "attention" | "made_to_order" | "stock" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "attention", label: "Требуют действия" },
  { id: "made_to_order", label: "Под заказ" },
  { id: "stock", label: "Готовые" },
  { id: "all", label: "Все" },
];

function matchesFilter(order: AdminOrderView, filter: Filter) {
  switch (filter) {
    case "attention":
      return NEEDS_ATTENTION.has(order.status);
    case "made_to_order":
    case "stock":
      return order.kind === filter;
    default:
      return true;
  }
}

/** Краткий состав: первое изделие с параметрами и «ещё N». */
function summary(order: AdminOrderView) {
  const [first, ...rest] = order.items;
  if (!first) return null;
  return {
    title: `${first.name}${first.quantity > 1 ? ` × ${first.quantity}` : ""}`,
    options: first.options
      ? `${first.options.size} · ${first.options.color}`
      : null,
    more: rest.length,
  };
}

/** Заказы покупателей: сначала те, что требуют действия мастера. */
export function OrdersTable({ orders }: { orders: AdminOrderView[] }) {
  const attentionCount = orders.filter((o) =>
    NEEDS_ATTENTION.has(o.status),
  ).length;
  const [filter, setFilter] = useState<Filter>(
    attentionCount > 0 ? "attention" : "all",
  );
  const visible = orders.filter((order) => matchesFilter(order, filter));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(({ id, label }) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? "default" : "outline"}
            onClick={() => setFilter(id)}
          >
            {label}
            {id === "attention" && attentionCount > 0 && ` · ${attentionCount}`}
          </Button>
        ))}
        <span className="text-muted-foreground ml-2 text-sm">
          {orders.length} последних заказов
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Дата</TableHead>
              <TableHead className="w-28">Заказ</TableHead>
              <TableHead>Покупатель</TableHead>
              <TableHead>Состав</TableHead>
              <TableHead className="w-28 text-right">Сумма</TableHead>
              <TableHead className="w-32">Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center"
                >
                  Заказов нет
                </TableCell>
              </TableRow>
            )}
            {visible.map((order) => {
              const items = summary(order);
              return (
                <TableRow key={order.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {dateTime.format(new Date(order.createdAt))}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {shortId(order.id)}
                    </Link>
                    <div>
                      <Badge variant="outline">{KIND_LABELS[order.kind]}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    {order.contactName}
                    <div className="text-muted-foreground text-xs">
                      {order.contactPhone}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[320px] text-sm whitespace-normal">
                    {items && (
                      <>
                        <span className="line-clamp-2">{items.title}</span>
                        {items.options && (
                          <span className="text-muted-foreground text-xs">
                            {items.options}
                          </span>
                        )}
                        {items.more > 0 && (
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            · ещё {items.more}
                          </span>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rubles.format(order.amountTotal)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
