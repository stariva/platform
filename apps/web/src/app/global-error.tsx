"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/stariva/error-screen";
import { fontVariables } from "./fonts";
import "./globals.css";

// Заменяет корневой layout целиком, поэтому свои html и body.
// Без этого файла Next показывает английскую заглушку «This page couldn't load».
export default function GlobalError({ error }: { error: unknown }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ru" className={`${fontVariables} bg-white`}>
      <head>
        <title>Ошибка — Stariva</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans antialiased bg-white text-near-black">
        {/* Полная перезагрузка: упавший роутер retry() не поднимет */}
        <ErrorScreen onRetry={() => window.location.reload()} />
      </body>
    </html>
  );
}
