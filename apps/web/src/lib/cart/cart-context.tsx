"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { z } from "zod";

/** Больше одного изделия в заказе сервер не примет. */
export const MAX_CART_QUANTITY = 99;

const cartItemSchema = z.object({
  productSlug: z.string().min(1),
  ozonSku: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  name: z.string().min(1),
  image: z.string(),
  price: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  quantity: z.number().int().positive().max(MAX_CART_QUANTITY),
});

export type CartItem = z.infer<typeof cartItemSchema>;

/** Свежие данные каталога по одному товару из корзины. */
export interface CatalogUpdate {
  productSlug: string;
  ozonSku: number;
  name: string;
  image: string;
  /** В копейках */
  price: number;
  /** Верхняя граница количества: остаток на складе */
  maxQuantity: number;
}

interface CartContextValue {
  items: CartItem[];
  /** Корзина прочитана из localStorage; до этого items пуст не потому, что корзина пуста. */
  hydrated: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  remove: (productSlug: string) => void;
  setQty: (productSlug: string, quantity: number) => void;
  clear: () => void;
  /** Подставляет актуальные цены и ограничивает количество остатком. */
  syncWithCatalog: (updates: CatalogUpdate[]) => void;
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
    const bySlug = new Map<string, CartItem>();
    for (const entry of parsed) {
      const result = cartItemSchema.safeParse(entry);
      if (!result.success) continue;
      const existing = bySlug.get(result.data.productSlug);
      bySlug.set(
        result.data.productSlug,
        existing
          ? {
              ...existing,
              quantity: clampQuantity(existing.quantity + result.data.quantity),
            }
          : result.data,
      );
    }
    return [...bySlug.values()];
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

  useEffect(() => {
    setItems(readStoredCart());
    setHydrated(true);
  }, []);

  // Корзина, изменённая в соседней вкладке, не должна затираться этой.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setItems(readStoredCart());
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

  const add = useCallback<CartContextValue["add"]>((item, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productSlug === item.productSlug);
      if (existing) {
        return prev.map((i) =>
          i.productSlug === item.productSlug
            ? { ...i, quantity: clampQuantity(i.quantity + quantity) }
            : i,
        );
      }
      return [...prev, { ...item, quantity: clampQuantity(quantity) }];
    });
  }, []);

  const remove = useCallback((productSlug: string) => {
    setItems((prev) => prev.filter((i) => i.productSlug !== productSlug));
  }, []);

  const setQty = useCallback((productSlug: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.productSlug !== productSlug);
      }
      return prev.map((i) =>
        i.productSlug === productSlug
          ? { ...i, quantity: clampQuantity(quantity) }
          : i,
      );
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const syncWithCatalog = useCallback((updates: CatalogUpdate[]) => {
    const bySlug = new Map(updates.map((u) => [u.productSlug, u]));
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const fresh = bySlug.get(item.productSlug);
        if (!fresh) return item;
        const merged: CartItem = {
          ...item,
          ozonSku: fresh.ozonSku,
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
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  );
  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      hydrated,
      add,
      remove,
      setQty,
      clear,
      syncWithCatalog,
      subtotal,
      count,
    }),
    [
      items,
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
