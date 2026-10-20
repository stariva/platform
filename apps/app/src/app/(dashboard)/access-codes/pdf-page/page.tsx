import { buttonVariants } from "@stariva/ui";
import Link from "next/link";
import { SiteHeader } from "~/components/layout";
import { PrintButton } from "./print-button";

/*
 * Последняя страница PDF-брифа для Ярмарки Мастеров: как открыть
 * видеоуроки по коду. Ссылок в чате Ярмарки слать нельзя, поэтому адрес и
 * QR покупатель находит здесь. QR ведёт на https://stariva.ru/code.
 */

// При печати остаётся только лист: меню админки и подсказки скрываем
const printStyles = `
@page { size: A4; margin: 0; }
@media print {
  body * { visibility: hidden; }
  #code-sheet, #code-sheet * { visibility: visible; }
  #code-sheet {
    position: fixed; inset: 0; margin: 0; border: 0; box-shadow: none;
    max-width: none; aspect-ratio: auto; width: 100%; height: 100%;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}
`;

export default function AccessCodePdfPage() {
  return (
    <>
      <style>{printStyles}</style>
      <SiteHeader title="Страница для PDF" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Страница с кодом для PDF-брифа
          </h1>
          <p className="text-muted-foreground text-sm">
            Добавьте её последней страницей в PDF, который продаёте на Ярмарке
            Мастеров. Нажмите «Сохранить в PDF», в окне печати выберите
            «Сохранить как PDF» и объедините файл с брифом в любой программе для
            PDF. Если бриф собираете в Canva — скачайте QR-код картинкой и
            повторите текст.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrintButton />
            <a
              href="/code-qr.svg"
              download="stariva-code-qr.svg"
              className={buttonVariants({ variant: "outline" })}
            >
              Скачать QR-код
            </a>
            <Link
              href="/access-codes"
              className={buttonVariants({ variant: "ghost" })}
            >
              К кодам
            </Link>
          </div>
        </div>

        <div
          id="code-sheet"
          className="mx-auto flex aspect-[210/297] w-full max-w-[595px] flex-col items-center justify-center bg-[#f7f2ea] px-[9%] text-center text-[#2c241b] shadow-sm ring-1 ring-black/5"
          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
        >
          <p className="text-[clamp(10px,2vw,13px)] tracking-[0.3em] uppercase">
            Stariva
          </p>
          <h2 className="mt-[6%] text-[clamp(22px,5.4vw,34px)] leading-tight">
            Видеоуроки к мастер-классу
          </h2>
          <p className="mt-[3%] max-w-[85%] text-[clamp(12px,2.6vw,16px)] leading-snug text-[#6b5d4f]">
            В этом файле — схема и материалы. Видео, где Ольга показывает каждый
            шаг, откроется по коду.
          </p>

          {/* biome-ignore lint/performance/noImgElement: печатный лист, без оптимизации next/image */}
          <img
            src="/code-qr.svg"
            alt="QR-код: stariva.ru/code"
            className="mt-[7%] aspect-square w-[42%]"
          />
          <p className="mt-[3%] text-[clamp(18px,4.4vw,28px)] tracking-wide">
            stariva.ru/code
          </p>

          <ol className="mt-[6%] space-y-[2%] text-left text-[clamp(12px,2.6vw,16px)] leading-snug">
            <li>1. Наведите камеру телефона на QR-код.</li>
            <li>
              2. Введите код из сообщения Ольги в чате заказа на Ярмарке
              Мастеров.
            </li>
            <li>3. Укажите email — пришлём на него ссылку на уроки.</li>
          </ol>

          <p className="mt-[7%] max-w-[85%] text-[clamp(10px,2.2vw,13px)] leading-snug text-[#6b5d4f]">
            Код ещё не пришёл? Напишите Ольге в чат заказа — она пришлёт его в
            течение дня.
          </p>
        </div>
      </div>
    </>
  );
}
