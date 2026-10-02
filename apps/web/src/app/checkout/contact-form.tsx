"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ConsentCheckbox,
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
import { Spinner } from "@/components/ui/spinner";

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120),
  phone: z.string().trim().min(5, "Введите телефон").max(32),
  email: z
    .string()
    .trim()
    .email("Некорректный email")
    .optional()
    .or(z.literal("")),
  personalDataConsent: z.boolean().refine((v) => v, PD_CONSENT_ERROR),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

/**
 * Введённые контакты переживают перезагрузку вкладки и возврат из корзины.
 * sessionStorage, а не localStorage: после закрытия вкладки данные не
 * остаются в браузере. Согласие не сохраняем — его дают заново.
 */
const DRAFT_KEY = "stariva:checkout-contact";
const draftSchema = z.object({
  name: z.string().max(120),
  phone: z.string().max(32),
  email: z.string().max(254),
});

function readDraft() {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveDraft(values: Partial<ContactFormValues>) {
  try {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name: values.name ?? "",
        phone: values.phone ?? "",
        email: values.email ?? "",
      }),
    );
  } catch {
    // Хранилище недоступно — просто не запоминаем
  }
}

interface ContactFormProps {
  /** Уже подтверждённые контакты — когда покупатель вернулся их изменить */
  initial: ContactFormValues | null;
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: ContactFormValues) => void;
}

export function ContactForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
}: ContactFormProps) {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: initial ?? {
      name: "",
      phone: "",
      email: "",
      personalDataConsent: false,
    },
  });

  useEffect(() => {
    if (initial) return;
    const draft = readDraft();
    if (draft) form.reset({ ...draft, personalDataConsent: false });
  }, [initial, form]);

  useEffect(() => {
    const subscription = form.watch((values) => saveDraft(values));
    return () => subscription.unsubscribe();
  }, [form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  disabled={busy}
                  className="h-12 rounded-xl bg-parchment"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Телефон</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+7 999 123-45-67"
                    disabled={busy}
                    className="h-12 rounded-xl bg-parchment"
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
                <FormLabel>
                  Email{" "}
                  <span className="font-normal text-taupe">
                    — необязательно
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    disabled={busy}
                    className="h-12 rounded-xl bg-parchment"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
        <Button
          type="submit"
          disabled={busy}
          className="w-full sm:w-auto sm:min-w-56 h-12 rounded-full bg-espresso text-parchment hover:bg-espresso/85"
        >
          {busy ? (
            <>
              <Spinner />
              Проверяем телефон…
            </>
          ) : (
            <>
              {submitLabel}
              <ArrowRightIcon aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
