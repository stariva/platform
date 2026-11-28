"use client";

import {
  CheckIcon,
  GiftIcon,
  MinusIcon,
  PackageIcon,
  PackageOpenIcon,
  PlusIcon,
  ShoppingBagIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { reachGoal, trackProductEvent } from "@/lib/analytics";
import { type CartItem, useCart } from "@/lib/cart/cart-context";
import { flyToCart } from "@/lib/cart/fly-to-cart";
import { MAX_MADE_TO_ORDER_QUANTITY } from "@/lib/commerce/made-to-order-options";
import { PHOTO_COLOR, PHOTO_SIZE } from "@/lib/made-to-order";
import {
  accusativeFigurines,
  isNewYearProductPurchasable,
  MIN_NEW_YEAR_ORNAMENT_QUANTITY,
  NEW_YEAR_GIFT_BOX_CAPACITY,
  type NewYearConfiguratorProduct,
  newYearDisplayName,
  newYearFigurinesPerItem,
  newYearGiftBoxCapacity,
  newYearGiftBoxMerchandising,
  newYearProductImage,
  newYearSetContents,
  newYearSetMerchandising,
  newYearSubcategoryFor,
  ornamentDetailForSlug,
  ornamentImage,
  pluralFigurines,
  pluralGiftBoxes,
} from "@/lib/new-year";
import { formatPrice, productHref } from "@/lib/products";
import { cn } from "@/lib/utils";

const ADDED_MS = 1800;
const SELECT_ORNAMENT_EVENT = "stariva:select-new-year-ornament";

type Mode = "custom" | "set";

interface NewYearConfiguratorProps {
  ornaments: NewYearConfiguratorProduct[];
  sets: NewYearConfiguratorProduct[];
  boxes: NewYearConfiguratorProduct[];
  catalogUnavailable: boolean;
}

interface SelectedProductEntry {
  product: NewYearConfiguratorProduct;
  quantity: number;
}

const purchasable = isNewYearProductPurchasable;

export function SelectOrnamentButton({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent<{ slug: string }>(SELECT_ORNAMENT_EVENT, {
            detail: { slug },
          }),
        );
        document
          .getElementById("configurator")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      aria-label={`Выбрать фигурку «${name}» в свою коробку`}
      className="min-h-11 rounded-md border-espresso/25 px-4 py-3 text-sm text-espresso transition-colors hover:bg-sand"
    >
      В свою коробку
    </Button>
  );
}

function cartLine(
  product: NewYearConfiguratorProduct,
): Omit<CartItem, "quantity"> {
  const subcategory = newYearSubcategoryFor(product);
  const figurines =
    subcategory === "ornaments"
      ? 1
      : subcategory === "ornament_sets"
        ? newYearFigurinesPerItem(product.slug)
        : 0;
  const contents =
    subcategory === "ornament_sets"
      ? newYearSetContents(product.slug)
      : undefined;
  return {
    productId: product.id,
    productSlug: product.slug,
    fulfillmentType: "made_to_order",
    instantMadeToOrder: true,
    options: {
      size: PHOTO_SIZE,
      color: PHOTO_COLOR,
      measurements: [],
      ...(contents?.length ? { contents } : {}),
    },
    name: product.name,
    image: newYearProductImage(product),
    price: Math.round(product.price * 100),
    ...(figurines > 0 ? { newYearFigurines: figurines } : {}),
  };
}

function stockLabel(product: NewYearConfiguratorProduct): string {
  return purchasable(product) ? "Изготовим за 2–4 дня" : "Скоро появится";
}

function ModeButton({
  active,
  title,
  text,
  badge,
  featured,
  onClick,
}: {
  active: boolean;
  title: string;
  text: string;
  badge?: string;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-20 rounded-2xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-espresso",
        featured ? "flex-1 sm:flex-[1.18]" : "flex-1 sm:flex-[0.82]",
        active
          ? "border-espresso bg-espresso text-parchment shadow-[0_18px_44px_-26px_rgba(22,21,19,0.7)]"
          : "border-espresso/12 bg-white/55 text-espresso hover:border-espresso/35 hover:bg-white",
      )}
    >
      <span className="flex flex-wrap items-center gap-2 font-serif text-xl leading-tight">
        {title}
        {badge && (
          <span className="rounded-full bg-(--ny-accent) px-2 py-0.5 font-sans text-[11px] font-medium tracking-normal text-white">
            {badge}
          </span>
        )}
      </span>
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
      alt={newYearDisplayName(product)}
      width={360}
      height={360}
      sizes={sizes}
      className={cn("h-auto w-auto max-w-full object-contain", className)}
    />
  );
}

function hasProductVisual(product: NewYearConfiguratorProduct): boolean {
  return newYearProductImage(product) !== "/placeholder.jpg";
}

function OrnamentCard({
  product,
  quantity,
  maxQuantity,
  disabled,
  onSetQuantity,
}: {
  product: NewYearConfiguratorProduct;
  quantity: number;
  maxQuantity: number;
  disabled: boolean;
  onSetQuantity: (next: number) => void;
}) {
  const selected = quantity > 0;
  const displayName = newYearDisplayName(product);
  const canIncrease = !disabled && quantity < maxQuantity;

  return (
    <div
      className={cn(
        "group relative flex min-h-full flex-col rounded-2xl border p-3 text-left transition-all",
        disabled && "opacity-55",
        selected
          ? "border-(--ny-accent) bg-white shadow-[0_18px_44px_-28px_rgba(165,33,39,0.55)]"
          : "border-espresso/10 bg-white/55 hover:border-espresso/30 hover:bg-white",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => onSetQuantity(selected ? 0 : 1)}
        className="flex flex-1 flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-espresso disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            "absolute right-3 top-3 z-10 flex min-w-7 h-7 items-center justify-center rounded-full border px-1.5 text-xs font-medium tabular-nums transition-colors",
            selected
              ? "border-(--ny-accent) bg-(--ny-accent) text-white"
              : "border-espresso/15 bg-white/85 text-transparent group-hover:border-espresso/30",
          )}
          aria-hidden="true"
        >
          {quantity > 1 ? (
            `×${quantity}`
          ) : (
            <CheckIcon className="size-4" strokeWidth={2.5} />
          )}
        </span>
        <span className="grid min-h-36 place-items-center rounded-xl bg-[var(--ny-paper)] p-3 sm:min-h-44">
          <ProductImage
            product={product}
            sizes="(max-width: 640px) 42vw, 180px"
            className="max-h-36 transition-transform duration-300 motion-safe:group-hover:scale-105 sm:max-h-44"
          />
        </span>
        <span className="mt-4 block font-serif text-xl leading-tight text-espresso">
          {displayName}
        </span>
        <span className="mt-2 line-clamp-2 block text-sm leading-relaxed text-taupe">
          {ornamentDetailForSlug(product.slug) ||
            product.shortDescription ||
            "Фигурка из новогодней коллекции."}
        </span>
      </button>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="font-medium text-espresso tabular-nums">
          {formatPrice(product.price, product.currency)}
        </span>
        {selected ? (
          <fieldset
            className="inline-flex items-center rounded-full border border-espresso/15 bg-[var(--ny-paper)]"
            aria-label={`Количество: ${displayName}`}
          >
            <button
              type="button"
              onClick={() => onSetQuantity(quantity - 1)}
              className="flex size-8 items-center justify-center rounded-full text-espresso transition-colors hover:bg-espresso/10"
              aria-label={`Уменьшить количество «${displayName}»`}
            >
              <MinusIcon className="size-3.5" aria-hidden="true" />
            </button>
            <output
              className="min-w-6 text-center text-xs font-medium text-espresso tabular-nums"
              aria-live="polite"
            >
              {quantity}
            </output>
            <button
              type="button"
              disabled={!canIncrease}
              onClick={() => onSetQuantity(quantity + 1)}
              className="flex size-8 items-center justify-center rounded-full text-espresso transition-colors hover:bg-espresso/10 disabled:opacity-30"
              aria-label={`Увеличить количество «${displayName}»`}
            >
              <PlusIcon className="size-3.5" aria-hidden="true" />
            </button>
          </fieldset>
        ) : (
          <span
            className={cn(
              "text-xs",
              purchasable(product)
                ? "text-taupe"
                : "font-medium text-(--ny-accent)",
            )}
          >
            {stockLabel(product)}
          </span>
        )}
      </div>
    </div>
  );
}

function SetCard({
  product,
  ornamentProducts,
  selected,
  disabled,
  onSelect,
}: {
  product: NewYearConfiguratorProduct;
  ornamentProducts: NewYearConfiguratorProduct[];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const merchandising = newYearSetMerchandising(product, ornamentProducts);
  const displayName =
    merchandising.definition?.name ?? newYearDisplayName(product);
  const compositionNames = merchandising.items
    .map((item) => item.name)
    .join(", ");
  const visibleComposition = merchandising.items.slice(0, 7);
  const hiddenCompositionCount =
    merchandising.items.length - visibleComposition.length;
  const hasSeparatePrice =
    merchandising.separateTotal !== undefined &&
    merchandising.separateTotal > product.price;
  const unitPrice =
    merchandising.separateTotal !== undefined && merchandising.items.length > 0
      ? merchandising.separateTotal / merchandising.items.length
      : 0;
  const freebies =
    merchandising.savings !== undefined && unitPrice > 0
      ? Math.floor(merchandising.savings / unitPrice)
      : 0;
  const savingsGift =
    freebies === 1
      ? `${merchandising.items.length}-я фигурка в подарок`
      : freebies > 1
        ? `${freebies} ${pluralFigurines(freebies)} в подарок`
        : undefined;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          "group relative flex flex-1 flex-col overflow-hidden rounded-2xl border text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-espresso disabled:cursor-not-allowed disabled:opacity-55",
          selected
            ? "border-(--ny-accent) bg-white shadow-[0_18px_44px_-28px_rgba(165,33,39,0.55)]"
            : "border-espresso/10 bg-white/55 hover:border-espresso/30 hover:bg-white",
        )}
      >
        <span className="relative grid min-h-56 place-items-center bg-[var(--ny-paper)] p-5">
          <ProductImage
            product={product}
            sizes="(max-width: 768px) 88vw, 300px"
            className="max-h-52 transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
          {merchandising.items.length > 0 && (
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-espresso shadow-sm">
              {merchandising.items.length}{" "}
              {pluralFigurines(merchandising.items.length)}
            </span>
          )}
          <span
            className={cn(
              "absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border",
              selected
                ? "border-(--ny-accent) bg-(--ny-accent) text-white"
                : "border-espresso/15 bg-white/85 text-transparent",
            )}
            aria-hidden="true"
          >
            <CheckIcon className="size-4" strokeWidth={2.5} />
          </span>
        </span>
        <span className="flex flex-1 flex-col p-5">
          <span className="block font-serif text-2xl leading-tight text-espresso">
            Набор «{displayName}»
          </span>
          {(merchandising.definition?.description ||
            product.shortDescription) && (
            <span className="mt-2 block text-sm leading-relaxed text-taupe">
              {merchandising.definition?.description ||
                product.shortDescription}
            </span>
          )}
          {compositionNames && (
            <span className="mt-4 block">
              <span className="flex items-center">
                {visibleComposition.map((item) => (
                  <span
                    key={item.id}
                    className="relative -ml-2 grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-espresso/10 bg-white shadow-sm first:ml-0"
                  >
                    <Image
                      src={
                        item.product
                          ? newYearProductImage(item.product)
                          : ornamentImage(item.id)
                      }
                      alt=""
                      fill
                      sizes="44px"
                      className="object-contain p-1.5"
                    />
                  </span>
                ))}
                {hiddenCompositionCount > 0 && (
                  <span className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full border border-espresso/10 bg-white text-xs font-medium text-taupe shadow-sm">
                    +{hiddenCompositionCount}
                  </span>
                )}
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-taupe">
                <span className="font-medium text-espresso">Внутри:</span>{" "}
                {compositionNames}
              </span>
            </span>
          )}
          {merchandising.savings !== undefined && (
            <span className="mt-3 w-fit rounded-full bg-(--ny-accent)/10 px-3 py-1 text-xs font-medium text-(--ny-accent)">
              Выгода {formatPrice(merchandising.savings, product.currency)}
              {savingsGift ? ` — ${savingsGift}` : ""}
            </span>
          )}
          {(product.material || product.dimensions) && (
            <span className="mt-3 block text-xs leading-relaxed text-taupe">
              {[product.material, product.dimensions]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          <span className="mt-auto flex items-end justify-between gap-3 pt-5">
            <span>
              {hasSeparatePrice && (
                <span className="mb-1 block text-xs text-taupe">
                  <span className="line-through">
                    {formatPrice(
                      merchandising.separateTotal ?? 0,
                      product.currency,
                    )}
                  </span>{" "}
                  по отдельности
                </span>
              )}
              <span className="text-xl font-medium text-espresso">
                {formatPrice(product.price, product.currency)}
              </span>
            </span>
            <span
              className={cn(
                "text-right text-xs",
                purchasable(product)
                  ? "text-taupe"
                  : "font-medium text-(--ny-accent)",
              )}
            >
              {stockLabel(product)}
            </span>
          </span>
        </span>
      </button>
      {!merchandising.definition && (
        <Link
          href={productHref(product)}
          aria-label={`Состав набора «${product.name}» в карточке товара`}
          className="mt-2 inline-flex min-h-11 items-center self-start text-sm text-espresso underline underline-offset-4"
        >
          Состав в карточке товара
        </Link>
      )}
    </div>
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
          hasProductVisual(product) ? (
            <ProductImage
              product={product}
              sizes="48px"
              className="max-h-11 max-w-11"
            />
          ) : (
            <GiftIcon
              className={cn(
                "size-5",
                selected ? "text-parchment" : "text-taupe",
              )}
              aria-hidden="true"
            />
          )
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
          {formatPrice(price, product?.currency ?? "RUB")}
        </span>
      )}
    </button>
  );
}

function Preview({ entries }: { entries: SelectedProductEntry[] }) {
  const expanded = entries.flatMap(({ product, quantity }) =>
    Array.from({ length: quantity }, (_, index) => ({
      key: `${product.slug}-${index}`,
      product,
    })),
  );
  if (expanded.length === 0) {
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
      {expanded.slice(0, 8).map(({ key, product }) => (
        <span
          key={key}
          className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-white/75 p-1.5"
          title={newYearDisplayName(product)}
        >
          {hasProductVisual(product) ? (
            <ProductImage
              product={product}
              sizes="72px"
              className="max-h-full"
            />
          ) : (
            <GiftIcon className="size-5 text-taupe" aria-hidden="true" />
          )}
        </span>
      ))}
      {expanded.length > 8 && (
        <span className="grid aspect-square place-items-center rounded-xl bg-white/75 text-sm font-medium text-taupe">
          +{expanded.length - 8}
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
  const [mode, setMode] = useState<Mode>(sets.length > 0 ? "set" : "custom");
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({});
  const [selectedSetSlug, setSelectedSetSlug] = useState<string | null>(
    sets.find(purchasable)?.slug ?? sets[0]?.slug ?? null,
  );
  const [boxSlug, setBoxSlug] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const quantityInCart = useCallback(
    (slug: string) =>
      items.find(
        (item) =>
          item.fulfillmentType === "made_to_order" &&
          item.instantMadeToOrder === true &&
          item.productSlug === slug,
      )?.quantity ?? 0,
    [items],
  );

  const setOrnamentQuantity = useCallback(
    (slug: string, nextQuantity: number) => {
      const product = ornaments.find((item) => item.slug === slug);
      if (!product || !purchasable(product)) return;
      const available = Math.max(
        0,
        MAX_MADE_TO_ORDER_QUANTITY - quantityInCart(slug),
      );
      const clamped = Math.min(
        Math.max(Math.trunc(nextQuantity), 0),
        available,
      );
      setSelectedQuantities((current) => {
        if (clamped <= 0) {
          const { [slug]: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, [slug]: clamped };
      });
    },
    [ornaments, quantityInCart],
  );

  useEffect(() => {
    const onSelectOrnament = (event: Event) => {
      const slug = (event as CustomEvent<{ slug?: string }>).detail?.slug;
      if (!slug) return;
      const product = ornaments.find((item) => item.slug === slug);
      if (!product || !purchasable(product)) return;
      setMode("custom");
      setSelectedQuantities((current) => {
        const available = Math.max(
          1,
          MAX_MADE_TO_ORDER_QUANTITY - quantityInCart(slug),
        );
        const next = Math.min((current[slug] ?? 0) + 1, available);
        return { ...current, [slug]: next };
      });
    };
    window.addEventListener(SELECT_ORNAMENT_EVENT, onSelectOrnament);
    return () =>
      window.removeEventListener(SELECT_ORNAMENT_EVENT, onSelectOrnament);
  }, [ornaments, quantityInCart]);

  const selectedOrnamentEntries = useMemo<SelectedProductEntry[]>(() => {
    const bySlug = new Map(ornaments.map((product) => [product.slug, product]));
    return Object.entries(selectedQuantities).flatMap(([slug, quantity]) => {
      const product = bySlug.get(slug);
      return product && quantity > 0 ? [{ product, quantity }] : [];
    });
  }, [ornaments, selectedQuantities]);

  const selectedCustomFigurinesCount = useMemo(
    () =>
      selectedOrnamentEntries.reduce((sum, entry) => sum + entry.quantity, 0),
    [selectedOrnamentEntries],
  );

  const maxSetSavings = useMemo(() => {
    let max = 0;
    let currency = "RUB";
    for (const set of sets) {
      const { savings } = newYearSetMerchandising(set, ornaments);
      if (savings !== undefined && savings > max) {
        max = savings;
        currency = set.currency;
      }
    }
    return max > 0 ? formatPrice(max, currency) : undefined;
  }, [sets, ornaments]);

  const selectedSet = sets.find((product) => product.slug === selectedSetSlug);
  const selectedBox = boxes.find((product) => product.slug === boxSlug);
  const mainEntries: SelectedProductEntry[] =
    mode === "custom"
      ? selectedOrnamentEntries
      : selectedSet
        ? [{ product: selectedSet, quantity: 1 }]
        : [];
  const selectedFigurinesCount =
    mode === "custom"
      ? selectedCustomFigurinesCount
      : selectedSet
        ? newYearFigurinesPerItem(selectedSet.slug)
        : 0;
  const selectedBoxCapacity = selectedBox
    ? newYearGiftBoxCapacity(selectedBox.slug)
    : NEW_YEAR_GIFT_BOX_CAPACITY;
  const boxesNeeded = selectedBox
    ? Math.max(1, Math.ceil(selectedFigurinesCount / selectedBoxCapacity))
    : 1;
  const entriesToAdd: SelectedProductEntry[] = selectedBox
    ? [...mainEntries, { product: selectedBox, quantity: boxesNeeded }]
    : mainEntries;

  // Маленький футляр не предлагаем, когда состав в него уже не помещается:
  // для «Сказочного терема» и больших своих коробок нужен футляр на 14 ячеек.
  const visibleBoxes = useMemo(() => {
    const maxCapacity = Math.max(
      0,
      ...boxes.map((box) => newYearGiftBoxCapacity(box.slug)),
    );
    return boxes.filter((box) => {
      const capacity = newYearGiftBoxCapacity(box.slug);
      return capacity >= selectedFigurinesCount || capacity === maxCapacity;
    });
  }, [boxes, selectedFigurinesCount]);

  useEffect(() => {
    if (!boxSlug) return;
    if (visibleBoxes.some((box) => box.slug === boxSlug)) return;
    const fallback = visibleBoxes.reduce<
      (typeof visibleBoxes)[number] | undefined
    >(
      (biggest, box) =>
        !biggest ||
        newYearGiftBoxCapacity(box.slug) > newYearGiftBoxCapacity(biggest.slug)
          ? box
          : biggest,
      undefined,
    );
    setBoxSlug(fallback?.slug ?? null);
  }, [visibleBoxes, boxSlug]);
  const total = entriesToAdd.reduce(
    (sum, { product, quantity }) => sum + product.price * quantity,
    0,
  );
  const hasSelection = mainEntries.length > 0;

  const figurinesInCart = items.reduce(
    (sum, item) =>
      item.fulfillmentType === "made_to_order" &&
      item.instantMadeToOrder === true
        ? sum +
          item.quantity *
            (item.newYearFigurines ?? newYearFigurinesPerItem(item.productSlug))
        : sum,
    0,
  );
  const customQuantityAfterAdd = figurinesInCart + selectedCustomFigurinesCount;
  const customMinimumMet =
    mode !== "custom" ||
    customQuantityAfterAdd >= MIN_NEW_YEAR_ORNAMENT_QUANTITY;
  const customMissing = Math.max(
    0,
    MIN_NEW_YEAR_ORNAMENT_QUANTITY - customQuantityAfterAdd,
  );
  const limitFor = (_product: NewYearConfiguratorProduct) =>
    MAX_MADE_TO_ORDER_QUANTITY;
  const blockedByCart = entriesToAdd.some(
    ({ product, quantity }) =>
      purchasable(product) &&
      quantityInCart(product.slug) + quantity > limitFor(product),
  );
  const canAdd =
    hasSelection &&
    customMinimumMet &&
    entriesToAdd.every(({ product }) => purchasable(product)) &&
    !blockedByCart;

  const addSelection = (trigger: HTMLButtonElement) => {
    if (!canAdd) return;
    for (const { product, quantity } of entriesToAdd) {
      add(cartLine(product), quantity);
    }

    const box = selectedBox ? " в подарочном футляре" : "";
    const summaryName =
      mode === "custom"
        ? `Своя коробка: ${selectedCustomFigurinesCount} ${pluralFigurines(selectedCustomFigurinesCount)}${box}`
        : `${selectedSet ? newYearDisplayName(selectedSet) : "Новогодний набор"}${box}`;
    const firstProduct = mainEntries[0]?.product;
    flyToCart({
      trigger,
      item: {
        lineKey: `new-year-configurator:${Date.now()}`,
        name: summaryName,
        image: firstProduct ? newYearProductImage(firstProduct) : "",
        price: Math.round(total * 100),
      },
    });
    trackProductEvent(
      "add",
      entriesToAdd.map(({ product, quantity }) => ({
        id: product.slug,
        name: product.name,
        price: product.price,
        quantity,
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
          <p className="ny-eyebrow">Сначала — готовые наборы</p>
          <h2 id="configurator-title" className="ny-heading">
            Выберите набор
          </h2>
        </div>
        <p className="max-w-md leading-relaxed text-taupe">
          В готовых наборах образы уже сочетаются между собой — от камерной
          семёрки до «Сказочного терема» со всей коллекцией
          {maxSetSavings ? ` (выгода до ${maxSetSavings})` : ""}. А если хочется
          собрать свою историю или взять парные игрушки на ёлку — переключитесь
          на «Свою коробку».
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ModeButton
          active={mode === "set"}
          title="Готовый набор"
          text="Сюжеты подобраны заранее: от 7 фигурок до всей коллекции — выгоднее поштучной покупки."
          badge="Выгодно"
          featured
          onClick={() => setMode("set")}
        />
        <ModeButton
          active={mode === "custom"}
          title="Своя коробка"
          text="Соберите от 7 любых фигурок (разных или парных) по 150 ₽."
          onClick={() => setMode("custom")}
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
                    quantity={selectedQuantities[product.slug] ?? 0}
                    maxQuantity={Math.max(
                      1,
                      MAX_MADE_TO_ORDER_QUANTITY - quantityInCart(product.slug),
                    )}
                    disabled={!purchasable(product)}
                    onSetQuantity={(next) =>
                      setOrnamentQuantity(product.slug, next)
                    }
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
                  ornamentProducts={ornaments}
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
          <div className="flex items-baseline justify-between gap-2">
            <p className="ny-eyebrow">Ваш выбор</p>
            {mode === "custom" && (
              <span className="text-xs font-medium text-taupe tabular-nums">
                {selectedCustomFigurinesCount}{" "}
                {pluralFigurines(selectedCustomFigurinesCount)}
              </span>
            )}
          </div>
          <h3 className="font-serif text-3xl text-espresso">
            {mode === "custom" ? "Своя коробка" : "Готовый набор"}
          </h3>
          <div className="mt-5">
            <Preview entries={entriesToAdd} />
          </div>

          <div className="mt-5 space-y-2 text-sm">
            {mainEntries.length === 0 ? (
              <p className="text-taupe">
                {mode === "custom"
                  ? "Отметьте минимум 7 фигурок — можно выбирать как разные, так и по 2–3 одинаковые."
                  : "Выберите готовый набор."}
              </p>
            ) : (
              <ul className="space-y-2">
                {entriesToAdd.map(({ product, quantity }) => (
                  <li key={product.slug} className="flex justify-between gap-3">
                    <span className="min-w-0 text-espresso">
                      {newYearDisplayName(product)}
                      {quantity > 1 && (
                        <span className="text-taupe tabular-nums">
                          {" "}
                          × {quantity}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-taupe tabular-nums">
                      {formatPrice(product.price * quantity, product.currency)}
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
                  title="Бережная упаковка для доставки"
                  text="Надёжная защита в дороге — если берёте для своей ёлки"
                  price={0}
                  onSelect={() => setBoxSlug(null)}
                />
                {visibleBoxes.map((product) => {
                  const boxCopy = newYearGiftBoxMerchandising(product.slug);
                  return (
                    <BoxOption
                      key={product.slug}
                      selected={boxSlug === product.slug}
                      title={boxCopy.title}
                      text={
                        purchasable(product)
                          ? boxCopy.text
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
                  );
                })}
              </div>
              {selectedBox && boxesNeeded > 1 && (
                <p className="mt-3 text-xs leading-relaxed text-taupe">
                  В один футляр помещается {selectedBoxCapacity}{" "}
                  {pluralFigurines(selectedBoxCapacity)} — для вашего состава
                  положим {boxesNeeded} {pluralGiftBoxes(boxesNeeded)},
                  количество можно изменить в корзине.
                </p>
              )}
            </fieldset>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-espresso/15 p-3 text-xs leading-relaxed text-taupe">
              Украшения приедут в надёжной защитной упаковке для доставки.
            </p>
          )}

          <div className="mt-6 border-t border-espresso/10 pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-taupe">Итого</span>
              <span className="font-serif text-3xl text-espresso tabular-nums">
                {formatPrice(total)}
              </span>
            </div>
            {mode === "custom" && !customMinimumMet && (
              <p className="mt-3 text-sm leading-relaxed text-(--ny-accent)">
                Добавьте ещё {customMissing}{" "}
                {accusativeFigurines(customMissing)} — минимальный заказ
                отдельных фигурок: {MIN_NEW_YEAR_ORNAMENT_QUANTITY} шт.
              </p>
            )}
            {blockedByCart && hasSelection && (
              <p className="mt-3 text-sm leading-relaxed text-(--ny-accent)">
                Некоторые изделия уже лежат в корзине в максимальном доступном
                количестве.
              </p>
            )}
            <Button
              type="button"
              size="lg"
              disabled={!canAdd}
              onClick={(event) => addSelection(event.currentTarget)}
              className="mt-4 min-h-12 w-full rounded-full bg-espresso text-parchment hover:bg-(--ny-accent)"
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
              Создадим ваш набор в мастерской после оплаты за 2–4 дня. Доставка
              в удобный пункт выдачи Ozon рассчитается на следующем шаге.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
