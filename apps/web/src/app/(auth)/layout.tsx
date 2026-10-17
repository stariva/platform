import Link from "next/link";
import type { ReactNode } from "react";
import { AuthBackground } from "./auth-background";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen text-espresso flex flex-col">
      <AuthBackground />
      <header className="px-6 pt-8 sm:pt-10 flex justify-center">
        <Link
          href="/"
          className="font-serif tracking-[0.18em] uppercase text-espresso text-2xl"
          aria-label="Stariva — на главную"
        >
          Stariva
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
      <footer className="px-6 py-6 text-center text-xs text-taupe">
        © {new Date().getFullYear()} Stariva · Изделия в технике макраме ручной
        работы
      </footer>
    </div>
  );
}
