import { translateAuthError } from "@stariva/auth/errors";
import { APIError } from "better-auth/api";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-strength";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(128),
});

/**
 * Первый пароль для аккаунта, в который входили только по коду или ссылке.
 * В better-auth это серверный вызов (setPassword), из браузера его не дёрнуть.
 * Сменить уже заданный пароль — обычный changePassword на клиенте.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов` },
      { status: 400 },
    );
  }
  try {
    await auth.api.setPassword({
      body: { newPassword: parsed.data.newPassword },
      headers: request.headers,
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    const body = error.body as
      | { code?: unknown; message?: unknown }
      | undefined;
    return NextResponse.json(
      {
        error:
          translateAuthError({
            code: body?.code,
            message: body?.message,
            status: error.statusCode,
          }) || "Не удалось задать пароль. Попробуйте ещё раз.",
      },
      { status: error.statusCode },
    );
  }
  return NextResponse.json({ ok: true });
}
