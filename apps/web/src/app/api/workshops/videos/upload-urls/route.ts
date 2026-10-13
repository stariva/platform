import { and, db, eq } from "@stariva/db";
import { videoRenditions } from "@stariva/db/schema";
import {
  createUploadUrl,
  HLS_FILE_PATTERN,
  hlsContentType,
} from "@stariva/storage";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readJobsRequest } from "@/lib/workshops/jobs-request";

export const runtime = "nodejs";

const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

const bodySchema = z.object({
  videoKey: z.string().startsWith("workshops/").max(300),
  attemptId: z.number().int().positive(),
  files: z.array(z.string().regex(HLS_FILE_PATTERN)).min(1).max(500),
});

/**
 * Ссылки, по которым воркер заливает куски HLS-версии. Папку берём из
 * текущей попытки, чтобы старый воркер не перезаписал её файлы.
 */
export async function POST(request: Request) {
  const parsed = await readJobsRequest(request, bodySchema);
  if ("response" in parsed) return parsed.response;
  const { videoKey, attemptId, files } = parsed.data;

  const [rendition] = await db
    .select({ hlsPrefix: videoRenditions.hlsPrefix })
    .from(videoRenditions)
    .where(
      and(
        eq(videoRenditions.videoKey, videoKey),
        eq(videoRenditions.attempts, attemptId),
        eq(videoRenditions.status, "processing"),
      ),
    )
    .limit(1);
  if (!rendition) {
    return NextResponse.json({ error: "not_found" }, { status: 409 });
  }
  const prefix = rendition.hlsPrefix;
  const entries = await Promise.all(
    files.map(async (file) => {
      const contentType = hlsContentType(file);
      const url = await createUploadUrl(`${prefix}/${file}`, contentType, {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
      });
      return [file, { url, contentType }] as const;
    }),
  );
  return NextResponse.json({ uploads: Object.fromEntries(entries) });
}
