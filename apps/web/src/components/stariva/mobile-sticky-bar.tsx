"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { trackOzonClick } from "@/lib/analytics";
import { OzonIcon, PhoneIcon, TelegramIcon } from "./icons";

interface MobileStickyBarProps {
  /** If provided, shows an Ozon CTA instead of the default contact bar */
  ozonUrl?: string;
  productName?: string;
}

export function MobileStickyBar({
  ozonUrl,
  productName,
}: MobileStickyBarProps) {
  const [show, setShow] = useState(false);
  const _pathname = usePathname();

  // Show after scrolling past the hero / product info
  const threshold = ozonUrl ? 400 : 600;

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const isVisible = show;

  // ── Product page variant: Ozon CTA ────────────────────────────────────────
  if (ozonUrl) {
    return (
      <div
        className={`lg:hidden fixed bottom-3 left-3 right-3 z-50 transition-all duration-500 ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6 pointer-events-none"
        }`}
      >
        <a
          href={ozonUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            productName && trackOzonClick("product", productName, ozonUrl)
          }
          className="flex items-center justify-center gap-3 w-full bg-[#005BFF] text-white py-4 px-6 rounded-2xl shadow-[0_8px_24px_rgba(0,91,255,0.40)] label-caps text-[13px]"
        >
          <OzonIcon className="w-5 h-5" />
          Купить на Ozon
        </a>
      </div>
    );
  }

  // ── Default variant: contact bar ──────────────────────────────────────────
  return (
    <div
      className={`lg:hidden fixed bottom-3 left-3 right-3 z-50 transition-all duration-500 ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6 pointer-events-none"
      }`}
    >
      <div className="bg-parchment/95 backdrop-blur-md border border-espresso/15 rounded-full p-1.5 shadow-[0_8px_30px_rgba(44,36,27,0.12)] flex gap-2">
        <a
          href="https://t.me/Olga_Stariva"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-terracotta text-parchment label-caps-md"
        >
          <TelegramIcon className="w-4 h-4" />
          Telegram
        </a>
        <a
          href="tel:+79778722546"
          className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-full border border-espresso/20 text-espresso label-caps-md"
        >
          <PhoneIcon className="w-4 h-4" />
          Позвонить
        </a>
      </div>
    </div>
  );
}
