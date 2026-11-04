import type { ReactElement } from "react";
import { z } from "zod";

import type { CampaignEmailLinks } from "./emails/campaign-footer";
import StarivaTelegramInviteEmail, {
  TELEGRAM_INVITE_PREVIEW,
  TELEGRAM_INVITE_SUBJECT,
} from "./emails/stariva-telegram-invite";

/** Поле, которое админ заполняет под выбранный шаблон. */
export interface CampaignTemplateField {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  type: "url" | "text";
}

interface CampaignTemplate<P extends Record<string, string>> {
  label: string;
  /** Что за письмо и кому — подсказка в админке. */
  description: string;
  subject: string;
  previewText: string;
  fields: CampaignTemplateField[];
  params: z.ZodType<P>;
  /** Куда ведёт кнопка письма; сайт засчитывает переход и отправляет сюда. */
  buttonUrl: (params: P) => string | null;
  render: (
    props: CampaignEmailLinks & { params: P; clickUrl: string },
  ) => ReactElement;
}

const httpsUrl = z.url({ protocol: /^https?$/ }).max(2000);

const telegramInvite: CampaignTemplate<{ channelUrl: string }> = {
  label: "Приглашение в Telegram-канал",
  description:
    "Письмо от Ольги покупателям мастер-классов: зовёт в канал, где задают вопросы по курсу и показывают свои работы.",
  subject: TELEGRAM_INVITE_SUBJECT,
  previewText: TELEGRAM_INVITE_PREVIEW,
  fields: [
    {
      name: "channelUrl",
      label: "Ссылка на канал",
      placeholder: "https://t.me/…",
      hint: "Публичная ссылка или ссылка-приглашение. В письме она спрятана за кнопкой «Перейти в канал».",
      type: "url",
    },
  ],
  params: z.object({ channelUrl: httpsUrl }),
  buttonUrl: (params) => params.channelUrl,
  render: ({ clickUrl, ...links }) =>
    StarivaTelegramInviteEmail({ ...links, channelUrl: clickUrl }),
};

/**
 * Готовые письма рассылок. Новое письмо — компонент в emails/ (его видно в
 * предпросмотре React Email) и запись здесь; id сохраняется в рассылке,
 * поэтому его не переименовывают.
 */
const templates = {
  "telegram-invite": telegramInvite,
};

export type CampaignTemplateId = keyof typeof templates;

export const CAMPAIGN_TEMPLATE_IDS = Object.keys(templates) as [
  CampaignTemplateId,
  ...CampaignTemplateId[],
];

export function isCampaignTemplateId(id: string): id is CampaignTemplateId {
  return Object.hasOwn(templates, id);
}

/** Шаблон по id; бросает, если такого нет (удалили из кода). */
export function campaignTemplate(id: string) {
  if (!isCampaignTemplateId(id))
    throw new Error(`unknown_campaign_template:${id}`);
  // Параметры у шаблонов разные; проверяет их params каждого шаблона
  return templates[id] as unknown as CampaignTemplate<Record<string, string>>;
}

/** Список шаблонов для админки: без функций, только то, что нужно форме. */
export function campaignTemplateList() {
  return CAMPAIGN_TEMPLATE_IDS.map((id) => {
    const { label, description, subject, previewText, fields } = templates[id];
    return { id, label, description, subject, previewText, fields };
  });
}

/**
 * Проверяет параметры рассылки по её шаблону. Возвращает текст ошибки для
 * админки или null.
 */
export function campaignParamsError(
  template: string,
  params: Record<string, string>,
): string | null {
  if (!isCampaignTemplateId(template)) return "Такого письма нет";
  const result = campaignTemplate(template).params.safeParse(params);
  if (result.success) return null;
  const issue = result.error.issues[0];
  const field = campaignTemplate(template).fields.find(
    (item) => item.name === issue?.path[0],
  );
  return field ? `Проверьте поле «${field.label}»` : "Проверьте поля письма";
}

/** Адрес кнопки рассылки; null — шаблона нет или в нём нет кнопки. */
export function campaignButtonUrl(campaign: {
  template: string;
  params: Record<string, string>;
}): string | null {
  if (!isCampaignTemplateId(campaign.template)) return null;
  const template = campaignTemplate(campaign.template);
  const params = template.params.safeParse(campaign.params);
  return params.success ? template.buttonUrl(params.data) : null;
}
