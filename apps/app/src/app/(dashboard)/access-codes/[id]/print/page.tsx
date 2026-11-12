import { CODE_PAGE_TEXT, codeRedeemUrl } from "@stariva/api/code-page-text";
import { buttonVariants } from "@stariva/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import encodeQR from "qr";
import { SiteHeader } from "~/components/layout";
import { AccessTicket } from "~/components/workshops/access-ticket";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

/**
 * QR одним контуром: у отдельных квадратов при печати между рядами бывают
 * щели. Сохраняем тихую зону шириной в четыре модуля вокруг кода.
 */
function qrOutline(url: string) {
  const modules = encodeQR(url, "raw", { ecc: "medium", border: 4 });
  let path = "";
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      path += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return { path, size: modules.length };
}

/**
 * Купон с кодом доступа к мастер-классу — на чековый термопринтер, в коробку
 * с набором. QR ведёт на stariva.ru/code с уже подставленным кодом.
 */
export default async function AccessCodePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const code = await api.admin.workshops.accessCode({ id }).catch((error) => {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  });
  const qr = qrOutline(codeRedeemUrl(code.code));

  return (
    <>
      <SiteHeader title={`Купон с кодом ${code.code}`} />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Купон в коробку с набором
          </h1>
          <p className="text-muted-foreground text-sm">
            Покупатель наводит камеру на QR-код — код уже подставлен, остаётся
            указать почту. Без камеры — адрес и код набираются руками. В окне
            печати выберите термопринтер, поля — «Нет», масштаб — 100%.
          </p>
          {code.redeemedAt && (
            <p className="text-destructive text-sm">
              Этот код уже активирован — второй раз он не сработает. Для нового
              покупателя выдайте новый код.
            </p>
          )}
          <Link
            href="/access-codes"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Ко всем кодам
          </Link>
        </div>

        <AccessTicket
          ticket={{
            code: code.code,
            workshopTitle: code.workshopTitle ?? code.workshopSlug,
            address: CODE_PAGE_TEXT.address,
            qrPath: qr.path,
            qrSize: qr.size,
            note: code.note,
          }}
        />
      </div>
    </>
  );
}
