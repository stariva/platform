"use client";

import {
  CheckIcon,
  GiftIcon,
  PackageIcon,
  PackageOpenIcon,
  ShoppingBagIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { reachGoal, trackProductEvent } from "@/lib/analytics";
import {
  type CartItem,
  MAX_CART_QUANTITY,
  useCart,
} from "@/lib/cart/cart-context";
import { flyToCart } from "@/lib/cart/fly-to-cart";
import {
  type NewYearConfiguratorProduct,
  newYearProductImage,
  ornamentDetailForSlug,
  ornamentSets,
} from "@/lib/new-year";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

const ADDED_MS = 1800;

type Mode = "custom" | "set";

interface NewYearConfiguratorProps {
  ornaments: NewYearConfiguratorProduct[];
  sets: NewYearConfiguratorProduct[];
  boxes: NewYearConfiguratorProduct[];
  catalogUnavailable: boolean;
}

function purchasable(product: NewYearConfiguratorProduct): boolean {
  return Boolean(
    product.inStock &&
      product.stockAvailable >= 1 &&
      product.currency === "RUB" &&
      typeof product.ozonSku === "number" &&
      Number.isSafeInteger(product.ozonSku) &&
      product.ozonSku > 0,
  );
}

function cartLine(
  product: NewYearConfiguratorProduct,
): Omit<CartItem, "quantity"> {
  return {
    productId: product.id,
    productSlug: product.slug,
    fulfillmentType: "stock",
    ozonSku: product.ozonSku as number,
    name: product.name,
    image: newYearProductImage(product),
    price: Math.round(product.price * 100),
  };
}

function fallbackSetDescription(slug: string): string {
  return (
    ornamentSets.find((set) => set.slug === slug)?.description ??
    "Готовое сочетание украшений из новогодней коллекции."
  );
}

function stockLabel(product: NewYearConfiguratorProduct): string {
  if (!purchasable(product)) return "Нет в наличии";
  return product.stockAvailable === 1
    ? "Осталась 1 штука"
    : `В наличии: ${product.stockAvailable}`;
}

function pluralFigurines(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "фигурка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "фигурки";
  }
  return "фигурок";
}

function ModeButton({
  active,
  title,
  text,
  onClick,
}: {
  active: boolean;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-20 flex-1 rounded-2xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-espresso",
        active
          ? "border-espresso bg-espresso text-parchment shadow-[0_18px_44px_-26px_rgba(22,21,19,0.7)]"
          : "border-espresso/12 bg-white/55 text-espresso hover:border-espresso/35 hover:bg-white",
      )}
    >
      <span className="block font-serif text-xl leading-tight">{title}</span>
      <span
        className={cn(
          "mt-1 block text-sm leading-snug",
          active ? "text-parchment/70" : "text-taupe",
        )}
      >
        {text}
      </span>
    </button>
  );
}

function ProductImage({
  product,
  className,
  sizes,
}: {
  product: NewYearConfiguratorProduct;
  className?: string;
  sizes: string;
}) {
  return (
    <Image
      src={newYearProductImage(product)}
      alt={product.name}
      width={360}
      height={360}
      sizes={sizes}
      className={cn("object-contain", className)}
    />
  );
}

function OrnamentCard({
  product,
  selected,
  disabled,
  onToggle,
}: {
  product: NewYearConfiguratorProduct;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "group relative flex min-h-full flex-col rounded-2xl border p-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-espresso disabled:cursor-not-allowed disabled:opacity-55",
        selected
          ? "border-[var(--ny-accent)] bg-white shadow-[0_18px_44px_-28px_rgba(165,33,39,0.55)]"
          : "border-espresso/10 bg-white/55 hover:border-espresso/30 hover:bg-white",
      )}
    >
      <span
        className={cn(
          "absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-[var(--ny-accent)] bg-[var(--ny-accent)] text-white"
            : "border-espresso/15 bg-white/85 text-transparent group-hover:border-espresso/30",
        )}
        aria-hidden="true"
      >
        <CheckIcon className="size-4" strokeWidth={2.5} />
      </span>
      <span className="grid min-h-36 place-items-center rounded-xl bg-[var(--ny-paper)] p-3 sm:min-h-44">
        <ProductImage
          product={product}
          sizes="(max-width: 640px) 42vw, 180px"
          className="max-h-36 transition-transform duration-300 motion-safe:group-hover:scale-105 sm:max-h-44"
        />
      </span>
      <span className="mt-4 block font-serif text-xl leading-tight text-espresso">
        {product.name}
      </span>
      <span className="mt-2 line-clamp-2 block text-sm leading-relaxed text-taupe">
        {product.shortDescription ||
          ornamentDetailForSlug(product.slug) ||
          "Фигурка из новогодней коллекции."}
      </span>
      <span className="mt-auto flex items-end justify-between gap-3 pt-4">
        <span className="font-medium text-espresso">
          {formatPrice(product.price, product.currency)}
        </span>
        <span
          className={cn(
            "text-xs",
            purchasable(product)
              ? "text-taupe"
              : "font-medium text-[var(--ny-accent)]",
          )}
        >
          {stockLabel(product)}
        </span>
      </span>
    </button>
  );
}

function SetCard({
  product,
  selected,
  disabled,
  onSelect,
}: {
  product: NewYearConfiguratorProduct;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-espresso disabled:cursor-not-allowed disabled:opacity-55",
        selected
          ? "border-[var(--ny-accent)] bg-white shadow-[0_18px_44px_-28px_rgba(165,33,39,0.55)]"
          : "border-espresso/10 bg-white/55 hover:border-espresso/30 hover:bg-white",
      )}
    >
      <span className="relative grid min-h-48 place-items-center bg-[var(--ny-paper)] p-5">
        <ProductImage
          product={product}
          sizes="(max-width: 768px) 88vw, 300px"
          className="max-h-48 transition-transform duration-300 motion-safe:group-hover:scale-105"
        />
        <span
          className={cn(
            "absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border",
            selected
              ? "border-[var(--ny-accent)] bg-[var(--ny-accent)] text-white"
              : "border-espresso/15 bg-white/85 text-transparent",
          )}
          aria-hidden="true"
        >
          <CheckIcon className="size-4" strokeWidth={2.5} />
        </span>
      </span>
      <span className="flex flex-1 flex-col p-5">
        <span className="block font-serif text-2xl leading-tight text-espresso">
          {product.name}
        </span>
        <span className="mt-2 line-clamp-3 block text-sm leading-relaxed text-taupe">
          {product.shortDescription || fallbackSetDescription(product.slug)}
        </span>
        {(product.material || product.dimensions) && (
          <span className="mt-3 block text-xs leading-relaxed text-taupe">
            {[product.material, product.dimensions].filter(Boolean).join(" · ")}
          </span>
        )}
        <span className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="text-xl font-medium text-espresso">
            {formatPrice(product.price, product.currency)}
          </span>
          <span
            className={cn(
              "text-xs",
              purchasable(product)
                ? "text-taupe"
                : "font-medium text-[var(--ny-accent)]",
            )}
          >
            {stockLabel(product)}
          </span>
        </span>
      </span>
    </button>
  );
}

function BoxOption({
  selected,
  title,
  text,
  price,
  product,
  disabled,
  onSelect,
}: {
  selected: boolean;
  title: string;
  text: string;
  price?: number;
  product?: NewYearConfiguratorProduct;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-espresso disabled:cursor-not-allowed disabled:opacity-55",
        selected
          ? "border-espresso bg-espresso text-parchment"
          : "border-espresso/12 bg-white/60 text-espresso hover:border-espresso/35",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg",
          selected ? "bg-white/12" : "bg-[var(--ny-paper)]",
        )}
      >
        {product ? (
          <ProductImage
            product={product}
            sizes="48px"
            className="max-h-11 max-w-11"
          />
        ) : selected ? (
          <PackageOpenIcon className="size-5" aria-hidden="true" />
        ) : (
          <PackageIcon className="size-5 text-taupe" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">{title}</span>
        <span
          className={cn(
            "mt-1 block text-xs leading-snug",
            selected ? "text-parchment/65" : "text-taupe",
          )}
        >
          {text}
        </span>
      </span>
      {price !== undefined && (
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {formatPrice(price)}
        </span>
      )}
    </button>
  );
}

function Preview({ products }: { products: NewYearConfiguratorProduct[] }) {
  if (products.length === 0) {
    return (
      <div
        data-cart-fly-source
        className="grid h-32 place-items-center rounded-2xl border border-dashed border-espresso/15 bg-white/45 text-taupe"
      >
        <GiftIcon className="size-8" strokeWidth={1.4} aria-hidden="true" />
      </div>
    );
  }
  return (
    <div
      data-cart-fly-source
      className="grid grid-cols-4 gap-2 rounded-2xl bg-[var(--ny-paper)] p-3"
    >
      {products.slice(0, 8).map((product) => (
        <span
          key={product.slug}
          className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-white/75 p-1.5"
          title={product.name}
        >
          <ProductImage product={product} sizes="72px" className="max-h-full" />
        </span>
      ))}
      {products.length > 8 && (
        <span className="grid aspect-square place-items-center rounded-xl bg-white/75 text-sm font-medium text-taupe">
          +{products.length - 8}
        </span>
      )}
    </div>
  );
}

function EmptyState({ unavailable }: { unavailable: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-espresso/20 bg-white/50 p-8 text-center">
      <GiftIcon
        className="mx-auto size-10 text-taupe"
        strokeWidth={1.4}
        aria-hidden="true"
      />
      <h3 className="mt-4 font-serif text-2xl text-espresso">
        {unavailable
          ? "Каталог временно недоступен"
          : "Коллекция скоро появится"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-taupe">
        {unavailable
          ? "Не удалось загрузить товары из базы. Обновите страницу через несколько минут."
          : "Когда фигурки, наборы и коробки будут опубликованы в каталоге, здесь появится конфигуратор."}
      </p>
    </div>
  );
}

export function NewYearConfigurator({
  ornaments,
  sets,
  boxes,
  catalogUnavailable,
}: NewYearConfiguratorProps) {
  const { add, items } = useCart();
  const [mode, setMode] = useState<Mode>("custom");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [selectedSetSlug, setSelectedSetSlug] = useState<string | null>(
    sets.find(purchasable)?.slug ?? sets[0]?.slug ?? null,
  );
  const [boxSlug, setBoxSlug] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const selectedOrnaments = useMemo(() => {
    const bySlug = new Map(ornaments.map((product) => [product.slug, product]));
    return selectedSlugs.flatMap((slug) => {
      const product = bySlug.get(slug);
      return product ? [product] : [];
    });
  }, [ornaments, selectedSlugs]);

  const selectedSet = sets.find((product) => product.slug === selectedSetSlug);
  const selectedBox = boxes.find((product) => product.slug === boxSlug);
  const mainProducts =
    mode === "custom" ? selectedOrnaments : selectedSet ? [selectedSet] : [];
  const productsToAdd = selectedBox
    ? [...mainProducts, selectedBox]
    : mainProducts;
  const total = productsToAdd.reduce((sum, product) => sum + product.price, 0);
  const hasSelection = mainProducts.length > 0;

  const quantityInCart = (slug: string) =>
    items.find(
      (item) => item.fulfillmentType === "stock" && item.productSlug === slug,
    )?.quantity ?? 0;
  const limitFor = (product: NewYearConfiguratorProduct) =>
    Math.min(product.stockAvailable, MAX_CART_QUANTITY);
  const blockedByCart = productsToAdd.some(
    (product) => quantityInCart(product.slug) >= limitFor(product),
  );
  const canAdd =
    hasSelection &&
    productsToAdd.every(
      (product) =>
        purchasable(product) &&
        quantityInCart(product.slug) < limitFor(product),
    );

  const toggleOrnament = (product: NewYearConfiguratorProduct) => {
    if (!purchasable(product)) return;
    setSelectedSlugs((current) =>
      current.includes(product.slug)
        ? current.filter((slug) => slug !== product.slug)
        : [...current, product.slug],
    );
  };

  const addSelection = (trigger: HTMLButtonElement) => {
    if (!canAdd) return;
    for (const product of productsToAdd) add(cartLine(product));

    const box = selectedBox ? " в напечатанной коробке" : "";
    const summaryName =
      mode === "custom"
        ? `Свой набор: ${mainProducts.length} ${pluralFigurines(mainProducts.length)}${box}`
        : `${selectedSet?.name ?? "Новогодний набор"}${box}`;
    flyToCart({
      trigger,
      item: {
        lineKey: `new-year-configurator:${Date.now()}`,
        name: summaryName,
        image: mainProducts[0] ? newYearProductImage(mainProducts[0]) : "",
        price: Math.round(total * 100),
      },
    });
    trackProductEvent(
      "add",
      productsToAdd.map((product) => ({
        id: product.slug,
        name: product.name,
        price: product.price,
        quantity: 1,
        category: product.category,
      })),
    );
    reachGoal("add_to_cart", {
      product_id: mode === "custom" ? "new-year-custom-box" : selectedSet?.slug,
      box: selectedBox?.slug ?? "without_printed_box",
    });
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
  };

  if (ornaments.length === 0 && sets.length === 0) {
    return (
      <section id="configurator" className="ny-section scroll-mt-24">
        <EmptyState unavailable={catalogUnavailable} />
      </section>
    );
  }

  return (
    <section
      id="configurator"
      className="ny-section scroll-mt-24"
      aria-labelledby="configurator-title"
      data-cart-fly-scope
    >
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ny-eyebrow">Конфигуратор</p>
          <h2 id="configurator-title" className="ny-heading">
            Соберите подарок
          </h2>
        </div>
        <p className="max-w-md leading-relaxed text-taupe">
          Выберите свои фигурки или готовый набор, а затем решите, нужна ли
          красивая напечатанная коробка.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ModeButton
          active={mode === "custom"}
          title="Своя коробка"
          text="Отметьте любимые фигурки — мы сложим их вместе."
          onClick={() => setMode("custom")}
        />
        <ModeButton
          active={mode === "set"}
          title="Готовый набор"
          text="Сочетания, которые уже собраны и упакованы."
          onClick={() => setMode("set")}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          {mode === "custom" ? (
            ornaments.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {ornaments.map((product) => (
                  <OrnamentCard
                    key={product.slug}
                    product={product}
                    selected={selectedSlugs.includes(product.slug)}
                    disabled={!purchasable(product)}
                    onToggle={() => toggleOrnament(product)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState unavailable={catalogUnavailable} />
            )
          ) : sets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {sets.map((product) => (
                <SetCard
                  key={product.slug}
                  product={product}
                  selected={selectedSetSlug === product.slug}
                  disabled={!purchasable(product)}
                  onSelect={() => setSelectedSetSlug(product.slug)}
                />
              ))}
            </div>
          ) : (
            <EmptyState unavailable={catalogUnavailable} />
          )}
        </div>

        <aside className="rounded-3xl border border-espresso/10 bg-[var(--ny-paper)] p-5 shadow-[0_24px_70px_-46px_rgba(22,21,19,0.55)] lg:sticky lg:top-24">
          <p className="ny-eyebrow">Ваш выбор</p>
          <h3 className="font-serif text-3xl text-espresso">
            {mode === "custom" ? "Своя коробка" : "Готовый набор"}
          </h3>
          <div className="mt-5">
            <Preview products={productsToAdd} />
          </div>

          <div className="mt-5 space-y-2 text-sm">
            {mainProducts.length === 0 ? (
              <p className="text-taupe">
                {mode === "custom"
                  ? "Отметьте фигурки, которые положить в коробку."
                  : "Выберите готовый набор."}
              </p>
            ) : (
              <ul className="space-y-2">
                {mainProducts.map((product) => (
                  <li key={product.slug} className="flex justify-between gap-3">
                    <span className="min-w-0 text-espresso">
                      {product.name}
                    </span>
                    <span className="shrink-0 text-taupe tabular-nums">
                      {formatPrice(product.price, product.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {boxes.length > 0 ? (
            <fieldset className="mt-6">
              <legend className="mb-3 text-sm font-medium text-espresso">
                Упаковка
              </legend>
              <div className="space-y-2">
                <BoxOption
                  selected={boxSlug === null}
                  title="Без напечатанной коробки"
                  text="Фигурки в защитной упаковке"
                  price={0}
                  onSelect={() => setBoxSlug(null)}
                />
                {boxes.map((product) => (
                  <BoxOption
                    key={product.slug}
                    selected={boxSlug === product.slug}
                    title={product.name}
                    text={
                      purchasable(product)
                        ? product.shortDescription ||
                          product.dimensions ||
                          "Праздничная напечатанная коробка"
                        : "Сейчас нет в наличии"
                    }
                    price={product.price}
                    product={product}
                    disabled={!purchasable(product)}
                    onSelect={() =>
                      setBoxSlug((current) =>
                        current === product.slug ? null : product.slug,
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-espresso/15 p-3 text-xs leading-relaxed text-taupe">
              Сейчас доступен вариант без напечатанной коробки. Праздничная
              коробка появится здесь после публикации в каталоге.
            </p>
          )}

          <div className="mt-6 border-t border-espresso/10 pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-taupe">Итого</span>
              <span className="font-serif text-3xl text-espresso tabular-nums">
                {formatPrice(total)}
              </span>
            </div>
            {blockedByCart && hasSelection && (
              <p className="mt-3 text-sm leading-relaxed text-[var(--ny-accent)]">
                Некоторые товары уже лежат в корзине в максимальном доступном
                количестве.
              </p>
            )}
            <Button
              type="button"
              size="lg"
              disabled={!canAdd}
              onClick={(event) => addSelection(event.currentTarget)}
              className="mt-4 min-h-12 w-full rounded-full bg-espresso text-parchment hover:bg-[var(--ny-accent)]"
            >
              {added ? (
                <>
                  <CheckIcon className="size-4" aria-hidden="true" />
                  Добавлено
                </>
              ) : (
                <>
                  <ShoppingBagIcon className="size-4" aria-hidden="true" />
                  {mode === "custom" ? "Добавить коробку" : "Добавить набор"}
                </>
              )}
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-taupe">
              Цена и остатки проверяются из каталога. В корзине состав можно
              изменить до оформления заказа.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
