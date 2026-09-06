"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics";

export function Metrika() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) trackPageView();
  }, [pathname]);
  return null;
}
