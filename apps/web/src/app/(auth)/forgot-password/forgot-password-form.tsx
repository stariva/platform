"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Введите email");
      return;
    }
    setLoading(true);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Не удалось отправить письмо");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center space-y-3 py-2">
        <p className="text-espresso font-medium">Письмо отправлено</p>
        <p className="text-taupe text-sm leading-relaxed">
          Если аккаунт с адресом <span className="text-espresso">{email}</span>{" "}
          существует, на него придёт ссылка для сброса пароля.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
      >
        {loading ? "Отправляем…" : "Отправить ссылку"}
      </Button>
    </form>
  );
}
