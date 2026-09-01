import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";
import { ChatWidget } from "@/components/stariva/chat-widget";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/stariva/json-ld";
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

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Stariva — Абажуры и декор из макраме ручной работы",
    template: "%s — Stariva",
  },
  description:
    "Эксклюзивные абажуры, платья и декор из макраме. Ручное плетение из натурального хлопка с 2018 года. Купить на Ozon.",
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
        {baseEnv.NODE_ENV === "production" && <Analytics />}
        {baseEnv.NODE_ENV === "production" && (
          <>
            <Script id="yandex-metrika" strategy="afterInteractive">
              {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window, document,'script','https://mc.yandex.ru/metrika/tag.js', 'ym');ym(96190087, 'init', {webvisor:true, clickmap:true, referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`}
            </Script>
            <noscript>
              <div>
                {/* biome-ignore lint/performance/noImgElement: Yandex Metrika noscript pixel, next/image cannot be used inside noscript */}
                <img
                  src="https://mc.yandex.ru/watch/96190087"
                  style={{ position: "absolute", left: "-9999px" }}
                  alt=""
                />
              </div>
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}
