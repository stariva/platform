import { ORPCError } from "@orpc/server";
import {
  and,
  businessExpenses as businessExpensesTable,
  crmSales,
  desc,
  eq,
  financeSettings as financeSettingsTable,
  gte,
  lte,
  orderCosts as orderCostsTable,
  productOrders,
} from "@stariva/db";
import type {
  BusinessExpenseCategory,
  OrderCostCategory,
} from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { toKopecks } from "../orders/stage-math";
import {
  COST_CATEGORIES,
  type CostCategory,
  economicsBy,
  type FinanceRates,
  itemMargins,
  orderEconomics,
  type PeriodEconomics,
  profitReport,
} from "./economics";
import { loadCrm } from "./load";
import { loadWork, periodOf } from "./orders";
import { daySchema, rubles } from "./shape";
import { lastMonths } from "./work";

const LINE_CATEGORIES = [
  "materials",
  "packaging",
  "shipping",
  "acquiring",
  "tax",
  "other",
] as const satisfies readonly OrderCostCategory[];

const EXPENSE_CATEGORIES = [
  "services",
  "equipment",
  "content",
  "education",
  "other",
] as const satisfies readonly BusinessExpenseCategory[];

const MAX_RUBLES = 21_474_836.47;

const note = z
  .string()
  .trim()
  .max(300)
  .transform((value) => value || null);

const ratesView = (rates: FinanceRates) => ({
  acquiring: rates.acquiring / 100,
  tax: rates.tax / 100,
});

/**
 * Затраты и прибыль одного заказа для его карточки: строки, внесённые вручную,
 * и суммы, посчитанные сами.
 *
 * @example client.admin.crm.orderCosts({ kind: "product", id })
 */
export const orderCosts = adminProcedure
  .input(
    z.object({ kind: z.enum(["product", "manual"]), id: z.string().min(1) }),
  )
  .handler(async ({ context, input }) => {
    const now = new Date();
    const { orders, rates } = await loadWork(context.db, now);
    const order = orders.find(
      (row) => row.kind === input.kind && row.id === input.id,
    );
    if (!order) {
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    }
    const economics = orderEconomics(order, rates, now);
    const auto = COST_CATEGORIES.map((category) => ({
      category,
      amount: economics.entries
        .filter((e) => e.category === category && e.lineId === null)
        .reduce((sum, e) => sum + e.amount, 0),
    })).filter((row) => row.amount > 0);
    return {
      revenue: rubles(economics.revenue),
      costs: rubles(economics.costs),
      profit: rubles(economics.profit),
      expected: economics.expected,
      missingMaterials: economics.missingMaterials,
      lines: order.costLines
        .map((line) => ({ ...line, amount: rubles(line.amount) }))
        .sort((a, b) => a.spentOn.localeCompare(b.spentOn)),
      auto: auto.map((row) => ({ ...row, amount: rubles(row.amount) })),
      rates: ratesView(rates),
    };
  });

/** Записывает затрату по заказу; сумма 0 — материалы не тратились. */
export const addOrderCost = adminProcedure
  .input(
    z.object({
      kind: z.enum(["product", "manual"]),
      orderId: z.string().min(1),
      category: z.enum(LINE_CATEGORIES),
      spentOn: daySchema,
      amount: z.number().min(0).max(MAX_RUBLES),
      note,
    }),
  )
  .handler(async ({ context, input }) => {
    const table = input.kind === "product" ? productOrders : crmSales;
    const [found] = await context.db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, input.orderId));
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    }
    const [cost] = await context.db
      .insert(orderCostsTable)
      .values({
        productOrderId: input.kind === "product" ? found.id : null,
        saleId: input.kind === "manual" ? found.id : null,
        category: input.category,
        spentOn: input.spentOn,
        amount: toKopecks(input.amount),
        note: input.note,
      })
      .returning({ id: orderCostsTable.id });
    return { id: cost?.id ?? null };
  });

export const removeOrderCost = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(orderCostsTable)
      .where(eq(orderCostsTable.id, input.id))
      .returning({ id: orderCostsTable.id });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Затрата не найдена" });
    }
    return { id: removed.id };
  });

/**
 * Постоянные расходы за период, новые сверху. `to` — последний день включительно.
 *
 * @example client.admin.crm.businessExpenses({ from: "2026-10-01", to: "2026-10-31" })
 */
export const businessExpenses = adminProcedure
  .input(z.object({ from: daySchema.optional(), to: daySchema.optional() }))
  .handler(async ({ context, input }) => {
    const rows = await context.db
      .select()
      .from(businessExpensesTable)
      .where(
        and(
          input.from
            ? gte(businessExpensesTable.spentOn, input.from)
            : undefined,
          input.to ? lte(businessExpensesTable.spentOn, input.to) : undefined,
        ),
      )
      .orderBy(
        desc(businessExpensesTable.spentOn),
        desc(businessExpensesTable.createdAt),
      );
    return {
      items: rows.map((row) => ({
        id: row.id,
        category: row.category,
        spentOn: row.spentOn,
        amount: rubles(row.amount),
        note: row.note,
      })),
      total: rubles(rows.reduce((sum, row) => sum + row.amount, 0)),
    };
  });

export const addBusinessExpense = adminProcedure
  .input(
    z.object({
      category: z.enum(EXPENSE_CATEGORIES),
      spentOn: daySchema,
      amount: z.number().positive().max(MAX_RUBLES),
      note,
    }),
  )
  .handler(async ({ context, input }) => {
    const [expense] = await context.db
      .insert(businessExpensesTable)
      .values({ ...input, amount: toKopecks(input.amount) })
      .returning({ id: businessExpensesTable.id });
    return { id: expense?.id ?? null };
  });

export const removeBusinessExpense = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(businessExpensesTable)
      .where(eq(businessExpensesTable.id, input.id))
      .returning({ id: businessExpensesTable.id });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Расход не найден" });
    }
    return { id: removed.id };
  });

/** Ставки эквайринга и налога в процентах. */
export const financeSettings = adminProcedure.handler(async ({ context }) => {
  const { rates } = await loadCrm(context.db);
  return ratesView(rates);
});

const percent = z.number().min(0).max(100);

export const saveFinanceSettings = adminProcedure
  .input(z.object({ acquiring: percent, tax: percent }))
  .handler(async ({ context, input }) => {
    const values = {
      acquiringRate: Math.round(input.acquiring * 100),
      taxRate: Math.round(input.tax * 100),
    };
    await context.db
      .insert(financeSettingsTable)
      .values(values)
      .onConflictDoUpdate({ target: financeSettingsTable.id, set: values });
    return input;
  });

/** Строка разбивки в рублях: выручка, затраты, что осталось. */
const economicsView = (row: PeriodEconomics) => ({
  revenue: rubles(row.revenue),
  costs: rubles(row.totalCosts),
  margin: rubles(row.revenue - row.totalCosts),
  paidOrders: row.paidOrders,
  missingOrders: row.missingOrders,
});

const costsView = (costs: Record<CostCategory, number>) =>
  COST_CATEGORIES.map((category) => ({
    category,
    amount: rubles(costs[category]),
  }));

/**
 * Прибыль за период: от выручки через затраты на заказы, рекламу и постоянные
 * расходы к чистой прибыли; помесячно за год, по площадкам, видам заказов и
 * изделиям. `to` — последний день включительно.
 *
 * @example client.admin.crm.profit({ from: "2026-10-01", to: "2026-10-31" })
 */
export const profit = adminProcedure
  .input(z.object({ from: daySchema.optional(), to: daySchema.optional() }))
  .handler(async ({ context, input }) => {
    const now = new Date();
    const [{ orders, rates, expenses }, overheads] = await Promise.all([
      loadWork(context.db, now),
      context.db
        .select({
          spentOn: businessExpensesTable.spentOn,
          amount: businessExpensesTable.amount,
        })
        .from(businessExpensesTable),
    ]);
    const period = periodOf(input);
    const summary = profitReport(orders, rates, expenses, overheads, period);

    const breakdown = <K extends string>(
      key: (order: (typeof orders)[number]) => K,
    ) =>
      [...economicsBy(orders, rates, period, key)]
        .filter(([, row]) => row.revenue > 0 || row.totalCosts > 0)
        .map(([name, row]) => ({ key: name, ...economicsView(row) }))
        .sort((a, b) => b.revenue - a.revenue);

    return {
      revenue: rubles(summary.revenue),
      costs: costsView(summary.costs),
      totalCosts: rubles(summary.totalCosts),
      margin: rubles(summary.margin),
      adSpend: rubles(summary.adSpend),
      overhead: rubles(summary.overhead),
      net: rubles(summary.net),
      paidOrders: summary.paidOrders,
      missingOrders: summary.missingOrders,
      missingRevenue: rubles(summary.missingRevenue),
      months: lastMonths(now, 12).map(({ month, period: range }) => {
        const row = profitReport(orders, rates, expenses, overheads, range);
        return {
          month,
          revenue: rubles(row.revenue),
          costs: rubles(row.totalCosts),
          margin: rubles(row.margin),
          adSpend: rubles(row.adSpend),
          overhead: rubles(row.overhead),
          net: rubles(row.net),
          missingOrders: row.missingOrders,
        };
      }),
      byChannel: breakdown((order) => order.channel),
      byType: breakdown((order) => order.type),
      items: itemMargins(orders, rates, period)
        .slice(0, 15)
        .map((row) => ({
          name: row.name,
          orders: row.orders,
          quantity: row.quantity,
          revenue: rubles(row.revenue),
          countedOrders: row.countedOrders,
          countedRevenue: rubles(row.countedRevenue),
          countedCosts: rubles(row.countedCosts),
        })),
    };
  });
