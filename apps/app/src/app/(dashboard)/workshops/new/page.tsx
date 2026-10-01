import { SiteHeader } from "~/components/layout";
import {
  EMPTY_WORKSHOP,
  WorkshopForm,
} from "~/components/workshops/workshop-form";
import { baseEnv } from "~/env";

export default function NewWorkshopPage() {
  return (
    <>
      <SiteHeader title="Новый мастер-класс" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Новый мастер-класс
        </h1>
        <WorkshopForm
          initialValues={EMPTY_WORKSHOP}
          storefrontUrl={baseEnv.STOREFRONT_URL}
        />
      </div>
    </>
  );
}
