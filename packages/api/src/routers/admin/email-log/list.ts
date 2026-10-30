import {
  and,
  count,
  desc,
  EMAIL_LOG_STATUSES,
  emailLog,
  getTableColumns,
  gte,
  lt,
  type SQL,
  sql,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { moscowDay } from "../crm/model";
import { daySchema } from "../crm/report";

const DAY = 24 * 60 * 60 * 1000;

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Письмо доставил не первый провайдер: основной отказал, сработал запасной. */
const viaFallback = sql`${emailLog.status} = 'sent' and jsonb_array_length(${emailLog.attempts}) > 1`;

/**
 * Исходящие письма за период, свежие сверху: кому, с какой темой, ушло ли и
 * через какого провайдера, а если не ушло — ответ провайдера. Для каждой
 * попытки видно, кто отказал и почему.
 *
 * Вместе со страницей отдаёт сводку за период (по провайдерам и статусам), не
 * зависящую от поиска и фильтра по статусу. `to` — последний день включительно.
 *
 * @example client.admin.emailLog.list({ from: "2026-10-01", status: "failed", limit: 50, offset: 0 })
 */
export const list = adminProcedure
  .input(
    z.object({
      from: daySchema.optional(),
      to: daySchema.optional(),
      status: z.enum(EMAIL_LOG_STATUSES).optional(),
      query: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const period: SQL[] = [];
    if (input.from) {
      period.push(gte(emailLog.createdAt, moscowDay(input.from)));
    }
    if (input.to) {
      period.push(
        lt(emailLog.createdAt, new Date(moscowDay(input.to).getTime() + DAY)),
      );
    }

    const filters = [...period];
    if (input.status) filters.push(sql`${emailLog.status} = ${input.status}`);
    if (input.query) {
      const pattern = `%${escapeLike(input.query)}%`;
      filters.push(sql`(
        ${emailLog.recipient} ilike ${pattern}
        or ${emailLog.subject} ilike ${pattern}
        or ${emailLog.workshopOrderId} ilike ${pattern}
        or ${emailLog.error} ilike ${pattern}
      )`);
    }
    const where = and(...filters);

    // Тело письма в список не берём (см. email-log/html): только признак, что оно есть
    const { html: _html, ...columns } = getTableColumns(emailLog);
    const [items, [totals], summary] = await Promise.all([
      context.db
        .select({ ...columns, hasHtml: sql<boolean>`${emailLog.html} is not null` })
        .from(emailLog)
        .where(where)
        .orderBy(desc(emailLog.createdAt), desc(emailLog.id))
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ total: count() }).from(emailLog).where(where),
      context.db
        .select({
          status: emailLog.status,
          provider: emailLog.provider,
          count: count(),
          fallback: sql<number>`(count(*) filter (where ${viaFallback}))::int`,
        })
        .from(emailLog)
        .where(and(...period))
        .groupBy(emailLog.status, emailLog.provider),
    ]);

    const sent = summary
      .filter((row) => row.status === "sent")
      .reduce((sum, row) => sum + row.count, 0);
    const failed = summary
      .filter((row) => row.status === "failed")
      .reduce((sum, row) => sum + row.count, 0);

    return {
      items,
      total: totals?.total ?? 0,
      summary: {
        total: sent + failed,
        sent,
        failed,
        // Письма, до которых основной провайдер не дотянулся
        fallback: summary.reduce((sum, row) => sum + row.fallback, 0),
        providers: summary
          .filter((row) => row.status === "sent" && row.provider)
          .map((row) => ({
            provider: row.provider as string,
            sent: row.count,
          })),
      },
    };
  });
