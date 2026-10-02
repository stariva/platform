import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv } from "@/env";
import { isAuthorizedByAdmin } from "@/lib/internal-auth";
import { pushStockToOzon } from "@/lib/ozon/stock-push";

export const runtime = "nodejs";

const bodySchema = z.object({
  slugs: z.array(z.string().min(1).max(256)).min(1).max(100),
});

/**
 * Админка (app.stariva.ru) после правки остатка просит продублировать его
 * на склад Ozon: ключи Seller API есть только у витрины. Доступ — по общему
 * REVALIDATE_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = baseEnv.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!isAuthorizedByAdmin(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    return NextResponse.json(await pushStockToOzon(parsed.data.slugs));
  } catch (error) {
    console.error("[ozon/stock] Не удалось отправить остаток в Ozon:", error);
    return NextResponse.json({ error: "ozon_failed" }, { status: 502 });
  }
}
