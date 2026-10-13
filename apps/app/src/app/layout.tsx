import { APP_CONFIG } from "@stariva/config";
import { cn, ThemeProvider, ThemeToggle, Toaster } from "@stariva/ui";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { ConfirmProvider } from "~/components/confirm-dialog";
import { env } from "~/env";
import { ORPCReactProvider } from "~/orpc/react";

import "~/app/styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    env.VERCEL_ENV === "production" ? APP_CONFIG.url : "http://localhost:3000",
  ),
  title: { default: "Stariva — админка", template: "%s — админка Stariva" },
  description: "Управление каталогом Stariva",
  // Админка не для поисковиков
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
          GeistSans.variable,
          GeistMono.variable,
        )}
      >
        <ThemeProvider>
          <ORPCReactProvider>
            <ConfirmProvider>{props.children}</ConfirmProvider>
          </ORPCReactProvider>
          <div className="absolute right-4 bottom-4">
            <ThemeToggle />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
