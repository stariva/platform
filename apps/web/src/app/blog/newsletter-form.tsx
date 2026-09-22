"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  ConsentCheckbox,
  MarketingConsentLabel,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "@/components/stariva/consent-checkbox";
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
  personalDataConsent: z.boolean().refine((v) => v, PD_CONSENT_ERROR),
  // Рассылка — реклама, нужно предварительное согласие (ст. 18 38-ФЗ).
  marketingConsent: z
    .boolean()
    .refine((v) => v, "Нужно согласие на получение рассылки"),
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
    defaultValues: {
      email: "",
      personalDataConsent: false,
      marketingConsent: false,
    },
  });

  async function onSubmit(data: NewsletterFormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          source,
          personalDataConsent: data.personalDataConsent,
          marketingConsent: data.marketingConsent,
        }),
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
      form.reset({
        email: "",
        personalDataConsent: false,
        marketingConsent: false,
      });
    } catch {
      toast.error("Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4 max-w-md mx-auto"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex flex-col sm:flex-row gap-4 items-start">
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
        </div>
        <FormField
          control={form.control}
          name="personalDataConsent"
          render={({ field, fieldState }) => (
            <ConsentCheckbox
              checked={field.value}
              onCheckedChange={field.onChange}
              error={fieldState.error?.message}
            >
              <PersonalDataConsentLabel />
            </ConsentCheckbox>
          )}
        />
        <FormField
          control={form.control}
          name="marketingConsent"
          render={({ field, fieldState }) => (
            <ConsentCheckbox
              checked={field.value}
              onCheckedChange={field.onChange}
              error={fieldState.error?.message}
            >
              <MarketingConsentLabel />
            </ConsentCheckbox>
          )}
        />
      </form>
    </Form>
  );
}
