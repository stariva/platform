import {
  BoxberryIcon,
  CardIcon,
  CdekIcon,
  MirIcon,
  PochtaIcon,
  SbpIcon,
  TruckIcon,
} from "./icons";

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
              По всей России
            </h3>
            <p className="text-espresso/75 leading-[1.7] mb-6 text-pretty">
              От 3 дней. От <span className="tabular-nums">350 ₽</span>.
              Упаковка в крафт и лён — в подарок к каждому заказу.
            </p>
            <div className="flex items-center flex-wrap gap-3 text-espresso/70">
              <CdekIcon className="h-7 w-auto" />
              <BoxberryIcon className="h-7 w-auto" />
              <PochtaIcon className="h-7 w-auto" />
            </div>
          </div>

          {/* Оплата */}
          <div className="md:border-l md:border-espresso/10 md:px-12">
            <div className="flex items-center gap-3 mb-6">
              <CardIcon className="w-6 h-6 text-terracotta" />
              <span className="label-caps-md text-taupe">Оплата</span>
            </div>
            <h3 className="font-serif text-2xl lg:text-3xl text-espresso leading-tight mb-3">
              Удобно и безопасно
            </h3>
            <p className="text-espresso/75 leading-[1.7] mb-6 text-pretty">
              Банковской картой, через СБП по QR-коду или наложенным платежом
              при получении — как вам удобнее.
            </p>
            <div className="flex items-center flex-wrap gap-3 text-espresso/70">
              <MirIcon className="h-6 w-auto" />
              <SbpIcon className="h-6 w-auto" />
              <CardIcon className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
