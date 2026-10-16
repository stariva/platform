"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";
import type { CampaignOption } from "./client-form";
import {
  DEAL_KIND_LABELS,
  dateTime,
  dealHref,
  rubles,
  utmLabel,
} from "./crm-meta";
import { CustomOrderForm } from "./custom-order-form";
import { statusLabel } from "./work-meta";

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
  // Ручной заказ: выбранная реклама и заявка, из которой он вырос
  campaignId: string | null;
  requestNumber: number | null;
}

/** Заказы, записи и ручные продажи клиента; продажу мимо сайта можно добавить. */
export function ClientDeals({
  clientKey,
  deals,
  campaigns,
}: {
  clientKey: string;
  deals: DealView[];
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const campaignNames = new Map(campaigns.map((c) => [c.id, c.name]));

  const removeSale = useMutation({
    ...orpc.admin.crm.removeSale.mutationOptions(),
    onSuccess: () => {
      toast.success("Заказ удалён");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Заказы и продажи</CardTitle>
        <CardDescription>
          Заказы и записи с сайта подтягиваются сами. Заказы с Авито, Ozon, из
          мессенджеров или вживую добавьте ниже — они появятся на доске «Заказы
          в работе».
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Что</TableHead>
                <TableHead>Когда</TableHead>
                <TableHead>Реклама</TableHead>
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
                        <Badge variant="secondary">{status}</Badge>
                        {deal.requestNumber && (
                          <Link
                            href={`/requests/${deal.requestNumber}`}
                            className="text-xs underline"
                          >
                            заявка №{deal.requestNumber}
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm whitespace-nowrap">
                      {dateTime.format(new Date(deal.createdAt))}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top text-xs">
                      {(deal.campaignId &&
                        (campaignNames.get(deal.campaignId) ??
                          "кампания удалена")) ||
                        utmLabel(deal.utmSource, deal.utmCampaign) ||
                        "—"}
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
                          aria-label="Удалить заказ"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: "Удалить заказ?",
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

        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Новый заказ вне сайта</h3>
          <CustomOrderForm clientKey={clientKey} campaigns={campaigns} />
        </div>
      </CardContent>
    </Card>
  );
}
