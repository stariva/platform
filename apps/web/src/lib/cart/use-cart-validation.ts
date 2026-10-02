"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/products";
import { type CartItem, cartLineKey, useCart } from "./cart-context";
import {
  type CartValidationLine,
  cartValidationResponseSchema,
  validationLineKey,
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
 * при оформлении. Состояния отдаются по ключу строки корзины (`cartLineKey`).
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

  // Проверяем товар, а не строку: размеры и цвета одного изделия на цену не влияют
  const productKey = useMemo(
    () =>
      [
        ...new Set(
          items.map((item) =>
            validationLineKey({
              productSlug: item.productSlug,
              fulfillmentType: item.fulfillmentType,
            }),
          ),
        ),
      ]
        .sort()
        .join("\n"),
    [items],
  );

  useEffect(() => {
    if (!hydrated) return;
    const keys = productKey ? productKey.split("\n") : [];
    const currentKeys = new Set(keys);
    for (const key of checked.current) {
      if (!currentKeys.has(key)) checked.current.delete(key);
    }
    if (keys.length === 0 || keys.every((key) => checked.current.has(key)))
      return;

    const requestLines = keys.map((key) => {
      const separator = key.indexOf(":");
      return {
        fulfillmentType: key.slice(0, separator),
        productSlug: key.slice(separator + 1),
      };
    });

    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: requestLines }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
          ]),
        });
        if (!res.ok) return;
        const parsed = cartValidationResponseSchema.safeParse(await res.json());
        if (!parsed.success) return;

        for (const key of keys) checked.current.add(key);
        setLines((prev) => {
          const next = new Map(prev);
          for (const line of parsed.data.lines) {
            next.set(validationLineKey(line), line);
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
  }, [hydrated, productKey, syncWithCatalog]);

  const states = useMemo(() => {
    const map = new Map<string, CartLineState>();
    for (const item of items) {
      const line = lines.get(validationLineKey(item));
      map.set(
        cartLineKey(item),
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
  const messages: string[] = [];
  for (const line of fresh) {
    const key = validationLineKey(line);
    const matching = items.filter((item) => validationLineKey(item) === key);
    const [item] = matching;
    if (!item) continue;
    if (item.price !== line.price) {
      messages.push(
        `«${line.name}»: цена изменилась с ${formatPrice(item.price / 100)} на ${formatPrice(line.price / 100)}`,
      );
    }
    if (matching.some((i) => i.quantity > line.maxQuantity)) {
      messages.push(
        line.fulfillmentType === "made_to_order"
          ? `«${line.name}»: под заказ можно не больше ${line.maxQuantity} шт. — количество уменьшено`
          : `«${line.name}»: в наличии только ${line.maxQuantity} шт. — количество уменьшено`,
      );
    }
  }
  return messages;
}
