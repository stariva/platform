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
  IconAddressBook,
  IconChartBar,
  IconExternalLink,
  IconInbox,
  IconMessageChatbot,
  IconMessageStar,
  IconPackage,
  IconPlus,
  IconSchool,
  IconSettings,
  IconShoppingBag,
  IconSpeakerphone,
  IconTicket,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { NavUser } from "~/components/sidebar";

type NavItem = { title: string; url: string; icon: typeof IconPackage };

const matchesPath = (pathname: string, url: string) =>
  pathname === url || pathname.startsWith(`${url}/`);

/** Active item = the longest matching url in its group, so "/products" stays inactive on "/products/new". */
const activeUrl = (pathname: string, items: NavItem[]) =>
  items
    .filter((item) => matchesPath(pathname, item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

const catalog: NavItem[] = [
  { title: "Товары", url: "/products", icon: IconPackage },
  { title: "Добавить товар", url: "/products/new", icon: IconPlus },
  { title: "Отзывы", url: "/reviews", icon: IconMessageStar },
];

const sales: NavItem[] = [
  { title: "Заказы", url: "/orders", icon: IconShoppingBag },
  { title: "Заявки", url: "/requests", icon: IconInbox },
];

const learning: NavItem[] = [
  { title: "Мастер-классы", url: "/workshops", icon: IconSchool },
  { title: "Записи", url: "/workshop-orders", icon: IconTicket },
  { title: "Добавить мастер-класс", url: "/workshops/new", icon: IconPlus },
];

const marketing: NavItem[] = [
  { title: "Сводка", url: "/crm", icon: IconChartBar },
  { title: "Клиенты", url: "/crm/clients", icon: IconAddressBook },
  {
    title: "Кампании и расходы",
    url: "/crm/campaigns",
    icon: IconSpeakerphone,
  },
];

const customers: NavItem[] = [
  { title: "Пользователи", url: "/users", icon: IconUsers },
  { title: "Чат с Никой", url: "/chats", icon: IconMessageChatbot },
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
                  isActive={item.url === activeUrl(pathname, catalog)}
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
                  isActive={item.url === activeUrl(pathname, sales)}
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
          <SidebarGroupLabel>Реклама</SidebarGroupLabel>
          <SidebarMenu>
            {marketing.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={item.url === activeUrl(pathname, marketing)}
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
                  isActive={item.url === activeUrl(pathname, learning)}
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
          <SidebarGroupLabel>Клиенты</SidebarGroupLabel>
          <SidebarMenu>
            {customers.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={item.url === activeUrl(pathname, customers)}
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
                isActive={matchesPath(pathname, paths.settings.root)}
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
