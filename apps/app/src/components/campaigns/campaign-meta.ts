import type {
  EmailCampaignStatus,
  EmailRecipientStatus,
} from "@stariva/db/schema";

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
