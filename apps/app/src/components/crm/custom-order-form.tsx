"use client";

import type { CrmOrderStatus } from "@stariva/db/schema";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";
import type { CampaignOption } from "./client-form";
import {
  OrderFields,
  type OrderFieldsValue,
  orderInput,
  useOrderFields,
} from "./order-fields";
import { CRM_STATUS_LABELS, CRM_STATUSES, parseRubles } from "./work-meta";

export interface CustomOrderDraft extends Partial<OrderFieldsValue> {
  name: string;
  phone: string;
  email: string;
}

/**
 * Новый заказ вне сайта: площадка, состав, сумма, этап и уже полученные
 * деньги. С clientKey пишется к этому клиенту; без него — по имени и
 * контактам: известный клиент найдётся по телефону или почте, иначе заведётся.
 */
export function CustomOrderForm({
  clientKey,
  campaigns,
  draft,
  requestNumber,
  submitLabel = "Записать заказ",
}: {
  clientKey?: string;
  campaigns: CampaignOption[];
  draft?: Partial<CustomOrderDraft>;
  requestNumber?: number;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(draft?.name ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [fields, setFields] = useOrderFields(draft);
  const [status, setStatus] = useState<CrmOrderStatus>("new");
  const [paid, setPaid] = useState("");

  const add = useMutation({
    ...orpc.admin.crm.addSale.mutationOptions(),
    onSuccess: ({ id }) => {
      toast.success("Заказ записан");
      router.push(`/crm/orders/${id}`);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const amount = parseRubles(fields.amount);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate({
          ...orderInput(fields),
          key: clientKey,
          client: clientKey ? undefined : { name, phone, email },
          status,
          paid: parseRubles(paid),
          requestNumber,
        });
      }}
    >
      {!clientKey && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="order-name">Клиент</Label>
            <Input
              id="order-name"
              required
              maxLength={120}
              placeholder="Имя"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-phone">Телефон</Label>
              <Input
                id="order-phone"
                type="tel"
                maxLength={40}
                placeholder="+7 916 123-45-67"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-email">Почта</Label>
              <Input
                id="order-email"
                type="email"
                maxLength={200}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            Если клиент уже заказывал с этим телефоном или почтой, заказ
            запишется к нему.
          </p>
        </>
      )}

      <OrderFields
        value={fields}
        onChange={setFields}
        campaigns={campaigns}
        clientKnown={Boolean(clientKey)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="order-status">Этап</Label>
          <Select
            value={status}
            onValueChange={(next) => {
              if (next) setStatus(next as CrmOrderStatus);
            }}
          >
            <SelectTrigger id="order-status" className="w-full">
              <SelectValue>
                {(next: CrmOrderStatus) => CRM_STATUS_LABELS[next]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CRM_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {CRM_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order-paid">Уже оплачено, ₽</Label>
          <div className="flex gap-2">
            <Input
              id="order-paid"
              inputMode="decimal"
              placeholder="0"
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!(amount > 0)}
              onClick={() => setPaid(fields.amount)}
            >
              Всё
            </Button>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Деньги запишутся оплатой в дату заказа. Предоплату и доплату потом
        добавите в карточке заказа.
      </p>

      <Button
        type="submit"
        disabled={
          add.isPending ||
          !fields.description.trim() ||
          (!clientKey && !name.trim())
        }
      >
        {add.isPending ? "Записываем…" : submitLabel}
      </Button>
    </form>
  );
}
