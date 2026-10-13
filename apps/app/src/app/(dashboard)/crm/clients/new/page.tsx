import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stariva/ui";
import { ClientForm } from "~/components/crm/client-form";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

export default async function NewCrmClientPage() {
  const campaigns = await api.admin.crm.campaigns();

  return (
    <>
      <SiteHeader title="Новый клиент" />
      <div className="max-w-xl px-4 pb-10 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Новый клиент</CardTitle>
            <CardDescription>
              Для тех, кто написал в мессенджер, нашёл на Авито или пришёл по
              посеву. Если клиент уже заказывал на сайте с тем же телефоном или
              почтой, карточка склеится с его заказами. Продажи добавите на
              странице клиента.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientForm
              hasSiteOrders={false}
              campaigns={campaigns}
              initial={{
                name: "",
                phone: "",
                email: "",
                source: "none",
                notes: "",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
