import { type Database, desc, inArray } from "@stariva/db";
import {
  type SiteHealthFindingRow,
  siteHealthFindings,
  siteHealthPages,
} from "@stariva/db/schema";

const severityWeight = { critical: 0, warning: 1, notice: 2 } as const;

function compareFindings(
  a: SiteHealthFindingRow,
  b: SiteHealthFindingRow,
): number {
  return (
    severityWeight[a.severity] - severityWeight[b.severity] ||
    a.code.localeCompare(b.code) ||
    a.target.localeCompare(b.target)
  );
}

export async function loadSiteHealthLatest(db: Database) {
  const latest = db
    .selectDistinctOn([siteHealthPages.url])
    .from(siteHealthPages)
    .orderBy(siteHealthPages.url, desc(siteHealthPages.scannedAt))
    .as("latest");

  const pages = await db.select().from(latest);
  if (pages.length === 0) return [];

  const findings = await db
    .select()
    .from(siteHealthFindings)
    .where(
      inArray(
        siteHealthFindings.pageId,
        pages.map((page) => page.id),
      ),
    );

  const byPage = new Map<string, SiteHealthFindingRow[]>();
  for (const finding of findings) {
    const rows = byPage.get(finding.pageId) ?? [];
    rows.push(finding);
    byPage.set(finding.pageId, rows);
  }

  return pages.map((page) => {
    const pageFindings = (byPage.get(page.id) ?? []).sort(compareFindings);
    const criticalCount = pageFindings.filter(
      (finding) => finding.severity === "critical",
    ).length;
    const warningCount = pageFindings.filter(
      (finding) => finding.severity === "warning",
    ).length;
    const noticeCount = pageFindings.filter(
      (finding) => finding.severity === "notice",
    ).length;
    return {
      ...page,
      criticalCount,
      warningCount,
      noticeCount,
      findingCount: pageFindings.length,
      findings: pageFindings,
    };
  });
}

export type SiteHealthLatestItem = Awaited<
  ReturnType<typeof loadSiteHealthLatest>
>[number];

export function siteHealthPageFailed(item: SiteHealthLatestItem): boolean {
  return item.error != null || item.status == null || item.status >= 400;
}
