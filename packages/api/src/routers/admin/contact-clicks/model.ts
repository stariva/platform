import type {
  CampaignAttribution,
  CampaignTouch,
  ContactClickChannel,
  SessionEntry,
} from "@stariva/db/schema";

import {
  type CampaignRule,
  type ClientSource,
  matchCampaign,
  normalizeUtm,
  sourceKey,
} from "../crm/model";

/**
 * Реклама, которой засчитывается переход: метки этого захода, а если их
 * нет — последний заход по UTM за 90 дней из cookie (как у заказов).
 */
export function clickTouch(
  entry: SessionEntry | null,
  attribution: CampaignAttribution | null,
): Pick<CampaignTouch, "utm_source" | "utm_campaign"> | null {
  if (entry?.utm_source) return entry;
  return attribution?.last.utm_source ? attribution.last : null;
}

/** Кампания из «Кампаний и расходов», голая метка или «не с рекламы». */
export function clickSource(
  entry: SessionEntry | null,
  attribution: CampaignAttribution | null,
  campaigns: CampaignRule[],
): ClientSource {
  const touch = clickTouch(entry, attribution);
  const utmSource = normalizeUtm(touch?.utm_source);
  if (!touch || !utmSource) return { kind: "none", manual: false };
  const campaignId = matchCampaign(touch, campaigns);
  if (campaignId) return { kind: "campaign", campaignId, manual: false };
  return {
    kind: "utm",
    utmSource,
    utmCampaign: normalizeUtm(touch.utm_campaign),
  };
}

/**
 * Откуда пришёл посетитель без меток: клик по объявлению без UTM (yclid,
 * rb_clickid), сайт-источник или прямой заход.
 */
export function siteOf(entry: SessionEntry | null): string {
  if (entry?.yclid) return "Яндекс Директ без UTM-меток";
  if (entry?.rb_clickid) return "VK Реклама без UTM-меток";
  return entry?.referrer?.replace(/^www\./, "") ?? "Прямой заход";
}

export interface SummaryClick {
  id: string;
  browserId: string | null;
  ip: string | null;
  channel: ContactClickChannel;
  entry: SessionEntry | null;
  attribution: CampaignAttribution | null;
}

/** Один человек — один браузер; без id браузера — IP, без IP — сам клик. */
const personOf = (click: SummaryClick) =>
  click.browserId ?? (click.ip ? `ip:${click.ip}` : `click:${click.id}`);

export interface ClickGroup {
  clicks: number;
  people: number;
  channels: Record<ContactClickChannel, number>;
}

class Counter {
  clicks = 0;
  people = new Set<string>();
  channels: Record<ContactClickChannel, number> = {
    telegram: 0,
    whatsapp: 0,
    max: 0,
    phone: 0,
  };

  add(click: SummaryClick) {
    this.clicks += 1;
    this.people.add(personOf(click));
    this.channels[click.channel] += 1;
  }

  view(): ClickGroup {
    return {
      clicks: this.clicks,
      people: this.people.size,
      channels: { ...this.channels },
    };
  }
}

/**
 * Сводка переходов: всего, по рекламе (с расходом кампании за период) и,
 * для заходов не с рекламы, по сайтам-источникам. Расходы — в копейках,
 * по id кампании; кампании с расходом без переходов тоже попадают в сводку.
 */
export function summarize(
  clicks: SummaryClick[],
  campaigns: CampaignRule[],
  spendByCampaign: Map<string, number>,
) {
  const total = new Counter();
  const bySource = new Map<string, { source: ClientSource; count: Counter }>();
  const bySite = new Map<string, Counter>();

  for (const click of clicks) {
    total.add(click);
    const source = clickSource(click.entry, click.attribution, campaigns);
    const key = sourceKey(source);
    let group = bySource.get(key);
    if (!group) {
      group = { source, count: new Counter() };
      bySource.set(key, group);
    }
    group.count.add(click);
    if (source.kind === "none") {
      const site = siteOf(click.entry);
      let counter = bySite.get(site);
      if (!counter) {
        counter = new Counter();
        bySite.set(site, counter);
      }
      counter.add(click);
    }
  }
  for (const [campaignId] of spendByCampaign) {
    const source: ClientSource = {
      kind: "campaign",
      campaignId,
      manual: false,
    };
    const key = sourceKey(source);
    if (!bySource.has(key)) bySource.set(key, { source, count: new Counter() });
  }

  const sources = [...bySource.values()]
    .map(({ source, count }) => ({
      source,
      ...count.view(),
      spend:
        source.kind === "campaign"
          ? (spendByCampaign.get(source.campaignId) ?? 0)
          : 0,
    }))
    // Реклама сверху, по расходу и переходам; «не с рекламы» — последней
    .sort(
      (a, b) =>
        Number(a.source.kind === "none") - Number(b.source.kind === "none") ||
        b.spend - a.spend ||
        b.clicks - a.clicks,
    );
  const sites = [...bySite.entries()]
    .map(([site, count]) => ({ site, ...count.view() }))
    .sort((a, b) => b.clicks - a.clicks);

  return { total: total.view(), sources, sites };
}
