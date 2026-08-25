"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signIn } from "@/lib/auth/client";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Введите email и пароль");
      return;
    }
    setLoading(true);
    const { error } = await signIn.email({ email, password, callbackURL });
    setLoading(false);

    if (error) {
      if (error.status === 403) {
        toast.error(
          "Email не подтверждён. Проверьте почту — мы отправили письмо со ссылкой.",
        );
      } else {
        toast.error(error.message || "Неверный email или пароль");
      }
      return;
    }
    toast.success("С возвращением!");
    router.push(callbackURL);
    router.refresh();
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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Пароль</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-terracotta hover:underline"
          >
            Забыли пароль?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
      >
        {loading ? "Входим…" : "Войти"}
      </Button>

      <div className="relative py-1 text-center">
        <span className="relative z-10 bg-white px-3 text-xs text-taupe">
          или
        </span>
        <span className="absolute left-0 right-0 top-1/2 h-px bg-espresso/10" />
      </div>

      <Button asChild variant="outline" className="w-full">
        <Link
          href={`/magic-link?callbackURL=${encodeURIComponent(callbackURL)}`}
        >
          Войти по ссылке на email
        </Link>
      </Button>
    </form>
  );
}
