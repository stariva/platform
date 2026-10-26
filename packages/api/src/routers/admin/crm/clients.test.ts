import { expect, mock, test } from "bun:test";
import {
  crmClients,
  crmSales,
  customOrderRequests,
  productOrders,
} from "@stariva/db";
import { addSale } from "./clients";
import type { ClientRecord } from "./model";

const phone = "79161234567";
const email = "anna@example.com";

function card(id: string, contacts: Partial<ClientRecord> = {}): ClientRecord {
  return {
    id,
    name: "Анна",
    phone: null,
    email: null,
    sourceManual: false,
    campaignId: null,
    notes: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...contacts,
  };
}

/** Only the transaction exposes queries, so both writes must use it. */
function database(
  records: ClientRecord[] = [],
  saleError?: unknown,
  requestLock: Promise<void> = Promise.resolve(),
) {
  const state = {
    records: [...records],
    sales: [] as unknown[],
    orders: [] as { number: number }[],
  };
  const lockRequest = mock(async (mode: string) => {
    expect(mode).toBe("update");
    await requestLock;
    return [{ number: 1042 }];
  });
  const orderLookup = mock(async () => [...state.orders]);
  const insert = mock((table: unknown) => ({
    values: (fields: Record<string, unknown>) => ({
      returning: async () => {
        if (table === crmClients) {
          const created = card("new-card", fields);
          state.records.push(created);
          return [created];
        }
        if (table !== crmSales) throw new Error("Unexpected table");
        if (saleError) throw saleError;
        const sale = { id: "sale", ...fields };
        state.sales.push(sale);
        return [sale];
      },
    }),
  }));
  const tx = {
    select: () => ({
      from: (table: unknown) => {
        if (table === customOrderRequests) {
          return { where: () => ({ for: lockRequest }) };
        }
        const rows = Promise.resolve(table === crmClients ? state.records : []);
        return Object.assign(rows, {
          orderBy: () => rows,
          where: table === productOrders ? orderLookup : () => rows,
          innerJoin: () => ({ leftJoin: () => rows }),
        });
      },
    }),
    insert,
  };
  const transaction = mock(async (fn: (t: typeof tx) => unknown) => {
    const before = { records: [...state.records], sales: [...state.sales] };
    try {
      return await fn(tx);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  });
  return { state, insert, transaction, lockRequest, orderLookup };
}

function sell(
  db: ReturnType<typeof database>,
  contacts: { phone: string | null; email: string | null },
) {
  const handler = addSale["~orpc"].handler;
  return handler({
    context: { db } as unknown as Parameters<typeof handler>[0]["context"],
    input: {
      client: { name: "Анна", ...contacts },
      soldOn: "2026-10-14",
      amount: 123.45,
      description: "Индивидуальный заказ",
      campaignId: null,
      requestNumber: 1042,
    },
    path: [],
    procedure: addSale,
    errors: {},
    lastEventId: undefined,
  });
}

test("sale rejects phone and email belonging to different clients", async () => {
  const db = database([
    card("phone-card", { phone }),
    card("email-card", { email }),
  ]);
  await expect(
    sell(db, { phone: "+7 (916) 123-45-67", email: "ANNA@EXAMPLE.COM" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.state.sales).toHaveLength(0);
});

test.each([
  { phone: "+7 (916) 123-45-67", email: "ANNA@EXAMPLE.COM" },
  { phone: "8 916 123 45 67", email: null },
  { phone: null, email: "ANNA@EXAMPLE.COM" },
  { phone: "79990000000", email: "ANNA@EXAMPLE.COM" },
  { phone: "+7 (916) 123-45-67", email: "new@example.com" },
])("sale reuses a matching card for %j", async (contacts) => {
  const db = database([card("existing", { phone, email })]);
  await expect(sell(db, contacts)).resolves.toMatchObject({
    key: "existing",
    sale: { clientId: "existing", amount: 123.45, requestNumber: 1042 },
  });
  expect(db.state.records).toHaveLength(1);
  expect(db.state.sales).toHaveLength(1);
});

test("sale commits a new card and its sale together", async () => {
  const db = database();
  await expect(
    sell(db, { phone: "+7 (916) 123-45-67", email: "ANNA@EXAMPLE.COM" }),
  ).resolves.toMatchObject({
    key: "new-card",
    sale: { clientId: "new-card", amount: 123.45 },
  });
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(db.state.records).toMatchObject([{ phone, email }]);
  expect(db.state.sales).toMatchObject([{ amount: 12345 }]);
});

test("sale sees an invoice committed while waiting for the request lock", async () => {
  const lock = Promise.withResolvers<void>();
  const db = database([], undefined, lock.promise);
  const result = sell(db, { phone, email });
  await Promise.resolve();
  const waiting = {
    lockCalls: db.lockRequest.mock.calls.length,
    orderLookups: db.orderLookup.mock.calls.length,
    writes: db.insert.mock.calls.length,
  };
  db.state.orders.push({ number: 2001 });
  lock.resolve();

  await expect(result).rejects.toMatchObject({
    code: "CONFLICT",
    message: "По заявке №1042 уже выставлен счёт — заказ №2001",
  });
  expect(waiting).toEqual({ lockCalls: 1, orderLookups: 0, writes: 0 });
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.state.records).toHaveLength(0);
  expect(db.state.sales).toHaveLength(0);
});

test("duplicate request rolls back the newly created card", async () => {
  const db = database([], {
    cause: { code: "23505", constraint: "crm_sales_request_idx" },
  });
  await expect(sell(db, { phone, email })).rejects.toMatchObject({
    code: "CONFLICT",
    message: "Заказ по заявке №1042 уже записан",
  });
  expect(db.insert).toHaveBeenCalledTimes(2);
  expect(db.state.records).toHaveLength(0);
  expect(db.state.sales).toHaveLength(0);
});

test("other sale failures roll back the new card and propagate", async () => {
  const error = new Error("database unavailable");
  const db = database([], error);
  await expect(sell(db, { phone, email })).rejects.toBe(error);
  expect(db.insert).toHaveBeenCalledTimes(2);
  expect(db.state.records).toHaveLength(0);
  expect(db.state.sales).toHaveLength(0);
});
