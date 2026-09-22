"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics";
import { COOKIE_CONSENT_EVENT } from "@/lib/cookie-consent";

export function Metrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the current URL is read inside trackPageView
  useEffect(() => {
    if (pathname) trackPageView();
  }, [pathname, searchParams]);
  // Счётчик стартует только после согласия в cookie-баннере.
  useEffect(() => {
    const onConsent = () => trackPageView();
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
  }, []);
  return null;
}
