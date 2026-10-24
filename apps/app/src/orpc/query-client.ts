import { RPCJsonSerializer } from "@orpc/client";
import {
  defaultShouldDehydrateQuery,
  hashKey,
  QueryClient,
} from "@tanstack/react-query";

// Те же типы, что oRPC передаёт по сети (Date, Map, Set, BigInt…): данные
// и ключи запросов переживают гидрацию без потерь
const serializer = new RPCJsonSerializer();

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        queryKeyHashFn: (queryKey) => {
          const { json, meta } = serializer.serializeJson(queryKey);
          return hashKey([
            json,
            meta?.map((entry) => JSON.stringify(entry)).sort(),
          ]);
        },
      },
      dehydrate: {
        serializeData: (data) => {
          const { json, meta } = serializer.serializeJson(data);
          return { json, meta };
        },
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => {
          // We should not catch Next.js server errors
          // as that's how Next.js detects dynamic pages
          // so we cannot redact them.
          // Next.js also automatically redacts errors for us
          // with better digests.
          return false;
        },
      },
      hydrate: {
        deserializeData: (data) => serializer.deserializeJson(data),
      },
    },
  });
