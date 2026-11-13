import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { LessonScreen } from "@/screens/LessonScreen";
import "./index.css";

const queryClient = new QueryClient({
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

  if (!slug || !lessonId) {
    return <p className="p-6 text-muted">Откройте урок из списка курсов.</p>;
  }
  return (
    <LessonScreen
      slug={slug}
      lessonId={lessonId}
      onSelectLesson={setLessonId}
      onBack={() => window.history.back()}
    />
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
