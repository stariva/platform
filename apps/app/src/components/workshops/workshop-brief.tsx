"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@stariva/ui";
import type { WorkshopFormValues } from "@stariva/validators";
import { IconLink, IconPlus, IconTrash } from "@tabler/icons-react";
import {
  type Control,
  Controller,
  type FieldErrors,
  type UseFormRegister,
  useFieldArray,
} from "react-hook-form";
import { WorkshopImageField } from "./workshop-image-field";

type BriefErrors = FieldErrors<WorkshopFormValues>["brief"];

/** Показывает ошибку поля брифа, если сообщение задано. */
function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

/** Ссылки на магазины у одной позиции: «Wildberries» → https://… */
function ShopLinks({
  index,
  control,
  register,
  errors,
}: {
  index: number;
  control: Control<WorkshopFormValues>;
  register: UseFormRegister<WorkshopFormValues>;
  errors: BriefErrors;
}) {
  const links = useFieldArray({
    control,
    name: `brief.shops.${index}.links`,
  });
  const linkErrors = errors?.shops?.[index]?.links;

  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground text-xs">Где купить</Label>
      {links.fields.map((link, linkIndex) => (
        <div key={link.id} className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              className="w-36 shrink-0"
              placeholder="Wildberries"
              aria-label="Магазин"
              {...register(`brief.shops.${index}.links.${linkIndex}.label`)}
            />
            <Input
              placeholder="https://…"
              aria-label="Ссылка"
              {...register(`brief.shops.${index}.links.${linkIndex}.url`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Убрать ссылку"
              onClick={() => links.remove(linkIndex)}
            >
              <IconTrash />
            </Button>
          </div>
          <FieldError message={linkErrors?.[linkIndex]?.label?.message} />
          <FieldError message={linkErrors?.[linkIndex]?.url?.message} />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => links.append({ label: "", url: "" })}
      >
        <IconLink />
        Добавить ссылку
      </Button>
    </div>
  );
}

/**
 * Бриф в кабинете ученика: совет перед стартом, где купить материалы, фото
 * готовой работы и пожелание. Список самих материалов — в «Программе».
 */
export function WorkshopBrief({
  slug,
  control,
  register,
  errors,
}: {
  slug: string;
  control: Control<WorkshopFormValues>;
  register: UseFormRegister<WorkshopFormValues>;
  errors: BriefErrors;
}) {
  const shops = useFieldArray({ control, name: "brief.shops" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Бриф для ученика</CardTitle>
        <CardDescription>
          Показывается в кабинете рядом со списком «Что понадобится»: где
          купить, как подготовиться. Все поля необязательные.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="brief-howTo">Как плести</Label>
          <Textarea
            id="brief-howTo"
            rows={3}
            placeholder="Плести можно на столе или вертикально, закрепив основу на стене."
            {...register("brief.howTo")}
          />
          <FieldError message={errors?.howTo?.message} />
        </div>

        <div className="space-y-3">
          <Label>На заметку: где купить</Label>
          {shops.fields.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Добавьте позиции, к которым нужны ссылки на магазины
            </p>
          )}
          {shops.fields.map((shop, index) => (
            <div key={shop.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <div className="space-y-1">
                    <Input
                      placeholder="Шнур"
                      aria-label="Что покупаем"
                      {...register(`brief.shops.${index}.item`)}
                    />
                    <FieldError
                      message={errors?.shops?.[index]?.item?.message}
                    />
                  </div>
                  <Input
                    placeholder="Подсказка: подойдут цвета хаки, изумруд…"
                    aria-label="Подсказка к покупке"
                    {...register(`brief.shops.${index}.note`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Убрать позицию"
                  onClick={() => shops.remove(index)}
                >
                  <IconTrash />
                </Button>
              </div>
              <ShopLinks
                index={index}
                control={control}
                register={register}
                errors={errors}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              shops.append({
                item: "",
                note: "",
                links: [{ label: "", url: "" }],
              })
            }
          >
            <IconPlus />
            Добавить позицию
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="brief-outro">Завершение</Label>
          <Textarea
            id="brief-outro"
            rows={3}
            placeholder="Идея подарка, пожелание приятного творчества"
            {...register("brief.outro")}
          />
          <FieldError message={errors?.outro?.message} />
        </div>

        <Controller
          control={control}
          name="brief.image"
          render={({ field }) => (
            <WorkshopImageField
              label="Фото готовой работы"
              hint="Вертикальное, около 3:4 — встанет рядом со списком материалов"
              slug={slug}
              value={field.value}
              onChange={field.onChange}
              error={errors?.image?.message}
            />
          )}
        />
      </CardContent>
    </Card>
  );
}
