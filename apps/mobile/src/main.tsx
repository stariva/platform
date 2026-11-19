import { ORPCError } from "@orpc/client";
import type { MobileCourse } from "@stariva/web-api/contract";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Compass, Heart, House, UserRound, Video } from "lucide-react";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Avatar, Button, EmptyState } from "@/components/ui/Primitives";
import { WorkshopCard } from "@/components/ui/WorkshopCard";
import { CourseDetailScreen } from "@/features/my-workshops/CourseDetailScreen";
import { MyWorkshopsScreen } from "@/features/my-workshops/MyWorkshopsScreen";
import { useMyCourses } from "@/features/my-workshops/queries";
import type { CatalogWorkshop } from "@/lib/catalog";
import { useCatalog } from "@/lib/catalog";
import { native } from "@/lib/native";
import {
  expireSession,
  signOut,
  startSession,
  useSession,
} from "@/lib/session";
import { useAppUpdate } from "@/lib/use-app-update";
import {
  CatalogScreen,
  DetailScreen,
  HomeScreen,
} from "@/screens/ExploreScreens";
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

type Section = "home" | "catalog" | "my" | "favorites" | "profile";
const sections = [
  { id: "home", label: "Главная", Icon: House },
  { id: "catalog", label: "Каталог", Icon: Compass },
  { id: "my", label: "Мои", Icon: Video },
  { id: "favorites", label: "Избранное", Icon: Heart },
  { id: "profile", label: "Профиль", Icon: UserRound },
] as const;

function App() {
  const contentRef = useRef<HTMLDivElement>(null);
  const params = new URLSearchParams(window.location.search);
  const [slug, setSlug] = useState(params.get("slug") ?? "");
  const [lessonId, setLessonId] = useState(params.get("lesson") ?? "");
  const [section, setSection] = useState<Section>("home");
  const [selected, setSelected] = useState<CatalogWorkshop | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<MobileCourse | null>(
    null,
  );
  const routeKey = `${section}:${selected?.id ?? ""}:${selectedCourse?.slug ?? ""}:${lessonId}`;
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
  const catalog = useCatalog();
  const myCourses = useMyCourses(
    session.status === "signed-in" ? (session.user?.id ?? null) : null,
    session.status === "signed-in",
  );
  const ownedCourse =
    myCourses.data?.courses.find((course) => course.slug === selected?.id) ??
    null;

  const closeLesson = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["lesson", slug] });
    const url = new URL(window.location.href);
    url.searchParams.delete("slug");
    url.searchParams.delete("lesson");
    window.history.replaceState(window.history.state, "", url);
    setSlug("");
    setLessonId("");
  };
  const goBack = () => {
    if (slug && lessonId) closeLesson();
    else if (selectedCourse) setSelectedCourse(null);
    else if (purchaseOpen) setPurchaseOpen(false);
    else if (selected) setSelected(null);
    else if (section !== "home") setSection("home");
    else void native.exitApp();
  };
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    void startSession();
  }, []);
  useEffect(() => {
    let remove = () => {};
    let active = true;
    void native
      .onBackButton(() => goBackRef.current())
      .then((unsubscribe) => {
        if (active) remove = unsubscribe;
        else unsubscribe();
      });
    return () => {
      active = false;
      remove();
    };
  }, []);
  useEffect(() => {
    let remove = () => {};
    let active = true;
    void native
      .onResume(() => {
        void queryClient.invalidateQueries({ queryKey: ["my-courses"] });
      })
      .then((unsubscribe) => {
        if (active) remove = unsubscribe;
        else unsubscribe();
      });
    return () => {
      active = false;
      remove();
    };
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
    if (routeKey) {
      contentRef.current?.scrollTo(0, 0);
      window.scrollTo(0, 0);
    }
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
        onBack={closeLesson}
      />
    );
  } else if (selectedCourse) {
    screen = (
      <CourseDetailScreen
        course={selectedCourse}
        userId={
          session.status === "signed-in" ? (session.user?.id ?? null) : null
        }
        onBack={goBack}
        onLesson={(id) => {
          const url = new URL(window.location.href);
          url.searchParams.set("slug", selectedCourse.slug);
          url.searchParams.set("lesson", id);
          window.history.replaceState(window.history.state, "", url);
          setSlug(selectedCourse.slug);
          setLessonId(id);
        }}
      />
    );
  } else if (selected) {
    screen = (
      <DetailScreen
        workshop={selected}
        onBack={goBack}
        favorite={favorites.includes(selected.id)}
        ownedCourse={ownedCourse}
        accessLoading={session.status === "signed-in" && myCourses.isLoading}
        accessError={session.status === "signed-in" && myCourses.isError}
        onRetryAccess={() => void myCourses.refetch()}
        purchaseOpen={purchaseOpen}
        onPurchaseOpenChange={setPurchaseOpen}
        onOpenCourse={(course) => {
          setSelected(null);
          setSelectedCourse(course);
        }}
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
            onPlayCourse={(course, id) => {
              setSelectedCourse(course);
              const url = new URL(window.location.href);
              url.searchParams.set("slug", course.slug);
              url.searchParams.set("lesson", id);
              window.history.replaceState(window.history.state, "", url);
              setSlug(course.slug);
              setLessonId(id);
            }}
          />
        );
    else if (section === "favorites")
      screen = (
        <main className="screen">
          <h1 className="display">Избранное</h1>
          {favorites.length ? (
            <div className="mt-7 space-y-3">
              {(catalog.data ?? [])
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
      <div className="app-shell">
        <div ref={contentRef} className="app-content">
          {screen}
        </div>
        <nav aria-label="Основная навигация" className="tab-bar">
          {sections.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
              className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] text-[.65rem] font-semibold ${section === id ? "bg-accent text-accent-fg" : "text-muted"}`}
            >
              <Icon size={21} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </div>
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
