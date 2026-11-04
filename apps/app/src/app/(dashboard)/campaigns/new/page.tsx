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
  emptyCampaign,
} from "~/components/campaigns/campaign-form";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

/** Новая рассылка: сначала черновик, отправка — со страницы черновика. */
export default async function NewCampaignPage() {
  const templates = await api.admin.campaigns.templates();
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
            <CampaignForm
              initial={emptyCampaign(templates)}
              templates={templates}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
