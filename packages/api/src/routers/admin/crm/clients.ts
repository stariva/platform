import { ORPCError } from "@orpc/server";
import {
  adCampaigns,
  crmClients,
  crmSales,
  type Database,
  eq,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { toKopecks } from "../orders/stage-math";
import { loadCrm } from "./load";
import {
  type Client,
  findClient,
  normalizeEmail,
  normalizePhone,
  sourceKey,
} from "./model";
import { daySchema } from "./report";
import {
  byId,
  clientSummary,
  dealView,
  isUniqueViolation,
  rubles,
  sourceView,
} from "./shape";

const keySchema = z.string().trim().min(1).max(200);

/**
 * Клиенты, недавние сверху. Поиск — по имени, телефону и почте; фильтр — по
 * источнику (ключ из сводки: c:<кампания>, u:<метка>, none).
 *
 * @example client.admin.crm.clients({ query: "анна", source: "none", limit: 50, offset: 0 })
 */
export const clients = adminProcedure
  .input(
    z.object({
      query: z.string().trim().max(100).optional(),
      source: z.string().trim().max(300).optional(),
      buyersOnly: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const { campaigns, clients: all } = await loadCrm(context.db);
    const campaignsById = byId(campaigns);

    const query = input.query?.toLowerCase();
    const digits = input.query?.replace(/\D/g, "");
    const matches = (client: Client) =>
      !query ||
      client.name.toLowerCase().includes(query) ||
      client.emails.some((email) => email.includes(query)) ||
      (digits !== undefined &&
        digits.length >= 3 &&
        client.phones.some((phone) => phone.includes(digits)));

    const found = all
      .filter(
        (client) =>
          matches(client) &&
          (!input.source || sourceKey(client.source) === input.source) &&
          (!input.buyersOnly || client.revenue > 0),
      )
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    // Источники для фильтра: все, что встречаются у клиентов, и кампании
    const sources = new Map<string, ReturnType<typeof sourceView>>();
    for (const campaign of campaigns) {
      const view = sourceView(
        { kind: "campaign", campaignId: campaign.id, manual: false },
        campaignsById,
      );
      sources.set(view.key, view);
    }
    for (const client of all) {
      const view = sourceView(client.source, campaignsById);
      if (!sources.has(view.key)) sources.set(view.key, view);
    }

    return {
      items: found
        .slice(input.offset, input.offset + input.limit)
        .map((client) => clientSummary(client, campaignsById)),
      total: found.length,
      sources: [...sources.values()],
    };
  });

/** Карточка клиента: контакты, источник, все заказы, записи и ручные продажи. */
export const client = adminProcedure
  .input(z.object({ key: keySchema }))
  .handler(async ({ context, input }) => {
    const { campaigns, clients: all, sales } = await loadCrm(context.db);
    const found = findClient(all, input.key);
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Клиент не найден" });
    }
    const campaignsById = byId(campaigns);
    const requests = new Map(
      sales.map((sale) => [sale.id, sale.requestNumber]),
    );
    return {
      ...clientSummary(found, campaignsById),
      record: found.record && {
        id: found.record.id,
        phone: found.record.phone,
        email: found.record.email,
        sourceManual: found.record.sourceManual,
        campaignId: found.record.campaignId,
        notes: found.record.notes,
      },
      userIds: found.userIds,
      touch: found.touch,
      deals: found.deals.map((deal) => ({
        ...dealView(deal),
        requestNumber:
          deal.kind === "manual" ? (requests.get(deal.id) ?? null) : null,
      })),
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        archived: campaign.archived,
      })),
    };
  });

const sourceSchema = z.union([
  z.literal("auto"),
  z.literal("none"),
  z.object({ campaignId: z.string().min(1) }),
]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

/** Строка карточки из полей формы; телефон и почта — в нормальном виде. */
async function cardFields(
  db: Database,
  input: {
    name: string;
    phone: string | null;
    email: string | null;
    source: z.infer<typeof sourceSchema>;
    notes: string | null;
  },
) {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (input.phone && !phone) {
    throw new ORPCError("BAD_REQUEST", { message: "Телефон не распознан" });
  }
  if (input.email && !email) {
    throw new ORPCError("BAD_REQUEST", { message: "Почта не распознана" });
  }
  let campaignId: string | null = null;
  if (typeof input.source === "object") {
    const [campaign] = await db
      .select({ id: adCampaigns.id })
      .from(adCampaigns)
      .where(eq(adCampaigns.id, input.source.campaignId));
    if (!campaign) {
      throw new ORPCError("BAD_REQUEST", { message: "Кампания не найдена" });
    }
    campaignId = campaign.id;
  }
  return {
    name: input.name,
    phone,
    email,
    sourceManual: input.source !== "auto",
    campaignId,
    notes: input.notes,
  };
}

/** Сообщение о занятом телефоне или почте; null для остальных ошибок. */
function conflictMessage(error: unknown): string | null {
  if (isUniqueViolation(error, "crm_clients_phone_idx")) {
    return "Карточка с этим телефоном уже есть — найдите клиента в списке";
  }
  if (isUniqueViolation(error, "crm_clients_email_idx")) {
    return "Карточка с этой почтой уже есть — найдите клиента в списке";
  }
  return null;
}

/**
 * Создаёт карточку клиента (без key) или сохраняет имя, контакты, источник и
 * заметки. Клиент с сайта получает карточку при первом сохранении. Источник:
 * auto — по UTM-метке первого заказа, none — не с рекламы, или кампания.
 */
export const saveClient = adminProcedure
  .input(
    z.object({
      key: keySchema.optional(),
      name: z.string().trim().min(1).max(120),
      phone: optionalText(40),
      email: optionalText(200),
      source: sourceSchema,
      notes: optionalText(4000),
    }),
  )
  .handler(async ({ context, input }) => {
    const fields = await cardFields(context.db, input);

    try {
      if (input.key) {
        const { clients: all } = await loadCrm(context.db);
        const found = findClient(all, input.key);
        if (!found) {
          throw new ORPCError("NOT_FOUND", { message: "Клиент не найден" });
        }
        if (found.record) {
          await context.db
            .update(crmClients)
            .set(fields)
            .where(eq(crmClients.id, found.record.id));
          return { key: found.record.id };
        }
        // Клиент с сайта: карточка наследует контакты из заказов
        const [created] = await context.db
          .insert(crmClients)
          .values({
            ...fields,
            phone: fields.phone ?? found.phones[0] ?? null,
            email: fields.email ?? found.emails[0] ?? null,
          })
          .returning({ id: crmClients.id });
        return { key: created?.id ?? input.key };
      }

      const [created] = await context.db
        .insert(crmClients)
        .values(fields)
        .returning({ id: crmClients.id });
      if (!created) throw new Error("crm_client_insert_failed");
      return { key: created.id };
    } catch (error) {
      const message = conflictMessage(error);
      if (message) throw new ORPCError("CONFLICT", { message });
      throw error;
    }
  });

/**
 * Удаляет карточку и ручные продажи. Заказы с сайта остаются, и клиент
 * по ним по-прежнему виден — с источником по UTM-метке.
 */
export const removeClient = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(crmClients)
      .where(eq(crmClients.id, input.id))
      .returning({ id: crmClients.id });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Карточка не найдена" });
    }
    return { id: removed.id };
  });

/** Карточка, к которой пишется заказ: существующая, клиента с сайта или новая. */
async function cardFor(
  db: Database,
  input: {
    key?: string;
    client?: { name: string; phone: string | null; email: string | null };
  },
): Promise<string> {
  const { clients: all } = await loadCrm(db);
  let found: Client | null = null;
  let fresh: { name: string; phone: string | null; email: string | null };

  if (input.key) {
    found = findClient(all, input.key);
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Клиент не найден" });
    }
    fresh = {
      name: found.name,
      phone: found.phones[0] ?? null,
      email: found.emails[0] ?? null,
    };
  } else if (input.client) {
    const phone = normalizePhone(input.client.phone);
    const email = normalizeEmail(input.client.email);
    if (input.client.phone && !phone) {
      throw new ORPCError("BAD_REQUEST", { message: "Телефон не распознан" });
    }
    if (input.client.email && !email) {
      throw new ORPCError("BAD_REQUEST", { message: "Почта не распознана" });
    }
    // Уже заказывал на сайте или заведён раньше — пишем к нему же
    found =
      (phone && findClient(all, `tel-${phone}`)) ||
      (email && findClient(all, `mail-${email}`)) ||
      null;
    fresh = { name: input.client.name, phone, email };
  } else {
    throw new ORPCError("BAD_REQUEST", { message: "Не указан клиент" });
  }

  if (found?.record) return found.record.id;
  try {
    const [created] = await db
      .insert(crmClients)
      .values(fresh)
      .returning({ id: crmClients.id });
    if (!created) throw new Error("crm_client_insert_failed");
    return created.id;
  } catch (error) {
    const message = conflictMessage(error);
    if (message) throw new ORPCError("CONFLICT", { message });
    throw error;
  }
}

/**
 * Заказ мимо корзины сайта: индивидуальный заказ по заявке или из
 * мессенджера, продажа на Авито. Клиента задают ключом карточки или
 * контактами — по ним найдётся уже известный клиент, иначе заведётся новый.
 * Выбранная реклама получает выручку заказа; если источник клиента ещё не
 * известен, она же становится его источником.
 */
export const addSale = adminProcedure
  .input(
    z.object({
      key: keySchema.optional(),
      client: z
        .object({
          name: z.string().trim().min(1).max(120),
          phone: optionalText(40),
          email: optionalText(200),
        })
        .optional(),
      soldOn: daySchema,
      amount: z.number().positive().max(21_474_836.47),
      description: z.string().trim().min(1).max(300),
      campaignId: z.string().min(1).nullable().default(null),
      requestNumber: z.number().int().positive().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    if (input.campaignId) {
      const [campaign] = await context.db
        .select({ id: adCampaigns.id })
        .from(adCampaigns)
        .where(eq(adCampaigns.id, input.campaignId));
      if (!campaign) {
        throw new ORPCError("BAD_REQUEST", { message: "Кампания не найдена" });
      }
    }
    const clientId = await cardFor(context.db, input);

    try {
      const [sale] = await context.db
        .insert(crmSales)
        .values({
          clientId,
          soldOn: input.soldOn,
          amount: toKopecks(input.amount),
          description: input.description,
          campaignId: input.campaignId,
          requestNumber: input.requestNumber ?? null,
        })
        .returning();
      return {
        key: clientId,
        sale: sale && { ...sale, amount: rubles(sale.amount) },
      };
    } catch (error) {
      if (isUniqueViolation(error, "crm_sales_request_idx")) {
        throw new ORPCError("CONFLICT", {
          message: `Заказ по заявке №${input.requestNumber} уже записан`,
        });
      }
      throw error;
    }
  });

/** Заказ, записанный по заявке с сайта, — чтобы не завести его дважды. */
export const saleForRequest = adminProcedure
  .input(z.object({ number: z.number().int().positive() }))
  .handler(async ({ context, input }) => {
    const [sale] = await context.db
      .select({
        id: crmSales.id,
        clientId: crmSales.clientId,
        amount: crmSales.amount,
        soldOn: crmSales.soldOn,
        campaignName: adCampaigns.name,
      })
      .from(crmSales)
      .leftJoin(adCampaigns, eq(adCampaigns.id, crmSales.campaignId))
      .where(eq(crmSales.requestNumber, input.number));
    return sale ? { ...sale, amount: rubles(sale.amount) } : null;
  });

export const removeSale = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(crmSales)
      .where(eq(crmSales.id, input.id))
      .returning({ id: crmSales.id });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Продажа не найдена" });
    }
    return { id: removed.id };
  });
