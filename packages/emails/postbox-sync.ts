import { logger } from "@stariva/config";
import {
  and,
  type Database,
  db as defaultDb,
  emailEvents,
  emailStreamCursors,
  emailSuppressions,
  eq,
  sql,
} from "@stariva/db";

import { env } from "./env";
import { parseStreamRecord, suppressionsOf } from "./postbox-events";
import { postboxCredentials } from "./providers";
import {
  getRecords,
  listShards,
  shardIterator,
  type YdsCredentials,
  YdsError,
  type YdsRecord,
} from "./yds";

// Записей за один запрос GetRecords
const BATCH = 500;
// Запросов на шард за прогон: прогон раз в минуту, догонять можно не спеша
const MAX_CALLS_PER_SHARD = 20;
// Итог по письмам пересчитываем по событиям за этот срок: событие могло
// прийти раньше, чем строка журнала, и та появилась только теперь
const REFRESH_WINDOW_MS = 60 * 60 * 1000;

export interface EmailEventsSyncResult {
  /** Задан ли поток и ключ: без них прогон ничего не читает. */
  configured: boolean;
  /** Записей прочитано из потока. */
  read: number;
  /** Новых событий в email_events (повторы потока не считаются). */
  stored: number;
  /** Записей, в которых не нашлось уведомления Postbox. */
  rejected: number;
  /** Адресов, добавленных в email_suppressions. */
  suppressed: number;
  /** Строк email_log, где обновился итог доставки. */
  updated: number;
}

/** Есть ли откуда читать события доставки. */
export function isPostboxEventsConfigured(): boolean {
  return Boolean(env.POSTBOX_EVENTS_STREAM && postboxCredentials());
}

/**
 * Дочитывает поток событий Postbox: складывает их в email_events, отписывает
 * от рассылок несуществующие ящики и пожаловавшихся, обновляет в email_log
 * итог доставки. Место в потоке хранится по шардам, поэтому повтор после
 * сбоя продолжит с того же места; события с тем же eventId не задвоятся.
 */
export async function syncPostboxEvents({
  db = defaultDb,
  deadline,
}: {
  db?: Database;
  /** Время (мс), после которого новых запросов к потоку не делаем. */
  deadline?: number;
} = {}): Promise<EmailEventsSyncResult> {
  const result: EmailEventsSyncResult = {
    configured: false,
    read: 0,
    stored: 0,
    rejected: 0,
    suppressed: 0,
    updated: 0,
  };
  const stream = env.POSTBOX_EVENTS_STREAM;
  const credentials = postboxCredentials();
  if (!stream || !credentials) return result;
  result.configured = true;

  const since = new Date(Date.now() - REFRESH_WINDOW_MS);
  for (const shardId of await listShards(credentials, stream)) {
    if (deadline !== undefined && Date.now() >= deadline) break;
    await readShard({ db, credentials, stream, shardId, deadline, result });
  }
  result.updated = await refreshEmailLog(db, since);
  return result;
}

async function readShard({
  db,
  credentials,
  stream,
  shardId,
  deadline,
  result,
}: {
  db: Database;
  credentials: YdsCredentials;
  stream: string;
  shardId: string;
  deadline?: number;
  result: EmailEventsSyncResult;
}) {
  const where = and(
    eq(emailStreamCursors.stream, stream),
    eq(emailStreamCursors.shardId, shardId),
  );
  const [cursor] = await db
    .select({ sequenceNumber: emailStreamCursors.sequenceNumber })
    .from(emailStreamCursors)
    .where(where);

  let iterator: string | null;
  try {
    iterator = await shardIterator(
      credentials,
      stream,
      shardId,
      cursor?.sequenceNumber ?? null,
    );
  } catch (error) {
    // Запись, на которой остановились, уже стёрта из потока (простой дольше
    // срока хранения): читаем с самой старой, что осталась
    if (!(cursor && error instanceof YdsError && error.status === 400)) {
      throw error;
    }
    logger.warn("email_events.cursor_reset", {
      shardId,
      sequenceNumber: cursor.sequenceNumber,
      error: error.message,
    });
    iterator = await shardIterator(credentials, stream, shardId, null);
  }

  for (let calls = 0; iterator && calls < MAX_CALLS_PER_SHARD; calls++) {
    if (deadline !== undefined && Date.now() >= deadline) break;
    const batch = await getRecords(credentials, iterator, BATCH);
    iterator = batch.next;
    const last = batch.records.at(-1);
    if (last) {
      await storeRecords(db, batch.records, result);
      // Место сохраняем после записи событий: упадём между ними — пачка
      // прочитается ещё раз, а дубли отсечёт ключ eventId
      await db
        .insert(emailStreamCursors)
        .values({ stream, shardId, sequenceNumber: last.sequenceNumber })
        .onConflictDoUpdate({
          target: [emailStreamCursors.stream, emailStreamCursors.shardId],
          set: { sequenceNumber: last.sequenceNumber, updatedAt: new Date() },
        });
    }
    // Пустая пачка ещё не конец потока, если YDS говорит, что мы отстаём
    if (batch.records.length === 0 && batch.behindMs === 0) break;
  }
}

async function storeRecords(
  db: Database,
  records: YdsRecord[],
  result: EmailEventsSyncResult,
) {
  result.read += records.length;
  const events = new Map<
    string,
    ReturnType<typeof parseStreamRecord>["events"][number]
  >();
  for (const record of records) {
    const parsed = parseStreamRecord(record.data);
    if (parsed.rejected > 0) {
      result.rejected += parsed.rejected;
      logger.warn("email_events.unparsed_record", {
        sequenceNumber: record.sequenceNumber,
        sample: record.data.slice(0, 200),
      });
    }
    for (const event of parsed.events) events.set(event.eventId, event);
  }
  if (events.size === 0) return;

  const stored = await db
    .insert(emailEvents)
    .values([...events.values()])
    .onConflictDoNothing()
    .returning({ eventId: emailEvents.eventId });
  result.stored += stored.length;

  // Отписываем по всем событиям пачки, а не только новым: если прошлый
  // прогон упал между записью событий и отпиской, повтор её доделает
  const suppressions = new Map(
    [...events.values()]
      .flatMap(suppressionsOf)
      .map((entry) => [entry.email, entry]),
  );
  if (suppressions.size > 0) {
    const added = await db
      .insert(emailSuppressions)
      .values([...suppressions.values()])
      .onConflictDoNothing()
      .returning({ email: emailSuppressions.email });
    result.suppressed += added.length;
  }
}

/**
 * Пересчитывает итог доставки в email_log для писем, о которых недавно
 * пришли события. Берётся первое событие каждого вида; жалоба «это не спам»
 * жалобой не считается.
 */
async function refreshEmailLog(db: Database, since: Date): Promise<number> {
  // Оба драйвера (node-postgres и neon-http) отдают строки в rows
  const updated = (await db.execute(sql`
    update email_log l set
      delivered_at = e.delivered_at,
      delayed_at = e.delayed_at,
      bounced_at = e.bounced_at,
      bounce_type = e.bounce_type,
      bounce_detail = e.bounce_detail,
      complained_at = e.complained_at
    from (
      select
        message_id,
        min(occurred_at) filter (where type = 'Delivery') as delivered_at,
        min(occurred_at) filter (where type = 'DeliveryDelay') as delayed_at,
        min(occurred_at) filter (where type = 'Bounce') as bounced_at,
        (array_agg(payload -> 'bounce' ->> 'bounceType' order by occurred_at)
          filter (where type = 'Bounce'))[1] as bounce_type,
        (array_agg(
          payload -> 'bounce' -> 'bouncedRecipients' -> 0 ->> 'diagnosticCode'
          order by occurred_at
        ) filter (where type = 'Bounce'))[1] as bounce_detail,
        min(occurred_at) filter (
          where type = 'Complaint'
            and coalesce(payload -> 'complaint' ->> 'complaintFeedbackType', '')
              <> 'not-spam'
        ) as complained_at
      from email_events
      where message_id in (
        select message_id from email_events where created_at >= ${since.toISOString()}::timestamptz
      )
      group by message_id
    ) e
    where l.message_id = e.message_id
      and (
        l.delivered_at is distinct from e.delivered_at
        or l.delayed_at is distinct from e.delayed_at
        or l.bounced_at is distinct from e.bounced_at
        or l.bounce_type is distinct from e.bounce_type
        or l.bounce_detail is distinct from e.bounce_detail
        or l.complained_at is distinct from e.complained_at
      )
    returning l.id`)) as { rows: unknown[] };
  return updated.rows.length;
}
