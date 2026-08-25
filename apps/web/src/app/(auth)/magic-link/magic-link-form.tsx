"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth/client";

export function MagicLinkForm() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/account";

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
    const { error } = await signIn.magicLink({ email, callbackURL });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Не удалось отправить ссылку");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center space-y-3 py-2">
        <p className="text-espresso font-medium">Ссылка отправлена</p>
        <p className="text-taupe text-sm leading-relaxed">
          Проверьте почту <span className="text-espresso">{email}</span> и
          перейдите по ссылке, чтобы войти. Ссылка действует ограниченное время.
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
        {loading ? "Отправляем…" : "Получить ссылку для входа"}
      </Button>
    </form>
  );
}
