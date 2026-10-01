import { notFound } from "next/navigation";
import { SiteHeader } from "~/components/layout";
import { WorkshopForm } from "~/components/workshops/workshop-form";
import { baseEnv } from "~/env";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

export default async function EditWorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workshop = await api.admin.workshops.byId({ id }).catch((error) => {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  });

  return (
    <>
      <SiteHeader title={workshop.values.title} />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {workshop.values.title}
        </h1>
        {/* key: после сохранения форма берёт свежие данные с сервера */}
        <WorkshopForm
          key={workshop.updatedAt.toISOString()}
          id={workshop.id}
          initialValues={workshop.values}
          storefrontUrl={baseEnv.STOREFRONT_URL}
        />
      </div>
    </>
  );
}
