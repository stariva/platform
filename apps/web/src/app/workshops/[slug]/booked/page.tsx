import { CalendarPlus, Check, Gift, Mail, Send } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { getSession } from "@/lib/auth/session";
import { getOrderById } from "@/lib/payments/orders";
import { clientBotStartUrl } from "@/lib/telegram/client-bot";
import { workshopCalendarLinks } from "@/lib/workshops/notifications";
import {
  cookieMatchesOrder,
  WORKSHOP_ORDER_COOKIE,
} from "@/lib/workshops/order-cookie";
import { syncPendingWorkshopOrder } from "@/lib/workshops/order-payment";
import { earnsPreorderBonus } from "@/lib/workshops/preorder-bonus";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import {
  formatReleaseDateTime,
  isPreorder,
  type Workshop,
} from "@/lib/workshops-data";
import { PaidGoal, PaymentPolling } from "./booked-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ваша запись на мастер-класс",
  robots: { index: false, follow: false },
};

/** olga.ivanova@mail.ru → o***a@mail.ru */
function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible =
    local.length <= 2
      ? `${local[0] ?? ""}***`
      : `${local[0]}***${local.at(-1)}`;
  return `${visible}@${domain}`;
}

async function loadOrder(slug: string, orderId: string | undefined) {
  if (!orderId) return null;
  const order = await getOrderById(orderId);
  if (!order || order.workshopSlug !== slug) return null;

  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  const isOwner = session?.user.id === order.userId;
  const sameBrowser = cookieMatchesOrder(
    cookieStore.get(WORKSHOP_ORDER_COOKIE)?.value,
    order,
  );
  if (!isOwner && !sameBrowser) return null;

  if (order.status === "pending") {
    await syncPendingWorkshopOrder(order);
    const fresh = await getOrderById(orderId);
    if (fresh) return { order: fresh, isOwner };
  }
  return { order, isOwner };
}

export default async function WorkshopBookedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const [{ slug }, { order: orderId }] = await Promise.all([
    params,
    searchParams,
  ]);
  const [found, workshop] = await Promise.all([
    loadOrder(slug, orderId),
    getWorkshopBySlug(slug, "owned"),
  ]);

  return (
    <>
      <Header variant="solid" />
      <main className="min-h-[70vh] bg-parchment px-5 pt-28 pb-24 lg:pt-36">
        <div className="mx-auto max-w-xl">
          {!found || !workshop ? (
            <Unknown slug={slug} />
          ) : found.order.status === "paid" ? (
            <Paid
              workshop={workshop}
              order={found.order}
              isOwner={found.isOwner}
            />
          ) : found.order.status === "pending" ? (
            <Pending />
          ) : (
            <Failed slug={slug} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white p-6 lg:p-8">{children}</section>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h1
      className="font-serif text-espresso leading-tight text-balance mb-3"
      style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
    >
      {children}
    </h1>
  );
}

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-5 py-4 text-base text-parchment transition-colors hover:bg-terracotta-dark";
const secondaryButton =
  "flex w-full items-center justify-center gap-2 rounded-2xl border border-espresso/15 bg-white px-5 py-3.5 text-espresso transition-colors hover:bg-sand/60";

/**
 * Показывает подтверждение оплаты, способы входа в кабинет и подготовки к
 * старту; подарок отображается, если заказ оформлен до выхода основного курса.
 */
function Paid({
  workshop,
  order,
  isOwner,
}: {
  workshop: Workshop;
  order: NonNullable<Awaited<ReturnType<typeof getOrderById>>>;
  isOwner: boolean;
}) {
  const preorder = isPreorder(workshop) && workshop.releaseAt;
  const calendar = preorder
    ? workshopCalendarLinks({
        slug: workshop.slug,
        title: workshop.title,
        releaseAt: new Date(preorder),
      })
    : null;
  const telegramUrl =
    preorder && !order.telegramChatId && order.telegramToken
      ? clientBotStartUrl(order.telegramToken)
      : undefined;
  const email = order.contactEmail;
  const bonus = earnsPreorderBonus({
    workshopSlug: workshop.slug,
    orderedAt: order.createdAt,
    releaseAt: workshop.releaseAt ? new Date(workshop.releaseAt) : null,
  });

  return (
    <div className="flex flex-col gap-5">
      <PaidGoal
        orderId={order.id}
        slug={workshop.slug}
        price={order.amount / 100}
      />
      <div>
        <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-sage/20 px-4 py-2 text-sm text-espresso">
          <Check className="size-4 text-sage" aria-hidden />
          Оплата прошла
        </p>
        <Heading>{preorder ? "Вы записаны!" : "Доступ открыт!"}</Heading>
        <p className="text-dark-grey leading-relaxed">
          Вы оплатили мастер-класс «{workshop.title}».{" "}
          {preorder
            ? `Уроки откроются ${formatReleaseDateTime(preorder)}. Мы напомним о старте за неделю, за день и в сам день.`
            : "Смотрите уроки когда удобно — доступ бессрочный."}
        </p>
      </div>

      <Card>
        <div className="flex gap-4">
          <Mail
            className="mt-0.5 size-5 shrink-0 text-terracotta"
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className="mb-1 font-serif text-xl text-espresso">
              Ссылка на уроки — у вас в почте
            </h2>
            <p className="text-sm leading-relaxed text-dark-grey">
              {email ? (
                <>
                  Мы отправили письмо на{" "}
                  <span className="text-espresso">{maskEmail(email)}</span>.
                </>
              ) : (
                "Мы отправили письмо на ваш email."
              )}{" "}
              По кнопке из письма вы войдёте в личный кабинет без пароля. Если
              письма нет, проверьте папки «Спам» и «Промоакции».
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {isOwner ? (
            <Link
              href={`/account/workshops/${workshop.slug}`}
              className={primaryButton}
            >
              {preorder ? "Открыть кабинет" : "Смотреть уроки"}
            </Link>
          ) : (
            <Link
              href={`/magic-link?callbackURL=${encodeURIComponent(`/account/workshops/${workshop.slug}`)}`}
              className={secondaryButton}
            >
              Письмо не пришло? Получить новую ссылку
            </Link>
          )}
        </div>
      </Card>

      {calendar ? (
        <Card>
          <div className="flex gap-4">
            <CalendarPlus
              className="mt-0.5 size-5 shrink-0 text-terracotta"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h2 className="mb-1 font-serif text-xl text-espresso">
                Добавьте дату старта в календарь
              </h2>
              <p className="mb-4 text-sm text-dark-grey">
                Телефон сам напомнит за день и за час до начала.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <a href={calendar.icsUrl} className={secondaryButton}>
                  iPhone, Android, Outlook
                </a>
                <a
                  href={calendar.googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={secondaryButton}
                >
                  Google Календарь
                </a>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {telegramUrl ? (
        <Card>
          <div className="flex gap-4">
            <Send
              className="mt-0.5 size-5 shrink-0 text-terracotta"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h2 className="mb-1 font-serif text-xl text-espresso">
                Напоминания в Telegram
              </h2>
              <p className="mb-4 text-sm text-dark-grey">
                Если вам удобнее Telegram, подключите напоминания и там. Письма
                на почту придут в любом случае.
              </p>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={secondaryButton}
              >
                Получать напоминания в Telegram
              </a>
            </div>
          </div>
        </Card>
      ) : null}

      {bonus ? (
        <Card>
          <div className="flex gap-4">
            <Gift
              className="mt-0.5 size-5 shrink-0 text-terracotta"
              aria-hidden
            />
            <div className="min-w-0">
              <h2 className="mb-1 font-serif text-xl text-espresso">
                Подарок за предзаказ
              </h2>
              <p className="text-sm leading-relaxed text-dark-grey">
                Вам бесплатно достаётся {bonus.title}. Он появится в вашем
                кабинете {bonus.releaseLabel} — доплачивать ничего не нужно.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {preorder && workshop.materials.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-serif text-xl text-espresso">
            Что подготовить к старту
          </h2>
          <ul className="flex flex-col gap-2">
            {workshop.materials.map((item) => (
              <li key={item} className="flex items-start gap-2 text-espresso">
                <Check className="mt-1 size-4 shrink-0 text-sage" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Pending() {
  return (
    <Card>
      <div role="status" className="flex flex-col gap-3">
        <Heading>Подтверждаем оплату…</Heading>
        <p className="text-dark-grey leading-relaxed">
          Обычно это занимает несколько секунд. Страница обновится сама.
        </p>
        <PaymentPolling />
      </div>
    </Card>
  );
}

function Failed({ slug }: { slug: string }) {
  return (
    <Card>
      <Heading>Оплата не прошла</Heading>
      <p className="mb-6 text-dark-grey leading-relaxed">
        Деньги не списаны. Попробуйте ещё раз — можно выбрать другую карту или
        оплатить через СБП.
      </p>
      <Link href={`/workshops/${slug}`} className={primaryButton}>
        Попробовать ещё раз
      </Link>
    </Card>
  );
}

function Unknown({ slug }: { slug: string }) {
  return (
    <Card>
      <Heading>Спасибо!</Heading>
      <p className="mb-6 text-dark-grey leading-relaxed">
        Если оплата прошла, в течение пары минут на ваш email придёт письмо со
        ссылкой на уроки. Ссылку для входа можно запросить и сейчас.
      </p>
      <div className="flex flex-col gap-3">
        <Link
          href={`/magic-link?callbackURL=${encodeURIComponent(`/account/workshops/${slug}`)}`}
          className={primaryButton}
        >
          Запросить ссылку для входа
        </Link>
        <Link href={`/workshops/${slug}`} className={secondaryButton}>
          К мастер-классу
        </Link>
      </div>
    </Card>
  );
}
