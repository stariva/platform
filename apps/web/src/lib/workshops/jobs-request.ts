import { NextResponse } from "next/server";
import type { z } from "zod";
import { env } from "@/env";
import { isAuthorizedByAdmin } from "@/lib/internal-auth";

/**
 * Проверяет вызов от воркера Hatchet (общий JOBS_SECRET) и разбирает тело.
 * Возвращает либо данные, либо готовый ответ с ошибкой.
 */
export async function readJobsRequest<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  const secret = env.JOBS_SECRET;
  if (!secret) {
    return {
      response: NextResponse.json({ error: "not_configured" }, { status: 503 }),
    };
  }
  if (!isAuthorizedByAdmin(request.headers.get("authorization"), secret)) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: "bad_request", details: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}
