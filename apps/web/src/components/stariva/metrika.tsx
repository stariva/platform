"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { reachGoal, trackPageView } from "@/lib/analytics";
import { captureCampaign } from "@/lib/campaign-attribution";
import { COOKIE_CONSENT_EVENT } from "@/lib/cookie-consent";

export function Metrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the current URL is read inside trackPageView
  useEffect(() => {
    if (pathname) {
      captureCampaign();
      trackPageView();
    }
  }, [pathname, searchParams]);
  // Счётчик стартует только после согласия в cookie-баннере.
  useEffect(() => {
    const onConsent = () => {
      captureCampaign();
      trackPageView();
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
  }, []);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href, window.location.origin);
      const location =
        link.dataset.location ??
        link.closest("section")?.id ??
        (link.closest("header")
          ? "header"
          : link.closest("footer")
            ? "footer"
            : "page");
      if (url.hostname === "t.me") reachGoal("telegram_click", { location });
      else if (url.protocol === "tel:") reachGoal("phone_click", { location });
      else if (url.origin === window.location.origin && url.hash === "#order")
        reachGoal("custom_order_cta", { location });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
