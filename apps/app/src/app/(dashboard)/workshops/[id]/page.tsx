import { notFound } from "next/navigation";
import { SiteHeader } from "~/components/layout";
import { WorkshopForm } from "~/components/workshops/workshop-form";
import { baseEnv } from "~/env";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

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
  const lastVideoUpload = Object.values(workshop.videoUploadedAt).reduce<
    Date | undefined
  >((latest, date) => (latest && latest > date ? latest : date), undefined);

  return (
    <>
      <SiteHeader title={workshop.values.title} />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {workshop.values.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {lastVideoUpload
              ? `Последняя загрузка видео: ${dateFormat.format(lastVideoUpload)}`
              : "Видео ещё не загружали"}
          </p>
        </div>
        {/* key: после сохранения форма берёт свежие данные с сервера */}
        <WorkshopForm
          key={workshop.updatedAt.toISOString()}
          id={workshop.id}
          initialValues={workshop.values}
          videoUploadedAt={workshop.videoUploadedAt}
          storefrontUrl={baseEnv.STOREFRONT_URL}
        />
      </div>
    </>
  );
}
