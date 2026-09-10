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
import { signIn } from "@/lib/auth/client";

const magicLinkSchema = z.object({
  email: z.string().trim().min(1, "Введите email").email("Некорректный email"),
});

type MagicLinkFormValues = z.infer<typeof magicLinkSchema>;

export function MagicLinkForm() {
  const searchParams = useSearchParams();
  const requestedCallback = searchParams.get("callbackURL") || "/account";
  const callbackURL =
    requestedCallback.startsWith("/") &&
    !requestedCallback.startsWith("//") &&
    !requestedCallback.includes("\\")
      ? requestedCallback.split("?")[0]
      : "/account";

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const form = useForm<MagicLinkFormValues>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: MagicLinkFormValues) {
    setLoading(true);
    const { error } = await signIn.magicLink({
      email: data.email,
      callbackURL,
      errorCallbackURL: "/magic-link",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Не удалось отправить ссылку");
      return;
    }
    setSent(data.email);
  }

  if (sent) {
    return (
      <div className="text-center space-y-3 py-2">
        <p className="text-espresso font-medium">Ссылка отправлена</p>
        <p className="text-taupe text-sm leading-relaxed">
          Проверьте почту <span className="text-espresso">{sent}</span> и
          перейдите по ссылке, чтобы войти. Ссылка действует ограниченное время.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {searchParams.has("error") && (
          <p
            role="alert"
            className="rounded-lg bg-sand p-4 text-sm text-espresso"
          >
            Ссылка для входа недействительна или срок её действия истёк.
            Запросите новую ссылку и откройте последнее письмо.
          </p>
        )}
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
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
        >
          {loading ? "Отправляем…" : "Получить ссылку для входа"}
        </Button>
      </form>
    </Form>
  );
}
