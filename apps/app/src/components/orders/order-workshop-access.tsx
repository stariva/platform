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
import { useEffect, useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
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

const sentFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

interface KitWorkshop {
  slug: string;
  title: string;
  /** Уроки уже открыты покупателю. */
  granted: boolean;
  /** Куда ушло или уйдёт письмо с доступом; null — почты нет. */
  email: string | null;
  /** Когда покупателю ушло письмо с доступом; null — не уходило. */
  accessSentAt: Date | null;
}

/**
 * Один мастер-класс набора: открыт ли доступ, ушло ли письмо с доступом, и
 * кнопка, чтобы отправить его вручную. Первая отправка заодно открывает уроки.
 */
function KitWorkshopRow({
  orderId,
  workshop,
  gift,
}: {
  orderId: string;
  workshop: KitWorkshop;
  /** Заказ — подарок: доступ только по коду на купоне, письма нет. */
  gift: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const deliveryKey = `kit-access:${orderId}:${workshop.slug}`;
  const [deliveryWarning, setDeliveryWarning] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);
  const [deliveryLoaded, setDeliveryLoaded] = useState(false);
  useEffect(() => {
    try {
      const warning = sessionStorage.getItem(deliveryKey);
      setDeliveryWarning(warning);
      setDelivered(!!warning);
    } catch {
      // Локальное подтверждение работает и без доступа к хранилищу.
    }
    setDeliveryLoaded(true);
  }, [deliveryKey]);
  // Письмо ушло, даже если отметка о нём в базе не сохранилась
  const wasSent = !!workshop.accessSentAt || delivered;
  const send = useMutation({
    ...orpc.admin.workshops.sendKitAccess.mutationOptions(),
    onSuccess: ({ to, warning }) => {
      setDelivered(true);
      setDeliveryWarning(warning);
      try {
        if (warning) sessionStorage.setItem(deliveryKey, warning);
        else sessionStorage.removeItem(deliveryKey);
      } catch {
        // Сохраняем состояние текущей строки, даже если хранилище недоступно.
      }
      if (warning) toast.warning(`${warning}: ${to}`);
      else toast.success(`Доступ отправлен на ${to}`);
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось отправить доступ");
      // Доступ мог открыться, даже если письмо не ушло
      router.refresh();
    },
  });

  async function submit() {
    if (
      wasSent &&
      !(await confirm({
        title: "Отправить доступ ещё раз?",
        description: `Письмо с доступом уже уходило на ${workshop.email ?? "почту покупателя"}. Придёт ещё одно такое же письмо.`,
        confirmLabel: "Отправить",
      }))
    ) {
      return;
    }
    send.mutate({ orderId, workshopSlug: workshop.slug });
  }

  if (gift) {
    return (
      <li className="space-y-2 rounded-md border p-3 text-sm">
        <p className="font-medium">{workshop.title}</p>
        <Badge variant="info-light">Подарок: доступ по коду</Badge>
        <p className="text-muted-foreground">
          Письма покупателю нет. Напечатайте купон с кодом и положите в коробку:
          доступ откроется, когда получатель введёт код.
        </p>
      </li>
    );
  }

  return (
    <li className="space-y-2 rounded-md border p-3 text-sm">
      <p className="font-medium">{workshop.title}</p>
      <div className="flex flex-wrap gap-2">
        {workshop.granted ? (
          <Badge variant="success-light">Доступ открыт</Badge>
        ) : (
          <Badge variant="warning-light">Доступ не открыт</Badge>
        )}
        {workshop.accessSentAt ? (
          <Badge variant="success-light">
            Письмо отправлено {sentFormat.format(workshop.accessSentAt)}
          </Badge>
        ) : (
          !delivered && (
            <Badge variant="warning-light">Письмо не отправлено</Badge>
          )
        )}
      </div>
      {deliveryWarning && (
        <p role="status" className="text-amber-700">
          {deliveryWarning}
        </p>
      )}
      {workshop.email && (
        <p className="text-muted-foreground break-all">{workshop.email}</p>
      )}
      {!workshop.email ? (
        <p className="text-muted-foreground">
          У заказа нет почты — отправить доступ некуда. Выдайте код и
          напечатайте купон.
        </p>
      ) : (
        <Button
          size="sm"
          variant={wasSent ? "outline" : "default"}
          disabled={send.isPending || !deliveryLoaded}
          onClick={submit}
        >
          {send.isPending
            ? "Отправляем…"
            : wasSent
              ? "Отправить ещё раз"
              : "Отправить доступ на почту"}
        </Button>
      )}
    </li>
  );
}

/**
 * Мастер-класс к набору из заказа. Обычно делать ничего не нужно: доступ к
 * урокам сам уходит на почту покупателя сразу после оплаты, а коробку
 * привозит Ozon. Письмо не ушло — отправьте его кнопкой. Купон с кодом —
 * запасной путь, когда почты у заказа нет или мастер-класс к товару ещё не
 * привязан.
 */
export function OrderWorkshopAccess({
  orderId,
  workshops,
  email,
  gift,
  linked,
  granted,
  codes,
}: {
  orderId: string;
  workshops: { slug: string; title: string }[];
  /** Почта покупателя из заказа; null — её нет. */
  email: string | null;
  /** Набор в подарок: доступ только по коду на купоне, письма нет. */
  gift: boolean;
  /** Мастер-классы, привязанные к товарам заказа. */
  linked: { slug: string; title: string }[];
  /** Уже открыты на почту покупателя. */
  granted: {
    workshopSlug: string;
    email: string | null;
    accessSentAt: Date | null;
  }[];
  codes: OrderAccessCode[];
}) {
  const router = useRouter();
  const [workshop, setWorkshop] = useState(linked[0]?.slug ?? "");
  const titles = Object.fromEntries(workshops.map((w) => [w.slug, w.title]));
  const linkedTitles = Object.fromEntries(linked.map((w) => [w.slug, w.title]));
  // Открытые — первыми; привязанные к товарам, но ещё не открытые — следом
  const kitWorkshops: KitWorkshop[] = [
    ...granted.map((row) => ({
      slug: row.workshopSlug,
      title:
        linkedTitles[row.workshopSlug] ??
        titles[row.workshopSlug] ??
        row.workshopSlug,
      granted: true,
      email: row.email ?? email,
      accessSentAt: row.accessSentAt,
    })),
    ...linked
      .filter((w) => !granted.some((row) => row.workshopSlug === w.slug))
      .map((w) => ({
        slug: w.slug,
        title: w.title,
        granted: false,
        email,
        accessSentAt: null,
      })),
  ];

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
          {gift
            ? "Покупатель оформил набор в подарок: код доступа выдан при оплате, на почту ничего не уходит. Напечатайте купон и положите в коробку — получатель введёт код на stariva.ru/code."
            : linked.length > 0
              ? "После оплаты доступ к урокам сам уходит на почту покупателя, а коробку привозит Ozon. Если письмо не ушло, отправьте его кнопкой. Купон с кодом нужен, только если почты нет."
              : "К товарам заказа мастер-класс не привязан — привяжите его в карточке товара или выдайте код и напечатайте купон в коробку."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {kitWorkshops.length > 0 && (
          <ul className="space-y-2">
            {kitWorkshops.map((row) => (
              <KitWorkshopRow
                key={`${orderId}:${row.slug}`}
                orderId={orderId}
                workshop={row}
                gift={gift}
              />
            ))}
          </ul>
        )}
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
