"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics";

export function Metrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the current URL is read inside trackPageView
  useEffect(() => {
    if (pathname) trackPageView();
  }, [pathname, searchParams]);
  return null;
}
