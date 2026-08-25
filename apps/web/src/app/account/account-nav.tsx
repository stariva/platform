"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Мои мастер-классы", href: "/account" },
  { label: "Заказы", href: "/account/orders" },
  { label: "Профиль", href: "/account/profile" },
];

export function AccountNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/account" ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`whitespace-nowrap px-4 py-2.5 rounded-lg text-sm transition-colors ${
            isActive(item.href)
              ? "bg-espresso text-parchment"
              : "text-espresso/70 hover:bg-espresso/8 hover:text-espresso"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
