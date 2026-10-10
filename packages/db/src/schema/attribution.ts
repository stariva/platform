/**
 * Заход по ссылке с UTM-метками. Без идентификатора посетителя:
 * только метки, страница входа и сайт, с которого пришли.
 */
export interface CampaignTouch {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing: string;
  // Только хост: Brave и большинство браузеров и так отдают лишь origin.
  referrer?: string;
  at: string; // ISO 8601
}

/**
 * Первый и последний заход по UTM-ссылке до заказа. Пишется сервером из
 * first-party cookie, поэтому не зависит от блокировщиков и Метрики.
 */
export interface CampaignAttribution {
  first: CampaignTouch;
  last: CampaignTouch;
}
