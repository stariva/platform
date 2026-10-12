import { NextResponse } from "next/server";
import { z } from "zod";
import { readJobsRequest } from "@/lib/workshops/jobs-request";
import { completeRendition } from "@/lib/workshops/video-renditions";

export const runtime = "nodejs";

const bodySchema = z.object({
  videoKey: z.string().startsWith("workshops/").max(300),
  durationSeconds: z.number().nonnegative(),
});

/** Воркер залил HLS-версию: с этого момента плеер показывает её. */
export async function POST(request: Request) {
  const parsed = await readJobsRequest(request, bodySchema);
  if ("response" in parsed) return parsed.response;

  const result = await completeRendition(
    parsed.data.videoKey,
    parsed.data.durationSeconds,
  );
  return NextResponse.json(
    { result },
    { status: result === "ready" ? 200 : 409 },
  );
}
