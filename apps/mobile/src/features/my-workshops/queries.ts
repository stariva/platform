import { Preferences } from "@capacitor/preferences";
import type { MobileCourses } from "@stariva/web-api/contract";
import { useQuery } from "@tanstack/react-query";
import { mobileCoursesCacheSchema } from "@/api/schemas";
import { api } from "@/lib/api";

const cacheKey = (userId: string) => `stariva:my-courses:${userId}`;
export function useMyCourses(userId: string | null) {
  return useQuery({
    queryKey: ["my-courses", userId],
    queryFn: async (): Promise<MobileCourses> => {
      let data: MobileCourses;
      try {
        data = await api.account.myCourses();
      } catch (error) {
        if (!navigator.onLine && userId) {
          const cached = (await Preferences.get({ key: cacheKey(userId) }))
            .value;
          if (cached) {
            const parsed = mobileCoursesCacheSchema.safeParse(
              JSON.parse(cached),
            );
            if (parsed.success) return parsed.data;
          }
        }
        throw error;
      }
      if (userId)
        await Preferences.set({
          key: cacheKey(userId),
          value: JSON.stringify(data),
        }).catch(() => {});
      return data;
    },
    staleTime: 60_000,
    // Без сети запрос не ставим на паузу: queryFn достанет курсы из кэша
    networkMode: "offlineFirst",
  });
}
