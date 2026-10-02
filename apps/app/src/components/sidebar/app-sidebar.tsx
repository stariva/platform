"use client";

import { paths } from "@stariva/config";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@stariva/ui";
import {
  IconExternalLink,
  IconMessageStar,
  IconPackage,
  IconPlus,
  IconSchool,
  IconSettings,
  IconShoppingBag,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { NavUser } from "~/components/sidebar";

const catalog = [
  { title: "Товары", url: "/products", icon: IconPackage },
  { title: "Добавить товар", url: "/products/new", icon: IconPlus },
  { title: "Отзывы", url: "/reviews", icon: IconMessageStar },
];

const sales = [{ title: "Заказы", url: "/orders", icon: IconShoppingBag }];

const learning = [
  { title: "Мастер-классы", url: "/workshops", icon: IconSchool },
  { title: "Добавить мастер-класс", url: "/workshops/new", icon: IconPlus },
];

export function AppSidebar({
  user,
  storefrontUrl,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
  storefrontUrl?: string;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/products" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-serif text-sidebar-primary-foreground">
                S
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Stariva</span>
                <span className="truncate text-xs">Админка</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Каталог</SidebarGroupLabel>
          <SidebarMenu>
            {catalog.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={
                    item.url === "/products"
                      ? pathname === "/products" ||
                        /^\/products\/(?!new)/.test(pathname)
                      : pathname === item.url
                  }
                  render={<Link href={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Продажи</SidebarGroupLabel>
          <SidebarMenu>
            {sales.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname.startsWith(item.url)}
                  render={<Link href={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Обучение</SidebarGroupLabel>
          <SidebarMenu>
            {learning.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={
                    item.url === "/workshops"
                      ? pathname === "/workshops" ||
                        /^\/workshops\/(?!new)/.test(pathname)
                      : pathname === item.url
                  }
                  render={<Link href={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            {storefrontUrl && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Открыть сайт"
                  render={
                    <a
                      href={storefrontUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <IconExternalLink />
                  <span>Открыть сайт</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Настройки"
                render={<Link href={paths.settings.root} />}
              >
                <IconSettings />
                <span>Настройки</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
