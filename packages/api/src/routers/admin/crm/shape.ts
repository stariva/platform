import type { adCampaigns } from "@stariva/db/schema";

import type { Client, ClientSource, Deal } from "./model";
import { sourceKey } from "./model";

type CampaignRow = typeof adCampaigns.$inferSelect;

export const rubles = (kopecks: number) => kopecks / 100;

/** Источник для админки: название кампании, канал или голая метка. */
export function sourceView(
  source: ClientSource,
  campaigns: Map<string, CampaignRow>,
) {
  const campaign =
    source.kind === "campaign" ? campaigns.get(source.campaignId) : undefined;
  return {
    key: sourceKey(source),
    kind: source.kind,
    manual: source.kind !== "utm" && source.manual,
    campaignId: campaign?.id ?? null,
    name: campaign?.name ?? null,
    channel: campaign?.channel ?? null,
    archived: campaign?.archived ?? false,
    utmSource:
      source.kind === "utm" ? source.utmSource : (campaign?.utmSource ?? null),
    utmCampaign:
      source.kind === "utm"
        ? source.utmCampaign
        : (campaign?.utmCampaign ?? null),
  };
}

export type SourceView = ReturnType<typeof sourceView>;

/** Строка списка клиентов. */
export function clientSummary(
  client: Client,
  campaigns: Map<string, CampaignRow>,
) {
  return {
    key: client.key,
    name: client.name,
    phones: client.phones,
    emails: client.emails,
    hasCard: client.record !== null,
    source: sourceView(client.source, campaigns),
    firstSeenAt: client.firstSeenAt,
    firstPaidAt: client.firstPaidAt,
    lastActivityAt: client.lastActivityAt,
    deals: client.deals.length,
    paidDeals: client.paidDeals,
    revenue: rubles(client.revenue),
  };
}

export function dealView(deal: Deal) {
  return {
    kind: deal.kind,
    id: deal.id,
    label: deal.label,
    status: deal.status,
    createdAt: deal.createdAt,
    paid: rubles(deal.payments.reduce((sum, p) => sum + p.amount, 0)),
    lastPaidAt: deal.payments.reduce<Date | null>(
      (last, p) => (!last || p.at > last ? p.at : last),
      null,
    ),
    utmSource: deal.attribution?.first.utm_source ?? null,
    utmCampaign: deal.attribution?.first.utm_campaign ?? null,
  };
}

export const byId = (campaigns: CampaignRow[]) =>
  new Map(campaigns.map((campaign) => [campaign.id, campaign]));

export function isUniqueViolation(error: unknown, constraint: string) {
  const cause = (error as { cause?: { code?: string; constraint?: string } })
    ?.cause;
  const pg = cause ?? (error as { code?: string; constraint?: string });
  return pg?.code === "23505" && pg.constraint === constraint;
}
