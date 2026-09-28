"use client";

import { useEffect, useRef, useState } from "react";
import { env } from "@/env";
import type { PickupPointLocation } from "@/lib/ozon-delivery/types";

const RUSSIA_CENTER: [number, number] = [55.751244, 37.618423];
// Сколько ближайших пунктов должно поместиться на карте при открытии
const INITIAL_VISIBLE_POINTS = 6;

const POINT_STYLE = {
  preset: "islands#circleDotIcon",
  iconColor: "#8a867f",
  zIndex: 100,
};
const SELECTED_POINT_STYLE = {
  preset: "islands#dotIcon",
  iconColor: "#161513",
  zIndex: 1000,
};

let ymapsLoadPromise: Promise<typeof window.ymaps> | null = null;

function loadYandexMaps(apiKey: string): Promise<typeof window.ymaps> {
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (ymapsLoadPromise) return ymapsLoadPromise;

  ymapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.onerror = () => {
      ymapsLoadPromise = null;
      reject(new Error("Не удалось загрузить Яндекс.Карты"));
    };
    script.onload = () => {
      window.ymaps.ready(() => resolve(window.ymaps));
    };
    document.head.appendChild(script);
  });

  return ymapsLoadPromise;
}

export interface MapAnchor {
  lat: number;
  lon: number;
  /** Точный адрес (улица/дом/геолокация) — рисуем метку «вы здесь» */
  precise: boolean;
}

interface PickupPointMapProps {
  /** Отсортированы по удалённости от anchor */
  locations: PickupPointLocation[];
  anchor: MapAnchor;
  selectedPointId: string;
  /** Подсказка при наведении на метку — адрес, если он уже загружен */
  titles: ReadonlyMap<string, string>;
  onSelect: (id: string) => void;
  onCenterChange: (center: [number, number]) => void;
}

export function PickupPointMap({
  locations,
  anchor,
  selectedPointId,
  titles,
  onSelect,
  onCenterChange,
}: PickupPointMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ymaps.Map | null>(null);
  const clustererRef = useRef<ymaps.Clusterer | null>(null);
  const placemarksRef = useRef(new Map<string, ymaps.Placemark>());
  const anchorPlacemarkRef = useRef<ymaps.Placemark | null>(null);
  // Карта создаётся асинхронно (после загрузки скрипта), а точки обычно
  // приходят раньше — этот флаг перезапускает отрисовку точек, когда карта готова.
  const [mapReady, setMapReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const selectedRef = useRef(selectedPointId);
  const titlesRef = useRef(titles);
  titlesRef.current = titles;

  const apiKey = env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;

  // biome-ignore lint/correctness/useExhaustiveDependencies: apiKey is a build-time env value, never changes across renders
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;
    let centerTimer: ReturnType<typeof setTimeout> | undefined;

    loadYandexMaps(apiKey)
      .then((ymapsApi) => {
        if (cancelled || !containerRef.current) return;
        const map = new ymapsApi.Map(
          containerRef.current,
          { center: RUSSIA_CENTER, zoom: 4, controls: ["zoomControl"] },
          { autoFitToViewport: "always", suppressMapOpenBlock: true },
        );
        // Колесо мыши листает страницу, а не зумит карту посреди чекаута
        map.behaviors.disable("scrollZoom");
        map.events.add("boundschange", (event) => {
          const center = (event as ymaps.IEvent).get("newCenter") as [
            number,
            number,
          ];
          clearTimeout(centerTimer);
          centerTimer = setTimeout(
            () => onCenterChangeRef.current(center),
            250,
          );
        });

        const clusterer = new ymapsApi.Clusterer({
          preset: "islands#invertedBlackClusterIcons",
          groupByCoordinates: false,
          hasBalloon: false,
        });
        // Community typings don't model Clusterer as an IGeoObject, though
        // the runtime API accepts it fine as a geoObjects child.
        map.geoObjects.add(clusterer as unknown as ymaps.IGeoObject);
        mapRef.current = map;
        clustererRef.current = clusterer;
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(centerTimer);
      mapRef.current?.destroy();
      mapRef.current = null;
      clustererRef.current = null;
      anchorPlacemarkRef.current = null;
      placemarksRef.current.clear();
      setMapReady(false);
    };
  }, [apiKey]);

  // Метки пересоздаются только при смене набора пунктов (новый адрес),
  // выбор пункта ниже лишь перекрашивает две метки и не сбивает зум.
  useEffect(() => {
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    const ymapsApi = window.ymaps;
    if (!mapReady || !map || !clusterer || !ymapsApi) return;

    clusterer.removeAll();
    placemarksRef.current.clear();
    const placemarks = locations.map((point) => {
      const placemark = new ymapsApi.Placemark(
        [point.latitude, point.longitude],
        { hintContent: titlesRef.current.get(point.id) ?? "Пункт выдачи Ozon" },
        {
          ...(point.id === selectedRef.current
            ? SELECTED_POINT_STYLE
            : POINT_STYLE),
          hasBalloon: false,
        },
      );
      placemark.events.add("click", () => onSelectRef.current(point.id));
      placemarksRef.current.set(point.id, placemark);
      return placemark;
    });
    clusterer.add(placemarks);

    if (anchorPlacemarkRef.current) {
      map.geoObjects.remove(anchorPlacemarkRef.current);
      anchorPlacemarkRef.current = null;
    }
    if (anchor.precise) {
      const anchorPlacemark = new ymapsApi.Placemark(
        [anchor.lat, anchor.lon],
        { hintContent: "Вы здесь" },
        {
          preset: "islands#homeCircleIcon",
          iconColor: "#4a4845",
          zIndex: 2000,
          hasBalloon: false,
        },
      );
      map.geoObjects.add(anchorPlacemark);
      anchorPlacemarkRef.current = anchorPlacemark;
    }

    // Показываем адрес покупателя и несколько ближайших пунктов вокруг
    const visible = locations.slice(0, INITIAL_VISIBLE_POINTS);
    const lats = [anchor.lat, ...visible.map((p) => p.latitude)];
    const lons = [anchor.lon, ...visible.map((p) => p.longitude)];
    if (visible.length === 0) {
      map.setCenter([anchor.lat, anchor.lon], 12);
    } else {
      map.setBounds(
        [
          [Math.min(...lats), Math.min(...lons)],
          [Math.max(...lats), Math.max(...lons)],
        ],
        { checkZoomRange: true, zoomMargin: [40] },
      );
    }
  }, [locations, anchor, mapReady]);

  useEffect(() => {
    const previous = placemarksRef.current.get(selectedRef.current);
    previous?.options.set(POINT_STYLE);
    selectedRef.current = selectedPointId;
    const current = placemarksRef.current.get(selectedPointId);
    const map = mapRef.current;
    if (!current || !map) return;
    current.options.set(SELECTED_POINT_STYLE);

    // Пункт, выбранный в списке, может оказаться за краем карты
    const coords = current.geometry?.getCoordinates() as
      | [number, number]
      | undefined;
    const [southWest, northEast] = map.getBounds();
    if (!coords || !southWest || !northEast) return;
    const inView =
      coords[0] > (southWest[0] ?? -90) &&
      coords[0] < (northEast[0] ?? 90) &&
      coords[1] > (southWest[1] ?? -180) &&
      coords[1] < (northEast[1] ?? 180);
    if (!inView) void map.panTo(coords, { flying: true, duration: 400 });
  }, [selectedPointId]);

  useEffect(() => {
    for (const [id, title] of titles) {
      placemarksRef.current.get(id)?.properties.set("hintContent", title);
    }
  }, [titles]);

  if (!apiKey || loadFailed) {
    return (
      <div className="h-72 sm:h-96 w-full flex items-center justify-center rounded-xl border border-espresso/15 bg-sand px-4 text-center text-sm text-taupe">
        Карта сейчас недоступна — выберите пункт из списка ниже
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-72 sm:h-96 w-full overflow-hidden rounded-xl border border-espresso/15 bg-sand"
    />
  );
}
