import { env } from "@stariva/config";
import {
  getDownloadUrl,
  getObjectText,
  HLS_FILE_PATTERN,
  isStorageConfigured,
} from "@stariva/storage";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { sessionFingerprint, verifyHlsGrant } from "@/lib/workshops/hls-token";

export const runtime = "nodejs";

// Ссылка на кусок в бакете: плеер забирает его сразу, дольше она не нужна
const SEGMENT_URL_TTL_SECONDS = 60;

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Плейлисты и куски HLS-версии урока. Пропуск в пути выдаёт
 * account.lessonVideo после проверки покупки; здесь проверяем подпись, срок и
 * что запрос пришёл из того же браузера. Плейлисты отдаём сами (их
 * относительные адреса ведут обратно сюда), за куском — короткая ссылка в
 * бакет.
 *
 * Нарезка в одно качество лежит прямо в папке (index.m3u8, init.mp4,
 * seg-NNNNN.m4s), в несколько — master.m3u8 и те же файлы в v0/, v1/…:
 * `<пропуск>/master.m3u8` → `<пропуск>/v1/index.m3u8` → `<пропуск>/v1/seg-…`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; path: string[] }> },
) {
  const { token, path } = await params;
  const file = path.join("/");
  if (!HLS_FILE_PATTERN.test(file)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const secret = env.AUTH_SECRET;
  if (!secret || !isStorageConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const grant = verifyHlsGrant(token, secret);
  if (!grant) {
    return NextResponse.json({ error: "expired" }, { status: 403 });
  }
  // Пропуск, скопированный в другой браузер, не сработает
  if (
    grant.session &&
    grant.session !== sessionFingerprint(getSessionCookie(request))
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const key = `${grant.prefix}/${file}`;
  try {
    if (file.endsWith(".m3u8")) {
      return new Response(await getObjectText(key), {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          ...NO_STORE,
        },
      });
    }
    const url = await getDownloadUrl(key, {
      expiresIn: SEGMENT_URL_TTL_SECONDS,
    });
    return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
  } catch (error) {
    console.error("[video/hls] Не удалось отдать файл:", key, error);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
