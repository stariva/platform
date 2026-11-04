import { render } from "@react-email/components";
import type { EmailCampaignRow, EmailCampaignSegment } from "@stariva/db";

import { campaignTemplate } from "./campaign-templates";

export type CampaignContent = Pick<
  EmailCampaignRow,
  "template" | "params" | "segment"
>;

/**
 * Ссылки письма для одного получателя. Все ведут на сайт: он засчитывает
 * открытие и переход и только потом отправляет дальше.
 */
export function campaignLinks(siteUrl: string, token: string) {
  const base = siteUrl.replace(/\/+$/, "");
  return {
    open: `${base}/api/m/o/${token}`,
    click: `${base}/api/m/c/${token}`,
    /** Страница с кнопкой «Отписаться»: сама ссылка ничего не меняет. */
    unsubscribe: `${base}/unsubscribe/${token}`,
    /** Отписка в один клик из почтовика (RFC 8058), только POST. */
    oneClick: `${base}/api/m/u/${token}`,
  };
}

/** Почему адресату пришло письмо — строчка внизу письма. */
export function campaignReason(segment: EmailCampaignSegment): string {
  switch (segment.type) {
    case "workshop_buyers":
      return "Письмо пришло, потому что вы купили мастер-класс на stariva.ru.";
  }
}

/**
 * Тема, тело и заголовки письма рассылки для одного получателя: готовое
 * письмо из реестра шаблонов с параметрами рассылки. Тема — из того же
 * шаблона, что и текст, а не сохранённая в рассылке. Кнопка письма ведёт на
 * сайт, а тот — по адресу из параметров.
 */
export function campaignEmail(
  campaign: CampaignContent,
  { siteUrl, token }: { siteUrl: string; token: string },
) {
  const links = campaignLinks(siteUrl, token);
  const template = campaignTemplate(campaign.template);
  return {
    subject: template.subject,
    react: template.render({
      params: template.params.parse(campaign.params),
      clickUrl: links.click,
      reason: campaignReason(campaign.segment),
      unsubscribeUrl: links.unsubscribe,
      openPixelUrl: links.open,
    }),
    headers: {
      "List-Unsubscribe": `<${links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** HTML письма для предпросмотра в админке: ссылки как в пробном письме. */
export function renderCampaignHtml(
  campaign: CampaignContent & { id: string },
  siteUrl: string,
): Promise<string> {
  return render(
    campaignEmail(campaign, { siteUrl, token: `test-${campaign.id}` }).react,
  );
}
