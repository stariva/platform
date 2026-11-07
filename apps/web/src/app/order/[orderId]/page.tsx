import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { OrderStatus } from "./order-status";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);

  return (
    <>
      <Header variant="solid" />
      <main className="pt-28 lg:pt-36 pb-24 px-5">
        <OrderStatus
          orderId={orderId}
          paymentReturn={query.payment === "success"}
        />
      </main>
      <Footer />
    </>
  );
}
