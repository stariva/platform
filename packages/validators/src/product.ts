import { z } from "zod";

/** Категории и подкатегории каталога — совпадают с enum'ами таблицы products. */
export const PRODUCT_CATEGORIES = {
  clothes: {
    label: "Одежда",
    subcategories: {
      dresses: "Туники и накидки",
      tops: "Топы и комплекты",
      belts: "Пояса",
    },
  },
  bags: {
    label: "Сумки",
    subcategories: {
      totes: "Сумки",
      crossbody: "Авоськи",
      baskets: "Корзины",
    },
  },
  interior: {
    label: "Декор интерьера",
    subcategories: {
      lampshades: "Абажуры",
      tipis: "Вигвамы и кресла",
      pannos: "Панно",
      placemats: "Плейсменты",
      planters: "Игрушки и прочее",
    },
  },
} as const;

export type ProductCategoryId = keyof typeof PRODUCT_CATEGORIES;

export const PRODUCT_STATUS_LABELS = {
  draft: "Черновик",
  published: "На сайте",
  archived: "В архиве",
} as const;

const categoryIds = ["clothes", "bags", "interior"] as const;
const subcategoryIds = [
  "dresses",
  "tops",
  "belts",
  "totes",
  "crossbody",
  "baskets",
  "lampshades",
  "tipis",
  "pannos",
  "placemats",
  "planters",
] as const;

/** Максимум для integer в PostgreSQL, цена хранится в копейках. */
const MAX_RUBLES = 21_474_836;

const optionalText = (max: number) => z.string().trim().max(max);
const days = z.number().int().min(1).max(365).nullable();

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название").max(200),
    slug: z
      .string()
      .trim()
      .min(1, "Укажите адрес")
      .max(200)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Только латиница в нижнем регистре, цифры и дефисы",
      ),
    description: z.string().max(20_000),
    category: z.enum(categoryIds),
    subcategory: z.enum(subcategoryIds),
    status: z.enum(["draft", "published", "archived"]),
    price: z
      .number({ error: "Укажите цену" })
      .positive("Цена должна быть больше нуля")
      .max(MAX_RUBLES),
    oldPrice: z.number().positive().max(MAX_RUBLES).nullable(),
    images: z.array(z.url()).max(20, "Не больше 20 фото"),
    material: optionalText(300),
    color: optionalText(300),
    dimensions: optionalText(300),
    careInstructions: optionalText(1000),
    sizes: z.array(z.string().trim().min(1).max(20)).max(20),
    madeToOrder: z.boolean(),
    leadTimeMinDays: days,
    leadTimeMaxDays: days,
    featured: z.boolean(),
    sortOrder: z.number().int().min(-100_000).max(100_000),
    seoTitle: optionalText(200),
    seoDescription: optionalText(400),
  })
  .superRefine((value, ctx) => {
    const subcategories: Record<string, string> =
      PRODUCT_CATEGORIES[value.category].subcategories;
    if (!(value.subcategory in subcategories)) {
      ctx.addIssue({
        code: "custom",
        path: ["subcategory"],
        message: "Подкатегория не из этой категории",
      });
    }
    if (value.oldPrice !== null && value.oldPrice <= value.price) {
      ctx.addIssue({
        code: "custom",
        path: ["oldPrice"],
        message: "Старая цена должна быть больше текущей",
      });
    }
    const { leadTimeMinDays: min, leadTimeMaxDays: max } = value;
    if ((min === null) !== (max === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["leadTimeMaxDays"],
        message: "Укажите срок «от» и «до» или оставьте оба пустыми",
      });
    } else if (min !== null && max !== null && min > max) {
      ctx.addIssue({
        code: "custom",
        path: ["leadTimeMaxDays"],
        message: "«До» не может быть меньше «от»",
      });
    }
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;

const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Адрес товара из названия: «Абажур макраме» → «abazhur-makrame». */
export function productSlugFromName(name: string): string {
  return [...name.toLowerCase()]
    .map((char) => TRANSLIT[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
}
