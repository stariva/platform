import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";

export const metadata = {
  title: "Договор оферты — Stariva",
  description:
    "Публичная оферта интернет-магазина Stariva. Условия продажи изделий ручного макраме.",
};

export default function OfferPage() {
  return (
    <div className="bg-parchment text-espresso">
      <Header variant="solid" />

      <main className="max-w-[860px] mx-auto px-6 lg:px-14 pt-32 pb-28 lg:pt-40 lg:pb-40">
        <p className="label-caps text-terracotta tracking-widest mb-5">
          Правовые документы
        </p>
        <h1 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05] mb-12">
          Договор публичной оферты
        </h1>

        <div className="space-y-10 text-espresso/80 text-[15px] leading-[1.85]">
          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              1. Общие положения
            </h2>
            <p>
              Настоящий документ является публичной офертой самозанятого
              Капычевой О. А. (ИНН: 502480197143, далее — «Продавец») и содержит
              все существенные условия договора розничной купли-продажи товаров,
              представленных на сайте <strong>stariva.ru</strong>.
            </p>
            <p className="mt-4">
              В соответствии со статьёй 437 Гражданского кодекса Российской
              Федерации данный документ является публичной офертой. Полным и
              безоговорочным акцептом оферты считается оформление заказа на
              Сайте.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              2. Предмет договора
            </h2>
            <p>
              Продавец обязуется передать в собственность Покупателя товары
              (изделия ручного макраме из натурального хлопка), а Покупатель
              обязуется принять и оплатить их на условиях настоящего договора.
            </p>
            <p className="mt-4">
              Ассортимент, количество и цена товаров определяются на основании
              заказа Покупателя, оформленного на Сайте или через мессенджеры.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              3. Цена и порядок оплаты
            </h2>
            <p>
              Цены на товары указаны в рублях Российской Федерации и включают
              НДС (при наличии). Продавец вправе изменять цены в одностороннем
              порядке; изменение не распространяется на уже оплаченные заказы.
            </p>
            <p className="mt-4">Оплата производится следующими способами:</p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Банковской картой онлайн через защищённый платёжный шлюз",
                "Переводом на расчётный счёт Продавца",
                "Наличными при самовывозе из ателье (по предварительной договорённости)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-terracotta flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              4. Доставка
            </h2>
            <p>
              Доставка осуществляется по всей территории Российской Федерации.
              Сроки и стоимость доставки зависят от выбранного способа и региона
              назначения и указываются при оформлении заказа.
            </p>
            <p className="mt-4">
              Право собственности и риск случайной гибели товара переходят к
              Покупателю с момента передачи товара курьеру или в пункт выдачи.
            </p>
            <p className="mt-4">
              Продавец не несёт ответственности за задержки, вызванные
              действиями служб доставки или обстоятельствами непреодолимой силы.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              5. Возврат и обмен
            </h2>
            <p>
              Поскольку все изделия Stariva являются товарами ручной работы,
              изготовленными по индивидуальным параметрам, они относятся к
              категории товаров, не подлежащих возврату и обмену надлежащего
              качества в соответствии с Постановлением Правительства РФ № 2463
              от 31.12.2020.
            </p>
            <p className="mt-4">
              В случае получения товара ненадлежащего качества Покупатель вправе
              в течение <strong>14 дней</strong> с момента получения обратиться
              к Продавцу с требованием о замене, устранении недостатков или
              возврате денежных средств. Для этого необходимо направить
              фотографии дефекта и описание проблемы на{" "}
              <a
                href="mailto:info@stariva.ru"
                className="text-terracotta hover:underline"
              >
                info@stariva.ru
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              6. Права и обязанности сторон
            </h2>
            <h3 className="font-serif text-lg text-espresso mb-3 mt-6">
              Продавец обязуется:
            </h3>
            <ul className="space-y-2 list-none pl-0">
              {[
                "Передать товар надлежащего качества в согласованные сроки",
                "Предоставить достоверную информацию о товаре",
                "Обеспечить сохранность персональных данных Покупателя",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-terracotta flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <h3 className="font-serif text-lg text-espresso mb-3 mt-6">
              Покупатель обязуется:
            </h3>
            <ul className="space-y-2 list-none pl-0">
              {[
                "Оплатить товар в полном объёме",
                "Предоставить корректные данные для доставки",
                "Принять товар в установленные сроки",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-terracotta flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              7. Ответственность сторон
            </h2>
            <p>
              Стороны несут ответственность за неисполнение или ненадлежащее
              исполнение своих обязательств в соответствии с законодательством
              Российской Федерации. Продавец не несёт ответственности за ущерб,
              возникший вследствие неправильного использования товара
              Покупателем.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              8. Форс-мажор
            </h2>
            <p>
              Стороны освобождаются от ответственности за частичное или полное
              неисполнение обязательств, если оно явилось следствием
              обстоятельств непреодолимой силы (стихийные бедствия, военные
              действия, решения органов государственной власти и иные
              обстоятельства, не зависящие от воли сторон).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              9. Разрешение споров
            </h2>
            <p>
              Все споры и разногласия, возникающие из настоящего договора,
              стороны стремятся урегулировать путём переговоров. При
              недостижении согласия спор передаётся на рассмотрение в суд по
              месту нахождения Продавца в соответствии с законодательством
              Российской Федерации.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              10. Реквизиты Продавца
            </h2>
            <div className="space-y-1">
              <p>СЗ Карпычева О. А.</p>
              <p>ИНН: 502480197143</p>
              <p>
                Email:{" "}
                <a
                  href="mailto:info@stariva.ru"
                  className="text-terracotta hover:underline"
                >
                  info@stariva.ru
                </a>
              </p>
              <p>
                Телефон:{" "}
                <a
                  href="tel:+79778722546"
                  className="text-terracotta hover:underline"
                >
                  +7 977 872 25 46
                </a>
              </p>
            </div>
          </section>

          <p className="pt-6 border-t border-espresso/10 text-espresso/50 text-[13px]">
            Дата последнего обновления: 15 мая 2026 г.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
