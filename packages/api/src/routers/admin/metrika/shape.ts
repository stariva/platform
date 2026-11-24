import { z } from "zod";

/** День в формате «2026-10-13». */
export const daySchema = z.iso.date();

export const periodSchema = z.object({
  from: daySchema.optional(),
  to: daySchema.optional(),
});

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const querySchema = z.string().trim().max(100).optional();

/** Экранирует % и _ в поисковой строке, чтобы они искались как обычные символы. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
