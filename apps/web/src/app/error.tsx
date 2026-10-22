"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/stariva/error-screen";

export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen onRetry={retry} />;
}
