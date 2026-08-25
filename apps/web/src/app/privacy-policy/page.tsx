import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";

export const metadata = {
  title: "Политика конфиденциальности — Stariva",
  description:
    "Политика конфиденциальности интернет-магазина Stariva. Как я собираю, использую и защищаю ваши персональные данные.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-parchment text-espresso">
      <Header variant="solid" />

      <main className="max-w-[860px] mx-auto px-6 lg:px-14 pt-32 pb-28 lg:pt-40 lg:pb-40">
        <p className="label-caps text-terracotta tracking-widest mb-5">
          Правовые документы
        </p>
        <h1 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] text-espresso leading-[1.05] mb-12">
          Политика конфиденциальности
        </h1>

        <div className="prose-stariva space-y-10 text-espresso/80 text-[15px] leading-[1.85]">
          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              1. Общие положения
            </h2>
            <p>
              Настоящая Политика конфиденциальности (далее — «Политика»)
              определяет порядок обработки и защиты персональных данных
              пользователей сайта <strong>stariva.ru</strong> (далее — «Сайт»),
              принадлежащего самозанятому Капычевой О. А. (ИНН: 502480197143,
              далее — «Оператор»).
            </p>
            <p className="mt-4">
              Используя Сайт, вы соглашаетесь с условиями настоящей Политики.
              Если вы не согласны с её условиями, пожалуйста, прекратите
              использование Сайта.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              2. Какие данные я собираю
            </h2>
            <p>
              Оператор может собирать следующие категории персональных данных:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Имя и фамилия",
                "Адрес электронной почты",
                "Номер телефона",
                "Почтовый адрес доставки",
                "Данные об оплате (обрабатываются платёжными системами, Оператор не хранит реквизиты карт)",
                "IP-адрес и данные браузера (в целях аналитики)",
                "История заказов и переписки с поддержкой",
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
              3. Цели обработки данных
            </h2>
            <p>Персональные данные обрабатываются в следующих целях:</p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Оформление и исполнение заказов, доставка товаров",
                "Связь с покупателем по вопросам заказа",
                "Направление информационных и рекламных сообщений (при наличии согласия)",
                "Улучшение работы Сайта и качества обслуживания",
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
              4. Правовые основания обработки
            </h2>
            <p>
              Обработка персональных данных осуществляется на основании
              Федерального закона от 27.07.2006 № 152-ФЗ «О персональных
              данных», а также на основании согласия субъекта персональных
              данных, исполнения договора и законных интересов Оператора.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              5. Передача данных третьим лицам
            </h2>
            <p>
              Оператор не продаёт и не передаёт персональные данные третьим
              лицам без согласия пользователя, за исключением случаев,
              предусмотренных законодательством, а также передачи данных:
            </p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Службам доставки — для исполнения заказа",
                "Платёжным системам — для проведения оплаты",
                "Сервисам аналитики (Яндекс.Метрика) — в обезличенном виде",
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
              6. Хранение и защита данных
            </h2>
            <p>
              Оператор принимает необходимые организационные и технические меры
              для защиты персональных данных от несанкционированного доступа,
              изменения, раскрытия или уничтожения. Данные хранятся не дольше,
              чем это необходимо для достижения целей обработки, либо в течение
              срока, установленного законодательством.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              7. Права пользователя
            </h2>
            <p>Вы вправе:</p>
            <ul className="mt-4 space-y-2 list-none pl-0">
              {[
                "Получить информацию об обработке ваших персональных данных",
                "Потребовать уточнения, блокирования или уничтожения данных",
                "Отозвать согласие на обработку данных",
                "Обратиться с жалобой в Роскомнадзор",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-terracotta flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4">
              Для реализации своих прав обратитесь ко мне по адресу:{" "}
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
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              8. Cookies
            </h2>
            <p>
              Сайт использует файлы cookie для обеспечения корректной работы и
              сбора аналитических данных. Вы можете отключить cookie в
              настройках браузера, однако это может повлиять на функциональность
              Сайта.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              9. Изменения Политики
            </h2>
            <p>
              Оператор оставляет за собой право вносить изменения в настоящую
              Политику. Актуальная версия всегда доступна на данной странице.
              Продолжение использования Сайта после внесения изменений означает
              ваше согласие с обновлённой Политикой.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-espresso mb-4">
              10. Контакты
            </h2>
            <p>
              По вопросам, связанным с обработкой персональных данных,
              обращайтесь:
            </p>
            <div className="mt-4 space-y-1">
              <p>СЗ Карпычева О. А., ИНН: 502480197143</p>
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
