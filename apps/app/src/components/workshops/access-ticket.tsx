"use client";

import { Button } from "@stariva/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/*
 * Купон в коробку с набором: QR, адрес и код, чтобы покупатель открыл
 * видеоуроки любым удобным способом. Печатается на чековом термопринтере,
 * поэтому всё чёрным по белому, без серого и тонких линий: полутона
 * термоголовка превращает в рябь.
 */

/** Ширина ленты в мм. Поля печати у принтера свои — отступы внутри купона. */
const PAPER_WIDTHS = [80, 58] as const;
type PaperWidth = (typeof PAPER_WIDTHS)[number];

const WIDTH_KEY = "stariva:ticket-width";
const PX_PER_MM = 96 / 25.4;

export interface AccessTicketData {
  code: string;
  workshopTitle: string;
  /** Адрес для набора руками: stariva.ru/code */
  address: string;
  /** Модули QR одним контуром в клетках и сторона кода в клетках. */
  qrPath: string;
  qrSize: number;
  /** Мелкая строка внизу — мастеру, чтобы не перепутать коробки. */
  note: string | null;
}

export function AccessTicket({ ticket }: { ticket: AccessTicketData }) {
  const [width, setWidth] = useState<PaperWidth>(80);
  const [heightMm, setHeightMm] = useState(160);
  const sheet = useRef<HTMLDivElement>(null);

  // Ширину ленты помним: принтер у мастера один
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY));
      if (PAPER_WIDTHS.includes(saved as PaperWidth)) {
        setWidth(saved as PaperWidth);
      }
    } catch {
      // Хранилище недоступно — остаётся лента 80 мм
    }
  }, []);

  function chooseWidth(next: PaperWidth) {
    setWidth(next);
    try {
      localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      // Не запомнили — не страшно
    }
  }

  // Высота страницы — по купону: лента не уходит впустую и не рвёт его на два листа
  useLayoutEffect(() => {
    const node = sheet.current;
    if (!node) return;
    const measure = () =>
      setHeightMm(Math.ceil(node.offsetHeight / PX_PER_MM) + 6);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const narrow = width === 58;

  // При печати остаётся только купон: меню админки и кнопки скрываем
  const printStyles = `
@page { size: ${width}mm ${heightMm}mm; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  #access-ticket, #access-ticket * { visibility: visible; }
  #access-ticket {
    position: fixed; left: 0; top: 0; margin: 0;
    border: 0; box-shadow: none; outline: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}
`;

  return (
    <>
      <style>{printStyles}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => window.print()}>Напечатать</Button>
        <fieldset className="flex items-center gap-1" aria-label="Ширина ленты">
          {PAPER_WIDTHS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={value === width ? "secondary" : "ghost"}
              aria-pressed={value === width}
              onClick={() => chooseWidth(value)}
            >
              Лента {value} мм
            </Button>
          ))}
        </fieldset>
      </div>

      <div
        id="access-ticket"
        ref={sheet}
        className="shadow-sm ring-1 ring-black/10"
        style={{
          width: `${width}mm`,
          padding: narrow ? "5mm 4mm 6mm" : "6mm 6mm 7mm",
          boxSizing: "border-box",
          background: "#fff",
          color: "#000",
          textAlign: "center",
          // Строки одной длины: без одинокого слова на второй строке
          textWrap: "balance",
          fontFamily: "Arial, Helvetica, sans-serif",
          lineHeight: 1.25,
        }}
      >
        <p
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: narrow ? "13pt" : "15pt",
            letterSpacing: "0.3em",
            // Разрядка добавляет пробел и после последней буквы — возвращаем центр
            marginRight: "-0.3em",
          }}
        >
          STARIVA
        </p>
        <Rule />

        <p style={{ fontSize: narrow ? "9pt" : "10pt", fontWeight: 700 }}>
          Видеоуроки к вашему набору
        </p>
        <p
          style={{
            marginTop: "1.5mm",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: narrow ? "13pt" : "16pt",
            fontWeight: 700,
            lineHeight: 1.15,
          }}
        >
          {ticket.workshopTitle}
        </p>
        <p style={{ marginTop: "2mm", fontSize: narrow ? "8pt" : "9pt" }}>
          Я показываю на видео каждый шаг — плетите вместе со мной.
        </p>

        <Step n={1} narrow={narrow}>
          Наведите камеру телефона на QR‑код
        </Step>
        <svg
          viewBox={`0 0 ${ticket.qrSize} ${ticket.qrSize}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={`QR-код: ${ticket.address}, код ${ticket.code}`}
          style={{
            display: "block",
            margin: "2.5mm auto 0",
            width: narrow ? "34mm" : "42mm",
            height: narrow ? "34mm" : "42mm",
          }}
        >
          <path d={ticket.qrPath} fill="#000" />
        </svg>

        <Step n={2} narrow={narrow}>
          Или откройте страницу и введите код
        </Step>
        <p
          style={{
            marginTop: "1.5mm",
            fontSize: narrow ? "12pt" : "14pt",
            fontWeight: 700,
          }}
        >
          {ticket.address}
        </p>
        <p
          style={{
            margin: "2.5mm auto 0",
            padding: "1.5mm 0 1mm",
            border: "0.6mm solid #000",
            borderRadius: "2mm",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: narrow ? "22pt" : "28pt",
            fontWeight: 700,
            letterSpacing: "0.08em",
            lineHeight: 1.1,
          }}
        >
          {ticket.code}
        </p>

        <Step n={3} narrow={narrow}>
          Укажите почту — пришлю на неё ссылку на уроки
        </Step>

        <Rule />
        <p style={{ fontSize: narrow ? "8pt" : "9pt" }}>
          Код срабатывает один раз. Уроки останутся у вас в кабинете — смотрите
          сколько угодно.
        </p>
        <p
          style={{
            marginTop: "3mm",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: narrow ? "11pt" : "12pt",
            fontStyle: "italic",
          }}
        >
          Приятного плетения! Ольга
        </p>
        {ticket.note && (
          <p style={{ marginTop: "3mm", fontSize: "7pt" }}>{ticket.note}</p>
        )}
      </div>
    </>
  );
}

function Rule() {
  return (
    <div
      aria-hidden
      style={{
        margin: "3mm auto",
        width: "60%",
        borderTop: "0.4mm solid #000",
      }}
    />
  );
}

function Step({
  n,
  narrow,
  children,
}: {
  n: number;
  narrow: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      style={{
        marginTop: "4mm",
        fontSize: narrow ? "9pt" : "10pt",
        fontWeight: 700,
      }}
    >
      {n}. {children}
    </p>
  );
}
