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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@stariva/ui";
import {
  IconAddressBook,
  IconChartBar,
  IconChartPie,
  IconExternalLink,
  IconInbox,
  IconKey,
  IconLayoutKanban,
  IconMail,
  IconMessageChatbot,
  IconMessageForward,
  IconMessageStar,
  IconPackage,
  IconPlayerPlay,
  IconPlus,
  IconSchool,
  IconSettings,
  IconShoppingBag,
  IconShoppingCart,
  IconSpeakerphone,
  IconTicket,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { NavUser } from "~/components/sidebar";
import { orpc } from "~/orpc/react";

type TodayCounts = Awaited<ReturnType<typeof orpc.admin.stats.today.call>>;

type NavItem = {
  title: string;
  url: string;
  icon: typeof IconPackage;
  /** Какой счётчик «нового за сегодня» показать рядом с пунктом. */
  today?: keyof TodayCounts;
};

const matchesPath = (pathname: string, url: string) =>
  pathname === url || pathname.startsWith(`${url}/`);

/**
 * Active item = the longest matching url across the whole menu, so "/products"
 * stays inactive on "/products/new" and "/crm" on "/crm/orders".
 */
const activeUrl = (pathname: string, items: NavItem[]) =>
  items
    .filter((item) => matchesPath(pathname, item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

const catalog: NavItem[] = [
  { title: "Товары", url: "/products", icon: IconPackage },
  { title: "Добавить товар", url: "/products/new", icon: IconPlus },
  {
    title: "Отзывы",
    url: "/reviews",
    icon: IconMessageStar,
    today: "reviews",
  },
];

const sales: NavItem[] = [
  { title: "Заказы в работе", url: "/crm/orders", icon: IconLayoutKanban },
  { title: "Новый заказ", url: "/crm/orders/new", icon: IconPlus },
  { title: "Аналитика", url: "/crm/analytics", icon: IconChartPie },
  {
    title: "Заказы с сайта",
    url: "/orders",
    icon: IconShoppingBag,
    today: "orders",
  },
  { title: "Корзины", url: "/carts", icon: IconShoppingCart, today: "carts" },
  { title: "Заявки", url: "/requests", icon: IconInbox, today: "requests" },
  { title: "Клиенты", url: "/crm/clients", icon: IconAddressBook },
];

const learning: NavItem[] = [
  { title: "Мастер-классы", url: "/workshops", icon: IconSchool },
  {
    title: "Записи",
    url: "/workshop-orders",
    icon: IconTicket,
    today: "workshopOrders",
  },
  {
    title: "Просмотры",
    url: "/workshop-views",
    icon: IconPlayerPlay,
    today: "workshopViews",
  },
  {
    title: "Коды с Ярмарки",
    url: "/access-codes",
    icon: IconKey,
    today: "accessCodes",
  },
  { title: "Добавить мастер-класс", url: "/workshops/new", icon: IconPlus },
];

const marketing: NavItem[] = [
  { title: "Сводка", url: "/crm", icon: IconChartBar },
  {
    title: "Кампании и расходы",
    url: "/crm/campaigns",
    icon: IconSpeakerphone,
  },
  {
    title: "Переходы в мессенджеры",
    url: "/contact-clicks",
    icon: IconMessageForward,
    today: "contactClicks",
  },
];

const customers: NavItem[] = [
  { title: "Пользователи", url: "/users", icon: IconUsers, today: "users" },
  {
    title: "Чат с Никой",
    url: "/chats",
    icon: IconMessageChatbot,
    today: "chats",
  },
  { title: "Журнал писем", url: "/email-log", icon: IconMail },
];

const allItems = [
  ...catalog,
  ...sales,
  ...marketing,
  ...learning,
  ...customers,
];

/** Группа меню; у пунктов со счётчиком — сколько нового за сегодня. */
function NavGroup({
  label,
  items,
  active,
  counts,
}: {
  label: string;
  items: NavItem[];
  active: string | undefined;
  counts: TodayCounts | undefined;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const fresh = item.today ? (counts?.[item.today] ?? 0) : 0;
          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={item.url === active}
                render={<Link href={item.url} />}
                // Место под бейдж, чтобы длинное название не уходило под него
                className={fresh > 0 ? "pr-8" : undefined}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
              {fresh > 0 && (
                <SidebarMenuBadge
                  className="bg-sidebar-primary text-sidebar-primary-foreground peer-hover/menu-button:text-sidebar-primary-foreground peer-data-[active=true]/menu-button:text-sidebar-primary-foreground rounded-full"
                  title="Новых за сегодня"
                >
                  {fresh}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/** Навигация админки с активным разделом, ссылкой на витрину и меню пользователя. */
export function AppSidebar({
  user,
  storefrontUrl,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
  storefrontUrl?: string;
}) {
  const pathname = usePathname();
  const active = activeUrl(pathname, allItems);
  // Раз в минуту и при возврате на вкладку — новое за день видно без перезагрузки
  const { data: counts } = useQuery({
    ...orpc.admin.stats.today.queryOptions(),
    refetchInterval: 60_000,
  });

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/crm/orders" />}>
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
        <NavGroup
          label="Каталог"
          items={catalog}
          active={active}
          counts={counts}
        />
        <NavGroup
          label="Продажи"
          items={sales}
          active={active}
          counts={counts}
        />
        <NavGroup
          label="Реклама"
          items={marketing}
          active={active}
          counts={counts}
        />
        <NavGroup
          label="Обучение"
          items={learning}
          active={active}
          counts={counts}
        />
        <NavGroup
          label="Клиенты"
          items={customers}
          active={active}
          counts={counts}
        />
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
