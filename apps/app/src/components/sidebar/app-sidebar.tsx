"use client";

import { paths } from "@stariva/config";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@stariva/ui";
import {
  type Icon,
  IconAddressBook,
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconChevronDown,
  IconCoin,
  IconExternalLink,
  IconInbox,
  IconKey,
  IconLayoutKanban,
  IconMail,
  IconMailForward,
  IconMap2,
  IconMessageForward,
  IconMessageStar,
  IconPackage,
  IconPlayerPlay,
  IconPlus,
  IconReceipt,
  IconSchool,
  IconSettings,
  IconShoppingBag,
  IconShoppingCart,
  IconSpeakerphone,
  IconTicket,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { NavUser } from "~/components/sidebar";
import { orpc } from "~/orpc/react";

type TodayCounts = Awaited<ReturnType<typeof orpc.admin.stats.today.call>>;

type NavItem = {
  title: string;
  url: string;
  icon: Icon;
  /** Какой счётчик «нового за сегодня» показать рядом с пунктом. */
  today?: keyof TodayCounts;
};

type NavSection = {
  id: string;
  title: string;
  icon: Icon;
  items: NavItem[];
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
  { title: "Прибыль", url: "/crm/profit", icon: IconCoin },
  { title: "Постоянные расходы", url: "/crm/expenses", icon: IconReceipt },
  {
    title: "Заказы с сайта",
    url: "/orders",
    icon: IconShoppingBag,
    today: "orders",
  },
  { title: "Корзины", url: "/carts", icon: IconShoppingCart, today: "carts" },
  { title: "Карта покупок", url: "/purchase-map", icon: IconMap2 },
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
    title: "Коды доступа",
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
  { title: "Рассылки", url: "/campaigns", icon: IconMailForward },
  {
    title: "Переходы в мессенджеры",
    url: "/contact-clicks",
    icon: IconMessageForward,
    today: "contactClicks",
  },
  { title: "Метрика", url: "/metrika", icon: IconChartLine },
];

const customers: NavItem[] = [
  { title: "Пользователи", url: "/users", icon: IconUsers, today: "users" },
  { title: "Журнал писем", url: "/email-log", icon: IconMail },
];

const settings: NavItem[] = [
  { title: "Аккаунт", url: paths.settings.root, icon: IconSettings },
  { title: "Профиль", url: paths.settings.profile, icon: IconUserCircle },
  { title: "Пароль", url: paths.settings.password, icon: IconKey },
];

const salesSection: NavSection = {
  id: "sales",
  title: "Продажи",
  icon: IconLayoutKanban,
  items: sales,
};

const mainSections: NavSection[] = [
  salesSection,
  { id: "catalog", title: "Каталог", icon: IconPackage, items: catalog },
  {
    id: "marketing",
    title: "Реклама",
    icon: IconSpeakerphone,
    items: marketing,
  },
  { id: "learning", title: "Обучение", icon: IconSchool, items: learning },
  { id: "customers", title: "Клиенты", icon: IconUsers, items: customers },
];

const settingsSection: NavSection = {
  id: "settings",
  title: "Настройки",
  icon: IconSettings,
  items: settings,
};

const sections = [...mainSections, settingsSection];
const allItems = sections.flatMap((section) => section.items);

function RailButton({
  label,
  icon: ItemIcon,
  active,
  onClick,
}: {
  label: string;
  icon: Icon;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-50",
        active && "bg-white/10 text-zinc-50",
      )}
    >
      <ItemIcon className="size-5" stroke={1.7} />
    </button>
  );
}

function WorkspaceSwitcher({ storefrontUrl }: { storefrontUrl?: string }) {
  const router = useRouter();
  const { isMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
          />
        }
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 font-serif text-sm font-semibold text-white">
          S
        </div>
        <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">Stariva</span>
          <span className="text-muted-foreground truncate text-xs">
            Админка
          </span>
        </div>
        <IconChevronDown className="text-muted-foreground ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="start"
        sideOffset={8}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Рабочая область</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push("/crm/orders")}>
            <IconLayoutKanban />
            Админка Stariva
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {storefrontUrl && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  window.open(storefrontUrl, "_blank", "noopener,noreferrer")
                }
              >
                <IconExternalLink />
                Открыть сайт
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Навигация админки: тёмный icon-rail и раскрываемая панель раздела. */
export function AppSidebar({
  user,
  storefrontUrl,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
  storefrontUrl?: string;
}) {
  const pathname = usePathname();
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar();
  const active = activeUrl(pathname, allItems);
  const routeSection =
    sections.find((section) =>
      section.items.some((item) => item.url === active),
    ) ?? salesSection;
  const [selectedSectionId, setSelectedSectionId] = React.useState(
    routeSection.id,
  );

  React.useEffect(() => {
    setSelectedSectionId(routeSection.id);
  }, [routeSection.id]);

  // Раз в минуту и при возврате на вкладку — новое за день видно без перезагрузки
  const { data: counts } = useQuery({
    ...orpc.admin.stats.today.queryOptions(),
    refetchInterval: 60_000,
  });

  const selectedSection =
    sections.find((section) => section.id === selectedSectionId) ??
    routeSection;

  const selectSection = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    if (state === "collapsed") {
      setOpen(true);
    }
  };

  const closeMobile = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0" {...props}>
      <div className="flex h-full min-h-0 w-full">
        <div className="m-2 flex w-12 shrink-0 flex-col items-center rounded-2xl bg-zinc-950 py-2.5 text-zinc-400 shadow-sm">
          <Link
            href="/crm/orders"
            title="Stariva"
            aria-label="Stariva"
            className="mb-4 flex size-9 items-center justify-center rounded-xl bg-zinc-800 font-serif text-lg font-semibold text-zinc-50 transition-colors hover:bg-zinc-700"
          >
            S
          </Link>
          <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
            {mainSections.map((section) => (
              <RailButton
                key={section.id}
                label={section.title}
                icon={section.icon}
                active={selectedSection.id === section.id}
                onClick={() => selectSection(section.id)}
              />
            ))}
          </nav>
          <div className="flex flex-col items-center gap-1 pt-2">
            {storefrontUrl && (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Открыть сайт"
                aria-label="Открыть сайт"
                className="flex size-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-50"
              >
                <IconExternalLink className="size-5" stroke={1.7} />
              </a>
            )}
            <RailButton
              label="Настройки"
              icon={IconSettings}
              active={selectedSection.id === settingsSection.id}
              onClick={() => selectSection(settingsSection.id)}
            />
            <NavUser user={user} />
          </div>
        </div>

        <div className="bg-sidebar flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
          <div className="border-sidebar-border/70 border-b p-3">
            <WorkspaceSwitcher storefrontUrl={storefrontUrl} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <div className="text-muted-foreground px-2 pb-2 text-xs font-medium">
              {selectedSection.title}
            </div>
            <SidebarMenu>
              {selectedSection.items.map((item) => {
                const fresh = item.today ? (counts?.[item.today] ?? 0) : 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={item.url === active}
                      render={<Link href={item.url} />}
                      onClick={closeMobile}
                      className={cn(
                        "h-9 rounded-lg px-2.5 data-[active=true]:bg-card! data-[active=true]:shadow-sm",
                        fresh > 0 && "pr-8",
                      )}
                    >
                      <item.icon
                        className="text-muted-foreground"
                        stroke={1.7}
                      />
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
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
