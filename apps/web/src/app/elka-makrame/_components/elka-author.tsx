import Image from "next/image";

/** Ольга о себе и о плетении — от первого лица, перед частыми вопросами. */
export function ElkaAuthor() {
  return (
    <section aria-labelledby="author-title" className="bg-sage-pale">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24 grid gap-8 lg:grid-cols-2 lg:gap-16 lg:items-center">
        <div className="relative aspect-[4/3] lg:aspect-[4/5] rounded-[28px] overflow-hidden bg-linen">
          <Image
            src="https://cdn.stariva.ru/site/images/about/founder-2026-3840.webp"
            alt="Ольга, мастер Stariva, за плетением макраме"
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <p className="label-caps mb-3 text-[11px] text-terracotta">
            Кто поведёт вас за руку
          </p>
          <h2
            id="author-title"
            className="font-serif text-espresso leading-tight text-balance mb-6"
            style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
          >
            «Каждая вещь, сплетённая своими руками, хранит тепло и спокойствие
            мастера»
          </h2>
          <div className="grid gap-4 text-dark-grey leading-relaxed">
            <p>
              Привет! Меня зовут Ольга, с 2018 года я создаю авторские изделия в
              технике макраме для дома, души и семейных праздников.
            </p>
            <p>
              Для меня макраме — это больше, чем просто декор. С древних времён
              узелковое плетение считалось особым искусством: завязывая узел за
              узлом в спокойном ритме, мы укладываем мысли по полочкам,
              отпускаем тревоги и буквально вплетаем в нити добрые пожелания для
              своего дома.
            </p>
            <p>
              Я записала этот мастер-класс так, чтобы у вас точно получилось —
              даже если вы никогда раньше не держали шнур в руках. Мы вместе
              пройдём путь от первого квадратного узла до пушистой хвойной
              бахромы и деревянной звезды на макушке. Вы удивитесь, как из
              простых хлопковых нитей в ваших руках родится настоящая новогодняя
              сказка, которая не осыплется после праздников и будет радовать
              вашу семью много зим подряд.
            </p>
            <p>
              Если на каком-то этапе у вас возникнет вопрос — я рядом в чате
              участниц в Telegram и лично подскажу, как поправить любой узелок.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
