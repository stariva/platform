"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/lib/auth/client";
import { formatPrice } from "@/lib/workshops-data";

interface WorkshopPurchaseProps {
  slug: string;
  price: number;
  title: string;
}

export function WorkshopPurchase({
  slug,
  price,
  title,
}: WorkshopPurchaseProps) {
  const { data: session, isPending: sessionPending } = useSession();
  const [owned, setOwned] = useState<boolean | null>(null);
  const [buying, setBuying] = useState(false);

  // Проверяем наличие доступа у авторизованного пользователя
  useEffect(() => {
    let active = true;
    if (!session) {
      setOwned(false);
      return;
    }
    fetch(`/api/account/access?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setOwned(Boolean(d.owned));
      })
      .catch(() => {
        if (active) setOwned(false);
      });
    return () => {
      active = false;
    };
  }, [session, slug]);

  async function handleBuy() {
    setBuying(true);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();

      if (res.status === 409 && data.alreadyOwned) {
        setOwned(true);
        return;
      }
      if (!res.ok || !data.confirmationUrl) {
        toast.error(data.error || "Не удалось перейти к оплате");
        setBuying(false);
        return;
      }
      // Редирект на страницу оплаты YooKassa
      window.location.href = data.confirmationUrl;
    } catch {
      toast.error("Не удалось перейти к оплате");
      setBuying(false);
    }
  }

  // Загрузка состояния
  if (sessionPending || (session && owned === null)) {
    return (
      <div className="flex items-center justify-center w-full py-4 mb-3">
        <Spinner className="text-taupe" />
      </div>
    );
  }

  // Гость — предлагаем войти
  if (!session) {
    return (
      <Button
        asChild
        className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark py-6 rounded-2xl mb-3 text-base"
      >
        <Link
          href={`/sign-in?callbackURL=${encodeURIComponent(`/workshops/${slug}`)}`}
        >
          Войти, чтобы купить
        </Link>
      </Button>
    );
  }

  // Доступ уже есть — ведём в кабинет
  if (owned) {
    return (
      <Button
        asChild
        className="w-full bg-espresso text-parchment hover:bg-espresso/90 py-6 rounded-2xl mb-3 text-base"
      >
        <Link href={`/account/workshops/${slug}`}>Смотреть в кабинете</Link>
      </Button>
    );
  }

  // Покупка
  return (
    <Button
      onClick={handleBuy}
      disabled={buying}
      className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark py-6 rounded-2xl mb-3 text-base"
      aria-label={`Купить мастер-класс ${title}`}
    >
      {buying ? "Переходим к оплате…" : `Купить за ${formatPrice(price)}`}
    </Button>
  );
}
