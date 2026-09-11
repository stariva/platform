"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { PickupPoint } from "@/lib/ozon-delivery/types";

const RUSSIA_CENTER: [number, number] = [55.751244, 37.618423];

function FitBounds({ points }: { points: PickupPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const [first, ...rest] = points;
    if (!first) return;
    if (rest.length === 0) {
      map.setView([first.latitude, first.longitude], 14);
      return;
    }
    const bounds = points.map(
      (p) => [p.latitude, p.longitude] as [number, number],
    );
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
  }, [points, map]);
  return null;
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
  return (
    <div className="h-80 w-full overflow-hidden rounded-lg border border-espresso/15">
      <MapContainer
        center={RUSSIA_CENTER}
        zoom={4}
        scrollWheelZoom
        preferCanvas
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {points.map((point) => {
          const selected = point.id === selectedPointId;
          return (
            <CircleMarker
              key={point.id}
              center={[point.latitude, point.longitude]}
              radius={selected ? 10 : 7}
              pathOptions={{
                color: selected ? "#b5622a" : "#8a7a6a",
                fillColor: selected ? "#b5622a" : "#c9a97e",
                fillOpacity: 0.9,
                weight: selected ? 3 : 1,
              }}
              eventHandlers={{ click: () => onSelect(point.id) }}
            >
              <Popup>
                <div className="text-sm space-y-1">
                  <p className="font-medium">{point.name}</p>
                  <p>{point.address}</p>
                  {point.workSchedule && (
                    <p className="text-xs text-neutral-500">
                      {point.workSchedule}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect(point.id)}
                    className="mt-1 text-terracotta underline"
                  >
                    Выбрать этот пункт
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
