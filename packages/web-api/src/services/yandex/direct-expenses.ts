import { type Database, sql } from "@stariva/db";

/** Дни и кампания, расходы которых пересчитать; без них — все. */
export interface DirectExpensesScope {
  from?: string;
  to?: string;
  campaignId?: string;
}

type Executor = Pick<Database, "execute">;

/**
 * Переносит расход Директа по дням из direct_stats в расходы кампаний CRM,
 * привязанных к кампании Директа (ad_campaigns.direct_campaign_id). Расход —
 * в копейках с НДС, как его показывает Директ.
 *
 * День, за который у кампании уже есть ручной расход, пропускается: его
 * внесли руками, и второй строкой он бы задвоился. Дни без расхода, дни
 * отвязанной кампании и вытесненные ручным расходом строки удаляются.
 * Повтор безопасен.
 */
export async function syncDirectExpenses(
  db: Executor,
  scope: DirectExpensesScope = {},
): Promise<{ days: number }> {
  const statsDays = [
    scope.from ? sql`and s.date >= ${scope.from}` : sql``,
    scope.to ? sql`and s.date <= ${scope.to}` : sql``,
    scope.campaignId ? sql`and c.id = ${scope.campaignId}` : sql``,
  ];
  const expenseDays = [
    scope.from ? sql`and e.spent_on >= ${scope.from}` : sql``,
    scope.to ? sql`and e.spent_on <= ${scope.to}` : sql``,
    scope.campaignId ? sql`and e.campaign_id = ${scope.campaignId}` : sql``,
  ];
  const wanted = sql`
    select c.id as campaign_id, s.date as spent_on,
      round(sum(s.cost) * 100)::int as amount
    from direct_stats s
    join ad_campaigns c on c.direct_campaign_id = s.campaign_id
    where not exists (
        select 1 from ad_expenses m
        where m.campaign_id = c.id and m.spent_on = s.date
          and m.source = 'manual'
      )
      ${sql.join(statsDays, sql` `)}
    group by c.id, s.date
    having round(sum(s.cost) * 100) > 0`;

  await db.execute(sql`
    delete from ad_expenses e
    where e.source = 'yandex_direct'
      ${sql.join(expenseDays, sql` `)}
      and (e.campaign_id, e.spent_on) not in (
        select w.campaign_id, w.spent_on from (${wanted}) w
      )`);
  // Оба драйвера (node-postgres и neon-http) отдают строки в rows
  const result = (await db.execute(sql`
    insert into ad_expenses (id, campaign_id, spent_on, amount, source)
    select gen_random_uuid()::text, w.campaign_id, w.spent_on, w.amount,
      'yandex_direct'
    from (${wanted}) w
    on conflict (campaign_id, spent_on) where source = 'yandex_direct'
      do update set amount = excluded.amount
    returning id`)) as { rows: unknown[] };
  return { days: result.rows.length };
}
