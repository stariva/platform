"use client";

import { Button } from "@stariva/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/*
 * Купон в коробку с набором: QR, адрес и код, чтобы покупатель открыл
 * видеоуроки любым удобным способом. Печатается на термопринтере, поэтому
 * всё чёрным по белому, без серого и тонких линий: полутона термоголовка
 * превращает в рябь.
 */

/**
 * Что стоит в принтере. Этикетка — фиксированный лист, купон обязан в него
 * влезть; рулон — лента нужной ширины, длина по купону.
 */
const FORMATS = [
  { id: "label", title: "Этикетка 75×120", width: 75, height: 120 },
  { id: "roll80", title: "Лента 80 мм", width: 80, height: null },
  { id: "roll58", title: "Лента 58 мм", width: 58, height: null },
] as const;
type Format = (typeof FORMATS)[number];
type FormatId = Format["id"];

const FORMAT_KEY = "stariva:ticket-format";
const PX_PER_MM = 96 / 25.4;
/** Длиннее этого название на этикетке не помещается в одну строку. */
const LONG_TITLE = 22;

/** Размеры купона под формат: на этикетке всё плотнее, на узкой ленте мельче. */
const SIZES = {
  label: {
    pad: "3mm 5mm",
    brand: "12pt",
    lead: "9pt",
    title: "13pt",
    step: "9pt",
    stepGap: "1.8mm",
    qr: "28mm",
    address: "11pt",
    code: "19pt",
    foot: "8pt",
    sign: "10pt",
    rule: "1.2mm",
  },
  roll80: {
    pad: "6mm 6mm 7mm",
    brand: "15pt",
    lead: "10pt",
    title: "16pt",
    step: "10pt",
    stepGap: "4mm",
    qr: "42mm",
    address: "14pt",
    code: "28pt",
    foot: "9pt",
    sign: "12pt",
    rule: "3mm",
  },
  roll58: {
    pad: "5mm 4mm 6mm",
    brand: "13pt",
    lead: "9pt",
    title: "13pt",
    step: "9pt",
    stepGap: "4mm",
    qr: "34mm",
    address: "12pt",
    code: "22pt",
    foot: "8pt",
    sign: "11pt",
    rule: "3mm",
  },
} satisfies Record<FormatId, Record<string, string>>;

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
  const [formatId, setFormatId] = useState<FormatId>("label");
  const [heightMm, setHeightMm] = useState(160);
  const [overflow, setOverflow] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);

  const format: Format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];
  const fixedHeight = format.height;
  // На этикетке длинное название занимает две строки — уменьшаем кегль, чтобы
  // купон не вылез за лист
  const size: Record<keyof (typeof SIZES)["label"], string> = {
    ...SIZES[format.id],
    ...(fixedHeight && ticket.workshopTitle.length > LONG_TITLE
      ? { title: "11pt" }
      : {}),
  };

  // Формат помним: принтер у мастера один
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORMAT_KEY);
      const found = FORMATS.find((f) => f.id === saved);
      if (found) setFormatId(found.id);
    } catch {
      // Хранилище недоступно — остаётся этикетка
    }
  }, []);

  function chooseFormat(next: FormatId) {
    setFormatId(next);
    try {
      localStorage.setItem(FORMAT_KEY, next);
    } catch {
      // Не запомнили — не страшно
    }
  }

  // Рулон: высота страницы по купону, лента не уходит впустую. Этикетка:
  // высота задана, проверяем, что содержимое в неё помещается
  useLayoutEffect(() => {
    const node = sheet.current;
    if (!node) return;
    const measure = () => {
      if (fixedHeight) {
        setHeightMm(fixedHeight);
        setOverflow(node.scrollHeight > node.clientHeight + 1);
      } else {
        setHeightMm(Math.ceil(node.offsetHeight / PX_PER_MM) + 6);
        setOverflow(false);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fixedHeight]);

  // При печати остаётся только купон: меню админки и кнопки скрываем
  const printStyles = `
@page { size: ${format.width}mm ${heightMm}mm; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  body *:not(#access-ticket):not(#access-ticket *):not(:has(#access-ticket)) {
    display: none !important;
  }
  body *:has(#access-ticket) {
    position: static !important;
  }
  #access-ticket {
    position: absolute; left: 0; top: 0; margin: 0;
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
        <fieldset className="flex items-center gap-1" aria-label="Бумага">
          {FORMATS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={item.id === formatId ? "secondary" : "ghost"}
              aria-pressed={item.id === formatId}
              onClick={() => chooseFormat(item.id)}
            >
              {item.title}
            </Button>
          ))}
        </fieldset>
      </div>
      {overflow && (
        <p className="text-destructive text-sm" role="alert">
          Название мастер-класса слишком длинное: купон не помещается в{" "}
          {format.width}×{format.height} мм и обрежется. Выберите ленту — она
          печатает купон целиком.
        </p>
      )}

      <div
        id="access-ticket"
        ref={sheet}
        className="shadow-sm ring-1 ring-black/10"
        style={{
          width: `${format.width}mm`,
          height: fixedHeight ? `${fixedHeight}mm` : undefined,
          overflow: fixedHeight ? "hidden" : undefined,
          padding: size.pad,
          boxSizing: "border-box",
          // Этикетка: остаток высоты делится поровну сверху и снизу
          display: "flex",
          flexDirection: "column",
          justifyContent: fixedHeight ? "center" : "flex-start",
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
            fontSize: size.brand,
            letterSpacing: "0.3em",
            // Разрядка добавляет пробел и после последней буквы — возвращаем центр
            marginRight: "-0.3em",
          }}
        >
          STARIVA
        </p>
        <Rule margin={size.rule} />

        <p style={{ fontSize: size.lead, fontWeight: 700 }}>
          Видеоуроки к вашему набору
        </p>
        <p
          style={{
            marginTop: "1.5mm",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: size.title,
            fontWeight: 700,
            lineHeight: 1.15,
          }}
        >
          {ticket.workshopTitle}
        </p>
        {format.id !== "label" && (
          <p
            style={{
              marginTop: "2mm",
              fontSize: format.id === "roll58" ? "8pt" : "9pt",
            }}
          >
            Я показываю на видео каждый шаг — плетите вместе со мной.
          </p>
        )}

        <Step gap={size.stepGap} fontSize={size.step}>
          1. Наведите камеру телефона на QR‑код
        </Step>
        <svg
          viewBox={`0 0 ${ticket.qrSize} ${ticket.qrSize}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={`QR-код: ${ticket.address}, код ${ticket.code}`}
          style={{
            display: "block",
            flexShrink: 0,
            margin: "2mm auto 0",
            width: size.qr,
            height: size.qr,
          }}
        >
          <path d={ticket.qrPath} fill="#000" />
        </svg>

        <Step gap={size.stepGap} fontSize={size.step}>
          2. Или откройте страницу и введите код
        </Step>
        <p
          style={{
            marginTop: "1.5mm",
            fontSize: size.address,
            fontWeight: 700,
          }}
        >
          {ticket.address}
        </p>
        <p
          style={{
            margin: "2mm auto 0",
            padding: "1.5mm 0 1mm",
            width: "100%",
            border: "0.6mm solid #000",
            borderRadius: "2mm",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: size.code,
            fontWeight: 700,
            letterSpacing: "0.08em",
            lineHeight: 1.1,
          }}
        >
          {ticket.code}
        </p>

        <Step gap={size.stepGap} fontSize={size.step}>
          3. Укажите почту — пришлю ссылку
        </Step>

        <Rule margin={size.rule} />
        <p style={{ fontSize: size.foot }}>
          Код срабатывает один раз. Уроки останутся у вас в кабинете — смотрите
          сколько угодно.
        </p>
        <p
          style={{
            marginTop: "2.5mm",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: size.sign,
            fontStyle: "italic",
          }}
        >
          Приятного плетения! Ольга
        </p>
        {ticket.note && (
          <p style={{ marginTop: "2mm", fontSize: "7pt" }}>{ticket.note}</p>
        )}
      </div>
    </>
  );
}

function Rule({ margin }: { margin: string }) {
  return (
    <div
      aria-hidden
      style={{
        margin: `${margin} auto`,
        width: "60%",
        flexShrink: 0,
        borderTop: "0.4mm solid #000",
      }}
    />
  );
}

function Step({
  gap,
  fontSize,
  children,
}: {
  gap: string;
  fontSize: string;
  children: React.ReactNode;
}) {
  return (
    <p style={{ marginTop: gap, fontSize, fontWeight: 700 }}>{children}</p>
  );
}
