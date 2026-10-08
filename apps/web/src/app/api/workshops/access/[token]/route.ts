import { db } from "@stariva/db";
import { user } from "@stariva/db/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPaidOrderByAccessToken } from "@/lib/payments/orders";
import { createLoginRedirect } from "@/lib/workshops/buyer";

export const runtime = "nodejs";

/**
 * Личная ссылка из писем о мастер-классе: открывает кабинет без пароля.
 *
 * Ссылка уходит только на email покупателя, поэтому переход по ней
 * подтверждает почту: выпускаем одноразовый magic link better-auth и сразу
 * переходим по нему — тот создаёт сессию и помечает email подтверждённым.
 * Ссылка многоразовая, чтобы кнопка в старом письме работала и через месяц.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const order = await getPaidOrderByAccessToken(token);
  if (!order) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("callbackURL", "/account");
    return NextResponse.redirect(signIn);
  }

  const coursePath = `/account/workshops/${order.workshopSlug}`;
  const session = await getSession();
  if (session?.user.id === order.userId) {
    return NextResponse.redirect(new URL(coursePath, request.url));
  }

  const [buyer] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, order.userId))
    .limit(1);
  const loginUrl =
    buyer &&
    (await createLoginRedirect(buyer.email, coursePath, request.headers));
  if (!loginUrl) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("callbackURL", coursePath);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.redirect(loginUrl);
}
