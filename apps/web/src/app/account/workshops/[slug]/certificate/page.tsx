import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasAccess } from "@/lib/account/access";
import { issueCertificateIfComplete } from "@/lib/account/certificates";
import { getSession } from "@/lib/auth/session";
import { getWorkshopBySlug } from "@/lib/workshops-data";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) return null;

  const workshop = getWorkshopBySlug(slug);
  if (!workshop) notFound();

  if (!(await hasAccess(session.user.id, slug))) {
    redirect(`/workshops/${slug}`);
  }

  const certificate = await issueCertificateIfComplete(session.user.id, slug);

  // Курс ещё не пройден полностью
  if (!certificate) {
    return (
      <div className="bg-white border border-espresso/10 rounded-2xl p-10 text-center">
        <h2 className="font-serif text-2xl text-espresso mb-2">
          Сертификат пока недоступен
        </h2>
        <p className="text-taupe text-sm mb-6">
          Завершите все уроки мастер-класса, чтобы получить именной сертификат о
          прохождении.
        </p>
        <Link
          href={`/account/workshops/${slug}`}
          className="text-terracotta hover:underline text-sm"
        >
          Вернуться к курсу
        </Link>
      </div>
    );
  }

  const recipient = session.user.name || session.user.email;

  return (
    <div>
      <style>{`@media print {
        header, footer, .no-print { display: none !important; }
        body { background: #fff !important; }
        .certificate-sheet { box-shadow: none !important; border-color: #c9a36a !important; margin: 0 !important; }
      }`}</style>

      <div className="flex items-center justify-between mb-5 no-print">
        <Link
          href={`/account/workshops/${slug}`}
          className="text-sm text-taupe hover:text-espresso transition-colors"
        >
          ← К курсу
        </Link>
        <PrintButton />
      </div>

      <div className="certificate-sheet bg-[#fffdf7] border-4 border-[#c9a36a] rounded-sm p-10 sm:p-14 text-center shadow-[0_8px_40px_rgba(44,36,27,0.12)] max-w-2xl mx-auto">
        <p className="label-caps tracking-[0.3em] text-[12px] text-[#b85c38] mb-2">
          Stariva
        </p>
        <p className="label-caps tracking-[0.2em] text-[11px] text-taupe mb-8">
          Сертификат о прохождении
        </p>

        <p className="text-taupe text-sm mb-2">Настоящим подтверждается, что</p>
        <p className="font-serif text-3xl sm:text-4xl text-espresso mb-6">
          {recipient}
        </p>
        <p className="text-taupe text-sm mb-1">
          успешно прошёл(ла) мастер-класс
        </p>
        <p className="font-serif text-xl sm:text-2xl text-espresso mb-8">
          «{workshop.title}»
        </p>

        <div className="flex items-center justify-center gap-10 text-xs text-taupe mt-10 pt-6 border-t border-[#c9a36a]/40">
          <div>
            <p className="text-espresso">
              {dateFormatter.format(certificate.issuedAt)}
            </p>
            <p className="mt-0.5">Дата выдачи</p>
          </div>
          <div>
            <p className="text-espresso font-mono">{certificate.number}</p>
            <p className="mt-0.5">Номер сертификата</p>
          </div>
        </div>
      </div>
    </div>
  );
}
