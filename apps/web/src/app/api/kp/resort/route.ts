import { NextResponse } from "next/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://stariva.ru";

const products = [
  {
    name: "Макраме-панно",
    desc: "Настенное декоративное панно из натурального хлопка. Размеры 60×120 — 120×200 см. Плетение на деревянной жерди.",
    price: "от 7 500 ₽",
    usage: "Ресепшн, шатры, общие зоны",
  },
  {
    name: "Абажур / светильник",
    desc: "Абажур из хлопкового шнура на металлическом каркасе. Диаметр 30–60 см. Совместим со стандартным Е27.",
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
    desc: "Индивидуальное изделие с названием или логотипом вашего объекта. Разработка дизайна включена в стоимость.",
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

const conditions = [
  "Минимальный заказ — 1 изделие",
  "Скидка 15% при заказе от 5 изделий",
  "При заказе от 10 изделий — индивидуальное ценообразование",
  "Срок производства: 3–5 недель для корпоративных заказов",
  "Экспресс-производство за +30% для заказов до 3 изделий",
  "Доставка СДЭК по всей России",
  "Монтаж по Москве и МО — в стоимость заказа от 5 изделий",
  "Документы: договор, счёт, акт, накладные (ИП / ООО)",
];

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stariva — Коммерческое предложение для баз отдыха</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --parchment: #F5F0E8;
      --sand: #EDE7DA;
      --espresso: #2C2118;
      --terracotta: #B85C38;
      --taupe: #8C7B6E;
      --mid-grey: #9E9590;
    }

    body {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: var(--espresso);
      background: #fff;
    }

    /* ── Page layout ─────────────────────────────────────── */
    .page { max-width: 794px; margin: 0 auto; padding: 0; }

    /* ── Cover ───────────────────────────────────────────── */
    .cover {
      background: var(--espresso);
      color: var(--parchment);
      padding: 64px 60px 56px;
      position: relative;
      overflow: hidden;
    }
    .cover-eyebrow {
      font-family: 'Inter', sans-serif;
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--terracotta);
      margin-bottom: 20px;
    }
    .cover-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 48px;
      font-weight: 500;
      line-height: 1.1;
      margin-bottom: 24px;
    }
    .cover-subtitle {
      font-size: 14px;
      line-height: 1.7;
      color: rgba(245,240,232,0.7);
      max-width: 420px;
      margin-bottom: 40px;
    }
    .cover-meta {
      font-size: 11px;
      color: rgba(245,240,232,0.45);
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }
    .cover-decoration {
      position: absolute;
      right: 60px;
      top: 50%;
      transform: translateY(-50%);
      width: 200px;
      opacity: 0.06;
    }
    .cover-decoration-line {
      height: 1px;
      background: rgba(245,240,232,0.15);
      margin: 4px 0;
    }

    /* ── Body sections ───────────────────────────────────── */
    .body { padding: 48px 60px; }

    .section { margin-bottom: 48px; }
    .section:last-child { margin-bottom: 0; }

    .section-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 26px;
      font-weight: 500;
      color: var(--espresso);
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(44,33,24,0.1);
    }

    /* ── Products table ──────────────────────────────────── */
    .products-table { width: 100%; border-collapse: collapse; }
    .products-table th {
      background: var(--sand);
      font-family: 'Inter', sans-serif;
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
    .products-table tr:last-child td { border-bottom: none; }
    .products-table .name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 15px;
      font-weight: 500;
      color: var(--espresso);
      display: block;
      margin-bottom: 4px;
    }
    .products-table .desc { color: var(--taupe); font-size: 11px; line-height: 1.5; }
    .products-table .price {
      font-family: 'Cormorant Garamond', serif;
      font-size: 16px;
      font-weight: 600;
      color: var(--terracotta);
      white-space: nowrap;
    }
    .products-table .usage {
      font-size: 10px;
      color: var(--taupe);
      letter-spacing: 0.04em;
    }

    /* ── Conditions grid ─────────────────────────────────── */
    .conditions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .condition-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: var(--parchment);
      border-radius: 8px;
      padding: 12px 14px;
    }
    .condition-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--terracotta);
      flex-shrink: 0;
      margin-top: 5px;
    }
    .condition-text { font-size: 12px; color: var(--espresso); line-height: 1.5; }

    /* ── Steps ───────────────────────────────────────────── */
    .steps { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .step {
      border: 1px solid rgba(44,33,24,0.08);
      border-radius: 12px;
      padding: 20px;
    }
    .step-num {
      font-family: 'Cormorant Garamond', serif;
      font-size: 32px;
      font-weight: 400;
      color: rgba(184,92,56,0.3);
      line-height: 1;
      margin-bottom: 10px;
    }
    .step-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 17px;
      font-weight: 500;
      color: var(--espresso);
      margin-bottom: 6px;
    }
    .step-body { font-size: 11px; color: var(--taupe); line-height: 1.6; }

    /* ── CTA strip ───────────────────────────────────────── */
    .cta {
      background: var(--terracotta);
      color: #fff;
      border-radius: 16px;
      padding: 36px 40px;
      text-align: center;
    }
    .cta-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 30px;
      font-weight: 500;
      margin-bottom: 12px;
    }
    .cta-body { font-size: 13px; opacity: 0.85; line-height: 1.6; margin-bottom: 24px; }
    .cta-contacts { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
    .cta-contact { font-size: 14px; font-weight: 500; color: #fff; text-decoration: none; }
    .cta-label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.65; display: block; margin-bottom: 4px; }

    /* ── Footer ──────────────────────────────────────────── */
    .doc-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid rgba(44,33,24,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .doc-footer-brand {
      font-family: 'Cormorant Garamond', serif;
      font-size: 18px;
      font-weight: 500;
      color: var(--espresso);
    }
    .doc-footer-meta { font-size: 10px; color: var(--mid-grey); text-align: right; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { max-width: 100%; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Cover -->
  <div class="cover">
    <div class="cover-decoration" aria-hidden="true">
      ${Array.from({ length: 30 })
        .map(
          (_, i) =>
            `<div class="cover-decoration-line" style="width:${60 + (i % 5) * 28}%;opacity:${0.3 + (i % 3) * 0.2}"></div>`,
        )
        .join("")}
    </div>
    <p class="cover-eyebrow">Stariva · Коммерческое предложение</p>
    <h1 class="cover-title">Макраме-декор<br>для баз отдыха<br>и глэмпингов</h1>
    <p class="cover-subtitle">Натуральный хлопок, авторский дизайн, монтаж под ключ. Превращаем типовые пространства в атмосферные места, куда гости возвращаются.</p>
    <div class="cover-meta">
      <span>Документ подготовлен: ${new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
      <span>Актуален: 30 дней</span>
      <span>${BASE_URL}/resort</span>
    </div>
  </div>

  <div class="body">

    <!-- Products -->
    <div class="section">
      <h2 class="section-title">Прайс-лист</h2>
      <table class="products-table">
        <thead>
          <tr>
            <th style="width:40%">Изделие</th>
            <th style="width:20%">Стоимость</th>
            <th style="width:40%">Применение</th>
          </tr>
        </thead>
        <tbody>
          ${products
            .map(
              (p) => `
          <tr>
            <td>
              <span class="name">${p.name}</span>
              <span class="desc">${p.desc}</span>
            </td>
            <td><span class="price">${p.price}</span></td>
            <td><span class="usage">${p.usage}</span></td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <!-- Conditions -->
    <div class="section">
      <h2 class="section-title">Условия сотрудничества</h2>
      <div class="conditions-grid">
        ${conditions
          .map(
            (c) => `
        <div class="condition-item">
          <div class="condition-dot"></div>
          <span class="condition-text">${c}</span>
        </div>`,
          )
          .join("")}
      </div>
    </div>

    <!-- Process -->
    <div class="section">
      <h2 class="section-title">Как мы работаем</h2>
      <div class="steps">
        <div class="step">
          <div class="step-num">01</div>
          <div class="step-title">Заявка и бриф</div>
          <div class="step-body">Пишите в Telegram или на почту. Рассказываете про пространство: размеры, стиль, фото. КП готовим за 24 часа.</div>
        </div>
        <div class="step">
          <div class="step-num">02</div>
          <div class="step-title">Эскиз и утверждение</div>
          <div class="step-body">Присылаем концепцию и раскладку. Вносим правки, согласовываем сроки, подписываем договор.</div>
        </div>
        <div class="step">
          <div class="step-num">03</div>
          <div class="step-title">Производство</div>
          <div class="step-body">Плетём в мастерской. Отправляем фото прогресса. Для корпоративных заказов — 3–5 недель.</div>
        </div>
        <div class="step">
          <div class="step-num">04</div>
          <div class="step-title">Доставка и монтаж</div>
          <div class="step-body">Доставка СДЭК по всей России. Монтаж по Москве и МО. Видеоинструкция для других регионов.</div>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div class="cta">
      <h2 class="cta-title">Готовы обсудить ваш проект?</h2>
      <p class="cta-body">Пришлите фото и размеры вашего пространства — подготовим индивидуальное предложение в течение 24 часов.</p>
      <div class="cta-contacts">
        <div>
          <span class="cta-label">Telegram</span>
          <a class="cta-contact" href="https://t.me/stariva">@stariva</a>
        </div>
        <div>
          <span class="cta-label">Телефон</span>
          <a class="cta-contact" href="tel:+79999999999">+7 (999) 999-99-99</a>
        </div>
        <div>
          <span class="cta-label">Сайт</span>
          <a class="cta-contact" href="${BASE_URL}/resort">${BASE_URL.replace(/https?:\/\//, "")}/resort</a>
        </div>
      </div>
    </div>

    <!-- Doc footer -->
    <div class="doc-footer">
      <span class="doc-footer-brand">Stariva</span>
      <div class="doc-footer-meta">
        <div>ИП Иванова / ООО Старива · ИНН 000000000000</div>
        <div>${BASE_URL}</div>
      </div>
    </div>

  </div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="stariva-kp-bazy-otdykha.html"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
