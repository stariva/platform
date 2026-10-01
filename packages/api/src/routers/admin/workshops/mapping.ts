import type { NewWorkshopRow, WorkshopRow } from "@stariva/db/schema";
import type { WorkshopFormValues } from "@stariva/validators";

const nullIfEmpty = (value: string) => (value.trim() === "" ? null : value);

/** Значения формы → поля строки workshops (цена в копейках, пустое → null). */
export function formToRow(values: WorkshopFormValues) {
  return {
    title: values.title,
    slug: values.slug,
    subtitle: values.subtitle,
    description: values.description,
    category: values.category,
    level: values.level,
    status: values.status,
    price: Math.round(values.price * 100),
    cover: values.cover,
    previewImage: values.previewImage,
    whatYouLearn: values.whatYouLearn,
    materials: values.materials,
    lessons: values.lessons,
    materialFiles: values.materialFiles,
    ozonUrl: nullIfEmpty(values.ozonUrl),
    testimonialText: nullIfEmpty(values.testimonialText),
    testimonialAuthor: nullIfEmpty(values.testimonialAuthor),
    featured: values.featured,
    sortOrder: values.sortOrder,
  } satisfies Partial<NewWorkshopRow>;
}

/** Строка workshops → значения формы (цена в рублях, null → пустая строка). */
export function rowToForm(row: WorkshopRow): WorkshopFormValues {
  return {
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    category: row.category,
    level: row.level,
    status: row.status,
    price: row.price / 100,
    cover: row.cover,
    previewImage: row.previewImage,
    whatYouLearn: row.whatYouLearn,
    materials: row.materials,
    lessons: row.lessons,
    materialFiles: row.materialFiles,
    ozonUrl: row.ozonUrl ?? "",
    featured: row.featured,
    sortOrder: row.sortOrder,
    testimonialText: row.testimonialText ?? "",
    testimonialAuthor: row.testimonialAuthor ?? "",
  };
}

/** Страницы витрины, которые надо обновить после правки мастер-класса. */
export function storefrontPaths(slug: string): string[] {
  return ["/workshops", `/workshops/${slug}`, "/sitemap.xml"];
}
