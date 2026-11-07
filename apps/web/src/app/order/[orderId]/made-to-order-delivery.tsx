"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PickupPointPicker } from "@/components/checkout/pickup-point-picker";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DELIVERY_POINT_ANCHOR } from "@/lib/commerce/order-status";
import { pickupPointAddressLine } from "@/lib/ozon-delivery/format";
import type { PickupPoint } from "@/lib/ozon-delivery/types";
import { formErrorMessage, webApi } from "@/lib/web-api";

interface Props {
  orderId: string;
  phone: string;
  /** Выбранный пункт; адреса нет, если Ozon тогда не ответил. */
  point: { id: string; title: string | null; address: string | null } | null;
  /** Можно ли выбрать пункт: при доплате, пока она не оплачена. */
  editable: boolean;
  /** Доставка ещё не посчитана: без неё доплату не оплатить. */
  quoteNeeded: boolean;
  onSaved: () => Promise<void> | void;
}

/**
 * Куда отправить изделие под заказ: когда оно готово, покупатель выбирает
 * пункт выдачи Ozon, и сайт сразу считает доставку до него. Она входит в
 * доплату.
 */
export function MadeToOrderDelivery({
  orderId,
  phone,
  point,
  editable,
  quoteNeeded,
  onSaved,
}: Props) {
  const [picking, setPicking] = useState(point === null);
  const [selected, setSelected] = useState<PickupPoint | null>(null);
  const [saving, setSaving] = useState(false);

  if (!editable && !point) return null;

  /** Сохраняет пункт и считает доставку до него. */
  async function save(pointId: string) {
    setSaving(true);
    try {
      await webApi.orders.updateDeliveryPoint({ orderId, phone, pointId });
      toast.success("Доставка посчитана");
      await onSaved();
      setPicking(false);
    } catch (error) {
      toast.error(
        formErrorMessage(
          error,
          "Не удалось посчитать доставку. Попробуйте ещё раз.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const address = point
    ? pickupPointAddressLine(point.title, point.address) ||
      "Выбран, адрес уточняется"
    : null;

  return (
    <div
      id={DELIVERY_POINT_ANCHOR}
      className="border-t border-espresso/8 pt-4 space-y-3 scroll-mt-24"
    >
      <p className="label-caps text-terracotta text-xs">Пункт выдачи Ozon</p>
      {address && <p className="text-espresso text-sm">{address}</p>}
      {editable && (
        <p className="text-taupe text-xs leading-relaxed">
          Доставку оплачиваете вы. Выберите пункт: сайт сразу посчитает доставку
          Ozon до него, и она войдёт в доплату. Получить заказ можно в
          приложении Ozon: там будет штрихкод для пункта выдачи.
        </p>
      )}
      {editable && !picking && quoteNeeded && point && (
        <Button
          type="button"
          onClick={() => save(point.id)}
          disabled={saving}
          className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
        >
          {saving ? <Spinner /> : "Посчитать доставку до этого пункта"}
        </Button>
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
            onClick={() => selected && save(selected.id)}
            disabled={!selected || saving}
            className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
          >
            {saving ? <Spinner /> : "Посчитать доставку"}
          </Button>
        </div>
      )}
    </div>
  );
}
