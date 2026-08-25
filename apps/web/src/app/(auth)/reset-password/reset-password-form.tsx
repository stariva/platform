"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  if (error || !token) {
    return (
      <div className="text-center space-y-3 py-2">
        <p className="text-espresso font-medium">Ссылка недействительна</p>
        <p className="text-taupe text-sm leading-relaxed">
          Срок действия ссылки истёк или она уже использована. Запросите сброс
          пароля заново.
        </p>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => router.push("/forgot-password")}
        >
          Запросить новую ссылку
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Пароль должен быть не короче 8 символов");
      return;
    }
    if (password !== confirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    setLoading(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token: token as string,
    });
    setLoading(false);

    if (resetError) {
      toast.error(resetError.message || "Не удалось сбросить пароль");
      return;
    }
    toast.success("Пароль обновлён. Войдите с новым паролем.");
    router.push("/sign-in");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">Новый пароль</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Минимум 8 символов"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Повторите пароль</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
      >
        {loading ? "Сохраняем…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}
