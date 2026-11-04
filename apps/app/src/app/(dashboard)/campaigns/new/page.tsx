import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stariva/ui";
import Link from "next/link";
import {
  CampaignForm,
  EMPTY_CAMPAIGN,
} from "~/components/campaigns/campaign-form";
import { SiteHeader } from "~/components/layout";

/** Новая рассылка: сначала черновик, отправка — со страницы черновика. */
export default function NewCampaignPage() {
  return (
    <>
      <SiteHeader title="Новая рассылка" />
      <div className="px-4 pb-10 lg:px-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Новая рассылка</CardTitle>
            <CardDescription>
              <Link href="/campaigns" className="hover:underline">
                ← Все рассылки
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignForm initial={EMPTY_CAMPAIGN} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
