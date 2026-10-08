import { NextResponse } from "next/server";
import { buildReleaseIcs } from "@/lib/workshops/calendar";
import { workshopCourseUrl } from "@/lib/workshops/notifications";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";

export const runtime = "nodejs";

/** «Добавить в календарь»: .ics со стартом уроков предзаказа. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const workshop = await getWorkshopBySlug(slug, "owned");
  if (!workshop?.releaseAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ics = buildReleaseIcs({
    slug: workshop.slug,
    title: workshop.title,
    releaseAt: new Date(workshop.releaseAt),
    url: workshopCourseUrl(workshop.slug),
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="stariva-${workshop.slug}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
