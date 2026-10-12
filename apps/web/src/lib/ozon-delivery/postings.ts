import { getFbsPosting } from "./client";

export interface PostingStatus {
  postingNumber: string;
  status: string;
}

/** Статусы отправлений Ozon по заказу; недоступный ответ — «unknown», а не ошибка страницы. */
export async function getPostingStatuses(
  postingNumbers: string[] | null,
): Promise<PostingStatus[]> {
  if (!postingNumbers || postingNumbers.length === 0) return [];
  return Promise.all(
    postingNumbers.map(async (postingNumber) => {
      try {
        const posting = await getFbsPosting(postingNumber);
        return { postingNumber, status: posting.status };
      } catch {
        return { postingNumber, status: "unknown" };
      }
    }),
  );
}
