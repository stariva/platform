import { TelegramIcon } from "@/components/stariva/icons";
import { DownloadIcon } from "./download-icon";

export function ResortCtaDownload() {
  return (
    <section className="py-24 lg:py-36 bg-sand">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <p className="label-caps text-terracotta text-[10px] mb-4">
            Коммерческое предложение
          </p>
          <h2
            className="font-serif text-near-black leading-tight mb-6"
            style={{ fontSize: "clamp(28px, 4vw, 52px)" }}
          >
            Скачайте готовое КП
            <br />
            для вашего руководства
          </h2>
          <p className="text-dark-grey leading-relaxed mb-10 text-[15px] max-w-lg mx-auto">
            PDF с ценами, фотографиями изделий, сроками и условиями работы.
            Готов к отправке в WhatsApp, Telegram или по email — один клик.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/api/kp/resort"
              download="stariva-kp-bazy-otdykha.pdf"
              className="inline-flex items-center justify-center gap-3 bg-terracotta text-parchment px-8 py-4 rounded-full label-caps-md text-[12px] hover:bg-terracotta-dark transition-colors"
            >
              <DownloadIcon />
              Скачать КП (PDF)
            </a>
            <a
              href="https://t.me/Olga_Stariva"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 bg-espresso text-parchment px-8 py-4 rounded-full label-caps-md text-[12px] hover:bg-near-black transition-colors"
            >
              <TelegramIcon className="w-4 h-4" />
              Написать в Telegram
            </a>
          </div>

          <p className="text-mid-grey text-[12px] mt-6">
            Или позвоните:{" "}
            <a
              href="tel:+79778722546"
              className="text-espresso/70 hover:text-espresso transition-colors"
            >
              +7 977 872 25 46
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
