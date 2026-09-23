import type { ComponentType, SVGProps } from "react";
import { SELLER } from "@/lib/legal";
import { CookieSettingsLink } from "./cookie-banner";
import {
  ArrowRight,
  AvitoIcon,
  LivemasterIcon,
  MailIcon,
  MaxIcon,
  OzonIcon,
  PhoneIcon,
  PinterestIcon,
  TelegramIcon,
  VkIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "./icons";

type ExternalLink = {
  label: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const catalog = [
  { label: "Абажуры из макраме", href: "/catalog/interior" },
  { label: "Платья макраме", href: "/catalog/clothes" },
  { label: "Декор для дома", href: "/catalog/interior" },
  { label: "Подарочные сертификаты", href: "/catalog" },
];

const info = [
  { label: "Уход за изделиями", href: "/blog" },
  { label: "Для кафе и ресторанов", href: "/b2b" },
  { label: "О бренде", href: "/about" },
  { label: "Контакты", href: "/#order" },
];

const messengers: ExternalLink[] = [
  { label: "Telegram", href: "https://t.me/Olga_Stariva", Icon: TelegramIcon },
  { label: "WhatsApp", href: "https://wa.me/79778722546", Icon: WhatsappIcon },
  {
    label: "MAX",
    href: "https://max.ru/u/f9LHodD0cOKBrgW8OBs1SDxy3mN7vPE34uus8lQhO22DEoOybjJE57AQMIg",
    Icon: MaxIcon,
  },
];

const socials: ExternalLink[] = [
  { label: "ВКонтакте", href: "https://vk.com/stariva_macrame", Icon: VkIcon },
  { label: "YouTube", href: "https://www.youtube.com/@olga.stariva", Icon: YoutubeIcon },
  { label: "Pinterest", href: "https://pinterest.com/stariva", Icon: PinterestIcon },
];

const marketplaces: ExternalLink[] = [
  {
    label: "Ozon",
    href: "https://www.ozon.ru/seller/stariva-makrame-odezhda-dekor-vyazanye-sumki-izdeliya-iz-shnura/",
    Icon: OzonIcon,
  },
  {
    label: "Авито",
    href: "https://www.avito.ru/brands/i3320470/all?sellerId=5c2374e4adcfe4219ff7e1702a15d27f",
    Icon: AvitoIcon,
  },
  {
    label: "Ярмарка Мастеров",
    href: "https://www.livemaster.ru/olga-meu",
    Icon: LivemasterIcon,
  },
];

function PillLink({
  link: { label, href, Icon },
  external,
}: {
  link: ExternalLink;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 sm:gap-2.5 rounded-full border border-parchment/15 px-3 sm:px-4 py-2.5 text-[13px] sm:text-sm text-parchment/85 hover:border-parchment/40 hover:bg-parchment/5 hover:text-parchment transition-colors"
    >
      <Icon className="w-4 h-4 text-linen shrink-0" />
      {label}
      {external && (
        <ArrowRight className="w-3.5 h-3.5 -rotate-45 text-parchment/40 group-hover:text-parchment transition-colors" />
      )}
    </a>
  );
}

function LinkGroup({
  title,
  links,
  external,
}: {
  title: string;
  links: ExternalLink[];
  external?: boolean;
}) {
  return (
    <div>
      <div className="label-caps text-parchment/50 mb-4">{title}</div>
      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        {links.map((link) => (
          <PillLink key={link.label} link={link} external={external} />
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-espresso text-parchment">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-20 lg:pt-28 pb-10">
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-12 lg:gap-12">
          {/* Brand + contacts */}
          <div className="col-span-2 lg:col-span-5">
            <div className="font-serif text-5xl lg:text-6xl tracking-tight mb-3">
              Stariva
            </div>
            <div className="label-caps text-parchment/60 mb-10">
              Ручное плетение с 2018
            </div>

            <a
              href="tel:+79778722546"
              className="inline-flex items-center gap-3 text-2xl lg:text-3xl font-serif text-parchment hover:text-linen transition-colors"
            >
              <PhoneIcon className="w-5 h-5 text-linen" />
              +7 977 872 25 46
            </a>
            <a
              href="mailto:info@stariva.ru"
              className="mt-3 flex w-fit items-center gap-3 text-parchment/80 hover:text-linen transition-colors"
            >
              <MailIcon className="w-5 h-5 text-linen shrink-0" />
              <span className="label-caps">info@stariva.ru</span>
            </a>

            <div className="mt-8">
              <LinkGroup title="Написать мастеру" links={messengers} />
            </div>
          </div>

          {/* Catalog */}
          <div className="lg:col-span-3 lg:col-start-7">
            <div className="label-caps text-parchment/50 mb-5">Каталог</div>
            <ul className="space-y-3">
              {catalog.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    className="text-parchment/85 hover:text-linen transition-colors"
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div className="lg:col-span-3">
            <div className="label-caps text-parchment/50 mb-5">Информация</div>
            <ul className="space-y-3">
              {info.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    className="text-parchment/85 hover:text-linen transition-colors"
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Socials + marketplaces */}
        <div className="mt-16 pt-10 border-t border-parchment/15 grid lg:grid-cols-12 gap-10 lg:gap-12">
          <div className="lg:col-span-5">
            <LinkGroup title="Соцсети" links={socials} />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <LinkGroup title="Купить на маркетплейсах" links={marketplaces} external />
          </div>
        </div>

        {/* Legal */}
        <div className="mt-12 pt-8 border-t border-parchment/15">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 text-[11px] leading-relaxed text-parchment/55">
            <div>
              {SELLER.shortName}, ИНН {SELLER.inn} — самозанятый (НПД)
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <a
                href="/privacy-policy"
                className="hover:text-linen transition-colors"
              >
                Политика конфиденциальности
              </a>
              <a href="/offer" className="hover:text-linen transition-colors">
                Договор оферты
              </a>
              <a
                href="/personal-data-consent"
                className="hover:text-linen transition-colors"
              >
                Согласие на обработку персональных данных
              </a>
              <CookieSettingsLink className="hover:text-linen transition-colors text-left" />
            </div>
          </div>
          <div className="mt-4 text-[11px] text-parchment/40">
            © Stariva, 2018–2026. Все права защищены. Каждое изделие уникально.
          </div>
        </div>
      </div>
    </footer>
  );
}
