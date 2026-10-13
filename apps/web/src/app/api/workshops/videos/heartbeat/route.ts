import { NextResponse } from "next/server";
import { z } from "zod";
import { readJobsRequest } from "@/lib/workshops/jobs-request";
import { extendRenditionLease } from "@/lib/workshops/video-renditions";

export const runtime = "nodejs";

const bodySchema = z.object({
  videoKey: z.string().startsWith("workshops/").max(300),
  attemptId: z.number().int().positive(),
});

/**
 * Воркер ещё режет видео — продлеваем аренду. 409 — попытка уже не его:
 * воркер бросает работу, чтобы не грузить сервер впустую.
 */
export async function POST(request: Request) {
  const parsed = await readJobsRequest(request, bodySchema);
  if ("response" in parsed) return parsed.response;

  const extended = await extendRenditionLease(
    parsed.data.videoKey,
    parsed.data.attemptId,
  );
  return NextResponse.json({ extended }, { status: extended ? 200 : 409 });
}
