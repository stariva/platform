import type { CampaignAttribution, SessionEntry } from "@stariva/db/schema";
import { Badge } from "@stariva/ui/reui";
import {
  sourceLabel as campaignLabel,
  type SourceView,
} from "~/components/crm/crm-meta";

/** Откуда пришёл посетитель в корзине, как её отдаёт admin.carts.byId. */
export interface CartSource {
  campaign: SourceView;
  // Откуда пришёл без меток: сайт, «Прямой заход», объявление без UTM
  site: string;
  entry: SessionEntry | null;
  attribution: CampaignAttribution | null;
}

/** utm_content и utm_term: какое объявление и по какому запросу. */
function adDetails({ entry, attribution }: CartSource) {
  const touch = entry?.utm_source ? entry : attribution?.last;
  return [touch?.utm_content, touch?.utm_term].filter(Boolean).join(" · ");
}

/**
 * С какой рекламы пришёл: кампания (или голая метка), объявление и запрос,
 * страница входа. События до того, как журнал начал это записывать, — без данных.
 */
export function CartSourceBlock({ source }: { source: CartSource }) {
  if (!source.entry && !source.attribution) {
    return (
      <span className="text-muted-foreground text-xs">
        Не записано: событие старше учёта рекламы
      </span>
    );
  }
  const fromAd = source.campaign.kind !== "none";
  const details = adDetails(source);
  const { entry } = source;
  return (
    <div className="text-sm whitespace-normal">
      <div className={fromAd ? "" : "text-muted-foreground"}>
        {fromAd ? campaignLabel(source.campaign) : source.site}
      </div>
      {source.campaign.kind === "utm" && (
        <Badge variant="secondary" className="mt-1">
          кампания не заведена
        </Badge>
      )}
      {details && (
        <div className="text-muted-foreground text-xs break-words">
          {details}
        </div>
      )}
      {fromAd && !entry?.utm_source && (
        <div className="text-muted-foreground text-xs">
          Реклама с прошлого захода, сейчас: {source.site}
        </div>
      )}
      {fromAd && entry?.utm_source && entry.referrer && (
        <div className="text-muted-foreground text-xs">с {entry.referrer}</div>
      )}
      {entry?.landing && (
        <div className="text-muted-foreground text-xs break-words">
          вход: {entry.landing}
        </div>
      )}
    </div>
  );
}
