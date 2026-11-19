import type {
  EmailCampaignSegment,
  EmailCampaignStatus,
  EmailRecipientStatus,
} from "@stariva/db/schema";
import type {
  CampaignTemplateField,
  CampaignTemplateId,
} from "@stariva/emails";

/** Готовое письмо из кода (@stariva/emails), как его отдаёт API. */
export interface CampaignTemplateOption {
  id: CampaignTemplateId;
  label: string;
  description: string;
  subject: string;
  previewText: string;
  fields: CampaignTemplateField[];
}

export interface CampaignFormValues {
  name: string;
  template: CampaignTemplateId;
  params: Record<string, string>;
  segment: EmailCampaignSegment;
}

/**
 * Новая рассылка: первое письмо из списка, его название и все покупатели.
 * Не в campaign-form: её зовёт серверная страница, а клиентский модуль
 * на сервере отдаёт ссылки, а не функции.
 */
export function emptyCampaign(
  templates: CampaignTemplateOption[],
): CampaignFormValues {
  const [first] = templates;
  return {
    name: first?.label ?? "",
    template: first?.id ?? "telegram-invite",
    params: {},
    segment: { buyers: true, workshops: [], emails: [] },
  };
}

export const CAMPAIGN_STATUS_LABELS: Record<EmailCampaignStatus, string> = {
  draft: "Черновик",
  sending: "Отправляется",
  sent: "Отправлена",
};

export const RECIPIENT_STATUS_LABELS: Record<EmailRecipientStatus, string> = {
  queued: "В очереди",
  sent: "Отправлено",
  failed: "Не ушло",
  skipped: "Отписался до отправки",
};

/** Доля от отправленных: «38 %»; пока ничего не ушло — прочерк. */
export function share(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)} %` : "—";
}
