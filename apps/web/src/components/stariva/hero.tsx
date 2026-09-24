"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import styles from "./hero.module.css";
import { useHomeOrder } from "./home-order-context";

const slides = [
  {
    id: "clothes",
    label: "Одежда",
    number: "01",
    productType: "clothes",
    image: "/images/home/hero-fashion-beach-v3.webp",
    alt: "Две модели в светлом платье и тунике макраме на солнечном морском пляже",
    eyebrow: "Одежда макраме · ручная работа",
    title: "Сплетено",
    accent: "для вас.",
    description:
      "Платья, топы и туники по вашим меркам. Вы выбираете образ — мы плетём вручную.",
    cta: "Заказать по своим меркам",
    href: "/catalog/clothes",
    link: "Посмотреть одежду",
    note: "Поможем с мерками. Цену и срок согласуем заранее.",
  },
  {
    id: "decor",
    label: "Декор",
    number: "02",
    productType: "panel",
    image: "/images/home/hero-decor-editorial.webp",
    alt: "Светлое панно макраме над деревянной скамьёй в интерьере с живыми растениями",
    eyebrow: "Декор макраме · ручная работа",
    title: "Детали, которые",
    accent: "делают дом вашим.",
    description:
      "Панно и предметы декора с живой фактурой. Подберём размер, оттенок и плетение для вашего пространства.",
    cta: "Обсудить свой декор",
    href: "/catalog/interior",
    link: "Посмотреть декор",
    note: "Можно начать с идеи или фото вашего интерьера.",
  },
  {
    id: "lampshades",
    label: "Абажуры",
    number: "03",
    productType: "lampshade",
    image: "/images/home/hero-interior-editorial.webp",
    alt: "Крупный абажур ручного плетения из светлого шнура в тёплом спокойном интерьере",
    eyebrow: "Абажуры макраме · ручная работа",
    title: "Свет с особенным",
    accent: "характером.",
    description:
      "Фактурное плетение для уютного света. Создадим абажур нужного размера для вашего дома или проекта.",
    cta: "Подобрать абажур",
    href: "/abazhury",
    link: "Посмотреть абажуры",
    note: "Размер, крепление и комплектацию обсудим с мастером.",
  },
] as const;

export function Hero() {
  const [active, setActive] = useState(0);
  const [instant, setInstant] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { setSelection } = useHomeOrder();
  const currentSlide = slides[active] ?? slides[0];
  const select = (index: number, keyboard = false) => {
    setInstant(keyboard);
    setActive((index + slides.length) % slides.length);
  };

  return (
    <section
      id="intro"
      aria-label="Изделия Stariva"
      aria-roledescription="карусель"
      className={styles.hero}
      data-tone={active === 0 ? "light" : "dark"}
      data-instant={instant}
    >
      <h1 className="sr-only">
        Stariva — одежда, декор и абажуры макраме на заказ
      </h1>
      <div className={styles.stage}>
        <div
          className={styles.photos}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (event.touches.length !== 1 || !touch) {
              touchStart.current = null;
              return;
            }
            touchStart.current = {
              x: touch.clientX,
              y: touch.clientY,
            };
          }}
          onTouchCancel={() => {
            touchStart.current = null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            touchStart.current = null;
            const touch = event.changedTouches[0];
            if (!start || event.changedTouches.length !== 1 || !touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
              select(active + (dx < 0 ? 1 : -1));
          }}
        >
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={styles.photo}
              data-active={active === index}
              data-fashion={index === 0}
              aria-hidden={active !== index}
            >
              <Image
                src={slide.image}
                alt={slide.alt}
                fill
                preload={index === 0}
                sizes="(max-width: 1023px) 140vw, 100vw"
                className={styles.image}
              />
            </div>
          ))}
          <div className={styles.shade} aria-hidden="true" />
          <span className={styles.counter} aria-hidden="true">
            {currentSlide.number}
            <span> / 03</span>
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Направления мастерской"
          className={styles.tabs}
        >
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              id={`hero-tab-${slide.id}`}
              role="tab"
              aria-selected={active === index}
              aria-controls={`hero-panel-${slide.id}`}
              tabIndex={active === index ? 0 : -1}
              className={styles.tab}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                if (event.altKey || event.ctrlKey || event.metaKey) return;
                let next: number;
                if (event.key === "ArrowRight")
                  next = (active + 1) % slides.length;
                else if (event.key === "ArrowLeft")
                  next = (active + slides.length - 1) % slides.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = slides.length - 1;
                else return;
                event.preventDefault();
                select(next, true);
                tabs.current[next]?.focus();
              }}
            >
              <span className={styles.tabNumber} aria-hidden="true">
                {slide.number}
              </span>
              {slide.label}
            </button>
          ))}
        </div>

        <div className={styles.copy}>
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              id={`hero-panel-${slide.id}`}
              role="tabpanel"
              aria-labelledby={`hero-tab-${slide.id}`}
              aria-hidden={active !== index}
              inert={active !== index}
              className={styles.panel}
              data-active={active === index}
            >
              <p className={styles.eyebrow}>{slide.eyebrow}</p>
              <h2 className={styles.title} data-long={index !== 0}>
                {slide.title}
                <br />
                <span>{slide.accent}</span>
              </h2>
              <p className={styles.description}>{slide.description}</p>
              <div className={styles.actions}>
                <Link
                  href="#order"
                  data-location={`hero-${slide.id}`}
                  className={styles.cta}
                  onClick={() =>
                    setSelection((previous) => ({
                      ...previous,
                      productType: slide.productType,
                      size:
                        previous.productType === slide.productType
                          ? previous.size
                          : undefined,
                    }))
                  }
                >
                  {slide.cta}
                  <span aria-hidden="true">↗</span>
                </Link>
                <Link href={slide.href} className={styles.catalog}>
                  {slide.link}
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <p className={styles.note}>{slide.note}</p>
            </div>
          ))}
        </div>
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {currentSlide.label}, слайд {active + 1} из {slides.length}
        </p>
      </div>
    </section>
  );
}
