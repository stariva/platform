import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = {
  title: "Корзина",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
