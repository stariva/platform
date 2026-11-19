import type { MobileCourse } from "@stariva/web-api/contract";
import { ArrowLeft, ArrowRight, Heart } from "lucide-react";
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/Primitives";
import { WorkshopCard } from "@/components/ui/WorkshopCard";
import { API_URL } from "@/lib/api";
import { type CatalogWorkshop, useCatalog } from "@/lib/catalog";
import { native } from "@/lib/native";

const courseCountLabel = (count: number) => {
  const plural = new Intl.PluralRules("ru-RU").select(count);
  return `${count} ${plural === "one" ? "курс" : plural === "few" ? "курса" : "курсов"}`;
};

export function HomeScreen({
  onCatalog,
  onOpen,
}: {
  onCatalog: () => void;
  onOpen: (workshop: CatalogWorkshop) => void;
}) {
  const catalog = useCatalog();
  const featured = catalog.data?.[0];
  return (
    <main className="screen">
      <div className="mb-7 flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-[.25em] text-accent">
          Stariva
        </span>
        <span className="text-xs text-muted">Видеоуроки по макраме</span>
      </div>
      <h1 className="display max-w-xs">Время создавать прекрасное</h1>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
        Учитесь в своём темпе. Продолжайте с нужного места, повторяйте сложные
        узлы и возвращайтесь к урокам когда угодно.
      </p>
      <div className="mt-7">
        {featured ? (
          <WorkshopCard workshop={featured} onOpen={() => onOpen(featured)} />
        ) : catalog.isLoading ? (
          <Skeleton className="aspect-[4/5]" />
        ) : catalog.isError ? (
          <ErrorState
            message="Не удалось загрузить видеокурсы."
            onRetry={() => void catalog.refetch()}
          />
        ) : (
          <EmptyState
            title="Курсы скоро появятся"
            description="Опубликованные мастер-классы будут здесь."
          />
        )}
      </div>
      <section className="mt-9">
        <h2 className="section-title">По душе</h2>
        <div className="mt-4 flex gap-2">
          <Chip onClick={onCatalog}>Декор</Chip>
          <Chip onClick={onCatalog}>Одежда</Chip>
        </div>
      </section>
      <div className="mt-9 flex items-end justify-between">
        <h2 className="section-title">Рекомендуем</h2>
        <Button variant="ghost" onClick={onCatalog}>
          Все курсы <ArrowRight size={18} />
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {catalog.data?.slice(1, 4).map((workshop) => (
          <WorkshopCard
            key={workshop.id}
            workshop={workshop}
            variant="horizontal"
            onOpen={() => onOpen(workshop)}
          />
        ))}
      </div>
    </main>
  );
}

export function CatalogScreen({
  onOpen,
}: {
  onOpen: (workshop: CatalogWorkshop) => void;
}) {
  const catalog = useCatalog();
  const items = catalog.data ?? [];
  return (
    <main className="screen">
      <span className="text-xs font-bold uppercase tracking-[.25em] text-accent">
        Мастер-классы
      </span>
      <h1 className="display mt-3">Найдите своё</h1>
      <p className="mt-3 text-sm text-muted">
        Видеокурсы по макраме. Выберите проект и смотрите уроки в приложении.
      </p>
      <div className="mt-7 flex items-center justify-between">
        <h2 className="section-title">Подборка</h2>
        {catalog.isSuccess && (
          <span className="text-sm text-muted">
            {courseCountLabel(items.length)}
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((workshop) => (
          <WorkshopCard
            key={workshop.id}
            workshop={workshop}
            variant="compact"
            onOpen={() => onOpen(workshop)}
          />
        ))}
      </div>
      {catalog.isLoading && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}
      {catalog.isError && (
        <div className="mt-6">
          <ErrorState
            message="Не удалось загрузить каталог."
            onRetry={() => void catalog.refetch()}
          />
        </div>
      )}
      {!catalog.isLoading && !catalog.isError && items.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Пока ничего"
            description="Новые мастер-классы скоро появятся."
          />
        </div>
      )}
    </main>
  );
}

export function DetailScreen({
  workshop,
  onBack,
  favorite,
  onToggleFavorite,
  ownedCourse,
  accessLoading,
  accessError,
  onRetryAccess,
  onOpenCourse,
  purchaseOpen,
  onPurchaseOpenChange,
}: {
  workshop: CatalogWorkshop;
  onBack: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  ownedCourse: MobileCourse | null;
  accessLoading: boolean;
  accessError: boolean;
  onRetryAccess: () => void;
  onOpenCourse: (course: MobileCourse) => void;
  purchaseOpen: boolean;
  onPurchaseOpenChange: (open: boolean) => void;
}) {
  return (
    <main className="min-h-dvh bg-bg pb-28 text-fg">
      <div className="relative">
        <img
          src={workshop.image}
          alt={workshop.title}
          className="aspect-[4/5] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <button
          aria-label="Назад"
          type="button"
          onClick={onBack}
          className="glass absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] flex size-12 items-center justify-center rounded-full text-fg"
        >
          <ArrowLeft />
        </button>
        <button
          aria-label={
            favorite ? "Убрать из избранного" : "Добавить в избранное"
          }
          aria-pressed={favorite}
          onClick={onToggleFavorite}
          type="button"
          className="glass absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] flex size-12 items-center justify-center rounded-full text-accent"
        >
          <Heart fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="relative -mt-7 rounded-t-[var(--radius-xl)] bg-bg px-5 pt-7">
        <Badge>{workshop.category}</Badge>
        <h1 className="display mt-4">{workshop.title}</h1>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          {workshop.description}
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-lg)] bg-surface p-4">
            <p className="text-xs text-muted">Уровень</p>
            <p className="mt-1 font-semibold">{workshop.level}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-surface p-4">
            <p className="text-xs text-muted">Формат</p>
            <p className="mt-1 font-semibold">Онлайн-курс</p>
          </div>
        </div>
        <section className="mt-9">
          <h2 className="section-title">
            Ваш ритм.
            <br />
            Ваши открытия.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Смотрите уроки в удобное время, возвращайтесь к шагам и отмечайте
            свой прогресс.
          </p>
        </section>
        <p className="mt-7 text-sm text-muted">
          {workshop.length} ·{" "}
          {workshop.isPreorder ? "Предзаказ" : "Доступ онлайн"}
        </p>
      </div>
      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-4">
          <span className="min-w-0 flex-1 text-xs text-muted">
            Стоимость курса
            <br />
            <strong className="text-sm text-fg">{workshop.price}</strong>
          </span>
          <Button
            disabled={accessLoading}
            onClick={() =>
              accessError
                ? onRetryAccess()
                : ownedCourse
                  ? onOpenCourse(ownedCourse)
                  : onPurchaseOpenChange(true)
            }
          >
            {accessLoading
              ? "Проверяем доступ…"
              : accessError
                ? "Повторить проверку"
                : ownedCourse
                  ? "Смотреть уроки"
                  : "Как получить доступ"}
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>
      <BottomSheet
        title="Доступ к курсу"
        open={purchaseOpen}
        onClose={() => onPurchaseOpenChange(false)}
      >
        <p className="text-sm leading-relaxed text-muted">
          Оформите курс на сайте Stariva. После покупки войдите в приложении с
          тем же email — видеоуроки появятся в разделе «Мои».
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() =>
            void native.openExternal(
              `${API_URL || "https://stariva.ru"}${workshop.href}`,
            )
          }
        >
          Оформить на сайте <ArrowRight size={18} />
        </Button>
      </BottomSheet>
    </main>
  );
}
