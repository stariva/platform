import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";

export const metadata = {
  title: "Согласие на обработку персональных данных — Stariva",
  description:
    "Согласие на обработку персональных данных пользователей сайта Stariva в соответствии с ФЗ-152.",
};

export default function PersonalDataConsentPage() {
  return (
    <div className="bg-parchment text-espresso">
      <Header variant="solid" />

      <main className="max-w-[860px] mx-auto px-6 lg:px-14 pt-32 pb-28 lg:pt-40 lg:pb-40">
        <p className="label-caps text-terracotta tracking-widest mb-5">
          Правовые документы
        </p>
        <h1 className="font-serif text-[clamp(2.2rem,4.5vw,4rem)] text-espresso leading-[1.05] mb-12">
          Согласие на обработку персональных данных
        </h1>

        <div className="space-y-10 text-espresso/80 text-[15px] leading-[1.85]">
          <section className="p-8 bg-sand rounded-2xl border border-espresso/8">
            <p>
              Настоящее согласие предоставляется в соответствии с требованиями
              Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных»
              и адресовано самозанятому <strong>Капычевой О. А.</strong> (ИНН:
              502480197143, далее — «Оператор»), являющемуся владельцем сайта{" "}
              <strong>stariva.ru</strong>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              1. Субъект персональных данных
            </h2>
            <p>
              Настоящее согласие предоставляется физическим лицом (далее —
              «Субъект»), использующим Сайт и/или оформляющим заказ на
              приобретение товаров Stariva.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              2. Перечень персональных данных
            </h2>
            <p>
              Субъект даёт согласие на обработку следующих персональных данных:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Фамилия, имя, отчество",
                "Адрес электронной почты",
                "Номер телефона",
                "Почтовый адрес (для доставки)",
                "Данные об оформленных заказах",
                "Технические данные: IP-адрес, тип браузера, данные cookie",
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
              3. Цели обработки
            </h2>
            <p>Персональные данные обрабатываются в следующих целях:</p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Идентификация Субъекта при оформлении заказа",
                "Исполнение договора купли-продажи, организация доставки",
                "Информирование о статусе заказа",
                "Направление рекламных и информационных сообщений (при наличии отдельного согласия)",
                "Улучшение качества обслуживания и работы Сайта",
                "Соблюдение требований законодательства Российской Федерации",
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
              4. Способы обработки
            </h2>
            <p>
              Обработка персональных данных осуществляется следующими способами:
              сбор, запись, систематизация, накопление, хранение, уточнение
              (обновление, изменение), извлечение, использование, передача
              (предоставление, доступ), обезличивание, блокирование, удаление,
              уничтожение.
            </p>
            <p className="mt-4">
              Обработка осуществляется как с использованием средств
              автоматизации, так и без таковых.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              5. Передача данных третьим лицам
            </h2>
            <p>
              Субъект соглашается на передачу персональных данных третьим лицам
              исключительно в целях исполнения договора:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Службам доставки (СДЭК, Почта России, Яндекс.Доставка и др.) — для организации доставки заказа",
                "Платёжным системам — для проведения оплаты",
                "Сервисам веб-аналитики (Яндекс.Метрика) — в обезличенном виде для анализа посещаемости",
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
              6. Срок действия согласия
            </h2>
            <p>
              Настоящее согласие действует с момента его предоставления
              (оформления заказа или регистрации на Сайте) и до момента его
              отзыва Субъектом либо до достижения целей обработки.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              7. Право на отзыв согласия
            </h2>
            <p>
              Субъект вправе в любой момент отозвать настоящее согласие,
              направив письменное заявление Оператору по адресу электронной
              почты{" "}
              <a
                href="mailto:info@stariva.ru"
                className="text-terracotta hover:underline"
              >
                info@stariva.ru
              </a>{" "}
              или по телефону{" "}
              <a
                href="tel:+79778722546"
                className="text-terracotta hover:underline"
              >
                +7 977 872 25 46
              </a>
              .
            </p>
            <p className="mt-4">
              Отзыв согласия не влечёт прекращения обработки данных, если она
              необходима для исполнения уже заключённого договора или
              предусмотрена законодательством.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              8. Права Субъекта
            </h2>
            <p>В соответствии с ФЗ-152 Субъект имеет право:</p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Получать информацию об обработке своих персональных данных",
                "Требовать уточнения, блокирования или уничтожения данных в случае их неполноты, устаревания или незаконной обработки",
                "Обжаловать действия Оператора в уполномоченном органе по защите прав субъектов персональных данных (Роскомнадзор)",
                "Защищать свои права и законные интересы в судебном порядке",
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
              9. Контакты Оператора
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
