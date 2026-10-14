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
    const { campaigns, clients: all } = await loadCrm(context.db);
    const found = findClient(all, input.key);
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Клиент не найден" });
    }
    const campaignsById = byId(campaigns);
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
      deals: found.deals.map(dealView),
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
    if (!fields.phone && !fields.email && !input.key) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Укажите телефон или почту — по ним клиент склеится с заказами",
      });
    }

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

/**
 * Продажа мимо сайта. Клиенту с сайта без карточки она заводится сама —
 * с контактами из заказов и источником по метке.
 */
export const addSale = adminProcedure
  .input(
    z.object({
      key: keySchema,
      soldOn: daySchema,
      amount: z.number().positive().max(10_000_000),
      description: z.string().trim().min(1).max(300),
    }),
  )
  .handler(async ({ context, input }) => {
    const { clients: all } = await loadCrm(context.db);
    const found = findClient(all, input.key);
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Клиент не найден" });
    }
    let clientId = found.record?.id;
    if (!clientId) {
      try {
        const [created] = await context.db
          .insert(crmClients)
          .values({
            name: found.name,
            phone: found.phones[0] ?? null,
            email: found.emails[0] ?? null,
          })
          .returning({ id: crmClients.id });
        clientId = created?.id;
      } catch (error) {
        const message = conflictMessage(error);
        if (message) throw new ORPCError("CONFLICT", { message });
        throw error;
      }
    }
    if (!clientId) throw new Error("crm_client_insert_failed");

    const [sale] = await context.db
      .insert(crmSales)
      .values({
        clientId,
        soldOn: input.soldOn,
        amount: toKopecks(input.amount),
        description: input.description,
      })
      .returning();
    return {
      key: clientId,
      sale: sale && { ...sale, amount: rubles(sale.amount) },
    };
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
