"use client";

import { useEffect, useState } from "react";
import { reachGoal } from "@/lib/analytics";
import { COOKIE_CONSENT_EVENT } from "@/lib/cookie-consent";
import {
  WORKSHOP_BUY_ID,
  WORKSHOP_QUICK_BUY_ID,
  WORKSHOP_SECTION_ID,
} from "../_data";

const COOKIE_BANNER = '[role="dialog"][aria-label="Настройки cookie"]';

/**
 * Кнопка предзаказа внизу экрана на телефоне. Из рекламы приходят сразу на
 * #workshop, а форма оплаты — на несколько экранов ниже. Видна только в блоке
 * мастер-класса и прячется, когда форма уже на экране или открыта
 * клавиатура; над cookie-баннером поднимается,
 * а не исчезает — большинство посетителей баннер не закрывают.
 */
export function WorkshopStickyCta({ label }: { label: string }) {
  const [inSection, setInSection] = useState(false);
  // Кнопка в тексте блока или форма оплаты уже на экране — дублировать незачем.
  const [ctaVisible, setCtaVisible] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [bannerOffset, setBannerOffset] = useState(0);

  useEffect(() => {
    const section = document.getElementById(WORKSHOP_SECTION_ID);
    const targets = [WORKSHOP_QUICK_BUY_ID, WORKSHOP_BUY_ID]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!section) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === section) setInSection(entry.isIntersecting);
        else
          setCtaVisible((prev) => ({
            ...prev,
            [entry.target.id]: entry.isIntersecting,
          }));
      }
    });
    observer.observe(section);
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateEditing = () =>
      setEditing(
        Boolean(document.activeElement?.matches("input,textarea,select")),
      );
    const updateBanner = () => {
      const banner = document.querySelector<HTMLElement>(COOKIE_BANNER);
      setBannerOffset(banner ? banner.offsetHeight + 12 : 0);
    };
    updateBanner();
    // Баннер монтируется после гидрации — перепроверяем, когда он появится.
    const timer = window.setTimeout(updateBanner, 500);
    document.addEventListener("focusin", updateEditing);
    document.addEventListener("focusout", updateEditing);
    window.addEventListener(COOKIE_CONSENT_EVENT, updateBanner);
    window.addEventListener("resize", updateBanner);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", updateEditing);
      document.removeEventListener("focusout", updateEditing);
      window.removeEventListener(COOKIE_CONSENT_EVENT, updateBanner);
      window.removeEventListener("resize", updateBanner);
    };
  }, []);

  return (
    <div
      hidden={!inSection || Object.values(ctaVisible).some(Boolean) || editing}
      // Справа оставляем место под круглую кнопку чата.
      className="lg:hidden fixed left-3 right-[4.75rem] z-[60]"
      style={{
        bottom: `calc(${bannerOffset + 12}px + env(safe-area-inset-bottom))`,
      }}
    >
      <a
        href={`#${WORKSHOP_BUY_ID}`}
        onClick={() => reachGoal("elka_sticky_cta")}
        className="flex min-h-12 items-center justify-center rounded-full bg-terracotta px-5 text-sm font-medium text-parchment shadow-lg shadow-terracotta/30"
      >
        {label}
      </a>
    </div>
  );
}
