"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  DELIVERY_PHONE_ERROR,
  isDeliveryPhone,
} from "@stariva/web-api/contract";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120),
  phone: z
    .string()
    .trim()
    .max(32)
    .refine(isDeliveryPhone, DELIVERY_PHONE_ERROR),
  email: z.string().trim().min(1, "Введите email").email("Некорректный email"),
  comment: z.string().trim().max(1500, "Не больше 1500 символов").optional(),
  /** Набор в подарок: код доступа будет в коробке, а не на почте. */
  gift: z.boolean().optional(),
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
  comment: z.string().max(1500).optional(),
  gift: z.boolean().optional(),
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
        comment: values.comment ?? "",
        gift: values.gift ?? false,
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
  /** В корзине есть набор: предлагаем оформить его в подарок. */
  offerGift?: boolean;
  onSubmit: (values: ContactFormValues) => void;
}

export function ContactForm({
  initial,
  busy,
  submitLabel,
  offerGift = false,
  onSubmit,
}: ContactFormProps) {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: initial ?? {
      name: "",
      phone: "",
      email: "",
      comment: "",
      gift: false,
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
                <FormLabel>Email</FormLabel>
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
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Комментарий к заказу{" "}
                <span className="font-normal text-taupe">— необязательно</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Пожелания по упаковке, подарок, удобное время связи…"
                  disabled={busy}
                  className="rounded-xl bg-parchment"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {offerGift && (
          <FormField
            control={form.control}
            name="gift"
            render={({ field }) => (
              <FormItem className="rounded-xl border border-espresso/10 bg-sand/60 p-4">
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(value) =>
                        field.onChange(value === true)
                      }
                      disabled={busy}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel className="cursor-pointer">
                      Это подарок
                    </FormLabel>
                    <p className="text-[13px] leading-relaxed text-taupe">
                      Ссылку на видеоурок мы не отправим на почту. Код доступа
                      будет на купоне в коробке: получатель введёт его на
                      stariva.ru/code и откроет урок сам.
                    </p>
                  </div>
                </div>
              </FormItem>
            )}
          />
        )}
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
