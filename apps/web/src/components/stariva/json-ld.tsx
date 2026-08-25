/**
 * JSON-LD structured data components for SEO.
 * Renders schema.org markup as <script type="application/ld+json"> tags.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

// ─── Organization / LocalBusiness ────────────────────────────────────────────

export function OrganizationJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${BASE_URL}/#organization`,
    name: "Stariva",
    alternateName: "Старива",
    description:
      "Мастерская ручного макраме из Подмосковья. Абажуры, одежда и декор из натурального хлопка с 2018 года.",
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/favicon.svg`,
      width: 512,
      height: 512,
    },
    image: [
      `${BASE_URL}/images/about/hero-founder.jpg`,
      `${BASE_URL}/images/about/atelier-wide.jpg`,
      `${BASE_URL}/images/catalog/lampshade-dome.jpg`,
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
      name: "Изделия из макраме",
      itemListElement: [
        {
          "@type": "OfferCatalog",
          name: "Абажуры из макраме",
          url: `${BASE_URL}/catalog/interior`,
        },
        {
          "@type": "OfferCatalog",
          name: "Одежда из макраме",
          url: `${BASE_URL}/catalog/clothes`,
        },
        {
          "@type": "OfferCatalog",
          name: "Сумки из макраме",
          url: `${BASE_URL}/catalog/bags`,
        },
      ],
    },
    sameAs: [
      "https://vk.com/stariva_macrame",
      "https://pinterest.com/stariva",
      "https://www.livemaster.ru/olga-meu",
      "https://t.me/Olga_Stariva",
    ],
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static schema.org data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ─── WebSite (enables Sitelinks Searchbox) ───────────────────────────────────

export function WebSiteJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    url: BASE_URL,
    name: "Stariva",
    description:
      "Изделия ручного макраме из натурального хлопка — абажуры, одежда, декор",
    inLanguage: "ru-RU",
    publisher: {
      "@id": `${BASE_URL}/#organization`,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/catalog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static schema.org data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static schema.org data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ─── Product ─────────────────────────────────────────────────────────────────

interface ProductJsonLdProps {
  name: string;
  description: string;
  image: string[];
  price: number;
  oldPrice?: number;
  currency?: string;
  inStock: boolean;
  url: string;
  category: string;
  material?: string;
  brand?: string;
}

export function ProductJsonLd({
  name,
  description,
  image,
  price,
  oldPrice,
  currency = "RUB",
  inStock,
  url,
  category,
  material,
  brand = "Stariva",
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
    category,
    url: `${BASE_URL}${url}`,
    offers: {
      "@type": "Offer",
      price: price.toString(),
      priceCurrency: currency,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@id": `${BASE_URL}/#organization`,
      },
      url: `${BASE_URL}${url}`,
    },
  };

  if (material) {
    schema.material = material;
  }

  if (oldPrice) {
    (schema.offers as Record<string, unknown>).priceValidUntil = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split("T")[0];
  }

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted product data from Ozon API
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
    image: `${BASE_URL}${image}`,
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static blog data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
}: CourseJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    description,
    image: `${BASE_URL}${image}`,
    url: `${BASE_URL}${url}`,
    educationalLevel: levelMap[level],
    numberOfCredits: lessonsCount,
    timeRequired: duration,
    inLanguage: "ru-RU",
    provider: {
      "@id": `${BASE_URL}/#organization`,
    },
    offers: {
      "@type": "Offer",
      price: price.toString(),
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
      url: ozonUrl ?? `${BASE_URL}${url}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static workshop data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static list data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ─── FAQPage ──────────────────────────────────────────────────────────────────

interface FAQItem {
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static FAQ data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
    alternateName: "Olga Kapycheva",
    jobTitle: "Мастер макраме",
    description:
      "Мастер ручного макраме из Подмосковья. Создаёт абажуры, одежду и декор из натурального хлопка с 2018 года.",
    url: `${BASE_URL}/about`,
    image: `${BASE_URL}/images/about/hero-founder.jpg`,
    worksFor: {
      "@id": `${BASE_URL}/#organization`,
    },
    sameAs: ["https://t.me/Olga_Stariva", "https://vk.com/stariva_macrame"],
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static person data
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
