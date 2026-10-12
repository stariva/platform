import {
  createUploadUrl,
  HLS_FILE_PATTERN,
  hlsContentType,
  workshopHlsPrefix,
} from "@stariva/storage";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readJobsRequest } from "@/lib/workshops/jobs-request";

export const runtime = "nodejs";

const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

const bodySchema = z.object({
  videoKey: z.string().startsWith("workshops/").max(300),
  files: z.array(z.string().regex(HLS_FILE_PATTERN)).min(1).max(500),
});

/**
 * Ссылки, по которым воркер заливает куски HLS-версии. Папку строит сервер
 * из ключа исходника, поэтому писать можно только в HLS-папку этого видео.
 */
export async function POST(request: Request) {
  const parsed = await readJobsRequest(request, bodySchema);
  if ("response" in parsed) return parsed.response;
  const { videoKey, files } = parsed.data;

  const prefix = workshopHlsPrefix(videoKey);
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
