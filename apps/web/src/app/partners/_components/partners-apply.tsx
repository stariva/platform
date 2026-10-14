"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CustomOrderConflictError } from "@stariva/web-api/contract";
import { MessageCircleIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  ConsentCheckbox,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "@/components/stariva/consent-checkbox";
import { ContactMasterButton } from "@/components/stariva/contact-master";
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
import { Textarea } from "@/components/ui/textarea";
import { reachGoal } from "@/lib/analytics";
import { CONTACTS } from "@/lib/contacts";
import { formErrorMessage, isServerError, webApi } from "@/lib/web-api";
import { APPLY_MESSAGE, formats } from "../_data";

const ROLES = [
  "Фотограф",
  "Стилист",
  "Фотостудия",
  "Организатор съёмок или туров",
  "Другое",
] as const;

const applySchema = z.object({
  role: z.enum(ROLES, { error: "Выберите, чем вы занимаетесь" }),
  formats: z.array(z.string()),
  name: z.string().trim().min(1, "Как к вам обращаться?").max(120),
  contact: z
    .string()
    .trim()
    .min(3, "Укажите Telegram, телефон или email")
    .max(200),
  city: z.string().trim().max(80).optional(),
  portfolio: z.string().trim().max(300).optional(),
  about: z.string().trim().max(1500).optional(),
  website: z.string().optional(),
  personalDataConsent: z.boolean().refine((v) => v, PD_CONSENT_ERROR),
});

type ApplyValues = z.infer<typeof applySchema>;

const groupLabel = "text-sm leading-none font-medium";

/** Анкета партнёра: уходит обычной заявкой в общий ящик и Telegram мастера. */
export function PartnersApply() {
  const [submitting, setSubmitting] = useState(false);
  const [requestNumber, setRequestNumber] = useState<number | null>(null);
  const submission = useRef<{ signature: string; id: string } | null>(null);

  const form = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      formats: [],
      name: "",
      contact: "",
      city: "",
      portfolio: "",
      about: "",
      website: "",
      personalDataConsent: false,
    },
  });

  async function onSubmit(data: ApplyValues) {
    const description = [
      "Анкета партнёра (фотографы и стилисты)",
      `Роль: ${data.role}`,
      data.city ? `Город: ${data.city}` : null,
      data.portfolio ? `Портфолио: ${data.portfolio}` : null,
      `Форматы: ${data.formats.length ? data.formats.join(", ") : "не выбраны"}`,
      data.about ? `О себе: ${data.about}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    setSubmitting(true);
    try {
      const fields = {
        name: data.name,
        contact: data.contact,
        description,
        productType: `Партнёрство: ${data.role}`,
        personalDataConsent: String(data.personalDataConsent) as "true",
        ...(data.website ? { website: data.website } : {}),
      };
      // Повтор той же анкеты идёт с тем же requestId: сервер не задвоит её
      const signature = JSON.stringify(fields);
      if (submission.current?.signature !== signature)
        submission.current = { signature, id: crypto.randomUUID() };
      const request = { ...fields, requestId: submission.current.id };

      let resData: { requestNumber: number };
      try {
        resData = await webApi.forms.submitCustomOrder(request);
      } catch (error) {
        if (!isServerError(error)) throw error;
        if (error instanceof CustomOrderConflictError)
          submission.current = null;
        toast.error(formErrorMessage(error, "Не удалось отправить анкету"));
        return;
      }

      submission.current = null;
      reachGoal("partner_application_submitted", { role: data.role });
      setRequestNumber(resData.requestNumber);
      form.reset();
    } catch {
      toast.error(
        "Ошибка соединения. Попробуйте ещё раз или напишите Ольге в мессенджер.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="apply" className="scroll-mt-20 py-20 lg:py-28 bg-parchment">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 grid lg:grid-cols-[1fr_1.3fr] gap-12 lg:gap-20">
        <div>
          <p className="label-caps text-terracotta text-[11px] mb-4">
            Анкета партнёра
          </p>
          <h2
            className="font-serif text-near-black leading-[1.1] text-balance mb-5"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}
          >
            Расскажите о своих съёмках
          </h2>
          <p className="text-dark-grey leading-relaxed mb-8 max-w-md">
            Анкета займёт пару минут. Ольга посмотрит портфолио, свяжется с вами
            и предложит формат и условия. Ответим в рабочее время:{" "}
            {CONTACTS.hours}.
          </p>

          <div className="rounded-2xl bg-sand p-6 max-w-md">
            <p className="font-serif text-near-black text-lg mb-2">
              Удобнее в мессенджере?
            </p>
            <p className="text-[14px] text-dark-grey leading-relaxed mb-5">
              Напишите напрямую и пришлите ссылку на портфолио — обсудим
              сотрудничество в переписке.
            </p>
            <ContactMasterButton
              source="partners_apply"
              message={APPLY_MESSAGE}
              className="inline-flex items-center gap-2.5 bg-espresso text-parchment px-6 py-3 rounded-full label-caps-md hover:bg-near-black transition-colors"
            >
              <MessageCircleIcon className="w-4 h-4" strokeWidth={1.3} />
              Написать Ольге
            </ContactMasterButton>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-espresso/8 p-6 sm:p-8 lg:p-10">
          {requestNumber ? (
            <div role="status" className="py-10 text-center">
              <p className="label-caps text-terracotta text-[11px] mb-4">
                Анкета №{requestNumber} принята
              </p>
              <h3 className="font-serif text-near-black text-3xl mb-4 text-balance">
                Спасибо! Скоро свяжемся
              </h3>
              <p className="text-dark-grey text-[14px] leading-relaxed max-w-sm mx-auto mb-8">
                Ольга посмотрит портфолио и напишет вам в рабочее время, чтобы
                обсудить формат и условия.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequestNumber(null)}
                className="rounded-full border-espresso/20 label-caps-md"
              >
                Отправить ещё одну анкету
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-6"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <fieldset
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.error ? "role-error" : undefined
                        }
                      >
                        <legend className={groupLabel}>
                          Чем вы занимаетесь
                        </legend>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ROLES.map((role, index) => (
                            <Chip
                              key={role}
                              active={field.value === role}
                              onClick={() => field.onChange(role)}
                              buttonRef={index === 0 ? field.ref : undefined}
                              aria-describedby={
                                fieldState.error ? "role-error" : undefined
                              }
                            >
                              {role}
                            </Chip>
                          ))}
                        </div>
                      </fieldset>
                      <FormMessage id="role-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="formats"
                  render={({ field }) => (
                    <FormItem>
                      <fieldset>
                        <legend className={groupLabel}>
                          Что интересно (можно несколько)
                        </legend>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {formats.map((f) => {
                            const active = field.value.includes(f.title);
                            return (
                              <Chip
                                key={f.number}
                                active={active}
                                onClick={() =>
                                  field.onChange(
                                    active
                                      ? field.value.filter((v) => v !== f.title)
                                      : [...field.value, f.title],
                                  )
                                }
                              >
                                {f.title}
                              </Chip>
                            );
                          })}
                        </div>
                      </fieldset>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имя или название студии</FormLabel>
                        <FormControl>
                          <Input autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Город</FormLabel>
                        <FormControl>
                          <Input autoComplete="address-level2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="portfolio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Портфолио</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="url"
                          placeholder="Ссылка на сайт, VK, Telegram-канал или Pinterest"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="about"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>О ваших съёмках</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Какие съёмки проводите, в каких локациях, ближайшие проекты или идея коллаборации"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telegram, телефон или email</FormLabel>
                      <FormControl>
                        <Input placeholder="@username или +7…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Ловушка для ботов: людям поле не видно. */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                  {...form.register("website")}
                />

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
                  disabled={submitting}
                  className="rounded-full bg-terracotta text-parchment hover:bg-espresso h-12 label-caps-md"
                >
                  {submitting ? "Отправляем…" : "Отправить анкету"}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </section>
  );
}

function Chip({
  active,
  onClick,
  buttonRef,
  "aria-describedby": ariaDescribedBy,
  children,
}: {
  active: boolean;
  onClick: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  "aria-describedby"?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={active}
      aria-describedby={ariaDescribedBy}
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-[13px] border transition-colors ${
        active
          ? "bg-espresso text-parchment border-espresso"
          : "border-espresso/15 text-espresso hover:border-espresso/40"
      }`}
    >
      {children}
    </button>
  );
}
