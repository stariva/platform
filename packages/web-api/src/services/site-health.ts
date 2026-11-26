import { ORPCError } from "@orpc/server";
import { db, inArray, sql } from "@stariva/db";
import { siteHealthFindings, siteHealthPages } from "@stariva/db/schema";
import type { SiteHealthPageResult } from "../contract/jobs";
import { moscowDate } from "./yandex/common";

const SCAN_TIME_TOLERANCE_MS = 24 * 60 * 60 * 1000;

function excluded(column: { name: string }) {
  return sql.raw(`excluded."${column.name.replace(/"/g, '""')}"`);
}

function validScannedAt(value: string): Date {
  const scannedAt = new Date(value);
  const skew = Math.abs(Date.now() - scannedAt.getTime());
  if (Number.isNaN(scannedAt.getTime()) || skew > SCAN_TIME_TOLERANCE_MS) {
    throw new ORPCError("BAD_REQUEST", {
      message: "site_health_scanned_at_out_of_range",
    });
  }
  return scannedAt;
}

export async function saveSiteHealthResults(
  results: SiteHealthPageResult[],
): Promise<number> {
  const date = moscowDate(new Date());
  const seen = new Set<string>();
  const rows = results.map((r) => {
    if (seen.has(r.url)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "site_health_duplicate_report",
      });
    }
    seen.add(r.url);
    const scannedAt = validScannedAt(r.scannedAt);
    return {
      url: r.url,
      date,
      status: r.status,
      finalUrl: r.finalUrl,
      redirectCount: r.redirectCount,
      responseTimeMs: r.responseTimeMs,
      title: r.title,
      metaDescription: r.metaDescription,
      canonical: r.canonical,
      robots: r.robots,
      h1Count: r.h1Count,
      internalLinks: r.internalLinks,
      brokenLinks: r.brokenLinks,
      images: r.images,
      brokenImages: r.brokenImages,
      missingAltImages: r.missingAltImages,
      error: r.error,
      scannedAt,
    };
  });

  await db.transaction(async (tx) => {
    const pages = await tx
      .insert(siteHealthPages)
      .values(rows)
      .onConflictDoUpdate({
        target: [siteHealthPages.url, siteHealthPages.date],
        setWhere: sql`${excluded(siteHealthPages.scannedAt)} >= ${siteHealthPages.scannedAt}`,
        set: {
          status: excluded(siteHealthPages.status),
          finalUrl: excluded(siteHealthPages.finalUrl),
          redirectCount: excluded(siteHealthPages.redirectCount),
          responseTimeMs: excluded(siteHealthPages.responseTimeMs),
          title: excluded(siteHealthPages.title),
          metaDescription: excluded(siteHealthPages.metaDescription),
          canonical: excluded(siteHealthPages.canonical),
          robots: excluded(siteHealthPages.robots),
          h1Count: excluded(siteHealthPages.h1Count),
          internalLinks: excluded(siteHealthPages.internalLinks),
          brokenLinks: excluded(siteHealthPages.brokenLinks),
          images: excluded(siteHealthPages.images),
          brokenImages: excluded(siteHealthPages.brokenImages),
          missingAltImages: excluded(siteHealthPages.missingAltImages),
          error: excluded(siteHealthPages.error),
          scannedAt: excluded(siteHealthPages.scannedAt),
        },
      })
      .returning({ id: siteHealthPages.id, url: siteHealthPages.url });

    const pageIds = new Map(pages.map((page) => [page.url, page.id]));
    const ids = pages.map((page) => page.id);
    if (ids.length > 0) {
      await tx
        .delete(siteHealthFindings)
        .where(inArray(siteHealthFindings.pageId, ids));
    }

    const findings = new Map<string, typeof siteHealthFindings.$inferInsert>();
    for (const result of results) {
      const pageId = pageIds.get(result.url);
      if (!pageId) continue;
      const scannedAt = validScannedAt(result.scannedAt);
      for (const finding of result.findings) {
        const target = finding.target ?? "";
        const key = JSON.stringify([result.url, finding.code, target]);
        findings.set(key, {
          pageId,
          url: result.url,
          date,
          severity: finding.severity,
          code: finding.code,
          message: finding.message,
          target,
          details: finding.details,
          scannedAt,
        });
      }
    }

    const findingRows = [...findings.values()];
    if (findingRows.length > 0) {
      await tx
        .insert(siteHealthFindings)
        .values(findingRows)
        .onConflictDoNothing({
          target: [
            siteHealthFindings.date,
            siteHealthFindings.url,
            siteHealthFindings.code,
            siteHealthFindings.target,
          ],
        });
    }
  });

  return rows.length;
}
