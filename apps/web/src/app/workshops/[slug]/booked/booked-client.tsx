"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { reachGoal } from "@/lib/analytics";

const POLL_MS = 3000;
const MAX_POLLS = 20;

/** Пока YooKassa подтверждает оплату — тихо перезапрашиваем страницу. */
export function PaymentPolling() {
  const router = useRouter();
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (polls >= MAX_POLLS) return;
    const timer = setTimeout(() => {
      router.refresh();
      setPolls((n) => n + 1);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [polls, router]);

  return polls >= MAX_POLLS ? (
    <p className="text-sm text-taupe">
      Подтверждение задерживается. Если деньги списались, письмо с доступом
      придёт в течение нескольких минут — обновлять страницу не нужно.
    </p>
  ) : null;
}

/**
 * Цель «оплачен мастер-класс» для Директа — один раз на заказ. У комбо
 * вдобавок своя цель: на неё оптимизируется реклама комбо.
 */
export function PaidGoal({
  orderId,
  slug,
  price,
  bundleGoal,
}: {
  orderId: string;
  slug: string;
  price: number;
  bundleGoal?: string;
}) {
  useEffect(() => {
    const key = `stariva:workshop-paid:${orderId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Без хранилища цель может отправиться дважды — не страшно
    }
    const params = { slug, order_price: price, currency: "RUB" };
    reachGoal("workshop_paid", params);
    if (bundleGoal) reachGoal(bundleGoal, params);
  }, [orderId, slug, price, bundleGoal]);
  return null;
}
