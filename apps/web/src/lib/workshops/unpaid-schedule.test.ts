import { describe, expect, test } from "bun:test";
import { dueUnpaidReminders, type UnpaidCandidate } from "./unpaid-schedule";

const now = new Date("2026-10-18T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

function order(over: Partial<UnpaidCandidate> = {}): UnpaidCandidate {
  return {
    id: "o1",
    userId: "u1",
    workshopSlug: "elka-makrame",
    status: "pending",
    createdAt: minutesAgo(90),
    email: "buyer@example.com",
    ...over,
  };
}

const nobody = { owns: () => false, reminded: () => false, now };
const ids = (orders: UnpaidCandidate[]) => orders.map((o) => o.id);

describe("dueUnpaidReminders", () => {
  test("pending and canceled orders get a reminder after an hour", () => {
    expect(ids(dueUnpaidReminders([order()], nobody))).toEqual(["o1"]);
    expect(
      ids(dueUnpaidReminders([order({ status: "canceled" })], nobody)),
    ).toEqual(["o1"]);
  });

  test("waits an hour and gives up after a day", () => {
    expect(
      dueUnpaidReminders([order({ createdAt: minutesAgo(30) })], nobody),
    ).toEqual([]);
    expect(
      dueUnpaidReminders([order({ createdAt: minutesAgo(25 * 60) })], nobody),
    ).toEqual([]);
  });

  test("no reminder when the course is already paid", () => {
    const owns = (o: UnpaidCandidate) =>
      o.email === "buyer@example.com" && o.workshopSlug === "elka-makrame";
    expect(dueUnpaidReminders([order()], { ...nobody, owns })).toEqual([]);
  });

  test("a paid or refunded order is not a candidate", () => {
    expect(dueUnpaidReminders([order({ status: "paid" })], nobody)).toEqual([]);
    expect(dueUnpaidReminders([order({ status: "refunded" })], nobody)).toEqual(
      [],
    );
  });

  test("no repeat for an order that was already reminded", () => {
    const reminded = (id: string) => id === "o1";
    expect(dueUnpaidReminders([order()], { ...nobody, reminded })).toEqual([]);
  });

  test("one reminder per person and course across retries", () => {
    const first = order({ id: "o1", createdAt: minutesAgo(180) });
    const retry = order({ id: "o2", createdAt: minutesAgo(90) });
    // Две брошенные попытки — одно письмо, по последней
    expect(ids(dueUnpaidReminders([first, retry], nobody))).toEqual(["o2"]);
    // Письмо по первой уже ушло — по второй не шлём
    expect(
      dueUnpaidReminders([first, retry], {
        ...nobody,
        reminded: (id) => id === "o1",
      }),
    ).toEqual([]);
  });

  test("waits while the latest attempt is fresh", () => {
    const first = order({ id: "o1", createdAt: minutesAgo(180) });
    const retry = order({ id: "o2", createdAt: minutesAgo(10) });
    expect(dueUnpaidReminders([first, retry], nobody)).toEqual([]);
  });

  test("different courses and people are independent", () => {
    const elka = order({ id: "o1" });
    const other = order({ id: "o2", workshopSlug: "dome-lampshade" });
    const friend = order({ id: "o3", email: "friend@example.com" });
    expect(ids(dueUnpaidReminders([elka, other, friend], nobody))).toEqual([
      "o1",
      "o2",
      "o3",
    ]);
  });
});
