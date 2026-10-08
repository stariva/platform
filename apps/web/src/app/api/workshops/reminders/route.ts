import { NextResponse } from "next/server";
import { env } from "@/env";
import { isAuthorizedByAdmin } from "@/lib/internal-auth";
import { runWorkshopReminderSweep } from "@/lib/workshops/notifications";

export const runtime = "nodejs";

/**
 * Рассылка напоминаний о мастер-классах. Вызывает воркер Hatchet по
 * расписанию (packages/jobs, workshop-reminders) с общим JOBS_SECRET.
 * Повторный вызов безопасен: уже отправленное не уходит второй раз.
 */
export async function POST(request: Request) {
  const secret = env.JOBS_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!isAuthorizedByAdmin(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runWorkshopReminderSweep();
  // 500 при сбоях отправки — Hatchet повторит прогон, отправленное не задвоится
  return NextResponse.json(result, { status: result.failed > 0 ? 500 : 200 });
}
