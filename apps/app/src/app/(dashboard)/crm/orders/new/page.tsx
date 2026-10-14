import { ORPCError } from "@orpc/client";
import {
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stariva/ui";
import Link from "next/link";
import { z } from "zod";
import { formatDay, parseContact, rubles } from "~/components/crm/crm-meta";
import {
  type CustomOrderDraft,
  CustomOrderForm,
} from "~/components/crm/custom-order-form";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const requestSchema = z.coerce.number().int().positive();

const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

/** Что положить в «Что заказал»: тип изделия или первая строка описания. */
function orderTitle(productType: string | null, description: string | null) {
  const line = description
    ?.split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  return [productType, line].filter(Boolean).join(": ").slice(0, 300);
}

/**
 * Индивидуальный заказ: клиент, реклама, с которой он пришёл, сумма и что
 * заказал. Из заявки (?request=1042) имя, контакт и описание подставляются.
 */
export default async function NewCustomOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string | string[] }>;
}) {
  const params = await searchParams;
  const parsedRequest = requestSchema.safeParse(first(params.request));
  const requestNumber = parsedRequest.success ? parsedRequest.data : undefined;

  const [campaigns, request, existing] = await Promise.all([
    api.admin.crm.campaigns(),
    requestNumber
      ? api.admin.requests
          .byNumber({ number: requestNumber })
          .catch((error) => {
            if (error instanceof ORPCError && error.code === "NOT_FOUND") {
              return null;
            }
            throw error;
          })
      : null,
    requestNumber
      ? api.admin.crm.saleForRequest({ number: requestNumber })
      : null,
  ]);

  let draft: Partial<CustomOrderDraft> | undefined;
  if (request) {
    const contact = parseContact(request.contact);
    draft = {
      name: request.name ?? "",
      phone: contact.phone,
      email: contact.email,
      description: orderTitle(request.productType, request.description),
    };
  }

  return (
    <>
      <SiteHeader title="Индивидуальный заказ" />
      <div className="max-w-xl space-y-4 px-4 pb-10 lg:px-6">
        {existing ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Заказ по заявке №{requestNumber} уже записан
              </CardTitle>
              <CardDescription>
                {formatDay(existing.soldOn)} · {rubles.format(existing.amount)}
                {existing.campaignName && ` · ${existing.campaignName}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/crm/clients/${encodeURIComponent(existing.clientId)}`}
                className={buttonVariants()}
              >
                Открыть клиента
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {request
                  ? `Индивидуальный заказ по заявке №${request.number}`
                  : "Индивидуальный заказ"}
              </CardTitle>
              <CardDescription>
                Для заказов, оплаченных мимо корзины сайта: по заявке, из
                мессенджера, на Авито. Выберите рекламу, с которой пришёл
                клиент, — в сводке выручка заказа пойдёт ей.
                {request?.contact && (
                  <>
                    {" "}
                    Контакт из заявки: <b>{request.contact}</b> — если это не
                    телефон и не почта, запишите его в заметки клиента.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomOrderForm
                campaigns={campaigns}
                draft={draft}
                requestNumber={request?.number}
              />
            </CardContent>
          </Card>
        )}
        {requestNumber && !request && (
          <p className="text-muted-foreground text-sm">
            Заявка №{requestNumber} не найдена — заполните данные вручную.
          </p>
        )}
      </div>
    </>
  );
}
