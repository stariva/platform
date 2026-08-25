"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth/client";

const catalogNav = [
  {
    label: "Одежда",
    href: "/catalog/clothes",
    desc: "Платья, топы и накидки из натурального хлопка ручного плетения",
    image: "/images/catalog/category-clothes.jpg",
    items: ["Платья макраме", "Топы", "Накидки"],
  },
  {
    label: "Сумки",
    href: "/catalog/bags",
    desc: "Авторские сумки, клатчи и шопперы в технике макраме",
    image: "/images/catalog/category-bags.jpg",
    items: ["Шопперы", "Клатчи", "Кросс-боди"],
  },
  {
    label: "Декор интерьера",
    href: "/catalog/interior",
    desc: "Абажуры, панно, вигвамы и аксессуары для дома",
    image: "/images/catalog/category-decor.jpg",
    items: ["Абажуры", "Панно", "Вигвамы", "Плейсменты"],
  },
];

const b2bLinks = [
  {
    label: "Кафе и рестораны",
    href: "/b2b",
    desc: "Абажуры, зонирование, фотозоны",
  },
  {
    label: "Базы отдыха",
    href: "/resort",
    desc: "Глэмпинг, террасы, SPA, отели",
  },
];

const nav = [
  { label: "Каталог", href: "/catalog", hasMega: true },
  { label: "Мастер-классы", href: "/workshops" },
  { label: "Блог", href: "/blog" },
  { label: "Для бизнеса", href: "/b2b", hasB2b: true },
  { label: "О бренде", href: "/about" },
];

interface HeaderProps {
  variant?: "transparent" | "solid";
}

export function Header({ variant = "solid" }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [b2bOpen, setB2bOpen] = useState(false);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const b2bTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const isSolid = variant === "solid" || scrolled;

  useEffect(() => {
    if (variant === "solid") return;
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  useEffect(() => {
    setMenuOpen(false);
    setMegaOpen(false);
  }, []);

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const openMega = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMegaOpen(false), 200);
  };

  const openB2b = () => {
    if (b2bTimer.current) clearTimeout(b2bTimer.current);
    setB2bOpen(true);
  };
  const closeB2b = () => {
    if (b2bTimer.current) clearTimeout(b2bTimer.current);
    b2bTimer.current = setTimeout(() => setB2bOpen(false), 200);
  };

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const initials = (session?.user?.name || session?.user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isSolid
            ? "bg-parchment/97 backdrop-blur-md border-b border-espresso/8"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12 flex items-center justify-between h-[60px] lg:h-[68px]">
          {/* Logo */}
          <Link
            href="/"
            className="flex-shrink-0 group"
            aria-label="Stariva — на главную"
          >
            <span
              className={`flex flex-col items-start leading-none transition-colors ${isSolid ? "text-espresso" : "text-white"}`}
            >
              {/* Wordmark */}
              <span
                className="font-serif tracking-[0.12em] uppercase"
                style={{
                  fontSize: "clamp(17px, 2vw, 22px)",
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                }}
              >
                Stariva
              </span>
              {/* Decorative rule — macrame thread motif */}
              <span
                className="flex items-center gap-[3px] mt-[3px]"
                aria-hidden="true"
              >
                <span
                  className={`block h-px w-[38px] transition-all duration-500 group-hover:w-[52px] ${isSolid ? "bg-terracotta" : "bg-white/60"}`}
                />
                <span
                  className={`block h-px w-[6px] ${isSolid ? "bg-espresso/25" : "bg-white/30"}`}
                />
                <span
                  className={`block h-px w-[3px] ${isSolid ? "bg-espresso/15" : "bg-white/20"}`}
                />
              </span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((item) =>
              item.hasB2b ? (
                // biome-ignore lint/a11y/noStaticElementInteractions: wrapper div needs mouse events for dropdown hover
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={openB2b}
                  onMouseLeave={closeB2b}
                >
                  <Link
                    href={item.href}
                    className={`px-4 py-2 rounded-md label-caps-md transition-colors flex items-center gap-1.5 ${
                      isActive(item.href)
                        ? "text-terracotta"
                        : isSolid
                          ? "text-espresso/70 hover:text-espresso"
                          : "text-white/80 hover:text-white"
                    }`}
                  >
                    {item.label}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                      className={`transition-transform duration-200 ${b2bOpen ? "rotate-180" : ""}`}
                    >
                      <path
                        d="M2 3.5l3 3 3-3"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>

                  {/* biome-ignore lint/a11y/noStaticElementInteractions: dropdown bridge div needs mouse events for hover persistence */}
                  <div
                    onMouseEnter={openB2b}
                    onMouseLeave={closeB2b}
                    className={`absolute left-0 top-full pt-2 transition-all duration-200 ease-out z-50 ${
                      b2bOpen
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-y-1 pointer-events-none"
                    }`}
                  >
                    <div className="bg-white border border-espresso/8 rounded-xl shadow-[0_12px_40px_rgba(22,21,19,0.12)] overflow-hidden min-w-[220px]">
                      {b2bLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setB2bOpen(false)}
                          className={`flex flex-col px-5 py-3.5 hover:bg-off-white transition-colors border-b border-espresso/6 last:border-b-0 ${
                            isActive(link.href) ? "bg-sand/60" : ""
                          }`}
                        >
                          <span
                            className={`text-[13px] font-medium leading-snug ${isActive(link.href) ? "text-terracotta" : "text-espresso"}`}
                          >
                            {link.label}
                          </span>
                          <span className="text-[11px] text-taupe mt-0.5">
                            {link.desc}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : item.hasMega ? (
                // biome-ignore lint/a11y/noStaticElementInteractions: wrapper div needs mouse events for mega menu hover
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={openMega}
                  onMouseLeave={closeMega}
                >
                  <Link
                    href={item.href}
                    className={`px-4 py-2 rounded-md label-caps-md transition-colors flex items-center gap-1.5 ${
                      isActive(item.href)
                        ? "text-terracotta"
                        : isSolid
                          ? "text-espresso/70 hover:text-espresso"
                          : "text-white/80 hover:text-white"
                    }`}
                  >
                    {item.label}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                      className={`transition-transform duration-200 ${megaOpen ? "rotate-180" : ""}`}
                    >
                      <path
                        d="M2 3.5l3 3 3-3"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>

                  {/* Mega menu — full-width panel anchored to viewport */}
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: dropdown bridge div needs mouse events for hover persistence */}
                  <div
                    onMouseEnter={openMega}
                    onMouseLeave={closeMega}
                    className={`fixed left-0 right-0 transition-all duration-200 ease-out z-50 ${
                      megaOpen
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-y-2 pointer-events-none"
                    }`}
                    style={{ top: "68px", paddingTop: 0 }}
                  >
                    {/* thin bridge so mouse can travel from nav link to panel */}
                    <div className="h-px" />
                    <div className="bg-white/98 backdrop-blur-xl border-b border-espresso/8 shadow-[0_24px_60px_rgba(22,21,19,0.10)]">
                      <div className="max-w-[1440px] mx-auto px-12 py-8">
                        <div className="grid grid-cols-3 gap-5">
                          {catalogNav.map((cat) => (
                            <Link
                              key={cat.href}
                              href={cat.href}
                              className={`group rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-[0_8px_32px_rgba(22,21,19,0.10)] hover:-translate-y-0.5 ${
                                pathname.startsWith(cat.href)
                                  ? "border-espresso/20"
                                  : "border-espresso/8 hover:border-espresso/20"
                              }`}
                            >
                              {/* Photo */}
                              <div className="relative h-44 overflow-hidden bg-off-white">
                                <Image
                                  src={cat.image}
                                  alt={cat.label}
                                  fill
                                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                                  sizes="(max-width: 1440px) 33vw"
                                />
                                {/* subtle dark overlay on hover */}
                                <div className="absolute inset-0 bg-near-black/0 group-hover:bg-near-black/10 transition-colors duration-300" />
                              </div>

                              {/* Text */}
                              <div className="p-5 bg-white">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-serif text-[18px] text-near-black leading-none">
                                    {cat.label}
                                  </span>
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 14 14"
                                    fill="none"
                                    aria-hidden="true"
                                    className="text-mid-grey group-hover:text-near-black transition-colors translate-x-0 group-hover:translate-x-0.5 transition-transform duration-200"
                                  >
                                    <path
                                      d="M2 7h10M8 3l4 4-4 4"
                                      stroke="currentColor"
                                      strokeWidth="1.3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>
                                <p className="text-mid-grey text-[12px] leading-relaxed mb-3">
                                  {cat.desc}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {cat.items.map((item) => (
                                    <span
                                      key={item}
                                      className="text-[10px] label-caps text-dark-grey bg-off-white px-2 py-1 rounded-full"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>

                        {/* Footer row */}
                        <div className="mt-5 pt-4 border-t border-espresso/8 flex items-center justify-between">
                          <span className="text-mid-grey text-[12px]">
                            Все изделия создаются вручную из натурального хлопка
                          </span>
                          <Link
                            href="/catalog"
                            className="inline-flex items-center gap-2 label-caps text-[10px] text-dark-grey hover:text-near-black transition-colors"
                          >
                            Смотреть весь каталог
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M2 6h8M7 3l3 3-3 3"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-md label-caps-md transition-colors relative ${
                    isActive(item.href)
                      ? "text-terracotta"
                      : isSolid
                        ? "text-espresso/70 hover:text-espresso"
                        : "text-white/80 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          {/* Right: CTA + Burger */}
          <div className="flex items-center gap-3">
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Личный кабинет"
                    className={`hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                      isSolid
                        ? "bg-espresso/8 text-espresso hover:bg-espresso/14"
                        : "bg-white/15 border border-white/40 text-white hover:bg-white hover:text-espresso"
                    }`}
                  >
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {session.user?.name || session.user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account">Мои мастер-классы</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/orders">Заказы</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/profile">Профиль</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/sign-in"
                className={`hidden lg:inline-flex items-center label-caps-md px-3 py-2 rounded-full transition-colors ${
                  isSolid
                    ? "text-espresso/70 hover:text-espresso"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Войти
              </Link>
            )}

            <Button
              asChild
              className={`hidden lg:inline-flex items-center gap-2 label-caps-md px-5 py-2 h-auto rounded-full transition-all ${
                isSolid
                  ? "bg-terracotta text-parchment hover:bg-terracotta-dark"
                  : "bg-white/15 border border-white/40 text-white hover:bg-white hover:text-espresso"
              }`}
            >
              <Link href="/#order">Заказать</Link>
            </Button>

            {/* Burger */}
            <Button
              variant="outline"
              size="icon"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              onClick={() => setMenuOpen((v) => !v)}
              className={`lg:hidden w-9 h-9 rounded-full transition-colors ${
                isSolid
                  ? "border-espresso/15 text-espresso"
                  : "border-white/30 text-white bg-transparent hover:bg-white/10"
              }`}
            >
              <span
                className={`block h-px w-[18px] bg-current transition-all duration-300 ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`}
              />
              <span
                className={`block h-px w-[18px] bg-current transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block h-px w-[18px] bg-current transition-all duration-300 ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`}
              />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${menuOpen ? "visible" : "invisible"}`}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay closes menu on click, keyboard handled by Escape key on parent */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop overlay closes menu on click, keyboard handled by Escape key on parent */}
        <div
          className={`absolute inset-0 bg-espresso/40 backdrop-blur-sm transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={`absolute top-0 right-0 h-full w-[300px] bg-parchment shadow-2xl flex flex-col transition-transform duration-300 ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between px-6 h-[60px] border-b border-espresso/8">
            <span className="font-serif text-xl text-espresso">Stariva</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMenuOpen(false)}
              className="text-espresso/50 hover:text-espresso"
              aria-label="Закрыть меню"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 2l12 12M14 2L2 14"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-1">
            {/* Catalog sub-links */}
            <div className="label-caps text-taupe text-[10px] px-1 mb-2">
              Каталог
            </div>
            {catalogNav.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 py-3 px-1 border-b border-espresso/6 group"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-espresso/40" />
                <div>
                  <div className="text-espresso text-[15px]">{cat.label}</div>
                  <div className="text-taupe text-[11px]">{cat.desc}</div>
                </div>
              </Link>
            ))}

            <div className="mt-4 label-caps text-taupe text-[10px] px-1 mb-2">
              Навигация
            </div>
            {[
              { label: "Весь каталог", href: "/catalog" },
              { label: "Мастер-классы", href: "/workshops" },
              { label: "Блог", href: "/blog" },
              { label: "О бренде", href: "/about" },
              { label: "Заказать", href: "/#order" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`py-3 px-1 border-b border-espresso/6 flex items-center justify-between group ${
                  isActive(item.href) ? "text-terracotta" : "text-espresso/80"
                }`}
              >
                <span className="font-serif text-[17px]">{item.label}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                  className="opacity-25 group-hover:opacity-60 transition-opacity"
                >
                  <path
                    d="M3 7h8M8 4l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ))}

            <div className="mt-4 label-caps text-taupe text-[10px] px-1 mb-2">
              Для бизнеса
            </div>
            {b2bLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`py-3 px-1 border-b border-espresso/6 flex items-center justify-between group ${
                  isActive(link.href) ? "text-terracotta" : "text-espresso/80"
                }`}
              >
                <div>
                  <span className="font-serif text-[17px] block leading-snug">
                    {link.label}
                  </span>
                  <span className="text-taupe text-[11px]">{link.desc}</span>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                  className="opacity-25 group-hover:opacity-60 transition-opacity flex-shrink-0"
                >
                  <path
                    d="M3 7h8M8 4l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ))}

            {/* Account */}
            <div className="mt-4 label-caps text-taupe text-[10px] px-1 mb-2">
              Личный кабинет
            </div>
            {session ? (
              <>
                <div className="px-1 pb-2 text-taupe text-[12px] truncate">
                  {session.user?.name || session.user?.email}
                </div>
                {[
                  { label: "Мои мастер-классы", href: "/account" },
                  { label: "Заказы", href: "/account/orders" },
                  { label: "Профиль", href: "/account/profile" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="py-3 px-1 border-b border-espresso/6 flex items-center justify-between text-espresso/80"
                  >
                    <span className="font-serif text-[17px]">{item.label}</span>
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="py-3 px-1 text-left text-terracotta font-serif text-[17px]"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link
                href="/sign-in"
                onClick={() => setMenuOpen(false)}
                className="py-3 px-1 border-b border-espresso/6 flex items-center justify-between text-espresso/80"
              >
                <span className="font-serif text-[17px]">Войти</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
