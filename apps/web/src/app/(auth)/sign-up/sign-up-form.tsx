"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signUp } from "@/lib/auth/client";

export function SignUpForm() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/account";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Пароль должен быть не короче 8 символов");
      return;
    }
    setLoading(true);
    const { error } = await signUp.email({
      name,
      email,
      password,
      callbackURL,
    });
    setLoading(false);

    if (error) {
      toast.error(
        error.message ||
          "Не удалось зарегистрироваться. Возможно, email уже используется.",
      );
      return;
    }
    setSent(true);
    toast.success("Письмо для подтверждения отправлено");
  }

  if (sent) {
    return (
      <div className="text-center space-y-3 py-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-sage/20 flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 7l8 5 8-5"
              stroke="#7a8a6f"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
              stroke="#7a8a6f"
              strokeWidth="1.6"
            />
          </svg>
        </div>
        <p className="text-espresso font-medium">Проверьте почту</p>
        <p className="text-taupe text-sm leading-relaxed">
          Мы отправили письмо на <span className="text-espresso">{email}</span>.
          Перейдите по ссылке в письме, чтобы подтвердить email и войти в
          кабинет.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Имя</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Как к вам обращаться"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
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
        <Label htmlFor="password">Пароль</Label>
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
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
      >
        {loading ? "Создаём аккаунт…" : "Зарегистрироваться"}
      </Button>
      <p className="text-xs text-taupe leading-relaxed text-center">
        Регистрируясь, вы соглашаетесь с{" "}
        <a href="/offer" className="text-terracotta hover:underline">
          условиями оферты
        </a>{" "}
        и{" "}
        <a href="/privacy-policy" className="text-terracotta hover:underline">
          политикой конфиденциальности
        </a>
        .
      </p>
    </form>
  );
}
