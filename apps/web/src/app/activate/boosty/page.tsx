import type { Metadata } from "next";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { BoostyActivationForm } from "./form";

export const metadata: Metadata = {
  title: "Активация мастер-класса после Boosty",
  robots: { index: false, follow: false },
};

export default function BoostyActivationPage() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh] bg-parchment px-5 py-20 text-espresso">
        <div className="mx-auto max-w-xl">
          <p className="label-caps text-terracotta">Мастер-классы Stariva</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight">
            Активация после покупки на Boosty
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-grey">
            Укажите email, который вы ввели перед переходом на Boosty. Если
            оплата прошла, доступ откроется сразу, а на почту придёт ссылка для
            входа.
          </p>
          <BoostyActivationForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
