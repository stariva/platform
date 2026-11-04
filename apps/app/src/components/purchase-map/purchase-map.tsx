"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { useState } from "react";
import { rubles } from "~/components/crm/crm-meta";
import { project } from "./projection";
import { RUSSIA_FRAME, RUSSIA_OUTLINE } from "./russia-outline";

export interface MapPlace {
  city: string;
  lat: number;
  lng: number;
  orders: number;
  customers: number;
  revenue: number;
  byIp: number;
  inRussia: boolean;
}

const MIN_RADIUS = 5;
const MAX_RADIUS = 22;

const plural = (count: number, one: string, few: string, many: string) => {
  const rest = count % 100;
  const last = count % 10;
  if (rest >= 11 && rest <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};

const ordersLabel = (count: number) =>
  `${count} ${plural(count, "заказ", "заказа", "заказов")}`;

/**
 * Карта России с кружком на каждом городе, где купили: площадь кружка
 * пропорциональна числу заказов. Рядом — таблица тех же городов, в том числе
 * тех, что на карту не попали, а наведение на строку подсвечивает кружок.
 */
export function PurchaseMap({ places }: { places: MapPlace[] }) {
  const [active, setActive] = useState<string | null>(null);
  const mapped = places.filter((place) => place.inRussia);
  const outside = places.filter((place) => !place.inRussia);
  const biggest = Math.max(1, ...mapped.map((place) => place.orders));
  const radius = (orders: number) =>
    MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(orders / biggest);

  const hovered = mapped.find((place) => place.city === active);
  const hoveredAt = hovered && project(RUSSIA_FRAME, hovered.lng, hovered.lat);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Где покупают</CardTitle>
          <CardDescription>
            Площадь кружка — число заказов. Город — по пункту выдачи или адресу
            доставки, а если доставку согласует мастер, то по IP при оформлении.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <svg
              viewBox={`0 0 ${RUSSIA_FRAME.width} ${RUSSIA_FRAME.height}`}
              role="img"
              aria-label={
                mapped.length > 0
                  ? `Карта России: города покупок — ${mapped.map((place) => place.city).join(", ")}`
                  : "Карта России: покупок пока нет"
              }
              className="h-auto w-full"
            >
              <path
                d={RUSSIA_OUTLINE}
                className="fill-muted stroke-border"
                strokeWidth={0.8}
                strokeLinejoin="round"
              />
              {/* Мелкие кружки поверх крупных, чтобы не прятались под ними */}
              {[...mapped]
                .sort((a, b) => b.orders - a.orders)
                .map((place) => {
                  const [x, y] = project(RUSSIA_FRAME, place.lng, place.lat);
                  const isActive = place.city === active;
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: кружок в SVG, <button> тут не поставить
                    <circle
                      key={place.city}
                      cx={x}
                      cy={y}
                      r={radius(place.orders)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${place.city}: ${ordersLabel(place.orders)}`}
                      onMouseEnter={() => setActive(place.city)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(place.city)}
                      onBlur={() => setActive(null)}
                      onClick={() => setActive(place.city)}
                      className={`cursor-pointer stroke-primary outline-none transition-colors ${
                        isActive ? "fill-primary/70" : "fill-primary/35"
                      }`}
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                  );
                })}
            </svg>

            {hovered && hoveredAt && (
              <div
                role="status"
                className="bg-popover text-popover-foreground pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border px-3 py-2 text-xs shadow-md"
                style={{
                  left: `${(hoveredAt[0] / RUSSIA_FRAME.width) * 100}%`,
                  top: `calc(${(hoveredAt[1] / RUSSIA_FRAME.height) * 100}% - ${radius(hovered.orders) + 4}px)`,
                }}
              >
                <div className="text-sm font-medium">{hovered.city}</div>
                <div className="text-muted-foreground tabular-nums">
                  {ordersLabel(hovered.orders)} ·{" "}
                  {rubles.format(hovered.revenue)}
                </div>
              </div>
            )}

            {mapped.length === 0 && (
              <p className="text-muted-foreground absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm">
                За этот период покупок с известным городом нет
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Города</CardTitle>
          <CardDescription>
            {places.length > 0
              ? `${places.length} ${plural(places.length, "город", "города", "городов")}, больше всего заказов — сверху`
              : "Появятся после первых оплаченных заказов"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border contain-inline-size">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Город</TableHead>
                  <TableHead className="text-right">Заказов</TableHead>
                  <TableHead className="text-right">Покупателей</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {places.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground py-8 text-center"
                    >
                      Нет покупок за период
                    </TableCell>
                  </TableRow>
                )}
                {places.map((place) => (
                  <TableRow
                    key={place.city}
                    onMouseEnter={() => setActive(place.city)}
                    onMouseLeave={() => setActive(null)}
                    className={
                      active === place.city ? "bg-muted/50" : undefined
                    }
                  >
                    <TableCell className="font-medium">
                      {place.city}
                      {place.byIp > 0 && (
                        <span
                          className="text-muted-foreground ml-1 text-xs font-normal"
                          title={`Для ${place.byIp} из ${place.orders} город определён по IP при оформлении, а не по доставке`}
                        >
                          · по IP
                          {place.byIp < place.orders ? ` ${place.byIp}` : ""}
                        </span>
                      )}
                      {!place.inRussia && (
                        <span className="text-muted-foreground ml-1 text-xs font-normal">
                          · не на карте
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {place.orders}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {place.customers}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rubles.format(place.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {outside.length > 0 && (
            <p className="text-muted-foreground mt-3 text-xs">
              Города вне России в таблице есть, а на карту не ставятся.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
