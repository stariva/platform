"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { reachGoal } from "@/lib/analytics";

const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Введите email")
    .email("Укажите корректный email"),
});

type NewsletterFormValues = z.infer<typeof newsletterSchema>;

interface NewsletterFormProps {
  /** Источник подписки для аналитики и заявки (например, "blog", "footer"). */
  source?: string;
}

export function NewsletterForm({ source = "blog" }: NewsletterFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: NewsletterFormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, source }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(resData?.error ?? "Не удалось оформить подписку");
        return;
      }
      reachGoal("newsletter_subscribe", { source });
      toast.success(
        "Готово! Спасибо за подписку — будем писать только по делу.",
      );
      form.reset({ email: "" });
    } catch {
      toast.error("Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto items-start"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1 w-full">
              <FormLabel className="sr-only">Ваш email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Ваш email"
                  autoComplete="email"
                  disabled={submitting}
                  className="rounded-full border-espresso/15 bg-parchment text-espresso placeholder:text-taupe/60 focus-visible:border-terracotta"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={submitting}
          className="label-caps-md px-6 py-3 h-auto rounded-full bg-espresso text-parchment hover:bg-terracotta transition-colors"
        >
          {submitting ? "Отправляем…" : "Подписаться"}
        </Button>
      </form>
    </Form>
  );
}
