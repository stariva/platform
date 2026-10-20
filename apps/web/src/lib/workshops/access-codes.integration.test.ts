import { expect, test } from "bun:test";

test.skipIf(!process.env.ACCESS_CODE_TEST_DATABASE_URL)(
  "access code attempts and course grants stay atomic under concurrency",
  async () => {
    const url = new URL(process.env.ACCESS_CODE_TEST_DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/stariva_access_code_test");
    process.env.POSTGRES_URL = url.href;
    const { db } = await import("@stariva/db");
    const {
      accessCodeAttempts,
      courseAccess,
      orders,
      user,
      workshopAccessCodes,
    } = await import("@stariva/db/schema");
    const { eq, sql } = await import("drizzle-orm");
    const {
      ACCESS_CODE_MAX_FAILURES,
      redeemAccessCode,
      releaseAccessCodeAttempt,
      reserveAccessCodeAttempt,
    } = await import("./access-codes");

    const ip = "203.0.113.7";
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () => reserveAccessCodeAttempt(ip)),
    );
    const reserved = attempts.filter((id): id is string => id !== null);
    expect(reserved).toHaveLength(ACCESS_CODE_MAX_FAILURES);
    expect(new Set(reserved).size).toBe(ACCESS_CODE_MAX_FAILURES);
    expect(
      await db
        .select()
        .from(accessCodeAttempts)
        .where(eq(accessCodeAttempts.ip, ip)),
    ).toHaveLength(ACCESS_CODE_MAX_FAILURES);
    expect(await reserveAccessCodeAttempt("203.0.113.8")).toBeString();
    await releaseAccessCodeAttempt(reserved[0] as string);
    expect(await reserveAccessCodeAttempt(ip)).toBeString();
    expect(await reserveAccessCodeAttempt(ip)).toBeNull();

    await db
      .update(accessCodeAttempts)
      .set({ createdAt: new Date(Date.now() - 2 * 60 * 60_000) })
      .where(eq(accessCodeAttempts.ip, ip));
    expect(await reserveAccessCodeAttempt(ip)).toBeString();

    // A journal failure must refuse the request instead of bypassing the limit.
    await db.execute(
      sql`alter table access_code_attempts rename to unavailable_attempts`,
    );
    try {
      expect(await reserveAccessCodeAttempt(ip)).toBeNull();
    } finally {
      await db.execute(
        sql`alter table unavailable_attempts rename to access_code_attempts`,
      );
    }

    const userId = crypto.randomUUID();
    const email = `${userId}@example.test`;
    await db.insert(user).values({ id: userId, name: "Test", email });
    const codes = await db
      .insert(workshopAccessCodes)
      .values(
        ["482719", "482720", "482721", "482722"].map((code) => ({
          id: crypto.randomUUID(),
          code,
          workshopSlug: "elka-makrame",
          channel: "livemaster",
          amount: 249000,
        })),
      )
      .returning();
    const redeem = (code: (typeof codes)[number], preorder = false) =>
      redeemAccessCode({
        code,
        userId,
        email,
        releaseAt: preorder ? new Date(Date.now() + 24 * 60 * 60_000) : null,
        visitor: null,
      });
    const [first, second, third, fourth] = codes;
    if (!first || !second || !third || !fourth)
      throw new Error("missing codes");

    // Two codes for the same course can only create one paid order.
    const outcomes = await Promise.allSettled([redeem(first), redeem(second)]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.message).toBe(
      "course_already_owned",
    );
    expect(
      await db.select().from(orders).where(eq(orders.userId, userId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(courseAccess)
        .where(eq(courseAccess.userId, userId)),
    ).toHaveLength(1);
    const readCodes = () => db.select().from(workshopAccessCodes);
    const claimed = (await readCodes()).filter(
      (code) => code.redeemedAt !== null,
    );
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.orderId).toBeTruthy();
    const unused = (await readCodes()).filter(
      (code) => code.redeemedAt === null,
    );
    expect(unused.every((code) => code.orderId === null)).toBe(true);

    await db.delete(courseAccess).where(eq(courseAccess.userId, userId));
    // An existing bonus never prevents the main course from being granted.
    await db.insert(courseAccess).values({
      id: crypto.randomUUID(),
      userId,
      workshopSlug: "elka-makrame-bolshaya",
    });
    expect(await redeem(third, true)).toBeTruthy();
    expect(
      await db
        .select()
        .from(courseAccess)
        .where(eq(courseAccess.userId, userId)),
    ).toHaveLength(2);

    await db.delete(courseAccess).where(eq(courseAccess.userId, userId));
    // The same code cannot be consumed twice, and a new bonus is granted.
    const repeated = await Promise.all([
      redeem(fourth, true),
      redeem(fourth, true),
    ]);
    expect(repeated.filter(Boolean)).toHaveLength(1);
    expect(repeated.filter((order) => order === null)).toHaveLength(1);
    expect(
      await db
        .select()
        .from(courseAccess)
        .where(eq(courseAccess.userId, userId)),
    ).toHaveLength(2);
    expect(
      await db.select().from(orders).where(eq(orders.userId, userId)),
    ).toHaveLength(3);
  },
);
