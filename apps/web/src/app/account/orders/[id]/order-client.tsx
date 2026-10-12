"use client";

import { useRouter } from "next/navigation";
import { type ComponentProps, useEffect } from "react";
import { MadeToOrderDetails } from "@/app/order/[orderId]/made-to-order-details";
import { trackPaidOrder } from "@/lib/analytics";

/** Дополнение заявки из кабинета: после сохранения перечитываем страницу с сервера. */
export function AccountMadeToOrderDetails(
  props: Omit<ComponentProps<typeof MadeToOrderDetails>, "onSaved">,
) {
  const router = useRouter();
  return <MadeToOrderDetails {...props} onSaved={() => router.refresh()} />;
}

/** Цель «заказ оплачен» — как на гостевой странице заказа, куда раньше вела оплата. */
export function PaidOrderTracker({
  orderId,
  amountKopecks,
  paid,
}: {
  orderId: string;
  amountKopecks: number;
  paid: boolean;
}) {
  useEffect(() => {
    trackPaidOrder(orderId, amountKopecks, paid);
  }, [orderId, amountKopecks, paid]);
  return null;
}
