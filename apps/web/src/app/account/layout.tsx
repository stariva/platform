import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { requireSession } from "@/lib/auth/session";
import { AccountNav } from "./account-nav";

export const metadata: Metadata = {
  title: "Личный кабинет",
  robots: { index: false, follow: false },
};

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession("/account");

  return (
    <div className="min-h-screen bg-parchment text-espresso">
      <Header variant="solid" />
      <div className="max-w-6xl mx-auto px-5 lg:px-10 pt-24 pb-16">
        <header className="mb-8">
          <p className="label-caps text-[11px] text-taupe mb-1">
            Личный кабинет
          </p>
          <h1 className="font-serif text-3xl text-espresso">
            {session.user.name
              ? `Здравствуйте, ${session.user.name}`
              : "Здравствуйте"}
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <AccountNav />
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
