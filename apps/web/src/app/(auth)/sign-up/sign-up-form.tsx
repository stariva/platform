"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signUp } from "@/lib/auth/client";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Введите имя"),
  email: z.string().trim().min(1, "Введите email").email("Некорректный email"),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/account";

  const [loading, setLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(data: SignUpFormValues) {
    setLoading(true);
    const { error } = await signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
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
    setSentEmail(data.email);
    toast.success("Письмо для подтверждения отправлено");
  }

  if (sentEmail) {
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
          Мы отправили письмо на{" "}
          <span className="text-espresso">{sentEmail}</span>. Перейдите по
          ссылке в письме, чтобы подтвердить email и войти в кабинет.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="name"
                  placeholder="Как к вам обращаться"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="Минимум 8 символов"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
    </Form>
  );
}
