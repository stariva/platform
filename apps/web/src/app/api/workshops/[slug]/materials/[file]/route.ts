import { env } from "@stariva/config";
import { getObjectStream } from "@stariva/storage";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { verifyMaterialGrant } from "@/lib/workshops/material-token";
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
 * account.materialUrl. Покупателя узнаём по cookie сессии или, если её нет
 * (приложение входит bearer-токеном), по пропуску из ссылки.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; file: string }> },
) {
  const { slug, file } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  const material = await findMaterialFile(
    slug,
    file,
    session?.user.id ?? grantedUserId(request, slug, file),
  );
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
function grantedUserId(
  request: NextRequest,
  slug: string,
  file: string,
): string | null {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !env.AUTH_SECRET) return null;
  const grant = verifyMaterialGrant(token, env.AUTH_SECRET);
  if (!grant || grant.slug !== slug || grant.file !== file) return null;
  return grant.userId;
}
