import { SITE_URL as BASE_URL } from "@/lib/site-url";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Suspense } from "react";
import { ChatWidget } from "@/components/stariva/chat-widget";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/stariva/json-ld";
import { Metrika } from "@/components/stariva/metrika";
import { Toaster } from "@/components/ui/sonner";
import { baseEnv } from "@/env";
import { CartProvider } from "@/lib/cart/cart-context";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});



export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Stariva — Абажуры и декор из макраме ручной работы",
    template: "%s — Stariva",
  },
  description:
    "Абажуры, одежда и декор из макраме ручной работы. Выберите изделие в каталоге Stariva и оформите заказ на сайте.",
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
    title: "Stariva — Абажуры и декор из макраме ручной работы",
    description:
      "Эксклюзивные абажуры, платья и декор из макраме. Ручное плетение из натурального хлопка с 2018 года.",
    images: [
      {
        url: "/images/about/hero-founder.jpg",
        width: 1200,
        height: 630,
        alt: "Stariva — мастерская ручного макраме",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stariva — Абажуры и декор из макраме ручной работы",
    description:
      "Эксклюзивные абажуры, платья и декор из макраме. Ручное плетение из натурального хлопка с 2018 года.",
    images: ["/images/about/hero-founder.jpg"],
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
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon-96x96.png",
        type: "image/png",
        sizes: "96x96",
      },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={`${cormorant.variable} ${inter.variable} bg-white`}
    >
      <body className="font-sans antialiased bg-white text-near-black">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <CartProvider>
          {children}
          <ChatWidget />
        </CartProvider>
        <Toaster position="top-center" richColors />
        {baseEnv.NODE_ENV === "production" && (
          <Suspense fallback={null}>
            <Metrika />
          </Suspense>
        )}
      </body>
    </html>
  );
}
