"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { signIn } from "@/lib/auth/client";

const signInSchema = z.object({
  email: z.string().trim().min(1, "Введите email").email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/account";

  const [loading, setLoading] = useState(false);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: SignInFormValues) {
    setLoading(true);
    const { error } = await signIn.email({
      email: data.email,
      password: data.password,
      callbackURL,
    });
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <FormLabel>Пароль</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-xs text-terracotta hover:underline"
                >
                  Забыли пароль?
                </Link>
              </div>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder="••••••••"
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
    </Form>
  );
}
