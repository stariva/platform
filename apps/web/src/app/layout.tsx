import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatWidget } from "@/components/stariva/chat-widget";
import { ContactClickTracker } from "@/components/stariva/contact-click-tracker";
import { CookieBanner } from "@/components/stariva/cookie-banner";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/stariva/json-ld";
import { Metrika } from "@/components/stariva/metrika";
import { VisitorEnv } from "@/components/stariva/visitor-env";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/lib/cart/cart-context";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Stariva — Абажуры и декор в технике макраме ручной работы",
    template: "%s — Stariva",
  },
  description:
    "Одежда, абажуры и декор в технике макраме ручной работы. Выберите изделие в каталоге Stariva и оформите заказ на сайте.",
  keywords: [
    "макраме",
    "абажур из макраме",
    "макраме ручная работа",
    "купить макраме",
    "декор интерьера макраме",
    "платье макраме",
    "мастер-класс макраме",
    "Stariva",
  ],
  authors: [{ name: "Ольга Карпычева", url: `${BASE_URL}/about` }],
  creator: "Ольга Карпычева",
  publisher: "Stariva",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: BASE_URL,
    siteName: "Stariva",
    title: "Stariva — Абажуры и декор в технике макраме ручной работы",
    description:
      "Эксклюзивные платья, абажуры и декор в технике макраме. Ручное плетение из натурального хлопка с 2018 года.",
    images: [
      {
        url: "https://cdn.stariva.ru/site/images/about/founder-2026.jpg",
        width: 1200,
        height: 630,
        alt: "Stariva — ручное макраме",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stariva — Абажуры и декор в технике макраме ручной работы",
    description:
      "Эксклюзивные платья, абажуры и декор в технике макраме. Ручное плетение из натурального хлопка с 2018 года.",
    images: ["https://cdn.stariva.ru/site/images/about/founder-2026.jpg"],
  },
  verification: {
    other: {
      "yandex-verification": "e889c7fefe9519f3",
      // Pinterest Rich Pins verification — подтвердить на pinterest.com/website/verify/
      "p:domain_verify": "d792755a6d4c2df8e315e33395176200",
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
  manifest: "/site.webmanifest",
  // iOS Safari сам превращает номера в ссылки до гидрации, и React видит чужой DOM.
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        type: "image/x-icon",
        sizes: "16x16 32x32 48x48",
      },
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        url: "/favicon-96x96.png",
        type: "image/png",
        sizes: "96x96",
      },
    ],
    apple: {
      url: "/apple-touch-icon.png",
      type: "image/png",
      sizes: "180x180",
    },
  },
};

// stariva.ru//test: перед приложением слэши склеиваются, сервер рендерит
// /test, а в адресной строке остаётся //test. Роутер Next читает это как
// ссылку на хост «test», падает при гидрации и вместо страницы показывает
// global-error. Чиним адрес до гидрации, без перезагрузки.
const COLLAPSE_SLASHES = `if(location.pathname.indexOf("//")>-1)history.replaceState(history.state,"",location.pathname.replace(/\\/{2,}/g,"/")+location.search+location.hash)`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={`${fontVariables} bg-white`}
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: свой статический код, без данных извне
          dangerouslySetInnerHTML={{ __html: COLLAPSE_SLASHES }}
        />
      </head>
      <body className="font-sans antialiased bg-white text-near-black">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <CartProvider>
          {children}
          <ChatWidget />
        </CartProvider>
        <Toaster position="top-center" richColors />
        <CookieBanner />
        <VisitorEnv />
        <ContactClickTracker />
        <Suspense fallback={null}>
          <Metrika />
        </Suspense>
      </body>
    </html>
  );
}
