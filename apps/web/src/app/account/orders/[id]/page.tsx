import { notFound } from "next/navigation";
import { getAccountOrder } from "@/lib/account/orders";
import { getSession } from "@/lib/auth/session";
import { ProductOrderView, WorkshopOrderView } from "./order-view";

export const dynamic = "force-dynamic";

export default async function AccountOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const details = await getAccountOrder(session.user.id, id);
  if (!details) notFound();

  const paymentReturn = query.payment === "success";
  return details.kind === "product" ? (
    <ProductOrderView
      order={details.order}
      view={details.view}
      paymentReturn={paymentReturn}
    />
  ) : (
    <WorkshopOrderView view={details.view} paymentReturn={paymentReturn} />
  );
}
