"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";
import {
  type AdminOrderView,
  dateTime,
  KIND_LABELS,
  MADE_TO_ORDER_STATUSES,
  rubles,
  STATUS_LABELS,
  statusVariant,
} from "./order-meta";

/** Статус можно менять только у оплаченного заказа под заказ. */
function isStatusEditable(order: AdminOrderView) {
  return (
    order.kind === "made_to_order" &&
    (MADE_TO_ORDER_STATUSES as readonly string[]).includes(order.status)
  );
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** Карточка заказа: что и кем заказано, пожелания покупателя и ведение заказа мастером. */
export function OrderEditor({ order }: { order: AdminOrderView }) {
  const router = useRouter();
  const editableStatus = isStatusEditable(order);
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

  const changed =
    status !== order.status ||
    trackingNumber.trim() !== (order.trackingNumber ?? "") ||
    masterNotes.trim() !== (order.masterNotes ?? "");

  function save() {
    update.mutate({
      id: order.id,
      ...(editableStatus &&
        status !== order.status && {
          status: status as (typeof MADE_TO_ORDER_STATUSES)[number],
        }),
      trackingNumber: trackingNumber.trim(),
      masterNotes: masterNotes.trim(),
    });
  }

  const phoneDigits = order.contactPhone.replace(/[^\d+]/g, "");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Заказ {order.id.slice(0, 8)}
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
              <Field label="Оплачен">
                {order.paidAt
                  ? dateTime.format(new Date(order.paidAt))
                  : "ещё не оплачен"}
              </Field>
              <Field label="Сумма">{rubles.format(order.amountTotal)}</Field>
              {order.ozonOrderId && (
                <Field label="Заказ Ozon Доставка">{order.ozonOrderId}</Field>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Изделия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {rubles.format(item.price * item.quantity)}
                  </span>
                </div>
                {item.options && (
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Размер">{item.options.size}</Field>
                    <Field label="Цвет">{item.options.color}</Field>
                    {item.options.measurements.map((m) => (
                      <Field key={m.label} label={m.label}>
                        {`${m.value} см`}
                      </Field>
                    ))}
                    {item.options.comment && (
                      <div className="sm:col-span-2">
                        <Field label="Комментарий к изделию">
                          {item.options.comment}
                        </Field>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {(order.customerNotes || order.deliveryNote) && (
          <Card>
            <CardHeader>
              <CardTitle>Пожелания покупателя</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {order.customerNotes && (
                  <Field label="Общие пожелания">{order.customerNotes}</Field>
                )}
                {order.deliveryNote && (
                  <Field label="Куда и как отправить">
                    {order.deliveryNote}
                  </Field>
                )}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Покупатель</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Field label="Имя">{order.contactName}</Field>
              <div>
                <dt className="text-muted-foreground text-xs">Телефон</dt>
                <dd className="text-sm">
                  <a
                    href={`tel:${phoneDigits}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {order.contactPhone}
                  </a>
                </dd>
              </div>
              {order.contactEmail && (
                <div>
                  <dt className="text-muted-foreground text-xs">Email</dt>
                  <dd className="text-sm">
                    <a
                      href={`mailto:${order.contactEmail}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {order.contactEmail}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ведение заказа</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editableStatus ? (
              <div className="space-y-1.5">
                <Label>Статус</Label>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    if (value) setStatus(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MADE_TO_ORDER_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Покупатель видит статус на странице заказа.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Статус этого заказа меняет платёжная система
                {order.kind === "stock" && " и Ozon Доставка"}.
              </p>
            )}

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
      </div>
    </div>
  );
}
