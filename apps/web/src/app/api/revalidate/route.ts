import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv } from "@/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  paths: z
    .array(
      z
        .string()
        .max(1024)
        .regex(/^\/[^\s?#]*$/, "Ожидается путь страницы"),
    )
    .min(1)
    .max(50),
});

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Сброс кэша страниц витрины по запросу админки (app.stariva.ru) после
 * правок каталога. Доступ — по общему REVALIDATE_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = baseEnv.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  for (const path of parsed.data.paths) revalidatePath(path);
  return NextResponse.json({ revalidated: parsed.data.paths.length });
}
