import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { LEGAL_VERSION_LABEL, SELLER } from "@/lib/legal";

/** Каркас страниц правовых документов: оферта, политика, согласие. */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-parchment text-espresso">
      <Header variant="solid" />

      <main className="max-w-[860px] mx-auto px-6 lg:px-14 pt-32 pb-28 lg:pt-40 lg:pb-40">
        <p className="label-caps text-terracotta tracking-widest mb-5">
          Правовые документы
        </p>
        <h1 className="font-serif text-[clamp(2.2rem,4.5vw,4rem)] text-espresso leading-[1.05] mb-12">
          {title}
        </h1>

        <div className="space-y-10 text-espresso/80 text-[15px] leading-[1.85]">
          {children}

          <p className="pt-6 border-t border-espresso/10 text-espresso/50 text-[13px]">
            Редакция от {LEGAL_VERSION_LABEL}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export function LegalSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 space-y-4">
      <h2 className="font-serif text-2xl text-espresso">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 list-none pl-0">
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static legal text
        <li key={i} className="flex items-start gap-3">
          <span className="mt-3 w-1.5 h-1.5 rounded-full bg-terracotta flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function SellerEmail() {
  return (
    <a
      href={`mailto:${SELLER.email}`}
      className="text-terracotta hover:underline"
    >
      {SELLER.email}
    </a>
  );
}

export function SellerPhone() {
  return (
    <a href={SELLER.phoneHref} className="text-terracotta hover:underline">
      {SELLER.phone}
    </a>
  );
}

export function SellerDetails() {
  return (
    <div className="space-y-1">
      <p>{SELLER.name}</p>
      <p>{SELLER.status}</p>
      <p>ИНН: {SELLER.inn}</p>
      <p>Адрес: {SELLER.address}</p>
      <p>
        Email: <SellerEmail />
      </p>
      <p>
        Телефон: <SellerPhone />
      </p>
      <p>Сайт: {SELLER.site}</p>
    </div>
  );
}
