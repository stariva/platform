import { formatMoscowDateTime } from "@stariva/validators";
import { SiteHeader } from "~/components/layout";
import { PromoCodesManager } from "~/components/promo-codes/promo-codes-manager";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

/** Промокоды новогоднего набора: скидка на изделия при мгновенной оплате. */
export default async function PromoCodesPage() {
  const items = await api.admin.promoCodes.list();

  return (
    <>
      <SiteHeader title="Промокоды" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Промокоды</h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Промокоды действуют на новогодний набор с мгновенной оплатой. Скидка
            уменьшает только стоимость изделий и никогда не покрывает её
            полностью; доставка оплачивается как обычно. Использование
            резервируется при создании заказа.
          </p>
        </div>
        <PromoCodesManager
          rows={items.map((row) => ({
            ...row,
            startsAt: row.startsAt ? formatMoscowDateTime(row.startsAt) : "",
            endsAt: row.endsAt ? formatMoscowDateTime(row.endsAt) : "",
            createdAt: row.createdAt.toISOString(),
          }))}
        />
      </div>
    </>
  );
}
