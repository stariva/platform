"use client";

import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccessCodeRemove } from "~/components/workshops/access-codes";
import { orpc } from "~/orpc/react";

export interface OrderAccessCode {
  id: string;
  code: string;
  workshopSlug: string;
  workshopTitle: string | null;
  redeemed: boolean;
}

const ticketHref = (id: string) => `/access-codes/${id}/print`;

/**
 * Мастер-класс к набору из заказа: выдать код и напечатать купон в коробку.
 * Код одноразовый; заказ по нему создаётся на 0 ₽ — мастер-класс уже оплачен
 * в цене набора.
 */
export function OrderWorkshopAccess({
  orderId,
  workshops,
  codes,
}: {
  orderId: string;
  workshops: { slug: string; title: string }[];
  codes: OrderAccessCode[];
}) {
  const router = useRouter();
  const [workshop, setWorkshop] = useState("");
  const titles = Object.fromEntries(workshops.map((w) => [w.slug, w.title]));

  const issue = useMutation({
    ...orpc.admin.workshops.issueAccessCode.mutationOptions(),
    onSuccess: ({ id, code }) => {
      toast.success(`Код ${code} выдан — открываем купон`);
      router.refresh();
      router.push(ticketHref(id));
    },
    onError: (error: Error) =>
      toast.error(error.message || "Не удалось выдать код"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Мастер-класс к набору</CardTitle>
        <CardDescription>
          Выдайте код и напечатайте купон в коробку: на нём QR-код, адрес и сам
          код. Покупатель откроет видеоуроки любым из способов.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {codes.length > 0 && (
          <ul className="space-y-3">
            {codes.map((row) => (
              <li key={row.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg">{row.code}</span>
                  {row.redeemed ? (
                    <Badge variant="success-light">Активирован</Badge>
                  ) : (
                    <Badge variant="warning-light">Ждёт активации</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {row.workshopTitle ?? row.workshopSlug}
                </p>
                {!row.redeemed && (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={ticketHref(row.id)}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Напечатать купон
                    </Link>
                    <AccessCodeRemove id={row.id} code={row.code} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {workshops.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Сначала добавьте мастер-класс — коды выдаются к нему.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="order-access-workshop">Мастер-класс</Label>
              <Select
                value={workshop}
                onValueChange={(value) => {
                  if (value) setWorkshop(value);
                }}
              >
                <SelectTrigger id="order-access-workshop" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      titles[value] ?? "Выберите мастер-класс"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {workshops.map((w) => (
                    <SelectItem key={w.slug} value={w.slug}>
                      {w.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              variant={codes.length > 0 ? "outline" : "default"}
              disabled={!workshop || issue.isPending}
              onClick={() =>
                issue.mutate({
                  workshopSlug: workshop,
                  productOrderId: orderId,
                })
              }
            >
              {issue.isPending
                ? "Выдаём…"
                : codes.length > 0
                  ? "Выдать ещё один код"
                  : "Выдать код и открыть купон"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
