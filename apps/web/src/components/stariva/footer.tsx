import {
  AvitoIcon,
  LivemasterIcon,
  OzonIcon,
  PhoneIcon,
  PinterestIcon,
  TelegramIcon,
  VkIcon,
} from "./icons";

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

export function Footer() {
  return (
    <footer className="bg-espresso text-parchment">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-20 lg:pt-28 pb-10">
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-4">
            <div className="font-serif text-5xl lg:text-6xl tracking-tight mb-3">
              Stariva
            </div>
            <div className="label-caps text-parchment/60 mb-8">
              Ручное плетение с 2018
            </div>

            <a
              href="tel:+79778722546"
              className="flex items-center gap-3 text-2xl font-serif text-parchment hover:text-linen transition-colors"
            >
              <PhoneIcon className="w-5 h-5 text-linen" />
              +7 977 872 25 46
            </a>

            <a
              href="https://t.me/Olga_Stariva"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-3 text-parchment/80 hover:text-linen transition-colors"
            >
              <TelegramIcon className="w-5 h-5 text-linen" />
              <span className="label-caps">Telegram</span>
            </a>

            <a
              href="mailto:info@stariva.ru"
              className="mt-3 flex items-center gap-3 text-parchment/80 hover:text-linen transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-linen shrink-0"
              >
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M3 8l9 6 9-6"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="label-caps">info@stariva.ru</span>
            </a>
          </div>

          {/* Catalog */}
          <div className="lg:col-span-2 lg:col-start-6">
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

          {/* Socials */}
          <div className="lg:col-span-3">
            <div className="label-caps text-parchment/50 mb-5">
              Я в соцсетях
            </div>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://vk.com/stariva_macrame"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-parchment/85 hover:text-linen transition-colors"
                >
                  <VkIcon className="w-4 h-4" />
                  ВКонтакте
                </a>
              </li>
              <li>
                <a
                  href="https://pinterest.com/stariva"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-parchment/85 hover:text-linen transition-colors"
                >
                  <PinterestIcon className="w-4 h-4" />
                  Pinterest
                </a>
              </li>
              <li>
                <a
                  href="https://www.livemaster.ru/olga-meu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-parchment/85 hover:text-linen transition-colors"
                >
                  <LivemasterIcon className="w-4 h-4" />
                  Ярмарка Мастеров
                </a>
              </li>
              <li>
                <a
                  href="https://www.ozon.ru/seller/stariva-makrame-odezhda-dekor-vyazanye-sumki-izdeliya-iz-shnura/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-parchment/85 hover:text-linen transition-colors"
                >
                  <OzonIcon className="w-4 h-4" />
                  Ozon
                </a>
              </li>
              <li>
                <a
                  href="https://www.avito.ru/brands/i3320470/all?sellerId=5c2374e4adcfe4219ff7e1702a15d27f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-parchment/85 hover:text-linen transition-colors"
                >
                  <AvitoIcon className="w-4 h-4" />
                  Авито
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal */}
        <div className="mt-16 pt-8 border-t border-parchment/15">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 text-[11px] leading-relaxed text-parchment/55">
            <div>СЗ Карпычева О. А. ИНН: 502480197143</div>
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
