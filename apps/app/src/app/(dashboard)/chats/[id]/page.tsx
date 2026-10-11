import { Badge, Card, CardContent } from "@stariva/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "~/components/layout";
import { baseEnv } from "~/env";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const timeFormat = new Intl.DateTimeFormat("ru-RU", { timeStyle: "short" });

/** Ссылки инструментов бывают относительными — ведут на витрину. */
function storefrontHref(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  const base = baseEnv.STOREFRONT_URL?.replace(/\/+$/, "");
  return base ? `${base}${url}` : undefined;
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chat = await api.admin.chats.byId({ id }).catch((error) => {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  });

  return (
    <>
      <SiteHeader title="Чат с Никой" />
      <div className="max-w-3xl space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <Link
            href="/chats"
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Все диалоги
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Диалог от {dateFormat.format(chat.createdAt)}
          </h1>
          <p className="text-muted-foreground text-sm">
            {chat.userId ? (
              <Link href={`/users/${chat.userId}`} className="hover:underline">
                {chat.userName} · {chat.userEmail}
              </Link>
            ) : (
              "Гость без входа в кабинет"
            )}
            {chat.page && ` · страница ${chat.page}`}
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4">
            {chat.messages.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Сообщений нет
              </p>
            )}
            {chat.messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={
                    isUser ? "flex flex-col items-end" : "flex flex-col"
                  }
                >
                  <div className="text-muted-foreground mb-1 text-xs">
                    {isUser ? "Посетитель" : "Ника"} ·{" "}
                    {timeFormat.format(message.createdAt)}
                  </div>
                  <div className="max-w-[85%] space-y-2">
                    {message.parts.map((part, i) =>
                      part.type === "text" ? (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: части сообщения не меняют порядок и своих id не имеют
                          key={i}
                          className={
                            isUser
                              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap"
                              : "bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm whitespace-pre-wrap"
                          }
                        >
                          {part.text}
                        </div>
                      ) : (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: части сообщения не меняют порядок и своих id не имеют
                          key={i}
                          className="rounded-lg border border-dashed px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{part.label}</span>
                            {part.detail && (
                              <span className="text-muted-foreground">
                                «{part.detail}»
                              </span>
                            )}
                            {part.failed && (
                              <Badge variant="destructive">не получилось</Badge>
                            )}
                          </div>
                          {part.items.length > 0 && (
                            <ul className="text-muted-foreground mt-1 list-inside list-disc">
                              {part.items.map((item, j) => {
                                const href = item.url
                                  ? storefrontHref(item.url)
                                  : undefined;
                                return (
                                  // biome-ignore lint/suspicious/noArrayIndexKey: у карточек может совпадать название
                                  <li key={j}>
                                    {href ? (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                      >
                                        {item.title}
                                      </a>
                                    ) : (
                                      item.title
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {part.items.length === 0 &&
                            !part.failed &&
                            part.tool !== "getContacts" && (
                              <div className="text-muted-foreground mt-1">
                                Ничего не нашла
                              </div>
                            )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
