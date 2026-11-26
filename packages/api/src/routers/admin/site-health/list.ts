import { z } from "zod";
import { adminProcedure } from "../../../orpc";
import {
  loadSiteHealthLatest,
  type SiteHealthLatestItem,
  siteHealthPageFailed,
} from "./data";

const FILTERS = ["issues", "all", "critical", "warning", "failed"] as const;
const SORTS = ["worst", "url", "recent"] as const;

function matchesFilter(
  item: SiteHealthLatestItem,
  filter: (typeof FILTERS)[number],
): boolean {
  if (filter === "all") return true;
  if (filter === "critical") return item.criticalCount > 0;
  if (filter === "warning") return item.warningCount > 0;
  if (filter === "failed") return siteHealthPageFailed(item);
  return item.findingCount > 0 || siteHealthPageFailed(item);
}

function compareWorst(a: SiteHealthLatestItem, b: SiteHealthLatestItem) {
  return (
    b.criticalCount - a.criticalCount ||
    b.warningCount - a.warningCount ||
    b.noticeCount - a.noticeCount ||
    Number(b.error != null) - Number(a.error != null) ||
    (b.responseTimeMs ?? 0) - (a.responseTimeMs ?? 0) ||
    a.url.localeCompare(b.url)
  );
}

export const list = adminProcedure
  .input(
    z.object({
      filter: z.enum(FILTERS).default("issues"),
      sort: z.enum(SORTS).default("worst"),
      query: z.string().trim().max(200).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const query = input.query?.toLowerCase();
    let items = (await loadSiteHealthLatest(context.db)).filter((item) =>
      matchesFilter(item, input.filter),
    );
    if (query) {
      items = items.filter((item) => item.url.toLowerCase().includes(query));
    }

    items.sort((a, b) => {
      if (input.sort === "url") return a.url.localeCompare(b.url);
      if (input.sort === "recent") {
        return b.scannedAt.getTime() - a.scannedAt.getTime();
      }
      return compareWorst(a, b);
    });

    return {
      items: items.slice(input.offset, input.offset + input.limit),
      total: items.length,
    };
  });
