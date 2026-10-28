import type { Product } from "@/lib/catalog/types";

/** Автор идеи просила указывать её имя у изделий, связанных по её задумке. */
const GNOME_IDEA_AUTHOR = "Марина Камбур";

/** Сноска об авторстве идеи: сейчас только у гномов, остальные изделия — авторские. */
export function getIdeaCredit(product: Pick<Product, "name">): string | null {
  return /^гном/i.test(product.name.trim())
    ? `Автор идеи — ${GNOME_IDEA_AUTHOR}.`
    : null;
}
