"use client";

import { useEffect, useRef } from "react";
import { type AnalyticsProduct, trackProductEvent } from "@/lib/analytics";

export function ProductAnalytics({ product }: { product: AnalyticsProduct }) {
  const previous = useRef("");
  useEffect(() => {
    if (previous.current === product.id) return;
    trackProductEvent("detail", [product]);
    previous.current = product.id;
  }, [product]);
  return null;
}
