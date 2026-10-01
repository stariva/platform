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
  formatDurationLabel,
  productSlugFromName,
  WORKSHOP_CATEGORIES,
  WORKSHOP_LEVELS,
  WORKSHOP_STATUS_LABELS,
  type WorkshopFormValues,
  workshopFormSchema,
} from "@stariva/validators";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { orpc } from "~/orpc/react";
import { WorkshopFiles } from "./workshop-files";
import { WorkshopImageField } from "./workshop-image-field";
import { WorkshopLessons } from "./workshop-lessons";

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export const EMPTY_WORKSHOP: WorkshopFormValues = {
  title: "",
  slug: "",
  subtitle: "",
  description: "",
  category: "interior",
  level: "beginner",
  status: "draft",
  price: 0,
  cover: "",
  previewImage: "",
  whatYouLearn: [],
  materials: [],
  lessons: [],
  materialFiles: [],
  ozonUrl: "",
  featured: false,
  sortOrder: 0,
  testimonialText: "",
  testimonialAuthor: "",
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

const toLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export function WorkshopForm({
  id,
  initialValues,
  storefrontUrl,
}: {
  id?: string;
  initialValues: WorkshopFormValues;
  storefrontUrl?: string;
}) {
  const router = useRouter();
  // Для нового курса адрес собираем из названия, пока его не правили руками
  const [slugTouched, setSlugTouched] = useState(Boolean(id));

  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopFormSchema),
    defaultValues: initialValues,
  });
  const { register, control, watch, setValue, formState } = form;
  const errors = formState.errors;

  const status = watch("status");
  const slug = watch("slug");
  const lessons = watch("lessons");
  const materialFiles = watch("materialFiles");

  // Файлы лежат в папке по адресу курса — после первой загрузки адрес фиксируем
  const slugLocked =
    Boolean(id) ||
    lessons.some((lesson) => lesson.videoKey) ||
    materialFiles.length > 0;

  const totalSeconds = lessons.reduce(
    (total, lesson) => total + lesson.durationSeconds,
    0,
  );

  const save = useMutation({
    ...orpc.admin.workshops.save.mutationOptions(),
    onSuccess: (result, variables) => {
      toast.success(
        result.revalidated
          ? "Сохранено, сайт обновлён"
          : "Сохранено. Страница на сайте обновится в течение часа",
      );
      form.reset(variables.values);
      if (!id) router.replace(`/workshops/${result.id}`);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  const remove = useMutation({
    ...orpc.admin.workshops.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Мастер-класс удалён");
      router.replace("/workshops");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  const workshopUrl =
    storefrontUrl && status === "published"
      ? `${storefrontUrl.replace(/\/+$/, "")}/workshops/${initialValues.slug}`
      : null;

  // Ошибки уроков по номерам: zod кладёт их в errors.lessons[index]
  const lessonErrors = Array.isArray(errors.lessons)
    ? errors.lessons.map((item) => ({
        title: item?.title?.message,
        videoKey: item?.videoKey?.message,
      }))
    : undefined;

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
              htmlFor="title"
              error={errors.title?.message}
            >
              <Input
                id="title"
                {...register("title", {
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
                  ? "После создания адрес не меняется: к нему привязаны покупки и прогресс"
                  : slugLocked
                    ? "Адрес зафиксирован: файлы уже лежат в папке этого курса"
                    : `stariva.ru/workshops/${slug || "…"}`
              }
            >
              <Input
                id="slug"
                disabled={slugLocked}
                {...register("slug", { onChange: () => setSlugTouched(true) })}
              />
            </FieldRow>
            <FieldRow
              label="Подзаголовок"
              htmlFor="subtitle"
              hint="Одна строка под названием в каталоге"
              error={errors.subtitle?.message}
            >
              <Input id="subtitle" {...register("subtitle")} />
            </FieldRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="Категория" htmlFor="category">
                <select
                  id="category"
                  className={selectClass}
                  {...register("category")}
                >
                  {Object.entries(WORKSHOP_CATEGORIES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Уровень" htmlFor="level">
                <select
                  id="level"
                  className={selectClass}
                  {...register("level")}
                >
                  {Object.entries(WORKSHOP_LEVELS).map(([value, label]) => (
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
              error={errors.description?.message}
            >
              <Textarea
                id="description"
                rows={6}
                {...register("description")}
              />
            </FieldRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Программа</CardTitle>
            <CardDescription>По одному пункту на строку.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="whatYouLearn"
              render={({ field }) => (
                <FieldRow
                  label="Чему научитесь"
                  htmlFor="whatYouLearn"
                  error={errors.whatYouLearn?.message}
                >
                  <Textarea
                    id="whatYouLearn"
                    rows={6}
                    defaultValue={field.value.join("\n")}
                    // Не onBlur: при отправке по Enter blur может не случиться
                    onChange={(event) =>
                      field.onChange(toLines(event.target.value))
                    }
                  />
                </FieldRow>
              )}
            />
            <Controller
              control={control}
              name="materials"
              render={({ field }) => (
                <FieldRow
                  label="Что понадобится"
                  htmlFor="materials"
                  hint="Шнур, ножницы, кольцо…"
                  error={errors.materials?.message}
                >
                  <Textarea
                    id="materials"
                    rows={6}
                    defaultValue={field.value.join("\n")}
                    onChange={(event) =>
                      field.onChange(toLines(event.target.value))
                    }
                  />
                </FieldRow>
              )}
            />
          </CardContent>
        </Card>

        <Controller
          control={control}
          name="lessons"
          render={({ field }) => (
            <WorkshopLessons
              slug={slug}
              lessons={field.value}
              getLessons={() => form.getValues("lessons")}
              onChange={field.onChange}
              errors={lessonErrors}
              rootError={
                typeof errors.lessons?.message === "string"
                  ? errors.lessons.message
                  : undefined
              }
            />
          )}
        />

        <Controller
          control={control}
          name="materialFiles"
          render={({ field }) => (
            <WorkshopFiles
              slug={slug}
              files={field.value}
              getFiles={() => form.getValues("materialFiles")}
              onChange={field.onChange}
            />
          )}
        />

        <Card>
          <CardHeader>
            <CardTitle>Отзыв и Ozon</CardTitle>
            <CardDescription>
              Необязательно. Отзыв показывается на странице курса, пока нет
              настоящих — оставьте пустым.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldRow
              label="Текст отзыва"
              htmlFor="testimonialText"
              error={errors.testimonialText?.message}
            >
              <Textarea
                id="testimonialText"
                rows={3}
                {...register("testimonialText")}
              />
            </FieldRow>
            <FieldRow
              label="Автор отзыва"
              htmlFor="testimonialAuthor"
              hint="Имя, город"
              error={errors.testimonialAuthor?.message}
            >
              <Input
                id="testimonialAuthor"
                {...register("testimonialAuthor")}
              />
            </FieldRow>
            <FieldRow
              label="Ссылка на Ozon"
              htmlFor="ozonUrl"
              hint="Если курс продаётся и там"
              error={errors.ozonUrl?.message}
            >
              <Input id="ozonUrl" {...register("ozonUrl")} />
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
            <FieldRow
              label="Статус"
              htmlFor="status"
              hint={
                status === "archived"
                  ? "Не продаётся и не в каталоге, но купившие продолжают смотреть"
                  : undefined
              }
            >
              <select
                id="status"
                className={selectClass}
                {...register("status")}
              >
                {Object.entries(WORKSHOP_STATUS_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </FieldRow>
            <FieldRow
              label="Цена, ₽"
              htmlFor="price"
              hint="0 — бесплатный курс, доступ выдаётся сразу после входа"
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
            <Controller
              control={control}
              name="featured"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="featured">Показывать в «Популярных»</Label>
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
            {lessons.length > 0 && (
              <p className="text-muted-foreground text-xs">
                На сайте: {lessons.length} ур.,{" "}
                {totalSeconds > 0 ? formatDurationLabel(totalSeconds) : "—"}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Сохраняем…" : id ? "Сохранить" : "Создать"}
              </Button>
              {workshopUrl && (
                <a
                  href={workshopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground text-center text-xs hover:underline"
                >
                  Открыть на сайте ↗
                </a>
              )}
              {id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Удалить мастер-класс? Это возможно, только если его никто не покупал.",
                      )
                    ) {
                      remove.mutate({ id });
                    }
                  }}
                >
                  Удалить
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Картинки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Controller
              control={control}
              name="cover"
              render={({ field }) => (
                <WorkshopImageField
                  label="Обложка"
                  hint="Карточка в каталоге и превью в соцсетях, 16:9"
                  slug={slug}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.cover?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="previewImage"
              render={({ field }) => (
                <WorkshopImageField
                  label="Превью"
                  hint="Необязательно: кадр с процессом для страницы курса"
                  slug={slug}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.previewImage?.message}
                />
              )}
            />
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
