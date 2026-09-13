"use client";

import { useEffect, useRef } from "react";
import { env } from "@/env";
import type { PickupPoint } from "@/lib/ozon-delivery/types";

const RUSSIA_CENTER: [number, number] = [55.751244, 37.618423];

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

function balloonContent(point: PickupPoint): string {
  const schedule = point.workSchedule
    ? `<p style="margin:4px 0 0;font-size:12px;color:#78716c">${point.workSchedule}</p>`
    : "";
  return `
    <div style="font-size:14px;line-height:1.4">
      <p style="margin:0;font-weight:500">${point.name}</p>
      <p style="margin:2px 0 0">${point.address}</p>
      ${schedule}
    </div>
  `;
}

interface PickupPointMapProps {
  points: PickupPoint[];
  selectedPointId: string;
  onSelect: (id: string) => void;
}

export function PickupPointMap({
  points,
  selectedPointId,
  onSelect,
}: PickupPointMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ymaps.Map | null>(null);
  const clustererRef = useRef<ymaps.Clusterer | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const apiKey = env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;

  // biome-ignore lint/correctness/useExhaustiveDependencies: apiKey is a build-time env value, never changes across renders
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;

    loadYandexMaps(apiKey).then((ymapsApi) => {
      if (cancelled || !containerRef.current) return;
      const map = new ymapsApi.Map(containerRef.current, {
        center: RUSSIA_CENTER,
        zoom: 4,
        controls: ["zoomControl"],
      });
      const clusterer = new ymapsApi.Clusterer({
        preset: "islands#invertedOrangeClusterIcons",
        groupByCoordinates: false,
      });
      // Community typings don't model Clusterer as an IGeoObject, though
      // the runtime API accepts it fine as a geoObjects child.
      map.geoObjects.add(clusterer as unknown as ymaps.IGeoObject);
      mapRef.current = map;
      clustererRef.current = clusterer;
    });

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      clustererRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    const ymapsApi = window.ymaps;
    if (!map || !clusterer || !ymapsApi) return;

    clusterer.removeAll();

    const placemarks = points.map((point) => {
      const selected = point.id === selectedPointId;
      const placemark = new ymapsApi.Placemark(
        [point.latitude, point.longitude],
        { balloonContentBody: balloonContent(point) },
        {
          preset: selected
            ? "islands#circleIcon"
            : "islands#dotIcon",
          iconColor: selected ? "#b5622a" : "#8a7a6a",
        },
      );
      placemark.events.add("click", () => onSelectRef.current(point.id));
      return placemark;
    });
    clusterer.add(placemarks);

    const [first] = points;
    if (first && points.length === 1) {
      map.setCenter([first.latitude, first.longitude], 14);
    } else if (points.length > 1) {
      const bounds = clusterer.getBounds();
      if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: [32] });
    }
  }, [points, selectedPointId]);

  if (!apiKey) {
    return (
      <div className="h-80 w-full flex items-center justify-center rounded-lg border border-espresso/15 bg-parchment/40 px-4 text-center text-sm text-taupe">
        Карта недоступна — не задан NEXT_PUBLIC_YANDEX_MAPS_API_KEY
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-lg border border-espresso/15"
    />
  );
}
