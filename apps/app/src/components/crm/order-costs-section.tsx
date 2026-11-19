import { Card, CardDescription, CardHeader, CardTitle } from "@stariva/ui";
import { api } from "~/orpc/server";
import { OrderCosts } from "./order-costs";

/**
 * Блок затрат на странице заказа. Сбой при их загрузке не должен закрывать
 * заказ: форма и управление этапом остаются доступными.
 */
export async function OrderCostsSection({
  kind,
  orderId,
}: {
  kind: "product" | "manual";
  orderId: string;
}) {
  const economics = await api.admin.crm
    .orderCosts({ kind, id: orderId })
    .catch((error: unknown) => {
      console.error(error);
      return null;
    });

  if (!economics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Затраты и прибыль</CardTitle>
          <CardDescription>
            Не удалось загрузить затраты. Обновите страницу.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <OrderCosts kind={kind} orderId={orderId} economics={economics} />;
}
