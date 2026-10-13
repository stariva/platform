import { CardIcon, OzonIcon, TruckIcon } from "./icons";

/**
 * Как на самом деле работает оформление заказа: доставка только в пункты
 * выдачи Ozon, оплата только онлайн через ЮKassa. Способы оплаты не
 * перечисляем — их показывает страница ЮKassa.
 */
export function PaymentDelivery() {
  return (
    <section
      id="delivery"
      className="py-20 lg:py-28 bg-parchment border-y border-espresso/10"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
          {/* Доставка */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <TruckIcon className="w-6 h-6 text-terracotta" />
              <span className="label-caps-md text-taupe">Доставка</span>
            </div>
            <h3 className="font-serif text-2xl lg:text-3xl text-espresso leading-tight mb-3">
              В пункты выдачи Ozon по всей России
            </h3>
            <p className="text-espresso/75 leading-[1.7] mb-6 text-pretty">
              Выберите пункт на карте при оформлении — стоимость и срок доставки
              покажем сразу, ещё до оплаты. Упаковка в крафт и лён — в подарок к
              каждому заказу.
            </p>
            <div className="flex items-center gap-2 text-espresso/70">
              <OzonIcon className="h-6 w-6" />
              <span className="text-sm">Ozon</span>
            </div>
          </div>

          {/* Оплата */}
          <div className="md:border-l md:border-espresso/10 md:px-12">
            <div className="flex items-center gap-3 mb-6">
              <CardIcon className="w-6 h-6 text-terracotta" />
              <span className="label-caps-md text-taupe">Оплата</span>
            </div>
            <h3 className="font-serif text-2xl lg:text-3xl text-espresso leading-tight mb-3">
              Онлайн через ЮKassa
            </h3>
            <p className="text-espresso/75 leading-[1.7] mb-6 text-pretty">
              Оплата на защищённой странице ЮKassa сразу после оформления.
              Наложенным платежом при получении оплатить нельзя — заказ
              отправляется после оплаты.
            </p>
            <div className="flex items-center gap-2 text-espresso/70">
              <CardIcon className="h-6 w-6" />
              <span className="text-sm">ЮKassa</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
