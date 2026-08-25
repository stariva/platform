import Link from "next/link";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";

const links = [
  { label: "Каталог", href: "/catalog" },
  { label: "Одежда", href: "/catalog/clothes" },
  { label: "Сумки", href: "/catalog/bags" },
  { label: "Декор интерьера", href: "/catalog/decor" },
  { label: "Мастер-классы", href: "/workshops" },
  { label: "Блог", href: "/blog" },
];

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="solid" />

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-24 lg:py-40">
        {/* Large editorial number */}
        <div className="relative select-none mb-10 lg:mb-16" aria-hidden="true">
          <span className="font-serif text-[clamp(140px,28vw,320px)] leading-none text-near-black/[0.04] tracking-tighter pointer-events-none">
            404
          </span>
          {/* Overlaid thin rule — macrame thread motif */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="block h-px w-16 bg-near-black/20" />
                <span className="block h-px w-4 bg-near-black/10" />
                <span className="block h-px w-2 bg-near-black/6" />
              </div>
              <span className="font-serif italic text-[clamp(1.5rem,4vw,2.5rem)] text-near-black tracking-tight">
                Страница не найдена
              </span>
              <div className="flex items-center gap-2">
                <span className="block h-px w-2 bg-near-black/6" />
                <span className="block h-px w-4 bg-near-black/10" />
                <span className="block h-px w-16 bg-near-black/20" />
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-mid-grey text-base lg:text-lg text-center max-w-md leading-[1.8] mb-12">
          Возможно, страница была перемещена или удалена. Попробуйте найти
          нужное через меню или воспользуйтесь ссылками ниже.
        </p>

        {/* Primary CTA */}
        <Link
          href="/"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-near-black text-white font-sans text-xs tracking-widest uppercase hover:bg-dark-grey transition-colors mb-12"
        >
          На главную
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 7h10M8 3l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8 w-full max-w-sm">
          <span className="flex-1 h-px bg-light-grey" />
          <span className="text-mid-grey text-[11px] tracking-widest uppercase font-sans">
            или перейдите
          </span>
          <span className="flex-1 h-px bg-light-grey" />
        </div>

        {/* Quick nav links */}
        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 rounded-full border border-light-grey text-dark-grey text-xs tracking-wide font-sans hover:border-near-black hover:text-near-black transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
