"use client";

import { useEffect } from "react";
import { WORKSHOP_AD_CAMPAIGNS, WORKSHOP_SECTION_ID } from "../_data";

/**
 * Из рекламы мастер-класса сразу к блоку мастер-класса: на телефоне он
 * в десятке экранов от начала, под продажей готовых ёлок. Якорь в ссылке
 * (#…) уважаем — его браузер прокрутит сам.
 */
export function WorkshopAdScroll() {
  useEffect(() => {
    const url = new URL(window.location.href);
    // Как в touchFromUrl: метка с пробелами по краям — та же кампания.
    const campaign = url.searchParams.get("utm_campaign")?.trim();
    if (url.hash || !campaign || !WORKSHOP_AD_CAMPAIGNS.includes(campaign))
      return;
    const section = document.getElementById(WORKSHOP_SECTION_ID);
    if (!section) return;
    // Без анимации: плавная прокрутка (scroll-behavior: smooth) на десяток
    // экранов прерывается, пока страница догружается, и остаётся наверху.
    section.scrollIntoView({ block: "start", behavior: "instant" });
    // Якорь в адресе: «назад» после оплаты и обновление страницы вернут сюда же.
    url.hash = WORKSHOP_SECTION_ID;
    window.history.replaceState(window.history.state, "", url);
  }, []);
  return null;
}
