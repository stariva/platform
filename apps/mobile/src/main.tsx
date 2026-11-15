import { ORPCError } from "@orpc/client";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { UpdateBanner } from "@/components/UpdateBanner";
import {
  expireSession,
  signOut,
  startSession,
  useSession,
} from "@/lib/session";
import { useAppUpdate } from "@/lib/use-app-update";
import { LessonScreen } from "@/screens/LessonScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import "./index.css";

const queryClient = new QueryClient({
  // Сервер не узнал токен (сессию отозвали, срок вышел): показываем вход
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ORPCError && error.code === "UNAUTHORIZED") {
        void expireSession().then(() => queryClient.clear());
      }
    },
  }),
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/**
 * Пока без роутера: открываем урок по адресу `/?slug=…&lesson=…`. Главный
 * экран, помощь и профиль — отдельными задачами.
 */
function App() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") ?? "";
  const [lessonId, setLessonId] = useState(params.get("lesson") ?? "");

  const update = useAppUpdate();
  const session = useSession();

  useEffect(() => {
    void startSession();
  }, []);

  let screen: React.ReactNode;
  if (session.status === "loading") {
    screen = <div className="min-h-dvh animate-pulse bg-bg" />;
  } else if (session.status === "signed-out") {
    screen = <LoginScreen />;
  } else if (!slug || !lessonId) {
    screen = (
      <div className="space-y-4 p-6">
        <p className="text-muted">Откройте урок из списка курсов.</p>
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => queryClient.clear());
          }}
          className="min-h-12 rounded-2xl px-4 text-sm text-muted underline underline-offset-4"
        >
          Выйти из аккаунта
        </button>
      </div>
    );
  } else {
    screen = (
      <LessonScreen
        slug={slug}
        lessonId={lessonId}
        onSelectLesson={(id) => {
          const url = new URL(window.location.href);
          url.searchParams.set("lesson", id);
          window.history.replaceState(window.history.state, "", url);
          setLessonId(id);
        }}
        onBack={() => window.history.back()}
      />
    );
  }

  return (
    <>
      {screen}
      <UpdateBanner update={update} />
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root не найден");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
