"use client";

import {
  CheckIcon,
  ClockIcon,
  InfoIcon,
  LocateFixedIcon,
  MapPinIcon,
  PackageIcon,
  StarIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { haversineKm } from "@/lib/geo";
import {
  formatDistance,
  formatRating,
  holidayNotice,
  pointKindLabel,
  todayHours,
  weekSchedule,
} from "@/lib/ozon-delivery/format";
import type {
  PickupPoint,
  PickupPointDetailsResponse,
  PickupPointLocation,
  PickupPointsNearbyResponse,
} from "@/lib/ozon-delivery/types";
import { cn } from "@/lib/utils";

const PickupPointMap = dynamic(
  () =>
    import("@/components/checkout/pickup-point-map").then(
      (m) => m.PickupPointMap,
    ),
  {
    ssr: false,
    loading: () => <MapPlaceholder />,
  },
);

const LIST_PAGE_SIZE = 8;
const DETAILS_BATCH_SIZE = 50;
// Если карту увели дальше этого от адреса, список показывает пункты
// «в этой части карты», а не «рядом с вами».
const MOVED_AWAY_KM = 1.5;

interface AddressSuggestion {
  value: string;
  lat: number;
  lon: number;
  precise: boolean;
}

type Anchor = AddressSuggestion;

function MapPlaceholder() {
  return (
    <div className="h-72 sm:h-96 w-full flex items-center justify-center rounded-xl border border-espresso/15 bg-sand">
      <Spinner className="text-taupe" />
    </div>
  );
}

interface PickupPointPickerProps {
  /** Вызывается, когда покупатель выбрал пункт и его адрес загружен */
  onChange: (point: PickupPoint | null) => void;
}

export function PickupPointPicker({ onChange }: PickupPointPickerProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [locating, setLocating] = useState(false);
  const anchorRequestRef = useRef(0);

  const [locations, setLocations] = useState<PickupPointLocation[] | null>(
    null,
  );
  const [expanded, setExpanded] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [details, setDetails] = useState<ReadonlyMap<string, PickupPoint>>(
    new Map(),
  );
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [detailsFailed, setDetailsFailed] = useState(false);
  const requestedRef = useRef(new Set<string>());

  const [viewCenter, setViewCenter] = useState<[number, number] | null>(null);
  const [listLimit, setListLimit] = useState(LIST_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState("");

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const selectedPoint = selectedId ? details.get(selectedId) : undefined;
  useEffect(() => {
    onChangeRef.current(selectedPoint ?? null);
  }, [selectedPoint]);

  // --- Поиск адреса ---------------------------------------------------
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === anchor?.value) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/checkout/address-suggest?query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const data = await res.json().catch(() => null);
        if (res.ok) {
          setSuggestions(data?.suggestions ?? []);
          setActiveSuggestion(-1);
        }
      } catch {
        // AbortError или сетевая ошибка — просто не показываем подсказки
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, anchor?.value]);

  async function chooseAnchor(next: Anchor) {
    // Покупатель мог успеть выбрать другой адрес, пока грузился прошлый
    const request = ++anchorRequestRef.current;
    setAnchor(next);
    setQuery(next.value);
    setSuggestions([]);
    setSelectedId("");
    setViewCenter(null);
    setListLimit(LIST_PAGE_SIZE);
    setLocations(null);
    setLoadingLocations(true);
    try {
      const res = await fetch(
        `/api/checkout/pickup-points?lat=${next.lat}&lon=${next.lon}`,
      );
      const data = (await res.json().catch(() => null)) as
        | (PickupPointsNearbyResponse & { error?: string })
        | null;
      if (request !== anchorRequestRef.current) return;
      if (!res.ok || !data) {
        toast.error(data?.error ?? "Не удалось загрузить пункты выдачи");
        return;
      }
      setDetails((prev) => {
        const merged = new Map(prev);
        for (const point of data.nearest) merged.set(point.id, point);
        return merged;
      });
      setLocations(data.locations);
      setExpanded(data.expanded);
    } catch {
      if (request === anchorRequestRef.current) {
        toast.error("Не удалось загрузить пункты выдачи");
      }
    } finally {
      if (request === anchorRequestRef.current) setLoadingLocations(false);
    }
  }

  function handleLocate() {
    if (!("geolocation" in navigator)) {
      toast.error("Браузер не умеет определять местоположение");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        void chooseAnchor({
          value: "Моё местоположение",
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          precise: true,
        });
      },
      () => {
        setLocating(false);
        toast.error(
          "Не получилось определить местоположение — введите адрес вручную",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function handleQueryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const suggestion = suggestions[Math.max(activeSuggestion, 0)];
      if (suggestion) void chooseAnchor(suggestion);
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  }

  // --- Список пунктов вокруг центра карты -----------------------------
  const visibleLocations = useMemo(
    () => (locations ?? []).filter((p) => !hidden.has(p.id)),
    [locations, hidden],
  );

  const centerLat = viewCenter?.[0] ?? anchor?.lat;
  const centerLon = viewCenter?.[1] ?? anchor?.lon;
  const movedAway =
    !!anchor &&
    !!viewCenter &&
    haversineKm(anchor.lat, anchor.lon, viewCenter[0], viewCenter[1]) >
      MOVED_AWAY_KM;

  const listed = useMemo(() => {
    if (centerLat === undefined || centerLon === undefined) return [];
    return visibleLocations
      .map((p) => ({
        id: p.id,
        fromCenter: haversineKm(centerLat, centerLon, p.latitude, p.longitude),
      }))
      .sort((a, b) => a.fromCenter - b.fromCenter)
      .slice(0, listLimit)
      .map((p) => p.id);
  }, [visibleLocations, centerLat, centerLon, listLimit]);

  const distanceFromAnchor = (point: PickupPointLocation) =>
    anchor?.precise
      ? haversineKm(anchor.lat, anchor.lon, point.latitude, point.longitude)
      : undefined;

  // Подгружаем адреса пунктов, которые видны в списке или выбраны на карте
  useEffect(() => {
    const wanted = [...new Set([...listed, selectedId])].filter(
      (id) =>
        id &&
        !details.has(id) &&
        !hidden.has(id) &&
        !requestedRef.current.has(id),
    );
    if (wanted.length === 0) return;
    for (const id of wanted) requestedRef.current.add(id);

    for (let i = 0; i < wanted.length; i += DETAILS_BATCH_SIZE) {
      const batch = wanted.slice(i, i + DETAILS_BATCH_SIZE);
      void (async () => {
        try {
          const res = await fetch(
            `/api/checkout/pickup-points/details?ids=${batch.join(",")}`,
          );
          if (!res.ok) throw new Error(`details_${res.status}`);
          const data = (await res.json()) as PickupPointDetailsResponse;
          setDetails((prev) => {
            const merged = new Map(prev);
            for (const point of data.points) merged.set(point.id, point);
            return merged;
          });
          if (data.unavailable.length > 0) {
            setHidden((prev) => new Set([...prev, ...data.unavailable]));
            setSelectedId((id) => (data.unavailable.includes(id) ? "" : id));
          }
        } catch {
          for (const id of batch) requestedRef.current.delete(id);
          setDetailsFailed(true);
        }
      })();
    }
  }, [listed, selectedId, details, hidden]);

  function retryDetails() {
    setDetailsFailed(false);
    // Пересоздаём Map, чтобы эффект подгрузки перезапустился
    setDetails((prev) => new Map(prev));
  }

  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, point] of details) map.set(id, point.title);
    return map;
  }, [details]);

  const selectedLocation = visibleLocations.find((p) => p.id === selectedId);

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="checkout-address"
          className="block text-sm text-espresso mb-1.5"
        >
          Где вам удобно забрать заказ?
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <MapPinIcon
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-taupe"
            />
            <Input
              id="checkout-address"
              type="text"
              placeholder="Город, улица, дом"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleQueryKeyDown}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="checkout-address-suggestions"
              className="pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSuggestions([]);
                  document.getElementById("checkout-address")?.focus();
                }}
                aria-label="Очистить адрес"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-taupe hover:text-espresso"
              >
                <XIcon className="size-4" />
              </button>
            )}
            {suggestions.length > 0 && (
              <ul
                id="checkout-address-suggestions"
                className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-espresso/15 bg-white py-1 shadow-lg"
              >
                {suggestions.map((suggestion, index) => (
                  <li key={`${suggestion.value}-${suggestion.lat}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void chooseAnchor(suggestion)}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-espresso hover:bg-sand",
                        index === activeSuggestion && "bg-sand",
                      )}
                    >
                      <MapPinIcon
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-taupe"
                      />
                      {suggestion.value}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleLocate}
            disabled={locating}
            className="shrink-0"
          >
            {locating ? <Spinner /> : <LocateFixedIcon />}
            Рядом со мной
          </Button>
        </div>
        {!anchor && (
          <p className="mt-2 text-xs text-taupe">
            Покажем ближайшие пункты выдачи Ozon на карте — адрес, часы работы и
            как найти.
          </p>
        )}
      </div>

      {anchor && loadingLocations && (
        <>
          <MapPlaceholder />
          <ListSkeleton rows={3} />
        </>
      )}

      {anchor &&
        !loadingLocations &&
        locations &&
        (visibleLocations.length === 0 ? (
          <p className="rounded-xl bg-sand px-4 py-6 text-center text-sm text-taupe">
            Пунктов выдачи Ozon рядом не нашлось — попробуйте другой адрес
          </p>
        ) : (
          <>
            {expanded && (
              <p className="flex items-start gap-2 rounded-lg bg-sand px-3 py-2 text-xs text-espresso">
                <InfoIcon aria-hidden className="mt-px size-4 shrink-0" />
                Рядом с этим адресом пунктов мало — показываем ближайшие,
                обратите внимание на расстояние
              </p>
            )}

            <PickupPointMap
              locations={visibleLocations}
              anchor={anchor}
              selectedPointId={selectedId}
              titles={titles}
              onSelect={setSelectedId}
              onCenterChange={setViewCenter}
            />

            {selectedId && selectedLocation && (
              <SelectedPointCard
                point={selectedPoint}
                distanceKm={distanceFromAnchor(selectedLocation)}
              />
            )}

            <div>
              <h3 className="mb-2 text-sm font-medium text-espresso">
                {movedAway
                  ? "Пункты в этой части карты"
                  : anchor.precise
                    ? "Ближайшие к вам пункты"
                    : "Пункты выдачи в центре карты"}
              </h3>
              <ul className="divide-y divide-espresso/8 overflow-hidden rounded-xl border border-espresso/10">
                {listed.map((id) => {
                  const point = details.get(id);
                  const location = visibleLocations.find((p) => p.id === id);
                  return (
                    <li key={id}>
                      {point ? (
                        <PointRow
                          point={point}
                          distanceKm={
                            location ? distanceFromAnchor(location) : undefined
                          }
                          selected={id === selectedId}
                          onSelect={() => setSelectedId(id)}
                        />
                      ) : (
                        <RowSkeleton />
                      )}
                    </li>
                  );
                })}
              </ul>
              {detailsFailed && (
                <p className="mt-2 text-xs text-taupe">
                  Не удалось загрузить адреса части пунктов.{" "}
                  <button
                    type="button"
                    onClick={retryDetails}
                    className="text-espresso underline"
                  >
                    Повторить
                  </button>
                </p>
              )}
              {visibleLocations.length > listed.length && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setListLimit((n) => n + LIST_PAGE_SIZE)}
                  className="mt-2 w-full text-espresso"
                >
                  Показать ещё пункты
                </Button>
              )}
            </div>
          </>
        ))}
    </div>
  );
}

function PointRow({
  point,
  distanceKm,
  selected,
  onSelect,
}: {
  point: PickupPoint;
  distanceKm?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const hours = todayHours(point);
  const holiday = holidayNotice(point);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
        selected ? "bg-sand" : "hover:bg-sand/60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected
            ? "border-espresso bg-espresso text-parchment"
            : "border-espresso/25",
        )}
      >
        {selected && <CheckIcon className="size-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-espresso">
            {point.title}
          </span>
          {distanceKm !== undefined && (
            <span className="shrink-0 text-xs text-taupe">
              {formatDistance(distanceKm)}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-taupe">
          {[
            pointKindLabel(point),
            point.locality,
            point.rating ? `★ ${formatRating(point.rating)}` : undefined,
            hours,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {holiday && (
          <span className="mt-1 flex items-center gap-1 text-xs text-amber-700">
            <TriangleAlertIcon aria-hidden className="size-3" />
            {holiday}
          </span>
        )}
      </span>
    </button>
  );
}

function SelectedPointCard({
  point,
  distanceKm,
}: {
  point: PickupPoint | undefined;
  distanceKm?: number;
}) {
  if (!point) {
    return (
      <div className="rounded-xl border border-espresso p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
    );
  }

  const schedule = weekSchedule(point);
  const holiday = holidayNotice(point);
  return (
    <section
      aria-label="Выбранный пункт выдачи"
      className="rounded-xl border border-espresso bg-white p-4"
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-taupe">
            <CheckIcon aria-hidden className="size-3.5 text-espresso" />
            {pointKindLabel(point)} Ozon
          </p>
          <p className="mt-1 text-base font-medium text-espresso">
            {point.title}
          </p>
          <p className="text-sm text-taupe">
            {[
              point.locality,
              distanceKm !== undefined
                ? `${formatDistance(distanceKm)} от вас`
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {point.imageUrl && (
          // biome-ignore lint/performance/noImgElement: фото с CDN Ozon, домены которого не добавлены в next/image
          <img
            src={point.imageUrl}
            alt="Фото пункта выдачи"
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-20 shrink-0 rounded-lg bg-sand object-cover"
          />
        )}
      </div>

      {holiday && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <TriangleAlertIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          {holiday}
        </p>
      )}

      <dl className="mt-3 space-y-2 text-sm">
        {schedule.length > 0 && (
          <div className="flex gap-2">
            <dt className="sr-only">Режим работы</dt>
            <ClockIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-taupe"
            />
            <dd className="grid grid-cols-[auto_1fr] gap-x-3 text-espresso">
              {schedule.map((row) => (
                <span key={row.days} className="contents">
                  <span className="text-taupe">{row.days}</span>
                  <span>{row.hours}</span>
                </span>
              ))}
            </dd>
          </div>
        )}
        {point.description && (
          <div className="flex gap-2">
            <dt className="sr-only">Как найти</dt>
            <MapPinIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-taupe"
            />
            <dd className="whitespace-pre-line text-espresso">
              {point.description}
            </dd>
          </div>
        )}
        {(point.storageDays || point.rating) && (
          <div className="flex gap-2">
            <dt className="sr-only">Хранение и рейтинг</dt>
            <PackageIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-taupe"
            />
            <dd className="flex flex-wrap items-center gap-x-3 text-espresso">
              {point.storageDays && (
                <span>
                  Заказ хранится {point.storageDays}{" "}
                  {daysWord(point.storageDays)}
                </span>
              )}
              {point.rating && (
                <span className="inline-flex items-center gap-1">
                  <StarIcon aria-hidden className="size-3.5 fill-current" />
                  {formatRating(point.rating)}
                  <span className="text-taupe">рейтинг пункта</span>
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-taupe">{point.address}</p>
    </section>
  );
}

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

function RowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="size-5 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-espresso/8 rounded-xl border border-espresso/10">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: статичный плейсхолдер
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}
