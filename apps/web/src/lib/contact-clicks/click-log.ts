import { db } from "@stariva/db";
import {
  type CampaignAttribution,
  CONTACT_CHANNELS,
  contactClicks,
  type SessionEntry,
  type VisitorInfo,
} from "@stariva/db/schema";
import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !/\p{Cc}/u.test(value))
    .optional();

export const entrySchema = z.object({
  landing: z.string().max(200),
  referrer: text(100),
  utm_source: text(120),
  utm_medium: text(120),
  utm_campaign: text(120),
  utm_content: text(120),
  utm_term: text(120),
  yclid: text(120),
  rb_clickid: text(120),
  at: z.iso.datetime(),
}) satisfies z.ZodType<SessionEntry>;

/** Что присылает браузер (lib/contact-clicks/events.ts); лишние поля отбрасываются. */
export const contactClickSchema = z.object({
  // Тот же формат, что cartId в журнале корзин
  browserId: z
    .string()
    .regex(/^[\w-]{8,64}$/)
    .optional(),
  channel: z.enum(CONTACT_CHANNELS),
  source: z
    .string()
    .regex(/^[\w-]{1,60}$/)
    .optional(),
  page: z.string().max(200).optional(),
  // Битый заход не повод терять клик: просто без него
  entry: entrySchema.optional().catch(undefined),
});

export type ContactClickInput = z.infer<typeof contactClickSchema>;

/**
 * Пишет переход в мессенджер в журнал. Не бросает исключений: журнал — для
 * админки, посетителю он не нужен.
 */
export async function recordContactClick(
  click: ContactClickInput,
  {
    userId,
    visitor,
    attribution,
  }: {
    userId: string | null;
    visitor: VisitorInfo;
    attribution: CampaignAttribution | null;
  },
): Promise<void> {
  try {
    await db.insert(contactClicks).values({
      id: crypto.randomUUID(),
      browserId: click.browserId ?? null,
      userId,
      channel: click.channel,
      source: click.source ?? null,
      page: click.page ?? null,
      entry: click.entry ?? null,
      attribution,
      ip: visitor.ip,
      visitor,
    });
  } catch (error) {
    console.error("[contact-clicks] failed to record click", error);
  }
}
