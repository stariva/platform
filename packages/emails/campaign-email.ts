import { render } from "@react-email/components";
import type {
  EmailCampaignRow,
  EmailCampaignSegment,
  EmailRecipientSource,
} from "@stariva/db";

import { campaignTemplate } from "./campaign-templates";

export type CampaignContent = Pick<EmailCampaignRow, "template" | "params">;

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
export function campaignReason(source: EmailRecipientSource): string {
  switch (source) {
    case "buyer":
      return "Вы получили это письмо, потому что купили мастер-класс на stariva.ru.";
    case "manual":
      return "Вы получили это письмо, потому что ваш адрес есть в списке рассылки Stariva.";
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
  {
    siteUrl,
    token,
    source = "buyer",
  }: { siteUrl: string; token: string; source?: EmailRecipientSource },
) {
  const links = campaignLinks(siteUrl, token);
  const template = campaignTemplate(campaign.template);
  return {
    subject: template.subject,
    react: template.render({
      params: template.params.parse(campaign.params),
      clickUrl: links.click,
      linkUrl: (link) => `${links.click}?link=${encodeURIComponent(link)}`,
      reason: campaignReason(source),
      buyer: source === "buyer",
      unsubscribeUrl: links.unsubscribe,
      openPixelUrl: links.open,
    }),
    headers: {
      "List-Unsubscribe": `<${links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/**
 * Каким получателем показать предпросмотр и пробное письмо: если покупатели
 * в рассылке выключены, письма уходят только ручным адресам — с их строчкой
 * «почему пришло письмо». В смешанной рассылке показываем вариант покупателя.
 */
export function previewSource(
  segment: Pick<EmailCampaignSegment, "buyers">,
): EmailRecipientSource {
  return segment.buyers ? "buyer" : "manual";
}

/**
 * HTML письма для предпросмотра в админке, со ссылками как в пробном
 * письме. Черновик без id и с незаполненными полями тоже можно посмотреть:
 * вместо его полей подставляется пример из шаблона.
 */
export function renderCampaignHtml(
  campaign: CampaignContent & { id?: string },
  siteUrl: string,
  source: EmailRecipientSource = "buyer",
): Promise<string> {
  const template = campaignTemplate(campaign.template);
  const params = template.params.safeParse(campaign.params).success
    ? campaign.params
    : template.example;
  return render(
    campaignEmail(
      { ...campaign, params },
      { siteUrl, token: `test-${campaign.id ?? "preview"}`, source },
    ).react,
  );
}
