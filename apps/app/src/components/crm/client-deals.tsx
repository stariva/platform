"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
import { STATUS_LABELS } from "~/components/orders/order-meta";
import { WORKSHOP_ORDER_STATUS_LABELS } from "~/components/workshops/workshop-orders-table";
import { orpc } from "~/orpc/react";
import {
  DEAL_KIND_LABELS,
  dateTime,
  dealHref,
  rubles,
  todayInMoscow,
  utmLabel,
} from "./crm-meta";

export interface DealView {
  kind: "product" | "workshop" | "manual";
  id: string;
  label: string;
  status: string;
  createdAt: string;
  paid: number;
  lastPaidAt: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
}

/** Подпись статуса заказа или записи; у ручной продажи статуса нет. */
function statusLabel(deal: DealView) {
  if (deal.kind === "manual") return null;
  if (deal.kind === "workshop") {
    return (
      WORKSHOP_ORDER_STATUS_LABELS[
        deal.status as keyof typeof WORKSHOP_ORDER_STATUS_LABELS
      ] ?? deal.status
    );
  }
  return STATUS_LABELS[deal.status] ?? deal.status;
}

/** Заказы, записи и ручные продажи клиента; продажу мимо сайта можно добавить. */
export function ClientDeals({
  clientKey,
  deals,
}: {
  clientKey: string;
  deals: DealView[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [soldOn, setSoldOn] = useState(todayInMoscow);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const addSale = useMutation({
    ...orpc.admin.crm.addSale.mutationOptions(),
    onSuccess: ({ key }) => {
      toast.success("Продажа добавлена");
      setAmount("");
      setDescription("");
      if (key !== clientKey) {
        router.replace(`/crm/clients/${encodeURIComponent(key)}`);
      }
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const removeSale = useMutation({
    ...orpc.admin.crm.removeSale.mutationOptions(),
    onSuccess: () => {
      toast.success("Продажа удалена");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  const parsedAmount = Number(amount.replace(",", ".").replace(/\s/g, ""));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Заказы и продажи</CardTitle>
        <CardDescription>
          Заказы и записи с сайта подтягиваются сами. Продажи на Авито, по
          переводу или вживую добавьте ниже — они войдут в выручку источника
          клиента.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Что</TableHead>
                <TableHead>Когда</TableHead>
                <TableHead>Метка</TableHead>
                <TableHead className="text-right">Оплачено</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-6 text-center"
                  >
                    Пока ни заказов, ни продаж
                  </TableCell>
                </TableRow>
              )}
              {deals.map((deal) => {
                const href = dealHref(deal);
                const status = statusLabel(deal);
                return (
                  <TableRow key={`${deal.kind}:${deal.id}`}>
                    <TableCell className="max-w-[280px] align-top whitespace-normal">
                      {href ? (
                        <Link
                          href={href}
                          className="font-medium hover:underline"
                        >
                          {deal.label}
                        </Link>
                      ) : (
                        <span className="font-medium">{deal.label}</span>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline">
                          {DEAL_KIND_LABELS[deal.kind]}
                        </Badge>
                        {status && <Badge variant="secondary">{status}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm whitespace-nowrap">
                      {dateTime.format(new Date(deal.createdAt))}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top text-xs">
                      {utmLabel(deal.utmSource, deal.utmCampaign) || "—"}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {deal.paid > 0 ? rubles.format(deal.paid) : "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      {deal.kind === "manual" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={removeSale.isPending}
                          aria-label="Удалить продажу"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: "Удалить продажу?",
                                description: `${deal.label} — ${rubles.format(deal.paid)}`,
                                confirmLabel: "Удалить",
                                destructive: true,
                              })
                            ) {
                              removeSale.mutate({ id: deal.id });
                            }
                          }}
                        >
                          ✕
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <form
          className="grid gap-3 sm:grid-cols-[150px_140px_minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            addSale.mutate({
              key: clientKey,
              soldOn,
              amount: parsedAmount,
              description,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="sale-date">Дата</Label>
            <Input
              id="sale-date"
              type="date"
              required
              max={todayInMoscow()}
              value={soldOn}
              onChange={(event) => setSoldOn(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-amount">Сумма, ₽</Label>
            <Input
              id="sale-amount"
              inputMode="decimal"
              required
              placeholder="4500"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-description">Что купил</Label>
            <Input
              id="sale-description"
              required
              maxLength={300}
              placeholder="Кашпо, Авито"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={
              addSale.isPending || !(parsedAmount > 0) || !description.trim()
            }
          >
            {addSale.isPending ? "Добавляем…" : "Добавить продажу"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
