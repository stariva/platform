import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { OrderStatus } from "./order-status";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return (
    <>
      <Header variant="solid" />
      <main className="pt-28 lg:pt-36 pb-24 px-5">
        <h1 className="font-serif text-3xl text-espresso mb-8 text-center">
          Ваш заказ
        </h1>
        <OrderStatus orderId={orderId} />
      </main>
      <Footer />
    </>
  );
}
