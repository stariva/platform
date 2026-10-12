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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";
import { MadeToOrderStage } from "./made-to-order-stage";
import {
  Field,
  OrderAttributionCard,
  OrderDeliveryCard,
  OrderItemsCard,
  OrderPaymentsCard,
} from "./order-details";
import {
  type AdminOrderView,
  dateTime,
  isSafeToDelete,
  KIND_LABELS,
  PAYMENT_STATUSES,
  rubles,
  STATUS_LABELS,
  STATUSES_BY_KIND,
  statusVariant,
} from "./order-meta";

type UpdateInput = Parameters<typeof orpc.admin.orders.update.call>[0];
type OrderStatus = NonNullable<UpdateInput["status"]>;

/** Чем опасно удаление — мастер видит это перед подтверждением. */
function deleteRisks(order: AdminOrderView): string[] {
  const risks: string[] = [];
  if (
    order.paidAt ||
    order.depositPaidAt ||
    order.payments.some((payment) => payment.status === "succeeded")
  ) {
    risks.push(
      "по заказу есть оплата — деньги останутся в ЮKassa, вернуть их можно только там",
    );
  }
  if (
    order.payments.some((payment) => payment.status === "pending") ||
    PAYMENT_STATUSES.has(order.status)
  ) {
    risks.push(
      "покупатель ещё может заплатить по ссылке — такая оплата не найдёт заказ",
    );
  }
  if (order.ozonOrderId) {
    risks.push("заказ в Ozon Доставка не отменится — отмените его в Ozon");
  }
  return risks;
}

/** Карточка заказа: что и кем заказано, доставка, оплаты и ведение заказа мастером. */
export function OrderEditor({ order }: { order: AdminOrderView }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [status, setStatus] = useState(order.status);
  const [trackingNumber, setTrackingNumber] = useState(
    order.trackingNumber ?? "",
  );
  const [masterNotes, setMasterNotes] = useState(order.masterNotes ?? "");

  const update = useMutation({
    ...orpc.admin.orders.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Сохранено");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const remove = useMutation({
    ...orpc.admin.orders.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Заказ удалён");
      router.replace("/orders");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  const changed =
    status !== order.status ||
    trackingNumber.trim() !== (order.trackingNumber ?? "") ||
    masterNotes.trim() !== (order.masterNotes ?? "");

  function save() {
    update.mutate({
      id: order.id,
      ...(status !== order.status && {
        status: status as OrderStatus,
        fromStatus: order.status as OrderStatus,
      }),
      trackingNumber: trackingNumber.trim(),
      masterNotes: masterNotes.trim(),
    });
  }

  async function confirmRemove() {
    const risks = deleteRisks(order);
    if (isSafeToDelete(order) && risks.length === 0) {
      if (
        await confirm({
          title: `Удалить заказ №${order.number}?`,
          description: "Это нельзя отменить.",
          confirmLabel: "Удалить",
          destructive: true,
        })
      ) {
        remove.mutate({ id: order.id });
      }
      return;
    }
    const confirmed = await confirm({
      title: `Удалить заказ №${order.number} вместе с историей оплат?`,
      description: (
        <>
          <p>Это нельзя отменить.</p>
          {risks.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          )}
        </>
      ),
      confirmLabel: "Удалить заказ",
      destructive: true,
      input: {
        label: "Чтобы подтвердить, введите номер заказа",
        placeholder: String(order.number),
        matches: (value) => value.replace(/\D/g, "") === String(order.number),
      },
    });
    if (confirmed) remove.mutate({ id: order.id, force: true });
  }

  const kindStatuses = STATUSES_BY_KIND[order.kind];
  const statusOptions = kindStatuses.includes(order.status)
    ? kindStatuses
    : [order.status, ...kindStatuses];

  const phoneDigits = order.contactPhone.replace(/[^\d+]/g, "");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Заказ №{order.number}
              <Badge variant="outline">{KIND_LABELS[order.kind]}</Badge>
              <Badge variant={statusVariant(order.status)}>
                {STATUS_LABELS[order.status] ?? order.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Создан">
                {dateTime.format(new Date(order.createdAt))}
              </Field>
              <Field
                label={
                  order.kind === "made_to_order"
                    ? "Оплачен полностью"
                    : "Оплачен"
                }
              >
                {order.paidAt
                  ? dateTime.format(new Date(order.paidAt))
                  : "ещё не оплачен"}
              </Field>
              <Field label="Сумма">{rubles.format(order.amountTotal)}</Field>
              {order.kind === "made_to_order" && (
                <>
                  <Field label="Одобрен">
                    {order.approvedAt &&
                      dateTime.format(new Date(order.approvedAt))}
                  </Field>
                  <Field label="Предоплата получена">
                    {order.depositPaidAt &&
                      dateTime.format(new Date(order.depositPaidAt))}
                  </Field>
                  <Field label="Срок изготовления">{order.leadTime}</Field>
                </>
              )}
              <Field label="Оплатить до">
                {order.paymentDueAt &&
                  dateTime.format(new Date(order.paymentDueAt))}
              </Field>
              <Field label="Мастер уведомлён">
                {order.staffNotifiedAt &&
                  dateTime.format(new Date(order.staffNotifiedAt))}
              </Field>
              {order.declineReason && (
                <div className="sm:col-span-2">
                  <Field label="Причина отказа">{order.declineReason}</Field>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <OrderItemsCard order={order} />
        <OrderDeliveryCard order={order} />

        {order.customerNotes && (
          <Card>
            <CardHeader>
              <CardTitle>Пожелания покупателя</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-line">
              {order.customerNotes}
            </CardContent>
          </Card>
        )}

        <OrderPaymentsCard order={order} />
        <OrderAttributionCard order={order} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Покупатель</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Field label="Имя">{order.contactName}</Field>
              <Field label="Телефон">
                <a
                  href={`tel:${phoneDigits}`}
                  className="underline-offset-4 hover:underline"
                >
                  {order.contactPhone}
                </a>
              </Field>
              {order.contactEmail && (
                <Field label="Email">
                  <a
                    href={`mailto:${order.contactEmail}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {order.contactEmail}
                  </a>
                </Field>
              )}
              <Field label="Аккаунт">
                {order.userId ? (
                  <Link
                    href={`/users/${order.userId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    открыть профиль
                  </Link>
                ) : (
                  "оформлен без входа"
                )}
              </Field>
            </dl>
          </CardContent>
        </Card>

        {order.kind === "made_to_order" && <MadeToOrderStage order={order} />}

        <Card>
          <CardHeader>
            <CardTitle>Ведение заказа</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  if (value) setStatus(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => STATUS_LABELS[value] ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((value) => (
                    <SelectItem
                      key={value}
                      value={value}
                      disabled={
                        PAYMENT_STATUSES.has(value) && value !== order.status
                      }
                    >
                      {STATUS_LABELS[value] ?? value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Покупатель видит статус на странице заказа. Смена статуса не
                двигает деньги: возврат — в кабинете ЮKassa
                {order.kind === "stock" ? ", отмена доставки — в Ozon" : ""}.
                Ожидание оплаты ставится только кнопками этапа.
              </p>
            </div>

            {order.kind === "made_to_order" && (
              <div className="space-y-1.5">
                <Label htmlFor="tracking">Отправление</Label>
                <Input
                  id="tracking"
                  value={trackingNumber}
                  maxLength={200}
                  placeholder="Служба и номер, например СДЭК 1234567890"
                  onChange={(event) => setTrackingNumber(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Покупатель увидит это, когда заказ отправлен.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="master-notes">Заметка мастера</Label>
              <Textarea
                id="master-notes"
                rows={4}
                value={masterNotes}
                maxLength={2000}
                placeholder="Внутренняя заметка, покупатель её не видит"
                onChange={(event) => setMasterNotes(event.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={!changed || update.isPending}
              onClick={save}
            >
              {update.isPending ? "Сохраняем…" : "Сохранить"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Удаление</CardTitle>
            <CardDescription>
              Для спама, дублей и тестовых заказов. Заказ пропадёт из админки и
              из кабинета покупателя вместе с историей оплат.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="destructive"
              disabled={remove.isPending}
              onClick={confirmRemove}
            >
              {remove.isPending ? "Удаляем…" : "Удалить заказ"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
