import { rubles } from "~/components/crm/crm-meta";
import {
  type PeriodParams,
  PeriodPicker,
  resolvePeriod,
} from "~/components/crm/period";
import { Stat } from "~/components/crm/stat";
import { SiteHeader } from "~/components/layout";
import { PurchaseMap } from "~/components/purchase-map/purchase-map";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const BASE = "/purchase-map";

/**
 * Карта покупок: города России, откуда оплачены заказы с сайта. По умолчанию
 * за всё время — карта нужна, чтобы увидеть, куда доходит продукция, а не
 * как прошёл месяц.
 */
export default async function PurchaseMapPage({
  searchParams,
}: {
  searchParams: Promise<PeriodParams>;
}) {
  const { today, preset, range } = resolvePeriod(await searchParams, "all");
  const { places, unplaced, orders, workshops, revenue } =
    await api.admin.purchaseMap.list(range);

  const cities = places.length;
  const customers = places.reduce((sum, place) => sum + place.customers, 0);

  return (
    <>
      <SiteHeader title="Карта покупок" />
      <div className="space-y-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Карта покупок
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Города, где купили у нас: оплаченные заказы товаров и записи на
            мастер-классы, без отменённых и возвращённых. Продажи, внесённые в
            CRM вручную, сюда не входят — у них нет города.
          </p>
        </div>

        <PeriodPicker
          basePath={BASE}
          preset={preset}
          range={range}
          today={today}
          fallback="all"
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Городов" value={cities} />
          <Stat
            label="Покупок"
            value={orders}
            hint={[
              `Записей на мастер-классы: ${workshops}`,
              unplaced > 0 &&
                `у ${unplaced} город неизвестен — на карте их нет`,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          <Stat
            label="Покупателей"
            value={customers}
            hint="Сумма по городам: тот, кто купил в двух городах, посчитан дважды"
          />
          <Stat label="Сумма покупок" value={rubles.format(revenue)} />
        </div>

        <PurchaseMap places={places} />
      </div>
    </>
  );
}
