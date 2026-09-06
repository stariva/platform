"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth/client";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
    confirm: z.string().min(8, "Пароль должен быть не короче 8 символов"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Пароли не совпадают",
    path: ["confirm"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [loading, setLoading] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

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

  async function onSubmit(data: ResetPasswordFormValues) {
    setLoading(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: data.password,
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Новый пароль</FormLabel>
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
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Повторите пароль</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
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
          {loading ? "Сохраняем…" : "Сохранить пароль"}
        </Button>
      </form>
    </Form>
  );
}
