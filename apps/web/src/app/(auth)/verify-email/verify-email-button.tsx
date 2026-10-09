"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { safeCallbackPath } from "@/lib/auth/verification-link";

/**
 * Подтверждение уходит в better-auth только по нажатию: переход делает
 * скрипт, а не ссылка в разметке, поэтому сканеры писем её не откроют.
 */
export function VerifyEmailButton() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <p role="alert" className="rounded-lg bg-sand p-4 text-sm text-espresso">
        Ссылка подтверждения недействительна. Запросите новое письмо при
        регистрации или входе.
      </p>
    );
  }

  function confirm() {
    if (!token) return;
    setLoading(true);
    const target = new URL("/api/auth/verify-email", window.location.origin);
    target.searchParams.set("token", token);
    target.searchParams.set(
      "callbackURL",
      safeCallbackPath(searchParams.get("callbackURL")),
    );
    window.location.assign(target.toString());
  }

  return (
    <Button
      type="button"
      onClick={confirm}
      disabled={loading}
      className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
    >
      {loading ? "Подтверждаем…" : "Подтвердить email"}
    </Button>
  );
}
