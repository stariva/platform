import { PhoneIcon, TelegramIcon } from "@/components/stariva/icons";

export function ResortContactStrip() {
  return (
    <section className="py-16 bg-espresso">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="font-serif text-white text-xl mb-1">
            Остались вопросы?
          </p>
          <p className="text-parchment/60 text-[13px]">
            Ответим в течение часа в рабочее время
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://t.me/Olga_Stariva"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 bg-white/10 border border-white/15 text-white px-5 py-2.5 rounded-full label-caps-md text-[11px] hover:bg-white/20 transition-colors"
          >
            <TelegramIcon className="w-4 h-4" />
            Telegram
          </a>
          <a
            href="tel:+79778722546"
            className="inline-flex items-center gap-2.5 bg-white/10 border border-white/15 text-white px-5 py-2.5 rounded-full label-caps-md text-[11px] hover:bg-white/20 transition-colors"
          >
            <PhoneIcon className="w-4 h-4" />
            Позвонить
          </a>
        </div>
      </div>
    </section>
  );
}
