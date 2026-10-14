import { Badge } from "@stariva/ui";
import {
  CHANNEL_LABELS,
  type SourceView,
  sourceLabel,
  utmLabel,
} from "./crm-meta";

/** Откуда клиент: кампания с каналом, голая метка или «не с рекламы». */
export function SourceBadge({ source }: { source: SourceView }) {
  return (
    <div className="space-y-1">
      <div className="text-sm">{sourceLabel(source)}</div>
      <div className="flex flex-wrap gap-1.5">
        {source.channel && (
          <Badge variant="outline">{CHANNEL_LABELS[source.channel]}</Badge>
        )}
        {source.kind === "utm" && (
          <Badge variant="secondary">кампания не заведена</Badge>
        )}
        {source.manual && <Badge variant="secondary">указан вручную</Badge>}
        {source.kind === "campaign" && !source.manual && source.utmSource && (
          <span className="text-muted-foreground text-xs">
            {utmLabel(source.utmSource, source.utmCampaign)}
          </span>
        )}
      </div>
    </div>
  );
}
