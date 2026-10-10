"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Textarea,
  toast,
} from "@stariva/ui";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_STATUS_LABELS,
  type ProductCategoryId,
  type ProductFormValues,
  productFormSchema,
  productSlugFromName,
} from "@stariva/validators";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { orpc } from "~/orpc/react";
import { ProductImages } from "./product-images";
import { StockEditor } from "./stock-editor";

export interface OzonInfo {
  offerId: string | null;
  sku: number | null;
  stockAvailable: number;
}

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const toNullableNumber = (value: unknown) =>
  value === "" || value === null || value === undefined ? null : Number(value);

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  category: "interior",
  subcategory: "lampshades",
  status: "draft",
  price: 0,
  oldPrice: null,
  images: [],
  material: "100% хлопок",
  color: "",
  dimensions: "",
  careInstructions: "",
  sizes: [],
  madeToOrder: true,
  leadTimeMinDays: null,
  leadTimeMaxDays: null,
  featured: false,
  sortOrder: 0,
  seoTitle: "",
  seoDescription: "",
};

function FieldRow({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

export function ProductForm({
  id,
  initialValues,
  ozon,
  storefrontUrl,
}: {
  id?: string;
  initialValues: ProductFormValues;
  ozon?: OzonInfo;
  storefrontUrl?: string;
}) {
  const router = useRouter();
  // Для нового товара адрес собираем из названия, пока его не правили руками
  const [slugTouched, setSlugTouched] = useState(Boolean(id));

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues,
  });
  const { register, control, watch, setValue, formState } = form;
  const errors = formState.errors;

  const category = watch("category");
  const status = watch("status");
  const slug = watch("slug");
  const subcategories: Record<string, string> =
    PRODUCT_CATEGORIES[category].subcategories;

  const save = useMutation({
    ...orpc.admin.products.save.mutationOptions(),
    onSuccess: (result, variables) => {
      toast.success(
        result.revalidated
          ? "Сохранено, сайт обновлён"
          : "Сохранено. Страница товара на сайте обновится в течение часа",
      );
      form.reset(variables.values);
      if (!id) router.replace(`/products/${result.id}`);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const productUrl =
    storefrontUrl && status === "published"
      ? `${storefrontUrl.replace(/\/+$/, "")}/catalog/${initialValues.category}/${initialValues.slug}`
      : null;

  return (
    <form
      onSubmit={form.handleSubmit((values) => save.mutate({ id, values }))}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Основное</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow
              label="Название"
              htmlFor="name"
              error={errors.name?.message}
            >
              <Input
                id="name"
                {...register("name", {
                  onChange: (event) => {
                    if (!slugTouched) {
                      setValue("slug", productSlugFromName(event.target.value));
                    }
                  },
                })}
              />
            </FieldRow>
            <FieldRow
              label="Адрес на сайте"
              htmlFor="slug"
              error={errors.slug?.message}
              hint={
                id
                  ? "Смена адреса ломает старые ссылки и сбрасывает позиции в поиске"
                  : `stariva.ru/catalog/${category}/${slug || "…"}`
              }
            >
              <Input
                id="slug"
                {...register("slug", { onChange: () => setSlugTouched(true) })}
              />
            </FieldRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="Категория" htmlFor="category">
                <select
                  id="category"
                  className={selectClass}
                  {...register("category", {
                    onChange: (event) => {
                      const next =
                        PRODUCT_CATEGORIES[
                          event.target.value as ProductCategoryId
                        ].subcategories;
                      setValue(
                        "subcategory",
                        Object.keys(
                          next,
                        )[0] as ProductFormValues["subcategory"],
                      );
                    },
                  })}
                >
                  {Object.entries(PRODUCT_CATEGORIES).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow
                label="Подкатегория"
                htmlFor="subcategory"
                error={errors.subcategory?.message}
              >
                <select
                  id="subcategory"
                  className={selectClass}
                  {...register("subcategory")}
                >
                  {Object.entries(subcategories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>
            <FieldRow
              label="Описание"
              htmlFor="description"
              hint="HTML: абзацы <p>, списки <ul><li>, перенос <br>"
              error={errors.description?.message}
            >
              <Textarea
                id="description"
                rows={10}
                className="font-mono text-xs"
                {...register("description")}
              />
            </FieldRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Цена</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="Цена, ₽"
              htmlFor="price"
              error={errors.price?.message}
            >
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                {...register("price", { valueAsNumber: true })}
              />
            </FieldRow>
            <FieldRow
              label="Старая цена, ₽"
              htmlFor="oldPrice"
              hint="Зачёркнутая цена; пусто — без скидки"
              error={errors.oldPrice?.message}
            >
              <Input
                id="oldPrice"
                type="number"
                step="0.01"
                min="0"
                {...register("oldPrice", { setValueAs: toNullableNumber })}
              />
            </FieldRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Как купить</CardTitle>
            <CardDescription>
              Готовые изделия продаются, когда на FBS-складе Ozon есть остаток.
              Под заказ — отдельно, можно включить вместе с наличием.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Controller
              control={control}
              name="madeToOrder"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="madeToOrder">Можно сплести под заказ</Label>
                    <p className="text-muted-foreground text-xs">
                      На сайте — форма заявки с размером и цветом
                    </p>
                  </div>
                  <Switch
                    id="madeToOrder"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow
                label="Срок изготовления от, дней"
                htmlFor="leadTimeMinDays"
                hint="Пусто — общий срок «2–4 дня»"
              >
                <Input
                  id="leadTimeMinDays"
                  type="number"
                  min="1"
                  {...register("leadTimeMinDays", {
                    setValueAs: toNullableNumber,
                  })}
                />
              </FieldRow>
              <FieldRow
                label="до, дней"
                htmlFor="leadTimeMaxDays"
                error={errors.leadTimeMaxDays?.message}
              >
                <Input
                  id="leadTimeMaxDays"
                  type="number"
                  min="1"
                  {...register("leadTimeMaxDays", {
                    setValueAs: toNullableNumber,
                  })}
                />
              </FieldRow>
            </div>
            {id && ozon && (
              <StockEditor
                id={id}
                stockAvailable={ozon.stockAvailable}
                sku={ozon.sku}
                offerId={ozon.offerId}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Характеристики</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="Материал"
              htmlFor="material"
              error={errors.material?.message}
            >
              <Input id="material" {...register("material")} />
            </FieldRow>
            <FieldRow
              label="Цвет"
              htmlFor="color"
              error={errors.color?.message}
            >
              <Input id="color" {...register("color")} />
            </FieldRow>
            <FieldRow
              label="Размеры изделия"
              htmlFor="dimensions"
              hint="Например: диаметр 40 см, высота 60 см"
            >
              <Input id="dimensions" {...register("dimensions")} />
            </FieldRow>
            <Controller
              control={control}
              name="sizes"
              render={({ field }) => (
                <FieldRow
                  label="Размеры на выбор"
                  htmlFor="sizes"
                  hint="Через запятую: XS, S, M. Пусто — размеры категории"
                  error={errors.sizes?.message}
                >
                  <Input
                    id="sizes"
                    defaultValue={field.value.join(", ")}
                    // Не onBlur: при отправке по Enter blur может не случиться
                    onChange={(event) =>
                      field.onChange(
                        event.target.value
                          .split(",")
                          .map((size) => size.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </FieldRow>
              )}
            />
            <div className="sm:col-span-2">
              <FieldRow label="Уход" htmlFor="careInstructions">
                <Textarea
                  id="careInstructions"
                  rows={2}
                  {...register("careInstructions")}
                />
              </FieldRow>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Поисковики</CardTitle>
            <CardDescription>
              Пусто — заголовок и описание собираются из названия и текста.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow
              label="Title"
              htmlFor="seoTitle"
              error={errors.seoTitle?.message}
            >
              <Input id="seoTitle" {...register("seoTitle")} />
            </FieldRow>
            <FieldRow
              label="Description"
              htmlFor="seoDescription"
              error={errors.seoDescription?.message}
            >
              <Textarea
                id="seoDescription"
                rows={3}
                {...register("seoDescription")}
              />
            </FieldRow>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Публикация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow label="Статус" htmlFor="status">
              <select
                id="status"
                className={selectClass}
                {...register("status")}
              >
                {Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldRow>
            <Controller
              control={control}
              name="featured"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="featured">Показывать на главной</Label>
                    <p className="text-muted-foreground text-xs">
                      В блоке «Изделия мастерской» и в «Хитах продаж» каталога.
                      Подпись карточки берётся по разделу товара
                    </p>
                  </div>
                  <Switch
                    id="featured"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
            <FieldRow
              label="Порядок в каталоге"
              htmlFor="sortOrder"
              hint="Меньше — выше"
              error={errors.sortOrder?.message}
            >
              <Input
                id="sortOrder"
                type="number"
                step="1"
                {...register("sortOrder", { valueAsNumber: true })}
              />
            </FieldRow>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Сохраняем…" : id ? "Сохранить" : "Создать"}
              </Button>
              {productUrl && (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground text-center text-xs hover:underline"
                >
                  Открыть на сайте ↗
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <Controller
          control={control}
          name="images"
          render={({ field }) => (
            <ProductImages
              productId={id}
              images={field.value}
              getImages={() => form.getValues("images")}
              onChange={field.onChange}
              error={errors.images?.message}
            />
          )}
        />
      </div>
    </form>
  );
}
