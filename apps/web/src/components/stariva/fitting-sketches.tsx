import Image from "next/image";
import { ContactMasterButton } from "./contact-master";

const steps = [
  {
    title: "Расскажите о себе",
    text: "Рост, тип фигуры, цвет волос и кожи. Фото не обязательно: достаточно словесного описания.",
  },
  {
    title: "Опишите изделие",
    text: "Платье, туника или топ, длина, силуэт, цвет, повод. Можно приложить картинки, которые нравятся.",
  },
  {
    title: "Получите эскизы",
    text: "Мастер пришлёт несколько вариантов с учётом того, что реально сплести из наших материалов.",
  },
  {
    title: "Выберите и уточните",
    text: "Скажите, что поменять: длину, рукав, плотность плетения. Когда эскиз нравится, согласуем цену и срок.",
  },
];

const examples = [
  {
    image: "/images/fitting-sketches/photo-maxi-milk.png",
    alt: "Девушка с русыми волосами в молочном макси-платье макраме на берегу моря",
    request:
      "Рост 165, фигура «песочные часы», светлая кожа, русые волосы до плеч. Хочу длинное молочное платье на свадьбу у моря.",
    result:
      "Макси-платье с открытой спиной и подчёркнутой талией, плетение плотнее на лифе.",
  },
  {
    image: "/images/fitting-sketches/photo-mini-terracotta.png",
    alt: "Высокая девушка с тёмно-русыми волосами в терракотовом мини-платье макраме на дюнах",
    request:
      "Рост 178, стройная, загорелая кожа, длинные тёмно-русые волнистые волосы. Нужно мини поверх купальника, тёплый терракотовый цвет.",
    result: "Мини-платье с бахромой по подолу и ажурными боками.",
  },
  {
    image: "/images/fitting-sketches/photo-tunic-sage.png",
    alt: "Рыжеволосая девушка с пышными формами в тунике миди макраме цвета шалфей",
    request:
      "Рост 158, пышные формы, рыжие волосы. Хочу тунику миди с рукавом, чтобы прикрыть руки, цвет шалфей.",
    result:
      "Туника миди с рукавом-фонариком и вертикальным узором, который вытягивает силуэт.",
  },
];

const checklist = [
  "Рост и мерки — если не знаете, мастер подскажет, что измерить",
  "Тип фигуры своими словами",
  "Цвет волос, кожи, глаз",
  "Какое изделие хотите и для какого случая",
  "Картинки-референсы — по желанию",
];

export function FittingSketches() {
  return (
    <section
      aria-labelledby="fitting-sketches-title"
      className="border-t border-espresso/10 bg-parchment py-12 lg:py-20"
    >
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
        <header className="max-w-3xl">
          <p className="label-caps text-terracotta mb-4">
            Эскиз на вашей фигуре
          </p>
          <h2
            id="fitting-sketches-title"
            className="font-serif text-3xl lg:text-5xl text-espresso text-balance"
          >
            Увидеть платье <span className="italic">до первого узла</span>
          </h2>
          <p className="mt-6 text-base lg:text-lg leading-relaxed text-espresso/75 text-pretty">
            Сложно представить, как изделие будет смотреться именно на вас?
            Расскажите о себе и о платье мечты — мастер подготовит эскизы, где
            модель нарисована на фигуре с вашими пропорциями, цветом волос и
            кожи. Вы выбираете вариант, вносите правки, и только потом мы
            начинаем плести.
          </p>
        </header>

        <div className="mt-12 lg:mt-16">
          <h3 className="font-serif text-2xl text-espresso">
            Как это работает
          </h3>
          <ol className="mt-6 grid gap-8 md:grid-cols-4 md:gap-6 lg:gap-10">
            {steps.map((step, index) => (
              <li key={step.title} className="border-t border-espresso/15 pt-5">
                <span className="text-sm text-taupe tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 font-serif text-xl text-espresso">
                  {step.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-espresso/75">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-14 lg:mt-20">
          <h3 className="font-serif text-2xl text-espresso">
            Как это выглядит на деле
          </h3>
          <div className="mt-6 grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {examples.map((example) => (
              <figure key={example.image} className="flex flex-col">
                <div className="relative aspect-[3/4] overflow-hidden bg-sand">
                  <Image
                    src={example.image}
                    alt={example.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="mt-5 flex flex-1 flex-col">
                  <p className="label-caps text-taupe">Запрос клиента</p>
                  <blockquote className="mt-2 font-serif italic text-lg leading-snug text-espresso">
                    «{example.request}»
                  </blockquote>
                  <div className="mt-5 border-t border-espresso/15 pt-5">
                    <p className="label-caps text-taupe">Что сделал мастер</p>
                    <p className="mt-2 text-sm leading-relaxed text-espresso/75">
                      {example.result}
                    </p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-xs leading-relaxed text-taupe">
            Изображения — визуализация замысла, а не фотография готового
            изделия. Ручное плетение может немного отличаться в деталях, всё
            важное мастер согласует с вами заранее.
          </p>
        </div>

        <div className="mt-14 lg:mt-20 grid gap-10 bg-sand p-6 lg:grid-cols-2 lg:gap-16 lg:p-10">
          <div>
            <h3 className="font-serif text-2xl text-espresso">
              Что прислать мастеру
            </h3>
            <ul className="mt-6 border-b border-espresso/15">
              {checklist.map((item) => (
                <li
                  key={item}
                  className="border-t border-espresso/15 py-4 text-sm leading-relaxed text-espresso"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-end gap-8">
            <p className="text-base leading-relaxed text-espresso/75 text-pretty max-w-md">
              Ваши данные нужны только для эскиза и не публикуются. Фото
              присылать не обязательно — описания достаточно.
            </p>
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
              <a
                href="#order"
                className="inline-flex items-center justify-center bg-espresso text-parchment px-8 py-4 label-caps-md hover:bg-espresso/90 transition-colors"
              >
                Заказать эскиз
              </a>
              <ContactMasterButton
                source="fitting_sketches"
                message="Здравствуйте, Ольга! У меня вопрос про эскиз и мерки."
                className="text-sm text-espresso underline underline-offset-4 hover:text-espresso/75 transition-colors"
              >
                Задать вопрос мастеру
              </ContactMasterButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
