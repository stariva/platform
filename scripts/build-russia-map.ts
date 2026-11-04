/**
 * Собирает контур России для «Карты покупок» в админке:
 *
 *   bun scripts/build-russia-map.ts [путь/к/ne_10m_admin_0_countries_rus.geojson]
 *
 * Берёт границы страны из Natural Earth (общественное достояние), версия
 * «глазами России» — с Крымом. Проецирует их той же проекцией, что и кружки
 * городов, упрощает до долей пикселя и записывает готовую SVG-линию в
 * apps/app/src/components/purchase-map/russia-outline.ts.
 */
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type MapFrame,
  projectRaw,
} from "../apps/app/src/components/purchase-map/projection";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_rus.geojson";
const OUT = new URL(
  "../apps/app/src/components/purchase-map/russia-outline.ts",
  import.meta.url,
);

const WIDTH = 1000;
const PADDING = 28;
/** Допуск упрощения контура и минимальная площадь острова — в пикселях карты. */
const TOLERANCE = 0.45;
const MIN_AREA = 3;

type Point = [number, number];
type Ring = Point[];

async function loadGeoJson() {
  const argument = process.argv[2];
  const cached = join(tmpdir(), "ne_10m_admin_0_countries_rus.geojson");
  const file = argument ?? (existsSync(cached) ? cached : undefined);
  if (file) return Bun.file(file).json();
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`Не скачалось: ${response.status}`);
  const text = await response.text();
  await Bun.write(cached, text);
  return JSON.parse(text);
}

const area = (ring: Ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i] as Point;
    const [x2, y2] = ring[(i + 1) % ring.length] as Point;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

/** Рамер–Дуглас–Пекер. */
function simplify(points: Ring, tolerance: number): Ring {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop() as [number, number];
    const [x1, y1] = points[start] as Point;
    const [x2, y2] = points[end] as Point;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    let far = -1;
    let farDistance = tolerance;
    for (let i = start + 1; i < end; i++) {
      const [x, y] = points[i] as Point;
      const distance =
        length === 0
          ? Math.hypot(x - x1, y - y1)
          : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / length;
      if (distance > farDistance) {
        far = i;
        farDistance = distance;
      }
    }
    if (far !== -1) {
      keep[far] = true;
      stack.push([start, far], [far, end]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

/** Точка внутри кольца (в градусах) — для проверки, что Крым на месте. */
function inside(ring: Ring, [x, y]: Point) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Point;
    const [xj, yj] = ring[j] as Point;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      result = !result;
    }
  }
  return result;
}

const geo = await loadGeoJson();
const russia = geo.features.find(
  (feature: { properties: Record<string, string> }) =>
    feature.properties.ADM0_A3 === "RUS",
);
if (!russia) throw new Error("Россия не найдена в файле");

const polygons: Ring[][] =
  russia.geometry.type === "Polygon"
    ? [russia.geometry.coordinates]
    : russia.geometry.coordinates;
const rings = polygons.map((polygon) => polygon[0] as Ring);

const crimea: Point = [34.1, 45.0];
if (!rings.some((ring) => inside(ring, crimea))) {
  throw new Error("В этих границах нет Крыма — нужен вариант «rus»");
}

const raw = rings.map((ring) =>
  ring.map(([lon, lat]) => projectRaw(lon as number, lat as number)),
);
const xs = raw.flat().map(([x]) => x);
const ys = raw.flat().map(([, y]) => y);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);

const scale = (WIDTH - PADDING * 2) / (maxX - minX);
const frame: MapFrame = {
  width: WIDTH,
  height: Math.ceil((maxY - minY) * scale + PADDING * 2),
  scale,
  tx: PADDING - minX * scale,
  ty: PADDING - minY * scale,
};

const fixed = (value: number) => Number(value.toFixed(1));
let kept = 0;
const path = raw
  .map((ring) =>
    ring.map(([x, y]): Point => [x * scale + frame.tx, y * scale + frame.ty]),
  )
  .filter((ring) => area(ring) >= MIN_AREA)
  .map((ring) => {
    kept += 1;
    const points = simplify(ring, TOLERANCE);
    return `M${points.map(([x, y]) => `${fixed(x)} ${fixed(y)}`).join("L")}Z`;
  })
  .join("");

const source = `// Создан scripts/build-russia-map.ts — не править руками.
// Контур: Natural Earth (общественное достояние), граница с Крымом в составе России.
import type { MapFrame } from "./projection";

export const RUSSIA_FRAME: MapFrame = ${JSON.stringify({
  width: frame.width,
  height: frame.height,
  scale: Number(frame.scale.toPrecision(10)),
  tx: Number(frame.tx.toPrecision(10)),
  ty: Number(frame.ty.toPrecision(10)),
})};

export const RUSSIA_OUTLINE =
  "${path}";
`;
await Bun.write(OUT, source);
console.log(
  `Контуров: ${kept} из ${rings.length}, ${(path.length / 1024).toFixed(1)} КБ, ${frame.width}×${frame.height}`,
);
