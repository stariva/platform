"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PickupPointPicker } from "@/components/checkout/pickup-point-picker";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { PickupPoint } from "@/lib/ozon-delivery/types";
import { formErrorMessage, webApi } from "@/lib/web-api";

interface Props {
  orderId: string;
  phone: string;
  /** Выбранный пункт; адреса нет, если Ozon тогда не ответил. */
  point: { title: string | null; address: string | null } | null;
  /** Можно ли ещё выбрать другой: после выставления доплаты нельзя. */
  editable: boolean;
  onSaved: () => Promise<void> | void;
}

/**
 * Куда отправить изделие под заказ: покупатель выбирает пункт выдачи Ozon,
 * пока мастер не выставила доплату с посчитанной до него доставкой.
 */
export function MadeToOrderDelivery({
  orderId,
  phone,
  point,
  editable,
  onSaved,
}: Props) {
  const [picking, setPicking] = useState(point === null);
  const [selected, setSelected] = useState<PickupPoint | null>(null);
  const [saving, setSaving] = useState(false);

  if (!editable && !point) return null;

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await webApi.orders.updateDeliveryPoint({
        orderId,
        phone,
        pointId: selected.id,
      });
      toast.success("Пункт выдачи сохранён");
      await onSaved();
      setPicking(false);
    } catch (error) {
      toast.error(
        formErrorMessage(
          error,
          "Не удалось сохранить пункт. Попробуйте ещё раз.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const address = point
    ? [point.title, point.address].filter(Boolean).join(", ") ||
      "Выбран, адрес уточняется"
    : null;

  return (
    <div className="border-t border-espresso/8 pt-4 space-y-3">
      <p className="label-caps text-terracotta text-xs">Пункт выдачи Ozon</p>
      {address && <p className="text-espresso text-sm">{address}</p>}
      {editable && (
        <p className="text-taupe text-xs leading-relaxed">
          Доставку оплачиваете вы. Ozon посчитает её, когда изделие будет
          готово, — сумма войдёт в доплату. Получить заказ можно в приложении
          Ozon: там будет штрихкод для пункта выдачи.
        </p>
      )}
      {editable && !picking && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setPicking(true)}
        >
          Выбрать другой пункт
        </Button>
      )}
      {editable && picking && (
        <div className="space-y-3">
          <PickupPointPicker onChange={setSelected} />
          <Button
            type="button"
            onClick={save}
            disabled={!selected || saving}
            className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
          >
            {saving ? <Spinner /> : "Сохранить пункт выдачи"}
          </Button>
        </div>
      )}
    </div>
  );
}
