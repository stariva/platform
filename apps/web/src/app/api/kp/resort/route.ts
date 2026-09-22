import { workSteps } from "@/app/resort/_data";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { type NextRequest, NextResponse } from "next/server";

const SITE_HOST = BASE_URL.replace(/^https?:\/\//, "");
const VALID_DAYS = 30;

const contacts = {
  telegram: "Olga_Stariva",
  phone: "+79778722546",
  phoneLabel: "+7 977 872 25 46",
  email: "info@stariva.ru",
};

const requisites = "Самозанятая Карпычева О. А. · ИНН 502480197143";

const products = [
  {
    name: "Макраме-панно",
    desc: "Настенное декоративное панно из натурального хлопка. Размеры 60×120 — 120×200 см. Плетение на деревянной жерди.",
    price: "от 7 500 ₽",
    usage: "Ресепшн, шатры, общие зоны",
  },
  {
    name: "Абажур / светильник",
    desc: "Абажур из хлопкового шнура на металлическом каркасе. Диаметр 30–60 см. Совместим со стандартным патроном Е27.",
    price: "от 4 200 ₽",
    usage: "Беседки, рестораны, SPA",
  },
  {
    name: "Подвесное кресло-гамак",
    desc: "Кресло из плотного хлопкового шнура 6 мм. Нагрузка до 120 кг. Крепёж на деревянную или металлическую балку.",
    price: "от 12 000 ₽",
    usage: "Террасы, глэмпинг, зоны отдыха",
  },
  {
    name: "Макраме-ширма / занавеска",
    desc: "Прозрачное плетение для зонирования пространства. Пропускает свет, создаёт приватность. Ширина 100–200 см.",
    price: "от 9 500 ₽",
    usage: "Открытые террасы, беседки",
  },
  {
    name: "Панно с логотипом",
    desc: "Индивидуальное изделие с названием или логотипом вашего объекта. Разработка эскиза включена в стоимость.",
    price: "от 14 000 ₽",
    usage: "Брендинг, фотозоны",
  },
  {
    name: "Комплект для глэмпинга",
    desc: "Панно + ловец снов + 2 кашпо — готовый комплект для одного номера. Единый стиль и готовые крепления.",
    price: "от 18 000 ₽",
    usage: "Глэмпинг, домики, шатры",
  },
];

const photos = [
  { src: "/images/resort/terrace.png", caption: "Террасы и беседки" },
  { src: "/images/resort/glamping.png", caption: "Глэмпинг" },
  { src: "/images/resort/reception.png", caption: "Ресепшн" },
  { src: "/images/resort/spa.png", caption: "SPA" },
];

const conditions = [
  "Минимальный заказ — 1 изделие",
  "Скидка 15% при заказе от 5 изделий",
  "От 10 изделий — индивидуальная цена и приоритет в производстве",
  "Срок производства: 3–5 недель для корпоративных заказов",
  "Экспресс-производство +30% для заказов до 3 изделий",
  "Доставка СДЭК и Почтой России по всей России",
  "Монтаж по Москве и МО — бесплатно при заказе от 5 изделий",
  "Документы: договор, счёт, акт, чек НПД",
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatDate = (date: Date) =>
  date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  });

export function GET(request: NextRequest) {
  const download = request.nextUrl.searchParams.has("download");
  const preparedAt = new Date();
  const validUntil = new Date(preparedAt.getTime() + VALID_DAYS * 86_400_000);

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stariva — коммерческое предложение для баз отдыха</title>
  <meta name="description" content="Макраме-декор для баз отдыха, глэмпингов и загородных отелей: цены, условия, сроки." />
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500&display=swap" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --parchment: #F5F0E8;
      --sand: #EDE7DA;
      --espresso: #2C2118;
      --terracotta: #B85C38;
      --taupe: #7A6A5E;
      --mid-grey: #8A817C;
      --serif: 'Cormorant Garamond', 'Cormorant', Georgia, 'Times New Roman', serif;
      --sans: 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    }

    html { background: var(--sand); }
    body {
      font-family: var(--sans);
      font-size: 13px;
      line-height: 1.6;
      color: var(--espresso);
      background: var(--sand);
      -webkit-text-size-adjust: 100%;
    }
    a { color: inherit; }

    /* ── Toolbar (screen only) ───────────────────────────── */
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 12px 16px;
      background: rgba(237,231,218,0.92);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(44,33,24,0.08);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 0;
      border-radius: 999px;
      padding: 10px 20px;
      font: 500 12px/1 var(--sans);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
      background: var(--terracotta);
      color: #fff;
    }
    .btn-secondary { background: var(--espresso); }
    .btn-ghost { background: transparent; color: var(--espresso); box-shadow: inset 0 0 0 1px rgba(44,33,24,0.2); }

    /* ── Page layout ─────────────────────────────────────── */
    .page {
      max-width: 794px;
      margin: 24px auto;
      background: #fff;
      box-shadow: 0 10px 40px rgba(44,33,24,0.08);
    }

    /* ── Cover ───────────────────────────────────────────── */
    .cover {
      background: var(--espresso);
      color: var(--parchment);
      padding: 64px 60px 56px;
      position: relative;
      overflow: hidden;
    }
    .cover > *:not(.cover-decoration) { position: relative; }
    .cover-eyebrow {
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #D9825E;
      margin-bottom: 20px;
    }
    .cover-title {
      font-family: var(--serif);
      font-size: 48px;
      font-weight: 500;
      line-height: 1.1;
      margin-bottom: 24px;
    }
    .cover-subtitle {
      font-size: 14px;
      line-height: 1.7;
      color: rgba(245,240,232,0.75);
      max-width: 420px;
      margin-bottom: 40px;
    }
    .cover-meta {
      font-size: 11px;
      color: rgba(245,240,232,0.55);
      display: flex;
      gap: 8px 24px;
      flex-wrap: wrap;
    }
    .cover-meta a { text-decoration: none; }
    .cover-decoration {
      position: absolute;
      right: 60px;
      top: 50%;
      transform: translateY(-50%);
      width: 200px;
      opacity: 0.35;
    }
    .cover-decoration-line {
      height: 1px;
      background: rgba(245,240,232,0.25);
      margin: 4px 0 4px auto;
    }

    /* ── Photos ──────────────────────────────────────────── */
    .photos {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      background: var(--espresso);
      padding: 0 0 4px;
    }
    .photo { position: relative; aspect-ratio: 4 / 5; overflow: hidden; background: #3a2d22; }
    .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo figcaption {
      position: absolute;
      left: 10px;
      bottom: 8px;
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #fff;
      text-shadow: 0 1px 6px rgba(0,0,0,0.6);
    }

    /* ── Body sections ───────────────────────────────────── */
    .body { padding: 48px 60px; }
    .section { margin-bottom: 48px; }
    .section-title {
      font-family: var(--serif);
      font-size: 26px;
      font-weight: 500;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(44,33,24,0.1);
      break-after: avoid;
    }
    .section-note { font-size: 11px; color: var(--taupe); margin-top: 14px; }

    /* ── Products table ──────────────────────────────────── */
    .products-table { width: 100%; border-collapse: collapse; }
    .products-table th {
      background: var(--sand);
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--taupe);
      padding: 10px 14px;
      text-align: left;
    }
    .products-table td {
      padding: 14px;
      border-bottom: 1px solid rgba(44,33,24,0.07);
      vertical-align: top;
      font-size: 12px;
    }
    .products-table tr { break-inside: avoid; }
    .products-table tr:last-child td { border-bottom: none; }
    .products-table .name {
      font-family: var(--serif);
      font-size: 16px;
      font-weight: 600;
      display: block;
      margin-bottom: 4px;
    }
    .products-table .desc { display: block; color: var(--taupe); font-size: 11px; line-height: 1.5; }
    .products-table .price {
      font-family: var(--serif);
      font-size: 17px;
      font-weight: 600;
      color: var(--terracotta);
      white-space: nowrap;
    }
    .products-table .usage { font-size: 11px; color: var(--taupe); }

    /* ── Conditions grid ─────────────────────────────────── */
    .conditions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .condition-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: var(--parchment);
      border-radius: 8px;
      padding: 12px 14px;
      break-inside: avoid;
    }
    .condition-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--terracotta);
      flex-shrink: 0;
      margin-top: 6px;
    }
    .condition-text { font-size: 12px; line-height: 1.5; }

    /* ── Steps ───────────────────────────────────────────── */
    .steps { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .step {
      border: 1px solid rgba(44,33,24,0.1);
      border-radius: 12px;
      padding: 20px;
      break-inside: avoid;
    }
    .step-num {
      font-family: var(--serif);
      font-size: 32px;
      color: rgba(184,92,56,0.45);
      line-height: 1;
      margin-bottom: 10px;
    }
    .step-title { font-family: var(--serif); font-size: 18px; font-weight: 600; margin-bottom: 6px; }
    .step-body { font-size: 11.5px; color: var(--taupe); line-height: 1.6; }

    /* ── CTA strip ───────────────────────────────────────── */
    .cta {
      background: var(--terracotta);
      color: #fff;
      border-radius: 16px;
      padding: 36px 40px;
      text-align: center;
      break-inside: avoid;
    }
    .cta-title { font-family: var(--serif); font-size: 30px; font-weight: 500; margin-bottom: 12px; }
    .cta-body { font-size: 13px; opacity: 0.9; line-height: 1.6; margin: 0 auto 24px; max-width: 460px; }
    .cta-contacts { display: flex; gap: 16px 28px; justify-content: center; flex-wrap: wrap; }
    .cta-contact { font-size: 14px; font-weight: 500; color: #fff; text-decoration: none; }
    .cta-label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; display: block; margin-bottom: 4px; }

    /* ── Footer ──────────────────────────────────────────── */
    .doc-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid rgba(44,33,24,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .doc-footer-brand { font-family: var(--serif); font-size: 18px; font-weight: 500; }
    .doc-footer-meta { font-size: 10px; color: var(--mid-grey); text-align: right; }

    /* ── Mobile ──────────────────────────────────────────── */
    @media (max-width: 640px) {
      .page { margin: 0; box-shadow: none; }
      .cover { padding: 40px 20px 36px; }
      .cover-title { font-size: 34px; }
      .cover-decoration { display: none; }
      .photos { grid-template-columns: repeat(2, 1fr); }
      .body { padding: 32px 20px; }
      .section { margin-bottom: 36px; }
      .products-table thead { display: none; }
      .products-table, .products-table tbody, .products-table tr, .products-table td { display: block; width: 100%; }
      .products-table tr { padding: 14px 0; border-bottom: 1px solid rgba(44,33,24,0.07); }
      .products-table td { padding: 0; border: 0; }
      .products-table td + td { margin-top: 6px; }
      .conditions-grid, .steps { grid-template-columns: 1fr; }
      .cta { padding: 28px 20px; }
      .cta-title { font-size: 26px; }
      .doc-footer-meta { text-align: left; }
    }

    /* ── Print / PDF ─────────────────────────────────────── */
    @page { size: A4; margin: 0; }
    @media print {
      html, body { background: #fff; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .toolbar { display: none; }
      .page { max-width: 100%; margin: 0; box-shadow: none; }
      .body { padding: 36px 48px; }
      .cta a[href]::after { content: none; }
    }
  </style>
</head>
<body>
<nav class="toolbar" aria-label="Действия с документом">
  <button class="btn" type="button" onclick="window.print()">Сохранить в PDF</button>
  <a class="btn btn-secondary" href="https://t.me/${contacts.telegram}" target="_blank" rel="noopener noreferrer">Обсудить в Telegram</a>
  <a class="btn btn-ghost" href="${BASE_URL}/resort">На сайт</a>
</nav>

<main class="page">

  <header class="cover">
    <div class="cover-decoration" aria-hidden="true">
      ${Array.from({ length: 30 })
        .map(
          (_, i) =>
            `<div class="cover-decoration-line" style="width:${60 + (i % 5) * 10}%;opacity:${0.3 + (i % 3) * 0.3}"></div>`,
        )
        .join("")}
    </div>
    <p class="cover-eyebrow">Stariva · Коммерческое предложение</p>
    <h1 class="cover-title">Макраме-декор<br>для баз отдыха<br>и глэмпингов</h1>
    <p class="cover-subtitle">Натуральный хлопок, авторский дизайн, монтаж под ключ. Превращаем типовые пространства в атмосферные места, куда гости возвращаются.</p>
    <div class="cover-meta">
      <span>Подготовлено: ${formatDate(preparedAt)}</span>
      <span>Действительно до: ${formatDate(validUntil)}</span>
      <a href="${BASE_URL}/resort">${SITE_HOST}/resort</a>
    </div>
  </header>

  <div class="photos">
    ${photos
      .map(
        (p) => `
    <figure class="photo">
      <img src="${BASE_URL}${p.src}" alt="${escapeHtml(p.caption)}" loading="eager" />
      <figcaption>${escapeHtml(p.caption)}</figcaption>
    </figure>`,
      )
      .join("")}
  </div>

  <div class="body">

    <section class="section">
      <h2 class="section-title">Прайс-лист</h2>
      <table class="products-table">
        <thead>
          <tr>
            <th style="width:46%">Изделие</th>
            <th style="width:18%">Стоимость</th>
            <th style="width:36%">Применение</th>
          </tr>
        </thead>
        <tbody>
          ${products
            .map(
              (p) => `
          <tr>
            <td>
              <span class="name">${escapeHtml(p.name)}</span>
              <span class="desc">${escapeHtml(p.desc)}</span>
            </td>
            <td><span class="price">${escapeHtml(p.price)}</span></td>
            <td><span class="usage">${escapeHtml(p.usage)}</span></td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <p class="section-note">Цены указаны за одно изделие. Итоговая стоимость зависит от размера, цвета и сложности плетения — точный расчёт делаем по брифу.</p>
    </section>

    <section class="section">
      <h2 class="section-title">Условия сотрудничества</h2>
      <div class="conditions-grid">
        ${conditions
          .map(
            (c) => `
        <div class="condition-item">
          <div class="condition-dot" aria-hidden="true"></div>
          <span class="condition-text">${escapeHtml(c)}</span>
        </div>`,
          )
          .join("")}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Как мы работаем</h2>
      <div class="steps">
        ${workSteps
          .map(
            (s) => `
        <div class="step">
          <div class="step-num">${escapeHtml(s.step)}</div>
          <div class="step-title">${escapeHtml(s.title)}</div>
          <div class="step-body">${escapeHtml(s.body)}</div>
        </div>`,
          )
          .join("")}
      </div>
    </section>

    <section class="cta">
      <h2 class="cta-title">Готовы обсудить ваш проект?</h2>
      <p class="cta-body">Пришлите фото и размеры вашего пространства — подготовим индивидуальное предложение в течение 24 часов.</p>
      <div class="cta-contacts">
        <div>
          <span class="cta-label">Telegram</span>
          <a class="cta-contact" href="https://t.me/${contacts.telegram}">@${contacts.telegram}</a>
        </div>
        <div>
          <span class="cta-label">Телефон</span>
          <a class="cta-contact" href="tel:${contacts.phone}">${contacts.phoneLabel}</a>
        </div>
        <div>
          <span class="cta-label">Email</span>
          <a class="cta-contact" href="mailto:${contacts.email}">${contacts.email}</a>
        </div>
      </div>
    </section>

    <footer class="doc-footer">
      <span class="doc-footer-brand">Stariva</span>
      <div class="doc-footer-meta">
        <div>${requisites}</div>
        <div><a href="${BASE_URL}">${SITE_HOST}</a></div>
      </div>
    </footer>

  </div>
</main>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="stariva-kp-bazy-otdykha.html"`,
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
