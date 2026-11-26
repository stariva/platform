import { adminProcedure } from "../../../orpc";
import { loadSiteHealthLatest, siteHealthPageFailed } from "./data";

export const summary = adminProcedure.handler(async ({ context }) => {
  const items = await loadSiteHealthLatest(context.db);
  const lastScanAt = items.reduce<Date | null>(
    (latest, item) =>
      latest && latest > item.scannedAt ? latest : item.scannedAt,
    null,
  );

  return {
    pages: items.length,
    failed: items.filter(siteHealthPageFailed).length,
    criticalPages: items.filter((item) => item.criticalCount > 0).length,
    warningPages: items.filter(
      (item) => item.criticalCount === 0 && item.warningCount > 0,
    ).length,
    cleanPages: items.filter((item) => item.findingCount === 0).length,
    criticalFindings: items.reduce((sum, item) => sum + item.criticalCount, 0),
    warningFindings: items.reduce((sum, item) => sum + item.warningCount, 0),
    noticeFindings: items.reduce((sum, item) => sum + item.noticeCount, 0),
    brokenLinks: items.reduce((sum, item) => sum + (item.brokenLinks ?? 0), 0),
    brokenImages: items.reduce(
      (sum, item) => sum + (item.brokenImages ?? 0),
      0,
    ),
    lastScanAt,
  };
});
