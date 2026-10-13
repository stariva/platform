import { NextResponse } from "next/server";
import { z } from "zod";
import { readJobsRequest } from "@/lib/workshops/jobs-request";
import { failRendition } from "@/lib/workshops/video-renditions";

export const runtime = "nodejs";

const bodySchema = z.object({
  videoKey: z.string().startsWith("workshops/").max(300),
  attemptId: z.number().int().positive(),
  error: z.string().max(10_000),
});

/** Нарезка упала: видео вернётся в очередь после паузы. */
export async function POST(request: Request) {
  const parsed = await readJobsRequest(request, bodySchema);
  if ("response" in parsed) return parsed.response;

  await failRendition(
    parsed.data.videoKey,
    parsed.data.attemptId,
    parsed.data.error,
  );
  return NextResponse.json({ ok: true });
}
