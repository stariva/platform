import { timingSafeEqual } from "node:crypto";

/** Проверка `Authorization: Bearer <REVALIDATE_SECRET>` от админки. */
export function isAuthorizedByAdmin(
  header: string | null,
  secret: string,
): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
