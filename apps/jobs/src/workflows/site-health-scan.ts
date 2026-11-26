import { hatchet } from "../client";
import { env } from "../env";
import { scanSiteHealth } from "../lib/site-health";
import { fetchSitemapUrls } from "../lib/sitemap";
import { webApi, withRetry } from "../lib/web-api";

export const siteHealthScanWorkflow = hatchet.workflow({
  name: "site-health-scan",
  on: { cron: "10 1 * * *" },
});

const EXECUTION_SECONDS = 3600;
const REPORT_BATCH = 20;

const sitemap = siteHealthScanWorkflow.task({
  name: "fetch-sitemap",
  retries: 2,
  backoff: { factor: 2, maxSeconds: 300 },
  executionTimeout: "120s",
  fn: async (_input, ctx) => ({
    scannedAt: new Date().toISOString(),
    urls: await fetchSitemapUrls(
      env.STOREFRONT_URL,
      ctx.abortController.signal,
    ),
  }),
});

siteHealthScanWorkflow.task({
  name: "scan-pages",
  parents: [sitemap],
  retries: 1,
  backoff: { factor: 2, maxSeconds: 600 },
  executionTimeout: `${EXECUTION_SECONDS}s`,
  fn: async (_input, ctx) => {
    const startedAt = Date.now();
    const { urls, scannedAt } = await ctx.parentOutput(sitemap);
    const results = await scanSiteHealth(urls, {
      // Four 15s attempts plus backoff per report batch, with scheduling margin.
      resourceDeadline:
        startedAt +
        EXECUTION_SECONDS * 1000 -
        Math.ceil(urls.length / REPORT_BATCH) * 75_000 -
        5_000,
      scannedAt,
      origin: env.STOREFRONT_URL,
      signal: ctx.abortController.signal,
      concurrency: 3,
      resourceConcurrency: 5,
    });

    let saved = 0;
    for (let index = 0; index < results.length; index += REPORT_BATCH) {
      const batch = results.slice(index, index + REPORT_BATCH);
      await withRetry("siteHealth.report", (context) =>
        webApi.jobs.siteHealth.report({ results: batch }, { context }),
      );
      saved += batch.length;
    }

    return {
      scanned: results.filter((result) => !result.error).length,
      failed: results.filter((result) => result.error).length,
      findings: results.reduce(
        (sum, result) => sum + result.findings.length,
        0,
      ),
      saved,
    };
  },
});
