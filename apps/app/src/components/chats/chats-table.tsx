import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import Link from "next/link";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export interface ChatRow {
  id: string;
  preview: string;
  page: string | null;
  messagesCount: number;
  lastMessageAt: Date;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

/** Таблица диалогов с Никой: на странице чатов и в карточке пользователя. */
export function ChatsTable({
  rows,
  showUser = true,
}: {
  rows: ChatRow[];
  showUser?: boolean;
}) {
  const columns = showUser ? 4 : 3;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Первый вопрос</TableHead>
            {showUser && <TableHead>Кто писал</TableHead>}
            <TableHead className="text-right">Сообщений</TableHead>
            <TableHead>Последнее</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns}
                className="text-muted-foreground py-8 text-center"
              >
                Диалогов нет
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[480px] whitespace-normal">
                <Link
                  href={`/chats/${row.id}`}
                  className="text-sm hover:underline"
                >
                  {row.preview || "Без текста"}
                </Link>
                {row.page && (
                  <div className="text-muted-foreground truncate text-xs">
                    {row.page}
                  </div>
                )}
              </TableCell>
              {showUser && (
                <TableCell className="text-sm">
                  {row.userId ? (
                    <Link
                      href={`/users/${row.userId}`}
                      className="hover:underline"
                    >
                      {row.userName}
                      <div className="text-muted-foreground text-xs">
                        {row.userEmail}
                      </div>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Гость</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right text-sm tabular-nums">
                {row.messagesCount}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                {dateFormat.format(row.lastMessageAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
