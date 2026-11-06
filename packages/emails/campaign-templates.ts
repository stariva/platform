import type { ReactElement } from "react";
import { z } from "zod";

import type { CampaignEmailLinks } from "./emails/campaign-footer";
import StarivaElkaPhotoRequestEmail, {
  ELKA_PHOTO_REQUEST_PREVIEW,
  ELKA_PHOTO_REQUEST_SUBJECT,
} from "./emails/stariva-elka-photo-request";
import StarivaElkaSupportInviteEmail, {
  ELKA_SUPPORT_INVITE_PREVIEW,
  ELKA_SUPPORT_INVITE_SUBJECT,
} from "./emails/stariva-elka-support-invite";
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
  /** Поля для предпросмотра, пока админ не заполнил свои. */
  example: P;
  /** Куда ведёт кнопка письма; сайт засчитывает переход и отправляет сюда. */
  buttonUrl: (params: P) => string | null;
  /** Другие ссылки письма, кроме кнопки: имя ссылки и куда она ведёт. */
  extraLinks?: Record<string, (params: P) => string>;
  render: (
    props: CampaignEmailLinks & {
      params: P;
      clickUrl: string;
      /** Ссылка через сайт на одну из extraLinks. */
      linkUrl: (link: string) => string;
    },
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
  example: { channelUrl: "https://t.me/stariva" },
  buttonUrl: (params) => params.channelUrl,
  render: ({ clickUrl, linkUrl: _linkUrl, ...links }) =>
    StarivaTelegramInviteEmail({ ...links, channelUrl: clickUrl }),
};

const elkaSupportInvite: CampaignTemplate<{
  groupUrl: string;
  channelUrl: string;
}> = {
  label: "Приглашение в закрытый чат по ёлке",
  description:
    "Письмо от Ольги тем, кто купил мастер-класс по ёлке: зовёт в закрытый чат и в канал Stariva. В получателях отметьте курсы с ёлкой.",
  subject: ELKA_SUPPORT_INVITE_SUBJECT,
  previewText: ELKA_SUPPORT_INVITE_PREVIEW,
  fields: [
    {
      name: "groupUrl",
      label: "Ссылка на закрытый чат",
      placeholder: "https://t.me/+…",
      hint: "Ссылка-приглашение. В письме она спрятана за кнопкой «Перейти в чат».",
      type: "url",
    },
    {
      name: "channelUrl",
      label: "Ссылка на канал",
      placeholder: "https://t.me/…",
      hint: "В письме она спрятана за ссылкой «Перейти в канал».",
      type: "url",
    },
  ],
  params: z.object({ groupUrl: httpsUrl, channelUrl: httpsUrl }),
  example: {
    groupUrl: "https://t.me/+example",
    channelUrl: "https://t.me/stariva",
  },
  buttonUrl: (params) => params.groupUrl,
  extraLinks: { channel: (params) => params.channelUrl },
  render: ({ clickUrl, linkUrl, params: _params, ...links }) =>
    StarivaElkaSupportInviteEmail({
      ...links,
      groupUrl: clickUrl,
      channelUrl: linkUrl("channel"),
    }),
};

const elkaPhotoRequest: CampaignTemplate<{ contactUrl: string }> = {
  label: "Просьба прислать фото ёлки",
  description:
    "Письмо от Ольги тем, кто купил мастер-класс по ёлке: просит прислать фото готовой ёлки и пару слов, чтобы с согласия автора показать их на сайте. В получателях отметьте курсы с ёлкой; лучше слать через несколько дней после покупки.",
  subject: ELKA_PHOTO_REQUEST_SUBJECT,
  previewText: ELKA_PHOTO_REQUEST_PREVIEW,
  fields: [
    {
      name: "contactUrl",
      label: "Куда присылать фото",
      placeholder: "https://t.me/…",
      hint: "Ссылка на Telegram Ольги или другой мессенджер. В письме она спрятана за кнопкой «Прислать фото».",
      type: "url",
    },
  ],
  params: z.object({ contactUrl: httpsUrl }),
  example: { contactUrl: "https://t.me/Olga_Stariva" },
  buttonUrl: (params) => params.contactUrl,
  render: ({ clickUrl, linkUrl: _linkUrl, params: _params, ...links }) =>
    StarivaElkaPhotoRequestEmail({ ...links, contactUrl: clickUrl }),
};

/**
 * Готовые письма рассылок. Новое письмо — компонент в emails/ (его видно в
 * предпросмотре React Email) и запись здесь; id сохраняется в рассылке,
 * поэтому его не переименовывают.
 */
const templates = {
  "telegram-invite": telegramInvite,
  "elka-support-invite": elkaSupportInvite,
  "elka-photo-request": elkaPhotoRequest,
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

/**
 * Куда ведёт ссылка письма рассылки: кнопка или другая ссылка шаблона по
 * имени. null — шаблона нет, в нём нет такой ссылки или поля не заполнены.
 */
export function campaignButtonUrl(
  campaign: { template: string; params: Record<string, string> },
  link?: string | null,
): string | null {
  if (!isCampaignTemplateId(campaign.template)) return null;
  const template = campaignTemplate(campaign.template);
  const params = template.params.safeParse(campaign.params);
  if (!params.success) return null;
  if (!link) return template.buttonUrl(params.data);
  // hasOwn: имя приходит из адреса, constructor и прочее — не ссылки шаблона
  const extra = template.extraLinks;
  return extra && Object.hasOwn(extra, link)
    ? (extra[link]?.(params.data) ?? null)
    : null;
}
