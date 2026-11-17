import { ORPCError } from "@orpc/client";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Compass, Heart, House, UserRound, Video } from "lucide-react";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Avatar, Button, EmptyState } from "@/components/ui/Primitives";
import type { CatalogWorkshop } from "@/lib/catalog";
import { catalogWorkshops } from "@/lib/catalog";
import { WorkshopCard } from "@/components/ui/WorkshopCard";
import { native } from "@/lib/native";
import {
  expireSession,
  signOut,
  startSession,
  useSession,
} from "@/lib/session";
import { useAppUpdate } from "@/lib/use-app-update";
import { LessonScreen } from "@/screens/LessonScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import {
  CatalogScreen,
  DetailScreen,
  HomeScreen,
} from "@/screens/ExploreScreens";
import { MyWorkshopsScreen } from "@/features/my-workshops/MyWorkshopsScreen";
import { CourseDetailScreen } from "@/features/my-workshops/CourseDetailScreen";
import type { MobileCourse, MobileCourses } from "@stariva/web-api/contract";
import type { Booking } from "@/api/schemas";
import { BookingDetailScreen } from "@/features/my-workshops/BookingDetailScreen";
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

type Section = "home" | "catalog" | "my" | "favorites" | "profile";
const sections = [
  { id: "home", label: "Главная", Icon: House },
  { id: "catalog", label: "Каталог", Icon: Compass },
  { id: "my", label: "Мои", Icon: Video },
  { id: "favorites", label: "Избранное", Icon: Heart },
  { id: "profile", label: "Профиль", Icon: UserRound },
] as const;

function App() {
  const params = new URLSearchParams(window.location.search);
  const [slug, setSlug] = useState(params.get("slug") ?? "");
  const [lessonId, setLessonId] = useState(params.get("lesson") ?? "");
  const [section, setSection] = useState<Section>("home");
  const [selected, setSelected] = useState<CatalogWorkshop | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<MobileCourse | null>(
    null,
  );
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const routeKey = `${section}:${selected?.id ?? ""}:${selectedCourse?.slug ?? ""}:${selectedBooking?.id ?? ""}:${lessonId}`;
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("stariva:favorites") || "[]",
      ) as string[];
    } catch {
      return [];
    }
  });
  const [theme, setTheme] = useState<"auto" | "light" | "dark">(
    () =>
      (localStorage.getItem("stariva:theme") as "auto" | "light" | "dark") ||
      "auto",
  );

  const update = useAppUpdate();
  const session = useSession();

  useEffect(() => {
    void startSession();
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("stariva:theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("stariva:favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    if (routeKey) window.scrollTo(0, 0);
  }, [routeKey]);

  let screen: React.ReactNode;
  if (session.status === "loading") {
    screen = <div className="min-h-dvh animate-pulse bg-bg" />;
  } else if (slug && lessonId && session.status === "signed-out") {
    screen = <LoginScreen />;
  } else if (slug && lessonId) {
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
        onBack={() => {
          if (selectedCourse) {
            setLessonId("");
            const url = new URL(window.location.href);
            url.searchParams.delete("slug");
            url.searchParams.delete("lesson");
            window.history.replaceState(window.history.state, "", url);
          } else window.history.back();
        }}
      />
    );
  } else if (selectedBooking) {
    screen = (
      <BookingDetailScreen
        booking={selectedBooking}
        onBack={() => setSelectedBooking(null)}
      />
    );
  } else if (selectedCourse) {
    const data = queryClient.getQueryData<MobileCourses>([
      "my-courses",
      session.status === "signed-in" ? (session.user?.id ?? null) : null,
    ]);
    const resumeLessonId =
      data?.resume?.slug === selectedCourse.slug ? data.resume.lessonId : null;
    screen = (
      <CourseDetailScreen
        course={selectedCourse}
        resumeLessonId={resumeLessonId}
        onBack={() => setSelectedCourse(null)}
        onLesson={(id) => {
          const url = new URL(window.location.href);
          url.searchParams.set("slug", selectedCourse.slug);
          url.searchParams.set("lesson", id);
          window.history.pushState({}, "", url);
          setSlug(selectedCourse.slug);
          setLessonId(id);
        }}
      />
    );
  } else if (selected) {
    screen = (
      <DetailScreen
        workshop={selected}
        onBack={() => setSelected(null)}
        favorite={favorites.includes(selected.id)}
        onToggleFavorite={() => {
          native.haptic();
          setFavorites((current) =>
            current.includes(selected.id)
              ? current.filter((id) => id !== selected.id)
              : [...current, selected.id],
          );
        }}
      />
    );
  } else {
    if (section === "home")
      screen = (
        <HomeScreen
          onCatalog={() => setSection("catalog")}
          onOpen={setSelected}
        />
      );
    else if (section === "catalog")
      screen = <CatalogScreen onOpen={setSelected} />;
    else if (section === "my")
      screen =
        session.status === "signed-out" ? (
          <LoginScreen />
        ) : (
          <MyWorkshopsScreen
            userId={session.user?.id ?? null}
            name={session.user?.name ?? ""}
            onCatalog={() => setSection("catalog")}
            onCourse={setSelectedCourse}
            favoriteCount={favorites.length}
            onBooking={setSelectedBooking}
          />
        );
    else if (section === "favorites")
      screen = (
        <main className="screen">
          <h1 className="display">Избранное</h1>
          {favorites.length ? (
            <div className="mt-7 space-y-3">
              {catalogWorkshops
                .filter((item) => favorites.includes(item.id))
                .map((item) => (
                  <WorkshopCard
                    key={item.id}
                    workshop={item}
                    variant="horizontal"
                    onOpen={() => setSelected(item)}
                  />
                ))}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                title="Пока пусто"
                description="Сохраняйте понравившиеся мастер-классы, чтобы вернуться к ним позже."
                action={
                  <Button onClick={() => setSection("catalog")}>
                    Открыть каталог
                  </Button>
                }
              />
            </div>
          )}
        </main>
      );
    else
      screen = (
        <main className="screen">
          <div className="flex items-center gap-4">
            <Avatar
              name={
                session.status === "signed-in"
                  ? (session.user?.name ?? "Stariva")
                  : "Гость"
              }
            />
            <div>
              <p className="text-sm text-muted">Аккаунт</p>
              <h1 className="section-title">
                {session.status === "signed-in"
                  ? session.user?.name || "Участник Stariva"
                  : "Гость Stariva"}
              </h1>
            </div>
          </div>
          <p className="mt-7 text-sm text-muted">
            {session.status === "signed-in"
              ? session.user?.email
              : "Войдите, чтобы смотреть приобретённые курсы."}
          </p>
          <h2 className="section-title mt-9">Оформление</h2>
          <fieldset aria-label="Тема приложения" className="mt-4 flex gap-2">
            {(["auto", "light", "dark"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
                className={`min-h-11 flex-1 rounded-[var(--radius-md)] px-2 text-xs font-semibold ${theme === value ? "bg-accent text-accent-fg" : "bg-surface text-fg ring-1 ring-line"}`}
              >
                {{ auto: "Авто", light: "Светлая", dark: "Тёмная" }[value]}
              </button>
            ))}
          </fieldset>
          <section className="mt-9 rounded-[var(--radius-lg)] bg-surface p-5">
            <h2 className="section-title">Напоминания</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Настройки напоминаний появятся вместе с расписанием очных занятий.
              Для онлайн-курсов даты не назначены.
            </p>
          </section>
          <div className="mt-7">
            {session.status === "signed-in" ? (
              <Button
                variant="secondary"
                onClick={() => void signOut().then(() => queryClient.clear())}
              >
                Выйти
              </Button>
            ) : (
              <Button onClick={() => setSection("my")}>Войти</Button>
            )}
          </div>
        </main>
      );
    screen = (
      <>
        {screen}
        <nav
          aria-label="Основная навигация"
          className="glass fixed inset-x-3 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-40 flex rounded-[var(--radius-xl)] border border-line p-1 shadow-[var(--shadow-2)]"
        >
          {sections.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] text-[.65rem] font-semibold ${section === id ? "bg-accent text-accent-fg" : "text-muted"}`}
            >
              <Icon size={21} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </>
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
