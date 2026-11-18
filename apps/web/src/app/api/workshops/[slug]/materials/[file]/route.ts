import { env } from "@stariva/config";
import { getObjectStream } from "@stariva/storage";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { grantedMaterialUser } from "@/lib/workshops/material-token";
import { findMaterialFile } from "@/lib/workshops/signed-media";

export const runtime = "nodejs";

const ERROR_STATUS = {
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  files_unavailable: 503,
} as const;

/**
 * Материал курса (PDF или схема урока) по адресу сайта, а не бакета:
 * проверяем покупку и отдаём файл потоком. Ссылку на этот адрес выдаёт
 * account.materialUrl. Покупателя узнаём по пропуску из ссылки (приложение
 * входит bearer-токеном), а без пропуска — по cookie сессии.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; file: string }> },
) {
  const { slug, file } = await params;
  // Пропуск приложения важнее cookie: в браузере может быть открыт другой аккаунт
  const userId =
    grantedMaterialUser(
      request.nextUrl.searchParams.get("token"),
      env.AUTH_SECRET,
      slug,
      file,
    ) ??
    (await auth.api.getSession({ headers: request.headers }))?.user.id ??
    null;
  const material = await findMaterialFile(slug, file, userId);
  if (material.status !== "ok") {
    return NextResponse.json(
      { error: material.status },
      { status: ERROR_STATUS[material.status] },
    );
  }

  try {
    const { body, contentLength } = await getObjectStream(material.key);
    const name = `${material.label}.${material.extension}`;
    return new Response(body, {
      headers: {
        "Content-Type": material.contentType,
        // Открываем в браузере; при сохранении — понятное имя вместо ключа
        "Content-Disposition": `inline; filename="${file}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        ...(contentLength ? { "Content-Length": String(contentLength) } : {}),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "[workshop-material] Не удалось отдать файл:",
      material.key,
      error,
    );
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}

/** Владелец пропуска из ссылки, если пропуск выдан на этот файл и не истёк. */
