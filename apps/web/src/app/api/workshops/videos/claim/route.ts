import { getDownloadUrl, isStorageConfigured } from "@stariva/storage";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readJobsRequest } from "@/lib/workshops/jobs-request";
import { claimNextVideo } from "@/lib/workshops/video-renditions";

export const runtime = "nodejs";

// ffmpeg читает исходник по этой ссылке всё время нарезки
const SOURCE_URL_TTL_SECONDS = 6 * 60 * 60;

/**
 * Воркер (apps/jobs, lesson-video-hls) берёт следующее видео без HLS-версии.
 * Отдаём ссылку на исходник и папку, куда класть куски. `job: null` —
 * нарезать нечего.
 */
export async function POST(request: Request) {
  const parsed = await readJobsRequest(request, z.object({}));
  if ("response" in parsed) return parsed.response;
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  const job = await claimNextVideo();
  if (!job) return NextResponse.json({ job: null });
  return NextResponse.json({
    job: {
      ...job,
      sourceUrl: await getDownloadUrl(job.videoKey, {
        expiresIn: SOURCE_URL_TTL_SECONDS,
      }),
    },
  });
}
