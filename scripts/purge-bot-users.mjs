// Удаляет брошенные регистрации (в основном ботов) из таблицы users.
//
//   bun --env-file=.env scripts/purge-bot-users.mjs           # только показать
//   bun --env-file=.env scripts/purge-bot-users.mjs --apply   # удалить
//
// Удаляется пользователь, только если он: не подтвердил email, зарегистрирован
// больше суток назад, не входил (нет сессий) и ни с чем не связан: ни заказов,
// ни доступа к курсам, ни сертификатов, ни прогресса. Заказы мастер-классов,
// доступ и сертификаты удаляются каскадом вместе с пользователем, поэтому
// условие NOT EXISTS по ним обязательно. Всё выполняется в одной транзакции.
import pg from "pg";

const apply = process.argv.includes("--apply");
const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL is not set");

const CANDIDATES = `
  select u.id, u.name, u.email, u.created_at
  from users u
  where u.email_verified = false
    and u.created_at < now() - interval '1 day'
    and not exists (select 1 from sessions s where s.user_id = u.id)
    and not exists (select 1 from orders o where o.user_id = u.id)
    and not exists (select 1 from product_orders o where o.user_id = u.id)
    and not exists (select 1 from course_access o where o.user_id = u.id)
    and not exists (select 1 from certificates o where o.user_id = u.id)
    and not exists (select 1 from lesson_progress o where o.user_id = u.id)
  order by u.created_at`;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin isolation level read committed");
  const before = (await client.query("select count(*)::int n from users"))
    .rows[0].n;
  const { rows } = await client.query(CANDIDATES);
  console.log(
    `users: ${before}, to delete: ${rows.length}, to keep: ${before - rows.length}`,
  );
  console.table(
    rows.slice(0, 10).map((r) => ({
      name: r.name,
      email: r.email,
      created: r.created_at.toISOString(),
    })),
  );

  if (!apply) {
    await client.query("rollback");
    console.log("Dry run, nothing deleted. Pass --apply to delete.");
  } else {
    const ids = rows.map((r) => r.id);
    // Block order associations, then recheck with a fresh statement snapshot.
    await client.query(
      "select id from users where id = any($1::text[]) for update",
      [ids],
    );
    const res = await client.query(
      `delete from users u
       where u.id = any($1::text[])
         and not exists (select 1 from product_orders o where o.user_id = u.id)`,
      [ids],
    );
    await client.query("commit");
    console.log(`Deleted ${res.rowCount} users.`);
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
