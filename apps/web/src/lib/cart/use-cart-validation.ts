"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/products";
import { type CartItem, useCart } from "./cart-context";
import {
  type CartValidationLine,
  cartValidationResponseSchema,
} from "./validation";

/** Долгая проверка не должна держать корзину в «Проверяем…» */
const VALIDATION_TIMEOUT_MS = 8000;

export type CartLineState =
  | { status: "unknown" }
  | { status: "available"; maxQuantity: number }
  | { status: "unavailable"; reason: "missing" | "sold_out" };

/**
 * Сверяет корзину с каталогом: обновляет цены, ограничивает количество
 * остатком и сообщает, какие товары уже нельзя купить. Если проверить не
 * удалось, корзина работает как раньше — окончательное слово за сервером
 * при оформлении.
 */
export function useCartValidation() {
  const { items, hydrated, syncWithCatalog } = useCart();
  const [lines, setLines] = useState<Map<string, CartValidationLine>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);

  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;
  const checked = useRef(new Set<string>());

  const slugKey = useMemo(
    () =>
      items
        .map((item) => item.productSlug)
        .sort()
        .join("\n"),
    [items],
  );

  useEffect(() => {
    if (!hydrated || !slugKey) return;
    const slugs = slugKey.split("\n");
    if (slugs.every((slug) => checked.current.has(slug))) return;

    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
          ]),
        });
        if (!res.ok) return;
        const parsed = cartValidationResponseSchema.safeParse(await res.json());
        if (!parsed.success) return;

        for (const slug of slugs) checked.current.add(slug);
        setLines((prev) => {
          const next = new Map(prev);
          for (const line of parsed.data.lines) {
            next.set(line.productSlug, line);
          }
          return next;
        });

        const found = parsed.data.lines.flatMap((line) =>
          line.available ? [line] : [],
        );
        const messages = describeChanges(itemsRef.current, found);
        if (messages.length > 0) setNotices((prev) => [...prev, ...messages]);
        syncWithCatalog(found);
      } catch {
        // Сеть или каталог недоступны — оставляем корзину как есть
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
      setLoading(false);
    };
  }, [hydrated, slugKey, syncWithCatalog]);

  const states = useMemo(() => {
    const map = new Map<string, CartLineState>();
    for (const item of items) {
      const line = lines.get(item.productSlug);
      map.set(
        item.productSlug,
        !line
          ? { status: "unknown" }
          : line.available
            ? { status: "available", maxQuantity: line.maxQuantity }
            : { status: "unavailable", reason: line.reason },
      );
    }
    return map;
  }, [items, lines]);

  return {
    states,
    loading,
    notices,
    dismissNotices: () => setNotices([]),
  };
}

/** Что изменилось в корзине из-за новых цен и остатков — по-русски, для покупателя. */
function describeChanges(
  items: CartItem[],
  fresh: Extract<CartValidationLine, { available: true }>[],
): string[] {
  const bySlug = new Map(items.map((item) => [item.productSlug, item]));
  const messages: string[] = [];
  for (const line of fresh) {
    const item = bySlug.get(line.productSlug);
    if (!item) continue;
    if (item.price !== line.price) {
      messages.push(
        `«${line.name}»: цена изменилась с ${formatPrice(item.price / 100)} на ${formatPrice(line.price / 100)}`,
      );
    }
    if (item.quantity > line.maxQuantity) {
      messages.push(
        `«${line.name}»: в наличии только ${line.maxQuantity} шт. — количество уменьшено`,
      );
    }
  }
  return messages;
}
