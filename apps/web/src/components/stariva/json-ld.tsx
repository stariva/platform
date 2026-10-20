import { CONTACTS } from "@/lib/contacts";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { absoluteImageUrl } from "@/lib/workshops-data";
/**
 * JSON-LD structured data components for SEO.
 * Renders schema.org markup as <script type="application/ld+json"> tags.
 */

/**
 * JSON для тега script. JSON.stringify не экранирует «<», и отзыв покупателя
 * с «</script>» закрыл бы тег и выполнил свой код — заменяем на <.
 * @see node_modules/next/dist/docs/01-app/02-guides/json-ld.md
 */
export function toJsonLd(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

// ─── Organization / LocalBusiness ────────────────────────────────────────────

export function OrganizationJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${BASE_URL}/#organization`,
    name: "Stariva",
    alternateName: "Старива",
    description:
      "Ручное макраме из Подмосковья: одежда, абажуры и декор из натурального хлопка. Плетёт мастер Ольга, с 2018 года.",
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/favicon.svg`,
      width: 512,
      height: 512,
    },
    image: [
      `https://cdn.stariva.ru/site/images/about/founder-2026.jpg`,
      `https://cdn.stariva.ru/site/images/about/atelier-wide.jpg`,
      `https://cdn.stariva.ru/site/images/catalog/lampshade-dome.jpg`,
    ],
    telephone: "+79778722546",
    email: "info@stariva.ru",
    address: {
      "@type": "PostalAddress",
      addressRegion: "Московская область",
      addressCountry: "RU",
    },
    geo: {
      "@type": "GeoCoordinates",
      addressCountry: "RU",
    },
    foundingDate: "2018",
    founder: {
      "@type": "Person",
      name: "Ольга Карпычева",
      jobTitle: "Мастер макраме",
      url: `${BASE_URL}/about`,
    },
    priceRange: "₽₽",
    currenciesAccepted: "RUB",
    paymentAccepted: "Cash, Credit Card, Online Payment",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "10:00",
        closes: "20:00",
      },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Изделия в технике макраме",
      itemListElement: [
        {
          "@type": "OfferCatalog",
          name: "Одежда в технике макраме",
          url: `${BASE_URL}/catalog/clothes`,
        },
        {
          "@type": "OfferCatalog",
          name: "Абажуры в технике макраме",
          url: `${BASE_URL}/abazhury`,
        },
        {
          "@type": "OfferCatalog",
          name: "Сумки в технике макраме",
          url: `${BASE_URL}/catalog/bags`,
        },
        {
          "@type": "OfferCatalog",
          name: "Декор интерьера в технике макраме",
          url: `${BASE_URL}/catalog/interior`,
        },
      ],
    },
    sameAs: [
      "https://vk.com/stariva_macrame",
      "https://pinterest.com/stariva",
      "https://www.livemaster.ru/olga-meu",
      CONTACTS.telegramUrl,
    ],
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}

// ─── WebSite ─────────────────────────────────────────────────────────────────
// Без SearchAction: поиска по каталогу (?q=) на сайте нет, а поле поиска
// в выдаче Google убрал в 2024 году.

export function WebSiteJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    url: BASE_URL,
    name: "Stariva",
    description:
      "Изделия ручного макраме из натурального хлопка — одежда, абажуры, декор",
    inLanguage: "ru-RU",
    publisher: {
      "@id": `${BASE_URL}/#organization`,
    },
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────

interface BreadcrumbItem {
  name: string;
  href: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}

// ─── Product ─────────────────────────────────────────────────────────────────

/**
 * Категория из таксономии товаров Google — свои названия разделов
 * («Одежда») Google считает недопустимым значением.
 * @see https://support.google.com/merchants/answer/6324436
 */
const GOOGLE_CATEGORY_BY_SUBCATEGORY: Record<string, string> = {
  belts: "Apparel & Accessories > Clothing Accessories > Belts",
  totes: "Apparel & Accessories > Handbags, Wallets & Cases > Handbags",
  crossbody: "Apparel & Accessories > Handbags, Wallets & Cases > Handbags",
  lampshades: "Home & Garden > Lighting Accessories > Lamp Shades",
  placemats: "Home & Garden > Linens & Bedding > Table Linens > Placemats",
  trees: "Home & Garden > Decor > Seasonal & Holiday Decorations",
};

const GOOGLE_CATEGORY_BY_CATEGORY: Record<string, string> = {
  clothes: "Apparel & Accessories > Clothing",
  bags: "Apparel & Accessories > Handbags, Wallets & Cases",
  interior: "Home & Garden > Decor",
};

export function googleProductCategory(
  category: string,
  subcategory: string,
): string {
  return (
    GOOGLE_CATEGORY_BY_SUBCATEGORY[subcategory] ??
    GOOGLE_CATEGORY_BY_CATEGORY[category] ??
    "Home & Garden > Decor"
  );
}

/** Длиннее Google не принимает поле material. */
const MAX_MATERIAL_LENGTH = 200;

/** Доставка Ozon до пункта выдачи по России. */
const TRANSIT_DAYS = { min: 2, max: 7 };

/** Возврат товара надлежащего качества — раздел 6 оферты. */
const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "RU",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 7,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
  merchantReturnLink: `${BASE_URL}/offer`,
};

function dayRange({ min, max }: { min: number; max: number }) {
  return {
    "@type": "QuantitativeValue",
    minValue: min,
    maxValue: max,
    unitCode: "DAY",
  };
}

interface ProductJsonLdProps {
  name: string;
  description: string;
  image: string[];
  price: number;
  currency?: string;
  inStock: boolean;
  madeToOrder: boolean;
  /** Сколько дней до отправки: со склада или на изготовление. */
  handlingDays: { min: number; max: number };
  url: string;
  category: string;
  subcategory: string;
  material?: string;
  color?: string;
  brand?: string;
  rating?: { average: number; count: number } | null;
  reviews?: {
    reviewerName: string;
    date: string;
    text: string;
    rating: number;
  }[];
}

/** Emits product structured data, including available Ozon ratings and reviews. */
export function ProductJsonLd({
  name,
  description,
  image,
  price,
  currency = "RUB",
  inStock,
  madeToOrder,
  handlingDays,
  url,
  category,
  subcategory,
  material,
  color,
  brand = "Stariva",
  rating,
  reviews,
}: ProductJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image,
    brand: {
      "@type": "Brand",
      name: brand,
    },
    category: googleProductCategory(category, subcategory),
    url: `${BASE_URL}${url}`,
    offers: {
      "@type": "Offer",
      price: price.toString(),
      priceCurrency: currency,
      // MadeToOrder Google не принимает: изделие под заказ отправим после
      // изготовления, это BackOrder со сроком в handlingTime
      availability: inStock
        ? "https://schema.org/InStock"
        : madeToOrder
          ? "https://schema.org/BackOrder"
          : "https://schema.org/OutOfStock",
      seller: {
        "@id": `${BASE_URL}/#organization`,
      },
      url: `${BASE_URL}${url}`,
      // Цену доставки считает Ozon при оформлении — указываем только регион и сроки
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "RU",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: dayRange(handlingDays),
          transitTime: dayRange(TRANSIT_DAYS),
        },
      },
      hasMerchantReturnPolicy: RETURN_POLICY,
    },
  };

  if (material && material.length <= MAX_MATERIAL_LENGTH) {
    schema.material = material;
  }

  if (color) {
    schema.color = color;
  }

  if (rating && rating.count > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.average.toFixed(1),
      ratingCount: rating.count,
      bestRating: "5",
      worstRating: "1",
    };
  }

  if (reviews && reviews.length > 0) {
    schema.review = reviews.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.reviewerName },
      datePublished: r.date.split("T")[0],
      reviewBody: r.text,
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
      },
    }));
  }

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}

// ─── Article (Blog Post) ──────────────────────────────────────────────────────

interface ArticleJsonLdProps {
  title: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified?: string;
  url: string;
  authorName?: string;
}

export function ArticleJsonLd({
  title,
  description,
  image,
  datePublished,
  dateModified,
  url,
  authorName = "Ольга Карпычева",
}: ArticleJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: absoluteImageUrl(BASE_URL, image),
    datePublished,
    dateModified: dateModified ?? datePublished,
    url: `${BASE_URL}${url}`,
    author: {
      "@type": "Person",
      name: authorName,
      url: `${BASE_URL}/about`,
    },
    publisher: {
      "@id": `${BASE_URL}/#organization`,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}${url}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}

// ─── Course (Workshop) ────────────────────────────────────────────────────────

interface CourseJsonLdProps {
  name: string;
  description: string;
  image: string;
  price: number;
  url: string;
  duration: string; // e.g. "3 ч 20 мин"
  level: "beginner" | "intermediate" | "advanced";
  lessonsCount: number;
  ozonUrl?: string;
  /** Уроки ещё не открылись — курс продаётся как предзаказ. */
  preorder?: boolean;
}

const levelMap = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function CourseJsonLd({
  name,
  description,
  image,
  price,
  url,
  duration,
  level,
  lessonsCount,
  ozonUrl,
  preorder,
}: CourseJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    description,
    image: image.startsWith("http") ? image : `${BASE_URL}${image}`,
    url: `${BASE_URL}${url}`,
    educationalLevel: levelMap[level],
    // У предзаказа уроков ещё нет — не пишем нули и пустую длительность
    numberOfCredits: lessonsCount > 0 ? lessonsCount : undefined,
    timeRequired: duration || undefined,
    inLanguage: "ru-RU",
    provider: {
      "@id": `${BASE_URL}/#organization`,
    },
    offers: {
      "@type": "Offer",
      price: price.toString(),
      priceCurrency: "RUB",
      availability: preorder
        ? "https://schema.org/PreOrder"
        : "https://schema.org/InStock",
      url: ozonUrl ?? `${BASE_URL}${url}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}

// ─── ItemList (Catalog / Blog listing) ───────────────────────────────────────

interface ItemListJsonLdProps {
  name: string;
  url: string;
  items: { name: string; url: string; image?: string }[];
}

export function ItemListJsonLd({ name, url, items }: ItemListJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: `${BASE_URL}${url}`,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: `${BASE_URL}${item.url}`,
      ...(item.image ? { image: item.image } : {}),
    })),
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}

// ─── FAQPage ──────────────────────────────────────────────────────────────────

export interface FAQItem {
  question: string;
  answer: string;
}

export function FAQJsonLd({ items }: { items: FAQItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}

// ─── Person (Founder) ─────────────────────────────────────────────────────────

export function PersonJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${BASE_URL}/#founder`,
    name: "Ольга Карпычева",
    alternateName: "Olga Karpycheva",
    jobTitle: "Мастер макраме",
    description:
      "Мастер ручного макраме из Подмосковья. Создаёт одежду, абажуры и декор из натурального хлопка с 2018 года.",
    url: `${BASE_URL}/about`,
    image: `https://cdn.stariva.ru/site/images/about/founder-2026.jpg`,
    worksFor: {
      "@id": `${BASE_URL}/#organization`,
    },
    sameAs: [CONTACTS.telegramUrl, "https://vk.com/stariva_macrame"],
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd экранирует «<», из JSON не закрыть тег script
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  );
}
