"use client";

import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useRef, useState } from "react";
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
import { IN_STOCK_HREF, IN_STOCK_SHIP_DAYS } from "@/lib/in-stock";
import { CartTrigger } from "./cart-trigger";

interface NavLink {
  label: string;
  href: string;
  desc?: string;
}

const catalogNav = [
  {
    label: "Абажуры",
    href: "/abazhury",
    desc: "Модели ручного плетения для дома и кафе",
    image: "https://cdn.stariva.ru/site/images/catalog/category-interior.jpg",
  },
  {
    label: "Одежда",
    href: "/catalog/clothes",
    desc: "Платья, топы и накидки из натурального хлопка ручного плетения",
    image:
      "https://cdn.stariva.ru/site/images/catalog/category-clothes-macrame-v4.jpg",
  },
  {
    label: "Сумки",
    href: "/catalog/bags",
    desc: "Авторские сумки, авоськи и корзины в технике макраме",
    image: "https://cdn.stariva.ru/site/images/catalog/category-bags.jpg",
  },
  {
    label: "Декор интерьера",
    href: "/catalog/interior",
    desc: "Панно, вигвамы, плейсменты и аксессуары для дома",
    image:
      "https://cdn.stariva.ru/site/images/catalog/category-interior-macrame-v5.jpg",
  },
];

const b2bLinks: NavLink[] = [
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

const aboutLinks: NavLink[] = [
  { label: "Обо мне", href: "/about", desc: "Кто плетёт ваши изделия" },
  { label: "Отзывы", href: "/reviews", desc: "Что говорят покупатели" },
  { label: "Блог", href: "/blog", desc: "Уход за изделиями и идеи для дома" },
];

const serviceLinks: NavLink[] = [
  { label: "Мастер-классы", href: "/workshops" },
  { label: "Фотосессии", href: "/photoshoots" },
];

type NavItem =
  | { kind: "link"; label: string; href: string }
  | { kind: "catalog"; label: string; href: string }
  | { kind: "dropdown"; label: string; href?: string; links: NavLink[] };

const nav: NavItem[] = [
  { kind: "catalog", label: "Каталог", href: "/catalog" },
  { kind: "link", label: "В наличии", href: IN_STOCK_HREF },
  ...serviceLinks.map((link) => ({ kind: "link" as const, ...link })),
  { kind: "dropdown", label: "Для бизнеса", href: "/b2b", links: b2bLinks },
  { kind: "dropdown", label: "О студии", links: aboutLinks },
];

const dropdownMotion =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200";

function Chevron() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className="transition-transform duration-200 group-data-[state=open]:rotate-180"
    >
      <path
        d="M2 3.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRight({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7h8M8 4l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface HeaderProps {
  variant?: "transparent" | "solid";
}

/** Показывает адаптивную навигацию, меню аккаунта и корзину с учётом фона шапки. */
export function Header({ variant = "solid" }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastPointer = useRef("");
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const isSolid = variant === "solid" || scrolled;
  const isInStockPage = pathname === IN_STOCK_HREF;

  useEffect(() => {
    if (variant === "solid") return;
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  /** Определяет активный раздел, исключая якоря и выделяя «В наличии» отдельно. */
  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    // «В наличии» живёт внутри /catalog, но в меню это отдельный пункт
    if (href === "/catalog" && isInStockPage) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  /** Активен ли пункт верхнего уровня — сам раздел или любой из его подпунктов. */
  const isItemActive = (item: NavItem) => {
    if (item.kind === "link") return isActive(item.href);
    if (item.kind === "catalog")
      return (
        isActive(item.href) || catalogNav.some((cat) => isActive(cat.href))
      );
    return item.links.some((link) => isActive(link.href));
  };

  /**
   * Мышью выпадающее меню открывается наведением, поэтому клик по пункту
   * ведёт в раздел, а не закрывает меню. С клавиатуры и пальцем клик
   * по-прежнему переключает меню.
   */
  const handleTriggerClick = (
    event: MouseEvent<HTMLButtonElement>,
    href?: string,
  ) => {
    if (lastPointer.current === "mouse") {
      event.preventDefault();
      if (href) router.push(href);
    }
    lastPointer.current = "";
  };

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const navItemClass = (active: boolean) =>
    `group px-2 2xl:px-4 py-2 rounded-md label-caps-nav whitespace-nowrap transition-colors flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 ${
      active
        ? "text-terracotta"
        : isSolid
          ? "text-espresso/70 hover:text-espresso data-[state=open]:text-espresso"
          : "text-white/80 hover:text-white data-[state=open]:text-white"
    }`;

  const initials = (session?.user?.name || session?.user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  const mobileHeading = (label: string) => (
    <div className="mt-4 first:mt-0 label-caps text-taupe text-[11px] px-1 mb-2">
      {label}
    </div>
  );

  const mobileLink = (link: NavLink) => (
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
        {link.desc && (
          <span className="text-taupe text-[11px]">{link.desc}</span>
        )}
      </div>
      <span className="opacity-25 group-hover:opacity-60 transition-opacity flex-shrink-0">
        <ArrowRight />
      </span>
    </Link>
  );

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isSolid
            ? "bg-parchment/97 backdrop-blur-md border-b border-espresso/8"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-5 xl:px-8 2xl:px-12 flex items-center justify-between gap-3 h-[60px] xl:h-[68px]">
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
          <NavigationMenuPrimitive.Root
            aria-label="Основное меню"
            delayDuration={80}
            className="hidden xl:block"
          >
            <NavigationMenuPrimitive.List className="flex items-center 2xl:gap-1">
              {nav.map((item) => {
                const active = isItemActive(item);

                if (item.kind === "link") {
                  return (
                    <NavigationMenuPrimitive.Item key={item.href}>
                      <NavigationMenuPrimitive.Link asChild active={active}>
                        <Link href={item.href} className={navItemClass(active)}>
                          {item.label}
                        </Link>
                      </NavigationMenuPrimitive.Link>
                    </NavigationMenuPrimitive.Item>
                  );
                }

                const trigger = (
                  <NavigationMenuPrimitive.Trigger
                    className={navItemClass(active)}
                    onPointerDown={(e) => {
                      lastPointer.current = e.pointerType;
                    }}
                    onClick={(e) => handleTriggerClick(e, item.href)}
                  >
                    {item.label}
                    <Chevron />
                  </NavigationMenuPrimitive.Trigger>
                );

                if (item.kind === "catalog") {
                  return (
                    <NavigationMenuPrimitive.Item key={item.label}>
                      {trigger}
                      {/* Mega menu — full-width panel anchored under the header */}
                      <NavigationMenuPrimitive.Content
                        className={`fixed left-0 right-0 top-[68px] z-50 ${dropdownMotion}`}
                      >
                        <div className="bg-white/98 backdrop-blur-xl border-y border-espresso/8 shadow-[0_24px_60px_rgba(22,21,19,0.10)]">
                          <div className="max-w-[1440px] mx-auto px-8 2xl:px-12 py-6">
                            <ul className="grid grid-cols-4 gap-4">
                              {catalogNav.map((cat) => (
                                <li key={cat.href}>
                                  <NavigationMenuPrimitive.Link
                                    asChild
                                    active={isActive(cat.href)}
                                  >
                                    <Link
                                      href={cat.href}
                                      className={`group flex flex-col h-full rounded-2xl overflow-hidden border outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(22,21,19,0.10)] hover:-translate-y-0.5 ${
                                        isActive(cat.href)
                                          ? "border-espresso/20"
                                          : "border-espresso/8 hover:border-espresso/20"
                                      }`}
                                    >
                                      <div className="relative h-36 overflow-hidden bg-off-white">
                                        <Image
                                          src={cat.image}
                                          alt=""
                                          fill
                                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                                          sizes="(max-width: 1440px) 25vw, 340px"
                                        />
                                        <div className="absolute inset-0 bg-near-black/0 group-hover:bg-near-black/10 transition-colors duration-300" />
                                      </div>
                                      <div className="flex-1 p-4 bg-white">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-serif text-[17px] text-near-black leading-none">
                                            {cat.label}
                                          </span>
                                          <span className="text-taupe group-hover:text-near-black group-hover:translate-x-0.5 transition-all duration-200">
                                            <ArrowRight />
                                          </span>
                                        </div>
                                        <p className="text-taupe text-[12px] leading-relaxed">
                                          {cat.desc}
                                        </p>
                                      </div>
                                    </Link>
                                  </NavigationMenuPrimitive.Link>
                                </li>
                              ))}
                            </ul>

                            {/* Footer row */}
                            <div className="mt-4 pt-4 border-t border-espresso/8 flex items-center justify-between">
                              <span className="text-taupe text-[12px]">
                                Все изделия создаются вручную из натурального
                                хлопка.{" "}
                                <NavigationMenuPrimitive.Link asChild>
                                  <Link
                                    href={IN_STOCK_HREF}
                                    className="text-near-black underline underline-offset-4 hover:text-terracotta transition-colors"
                                  >
                                    Готовые в наличии
                                  </Link>
                                </NavigationMenuPrimitive.Link>{" "}
                                — отправим за {IN_STOCK_SHIP_DAYS}
                              </span>
                              <NavigationMenuPrimitive.Link asChild>
                                <Link
                                  href="/catalog"
                                  className="inline-flex items-center gap-2 label-caps text-[11px] text-dark-grey hover:text-near-black transition-colors"
                                >
                                  Смотреть весь каталог
                                  <ArrowRight size={12} />
                                </Link>
                              </NavigationMenuPrimitive.Link>
                            </div>
                          </div>
                        </div>
                      </NavigationMenuPrimitive.Content>
                    </NavigationMenuPrimitive.Item>
                  );
                }

                return (
                  <NavigationMenuPrimitive.Item
                    key={item.label}
                    className="relative"
                  >
                    {trigger}
                    <NavigationMenuPrimitive.Content
                      className={`absolute left-0 top-full pt-2 z-50 ${dropdownMotion}`}
                    >
                      <ul className="bg-white border border-espresso/8 rounded-xl shadow-[0_12px_40px_rgba(22,21,19,0.12)] overflow-hidden min-w-[240px]">
                        {item.links.map((link) => (
                          <li
                            key={link.href}
                            className="border-b border-espresso/6 last:border-b-0"
                          >
                            <NavigationMenuPrimitive.Link
                              asChild
                              active={isActive(link.href)}
                            >
                              <Link
                                href={link.href}
                                className={`flex flex-col px-5 py-3.5 outline-none hover:bg-off-white focus-visible:bg-off-white transition-colors ${
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
                            </NavigationMenuPrimitive.Link>
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuPrimitive.Content>
                  </NavigationMenuPrimitive.Item>
                );
              })}
            </NavigationMenuPrimitive.List>
          </NavigationMenuPrimitive.Root>

          {/* Right: CTA + Burger */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Личный кабинет"
                    className={`hidden xl:inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium transition-colors ${
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
                className={`hidden xl:inline-flex items-center label-caps-nav whitespace-nowrap px-2 2xl:px-3 py-2 rounded-full transition-colors ${
                  isSolid
                    ? "text-espresso/70 hover:text-espresso"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Войти
              </Link>
            )}

            <CartTrigger isSolid={isSolid} />

            <Button
              asChild
              className={`inline-flex items-center gap-2 text-xs whitespace-nowrap xl:label-caps-nav px-3 sm:px-4 2xl:px-5 py-2 min-h-10 h-auto rounded-full transition-colors ${
                isSolid
                  ? "bg-terracotta text-parchment hover:bg-terracotta-dark"
                  : "bg-white/15 border border-white/40 text-white hover:bg-white hover:text-espresso"
              }`}
            >
              <Link href="/#order">
                Рассчитать<span className="hidden sm:inline">&nbsp;заказ</span>
              </Link>
            </Button>

            {/* Burger */}
            <Button
              variant="outline"
              size="icon"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              onClick={() => setMenuOpen((v) => !v)}
              className={`xl:hidden w-9 h-9 rounded-full transition-colors ${
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
        className={`fixed inset-0 z-50 xl:hidden transition-all duration-300 ${menuOpen ? "visible" : "invisible"}`}
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
              className="text-espresso/60 hover:text-espresso"
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
            {mobileHeading("Каталог")}
            {catalogNav.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 py-3 px-1 border-b border-espresso/6 group"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-espresso/40" />
                <div>
                  <div
                    className={`text-[15px] ${isActive(cat.href) ? "text-terracotta" : "text-espresso"}`}
                  >
                    {cat.label}
                  </div>
                  <div className="text-taupe text-[11px]">{cat.desc}</div>
                </div>
              </Link>
            ))}
            {mobileLink({ label: "Весь каталог", href: "/catalog" })}
            {mobileLink({
              label: "В наличии",
              href: IN_STOCK_HREF,
              desc: `Готовые изделия, отправим за ${IN_STOCK_SHIP_DAYS}`,
            })}

            {mobileHeading("Услуги")}
            {serviceLinks.map(mobileLink)}

            {mobileHeading("Для бизнеса")}
            {b2bLinks.map(mobileLink)}

            {mobileHeading("О студии")}
            {aboutLinks.map(mobileLink)}

            {mobileHeading("Личный кабинет")}
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
