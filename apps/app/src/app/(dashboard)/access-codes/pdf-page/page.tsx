import { CODE_PAGE_TEXT, CODE_PAGE_URL } from "@stariva/api/code-page-text";
import { buttonVariants } from "@stariva/ui";
import Link from "next/link";
import { SiteHeader } from "~/components/layout";
import { PrintButton } from "./print-button";

/*
 * Последняя страница PDF-брифа для Ярмарки Мастеров: как открыть
 * видеоуроки по коду. Ссылок в чате Ярмарки слать нельзя, поэтому адрес и
 * QR покупатель находит здесь. QR ведёт на https://stariva.ru/code. Текст
 * общий с PDF, который собирает сервер (@stariva/api/code-page-text).
 */

// При печати остаётся только лист: меню админки и подсказки скрываем
const printStyles = `
@page { size: A4; margin: 0; }
@media print {
  body * { visibility: hidden; }
  #code-sheet, #code-sheet * { visibility: visible; }
  #code-sheet { position: fixed; inset: 0; margin: 0; border: 0; box-shadow: none; }
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
            Мастеров. Проще всего — кнопкой «Скачать PDF для Ярмарки» на
            странице мастер-класса, в блоке «Материалы»: она сама допишет эту
            страницу в конец загруженного брифа.
          </p>
          <p className="text-muted-foreground text-sm">
            Вручную: нажмите «Сохранить в PDF», в окне печати выберите
            «Сохранить как PDF» и объедините файл с брифом в любой программе для
            PDF. Если бриф собираете в Canva — скачайте QR-код картинкой,
            повторите текст и сделайте адрес и QR-код ссылкой на{" "}
            {CODE_PAGE_TEXT.address}: с телефона их нажимают, а не сканируют.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/workshops" className={buttonVariants()}>
              Выбрать мастер-класс
            </Link>
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
            {CODE_PAGE_TEXT.brand}
          </p>
          <h2 className="mt-[6%] text-[clamp(22px,5.4vw,34px)] leading-tight">
            {CODE_PAGE_TEXT.title}
          </h2>
          <p className="mt-[3%] max-w-[85%] text-[clamp(12px,2.6vw,16px)] leading-snug text-[#6b5d4f]">
            {CODE_PAGE_TEXT.lead}
          </p>

          {/* Ссылки сохраняются в PDF: бриф часто читают с телефона, где QR не навести */}
          <a
            href={CODE_PAGE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-[7%] block aspect-square w-[42%]"
          >
            {/* biome-ignore lint/performance/noImgElement: печатный лист, без оптимизации next/image */}
            <img
              src="/code-qr.svg"
              alt={`QR-код: ${CODE_PAGE_TEXT.address}`}
              className="size-full"
            />
          </a>
          <a
            href={CODE_PAGE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-[3%] text-[clamp(18px,4.4vw,28px)] tracking-wide underline decoration-1 underline-offset-4"
          >
            {CODE_PAGE_TEXT.address}
          </a>

          <ol className="mt-[6%] space-y-[2%] text-left text-[clamp(12px,2.6vw,16px)] leading-snug">
            {CODE_PAGE_TEXT.steps.map((step) => {
              // Адрес в тексте шага — тоже ссылка, как в PDF
              const [before, after] = step.split(CODE_PAGE_TEXT.address);
              return (
                <li key={step}>
                  {after === undefined ? (
                    step
                  ) : (
                    <>
                      {before}
                      <a
                        href={CODE_PAGE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-1 underline-offset-2"
                      >
                        {CODE_PAGE_TEXT.address}
                      </a>
                      {after}
                    </>
                  )}
                </li>
              );
            })}
          </ol>

          <p className="mt-[7%] max-w-[85%] text-[clamp(10px,2.2vw,13px)] leading-snug text-[#6b5d4f]">
            {CODE_PAGE_TEXT.footer}
          </p>
        </div>
      </div>
    </>
  );
}
