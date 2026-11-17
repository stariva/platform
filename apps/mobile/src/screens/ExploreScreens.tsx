import {
  ArrowLeft,
  ArrowRight,
  Heart,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { WorkshopCard } from "@/components/ui/WorkshopCard";
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
} from "@/components/ui/Primitives";
import { API_URL } from "@/lib/api";
import { catalogWorkshops, type CatalogWorkshop } from "@/lib/catalog";

export function HomeScreen({
  onCatalog,
  onOpen,
}: {
  onCatalog: () => void;
  onOpen: (workshop: CatalogWorkshop) => void;
}) {
  return (
    <main className="screen">
      <div className="mb-7 flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-[.25em] text-accent">
          Stariva
        </span>
        <span className="text-xs text-muted">Творчество рядом</span>
      </div>
      <h1 className="display max-w-xs">Время создавать прекрасное</h1>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
        Мастер-классы по макраме, к которым хочется возвращаться.
      </p>
      <div className="mt-7">
        <WorkshopCard
          workshop={catalogWorkshops[0]}
          onOpen={() => onOpen(catalogWorkshops[0])}
        />
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
        {catalogWorkshops.slice(1).map((workshop) => (
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Все");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<"default" | "name">("default");
  const items = useMemo(() => {
    const list = catalogWorkshops.filter(
      (w) =>
        (category === "Все" || w.category === category) &&
        w.title
          .toLocaleLowerCase("ru-RU")
          .includes(search.toLocaleLowerCase("ru-RU")),
    );
    return sort === "name"
      ? [...list].sort((a, b) => a.title.localeCompare(b.title, "ru-RU"))
      : list;
  }, [search, category, sort]);
  return (
    <main className="screen">
      <span className="text-xs font-bold uppercase tracking-[.25em] text-accent">
        Мастер-классы
      </span>
      <h1 className="display mt-3">Найдите своё</h1>
      <p className="mt-3 text-sm text-muted">
        Плетение, которое впишется в вашу жизнь.
      </p>
      <div className="mt-7 flex gap-2">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-md)] bg-surface px-4 ring-1 ring-line">
          <Search size={19} aria-hidden className="shrink-0 text-muted" />
          <span className="sr-only">Поиск мастер-класса</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Что хотите создать?"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
        <Button
          variant="secondary"
          aria-label="Фильтры"
          onClick={() => setFiltersOpen(true)}
          className="px-4"
        >
          <SlidersHorizontal size={20} />
        </Button>
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {["Все", "Декор", "Одежда"].map((value) => (
          <Chip
            key={value}
            active={category === value}
            onClick={() => setCategory(value)}
          >
            {value}
          </Chip>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <h2 className="section-title">Подборка</h2>
        <span className="text-sm text-muted">{items.length} курса</span>
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
      {items.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Пока ничего"
            description="Попробуйте другой запрос или категорию."
            action={
              <Button
                onClick={() => {
                  setSearch("");
                  setCategory("Все");
                }}
              >
                Сбросить поиск
              </Button>
            }
          />
        </div>
      )}
      <p className="mt-6 text-xs leading-relaxed text-muted">
        Это подборка для знакомства. Актуальная стоимость и полный каталог
        доступны на сайте Stariva.
      </p>
      <BottomSheet
        title="Фильтры"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      >
        <p className="mb-3 text-sm text-muted">Порядок показа</p>
        <div className="space-y-2">
          <Chip active={sort === "default"} onClick={() => setSort("default")}>
            Рекомендуем
          </Chip>
          <Chip active={sort === "name"} onClick={() => setSort("name")}>
            По названию
          </Chip>
        </div>
        <Button className="mt-6 w-full" onClick={() => setFiltersOpen(false)}>
          Показать
        </Button>
      </BottomSheet>
    </main>
  );
}

export function DetailScreen({
  workshop,
  onBack,
  favorite,
  onToggleFavorite,
}: {
  workshop: CatalogWorkshop;
  onBack: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [bookingOpen, setBookingOpen] = useState(false);
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
        <section className="mt-8">
          <h2 className="section-title">Место занятий</h2>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <MapPin size={18} />
            Где вам удобно — доступ онлайн
          </p>
        </section>
      </div>
      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-4">
          <span className="min-w-0 flex-1 text-xs text-muted">
            Актуальная цена
            <br />
            <strong className="text-sm text-fg">на сайте Stariva</strong>
          </span>
          <Button onClick={() => setBookingOpen(true)}>
            Подробнее <ArrowRight size={18} />
          </Button>
        </div>
      </div>
      <BottomSheet
        title="Продолжить на сайте"
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
      >
        <p className="text-sm leading-relaxed text-muted">
          Этот мастер-класс проходит онлайн. На сайте можно проверить цену,
          программу и оформить покупку в существующей системе Stariva.
        </p>
        <a
          href={`${API_URL || "https://stariva.ru"}/workshops`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-accent px-5 font-semibold text-accent-fg"
        >
          Открыть мастер-классы <ArrowRight size={18} className="ml-2" />
        </a>
      </BottomSheet>
    </main>
  );
}
