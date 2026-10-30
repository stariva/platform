export const dynamic = "force-dynamic";

/**
 * Проба готовности для k3s. Намеренно без базы и внешних сервисов: если база
 * недоступна, перезапуск пода не поможет, а readiness с БД выведет из
 * балансировки все поды сразу.
 */
export function GET() {
  return Response.json({ status: "ok" });
}
