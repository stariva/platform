import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stariva/ui";
import {
  BusinessExpenses,
  FinanceRatesForm,
} from "~/components/crm/business-expenses";
import {
  type PeriodParams,
  PeriodPicker,
  resolvePeriod,
} from "~/components/crm/period";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

/** Расходы вне заказов и ставки, по которым считаются эквайринг и налог. */
export default async function CrmExpensesPage({
  searchParams,
}: {
  searchParams: Promise<PeriodParams>;
}) {
  const { today, preset, range } = resolvePeriod(await searchParams, "year");
  const [expenses, rates] = await Promise.all([
    api.admin.crm.businessExpenses(range),
    api.admin.crm.financeSettings(),
  ]);

  return (
    <>
      <SiteHeader title="Постоянные расходы" />
      <div className="flex flex-col gap-6 px-4 pb-10 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Постоянные расходы
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            То, что не относится к одному заказу: подписки, сервер, инструменты,
            фотосъёмка. Реклама сюда не входит, она ведётся в «Кампаниях и
            расходах». Закупку материалов тоже не вносите: материалы считаются в
            заказах, иначе они учтутся дважды.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4">
            <PeriodPicker
              basePath="/crm/expenses"
              preset={preset}
              range={range}
              today={today}
              fallback="year"
            />
            <BusinessExpenses
              expenses={expenses.items}
              total={expenses.total}
              range={range}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ставки</CardTitle>
              <CardDescription>
                По ним затраты заказов считаются сами. Новая ставка пересчитает
                и прошлые месяцы.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* key: после сохранения форма берёт свежие данные с сервера */}
              <FinanceRatesForm
                key={`${rates.acquiring}:${rates.tax}`}
                rates={rates}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
