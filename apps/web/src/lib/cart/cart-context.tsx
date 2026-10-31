"use client";

import type { CartEventAction } from "@stariva/db/schema";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { applyBundlePricing, type WithListPrice } from "@/lib/commerce/bundles";
import { madeToOrderOptionsSchema } from "@/lib/commerce/made-to-order-options";
import { logCartEvent } from "./events";

/** Больше одного изделия в заказе сервер не примет. */
export const MAX_CART_QUANTITY = 99;

/** Готовое изделие со склада или изделие, которое сплетут после оплаты. */
export const fulfillmentTypeSchema = z.enum(["stock", "made_to_order"]);
export type FulfillmentType = z.infer<typeof fulfillmentTypeSchema>;

const cartItemSchema = z.object({
  productSlug: z.string().min(1),
  /** Нет у изделий под заказ: они не проходят через склад Ozon. */
  ozonSku: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  name: z.string().min(1),
  image: z.string(),
  price: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  quantity: z.number().int().positive().max(MAX_CART_QUANTITY),
  // Корзина из старой версии хранит только готовые изделия.
  fulfillmentType: fulfillmentTypeSchema.default("stock"),
  /** Размер и цвет, выбранные на карточке; только для изделий под заказ. */
  options: madeToOrderOptionsSchema.optional(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

/** Позиция корзины с ценой комплекта; `listPrice` — цена без скидки за комплект. */
export type PricedCartItem = WithListPrice<CartItem>;

/**
 * Строка корзины. Готовое изделие — по товару, изделие под заказ — ещё и по
 * размеру и цвету: одно и то же изделие в разных вариантах — разные строки.
 */
export function cartLineKey(
  item: Pick<CartItem, "productSlug" | "fulfillmentType" | "options">,
): string {
  if (item.fulfillmentType === "stock") return `stock:${item.productSlug}`;
  const { size = "", color = "" } = item.options ?? {};
  return `made_to_order:${item.productSlug}:${size}:${color}`;
}

/** Свежие данные каталога по одному товару из корзины. */
export interface CatalogUpdate {
  productSlug: string;
  fulfillmentType: FulfillmentType;
  ozonSku?: number;
  name: string;
  image: string;
  /** В копейках */
  price: number;
  /** Верхняя граница количества: остаток на складе или лимит изделий под заказ */
  maxQuantity: number;
}

interface CartContextValue {
  /** Цены уже с учётом комплектов (два гнома вместе дешевле). */
  items: PricedCartItem[];
  /** Корзина прочитана из localStorage; до этого items пуст не потому, что корзина пуста. */
  hydrated: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  remove: (lineKey: string) => void;
  setQty: (lineKey: string, quantity: number) => void;
  /**
   * Без аргумента очищает всю корзину, с аргументом — только готовые или только
   * изделия под заказ. orderId — корзину очищает оформленный заказ или заявка.
   */
  clear: (fulfillmentType?: FulfillmentType, orderId?: string) => void;
  /** Подставляет актуальные цены и ограничивает количество остатком. */
  syncWithCatalog: (updates: CatalogUpdate[]) => void;
  /**
   * Строки, которые каталог уже не продаёт (`fulfillmentType:productSlug`):
   * в комплект они не входят, иначе оставшийся гном остался бы со скидкой.
   */
  setUnavailableKeys: (keys: ReadonlySet<string>) => void;
  subtotal: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "stariva:cart";

/**
 * Невалидная позиция (например, из старой версии корзины) не должна обнулять
 * остальные: пропускаем только её. Дубликаты склеиваем, как это делает add.
 */
function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const byKey = new Map<string, CartItem>();
    for (const entry of parsed) {
      const result = cartItemSchema.safeParse(entry);
      if (!result.success) continue;
      // Готовое изделие без SKU нельзя заказать — пропускаем, как невалидное
      if (
        result.data.fulfillmentType === "stock" &&
        result.data.ozonSku === undefined
      ) {
        continue;
      }
      const key = cartLineKey(result.data);
      const existing = byKey.get(key);
      byKey.set(
        key,
        existing
          ? {
              ...existing,
              quantity: clampQuantity(existing.quantity + result.data.quantity),
            }
          : result.data,
      );
    }
    return [...byKey.values()];
  } catch {
    return [];
  }
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_CART_QUANTITY);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [unavailableKeys, setUnavailableKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Корзина на этот момент, без ожидания рендера: два изменения подряд
  // (например, убрать несколько раскупленных товаров) видят друг друга, и
  // журнал получает изменение сразу, до ухода на оплату.
  const itemsRef = useRef<CartItem[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    itemsRef.current = readStoredCart();
    hydratedRef.current = true;
    setItems(itemsRef.current);
    setHydrated(true);
  }, []);

  // Корзина, изменённая в соседней вкладке, не должна затираться этой.
  // В журнал её уже записала та вкладка.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        itemsRef.current = readStoredCart();
        setItems(itemsRef.current);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage может быть недоступен (приватный режим и т.п.) — не критично
    }
  }, [items, hydrated]);

  /** Применяет изменение и отправляет его в журнал корзин. */
  const commit = useCallback(
    (
      action: CartEventAction,
      update: (prev: CartItem[]) => CartItem[],
      orderId?: string,
    ) => {
      const prev = itemsRef.current;
      const next = update(prev);
      if (next === prev && !orderId) return;
      itemsRef.current = next;
      setItems(next);
      if (hydratedRef.current) {
        logCartEvent({ action, before: prev, after: next, orderId });
      }
    },
    [],
  );

  const add = useCallback<CartContextValue["add"]>(
    (item, quantity = 1) => {
      const key = cartLineKey(item);
      commit("add", (prev) => {
        const existing = prev.find((i) => cartLineKey(i) === key);
        if (existing) {
          return prev.map((i) =>
            cartLineKey(i) === key
              ? { ...i, quantity: clampQuantity(i.quantity + quantity) }
              : i,
          );
        }
        return [...prev, { ...item, quantity: clampQuantity(quantity) }];
      });
    },
    [commit],
  );

  const remove = useCallback(
    (lineKey: string) => {
      commit("remove", (prev) =>
        prev.filter((i) => cartLineKey(i) !== lineKey),
      );
    },
    [commit],
  );

  const setQty = useCallback(
    (lineKey: string, quantity: number) => {
      commit(quantity <= 0 ? "remove" : "quantity", (prev) => {
        if (quantity <= 0) {
          return prev.filter((i) => cartLineKey(i) !== lineKey);
        }
        return prev.map((i) =>
          cartLineKey(i) === lineKey
            ? { ...i, quantity: clampQuantity(quantity) }
            : i,
        );
      });
    },
    [commit],
  );

  const clear = useCallback<CartContextValue["clear"]>(
    (fulfillmentType, orderId) => {
      commit(
        orderId ? "order" : "clear",
        (prev) =>
          fulfillmentType
            ? prev.filter((i) => i.fulfillmentType !== fulfillmentType)
            : [],
        orderId,
      );
    },
    [commit],
  );

  const syncWithCatalog = useCallback(
    (updates: CatalogUpdate[]) => {
      const byProduct = new Map(
        updates.map((u) => [`${u.fulfillmentType}:${u.productSlug}`, u]),
      );
      commit("sync", (prev) => {
        let changed = false;
        const next = prev.map((item) => {
          const fresh = byProduct.get(
            `${item.fulfillmentType}:${item.productSlug}`,
          );
          if (!fresh) return item;
          const merged: CartItem = {
            ...item,
            ozonSku: fresh.ozonSku ?? item.ozonSku,
            name: fresh.name,
            // Пустую картинку из каталога не подставляем поверх рабочей
            image: fresh.image || item.image,
            price: fresh.price,
            quantity: Math.min(item.quantity, Math.max(fresh.maxQuantity, 1)),
          };
          if (
            merged.ozonSku !== item.ozonSku ||
            merged.name !== item.name ||
            merged.image !== item.image ||
            merged.price !== item.price ||
            merged.quantity !== item.quantity
          ) {
            changed = true;
            return merged;
          }
          return item;
        });
        return changed ? next : prev;
      });
    },
    [commit],
  );

  // В хранилище и журнале лежат цены каталога, комплект считаем на лету
  const pricedItems = useMemo(() => {
    const live = items.filter(
      (item) =>
        !unavailableKeys.has(`${item.fulfillmentType}:${item.productSlug}`),
    );
    const priced = new Map(
      applyBundlePricing(live).map((item) => [cartLineKey(item), item]),
    );
    return items.map((item) => priced.get(cartLineKey(item)) ?? item);
  }, [items, unavailableKeys]);
  const subtotal = useMemo(
    () => pricedItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [pricedItems],
  );
  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items: pricedItems,
      hydrated,
      add,
      remove,
      setQty,
      clear,
      syncWithCatalog,
      setUnavailableKeys,
      subtotal,
      count,
    }),
    [
      pricedItems,
      hydrated,
      add,
      remove,
      setQty,
      clear,
      syncWithCatalog,
      subtotal,
      count,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
