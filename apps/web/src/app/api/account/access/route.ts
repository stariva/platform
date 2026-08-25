import { type NextRequest, NextResponse } from "next/server";
import { hasAccess } from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Возвращает, есть ли у текущего пользователя доступ к мастер-классу. */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug обязателен" }, { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, owned: false });
  }

  const owned = await hasAccess(session.user.id, slug);
  return NextResponse.json({ authenticated: true, owned });
}
