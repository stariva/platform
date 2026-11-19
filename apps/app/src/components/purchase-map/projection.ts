/**
 * Равновеликая коническая проекция Альберса для карты России. Параметры
 * подобраны так, чтобы страна лежала ровно, а не веером; те же формулы
 * использует `scripts/build-russia-map.ts`, который рисует контур, —
 * поэтому кружки городов ложатся точно на карту.
 */
const RAD = Math.PI / 180;

/** Центральный меридиан и параллель, стандартные параллели. */
const LON0 = 100;
const LAT0 = 54;
const LAT1 = 50;
const LAT2 = 70;

const N = (Math.sin(LAT1 * RAD) + Math.sin(LAT2 * RAD)) / 2;
const C = Math.cos(LAT1 * RAD) ** 2 + 2 * N * Math.sin(LAT1 * RAD);
const RHO0 = Math.sqrt(C - 2 * N * Math.sin(LAT0 * RAD)) / N;

/** Долгота относительно центрального меридиана в пределах −180…180 — чтобы Чукотка за 180° не улетала. */
function offsetFromCentre(lon: number) {
  let delta = lon - LON0;
  while (delta > 180) delta -= 360;
  while (delta <= -180) delta += 360;
  return delta;
}

/** Координаты точки в единицах проекции (радиус Земли = 1), ось y вниз. */
export function projectRaw(lon: number, lat: number): [number, number] {
  const rho = Math.sqrt(C - 2 * N * Math.sin(lat * RAD)) / N;
  const theta = N * offsetFromCentre(lon) * RAD;
  return [rho * Math.sin(theta), -(RHO0 - rho * Math.cos(theta))];
}

export interface MapFrame {
  width: number;
  height: number;
  scale: number;
  tx: number;
  ty: number;
}

/** Пиксели SVG для долготы и широты на карте с рамкой `frame`. */
export function project(
  frame: MapFrame,
  lon: number,
  lat: number,
): [number, number] {
  const [x, y] = projectRaw(lon, lat);
  return [x * frame.scale + frame.tx, y * frame.scale + frame.ty];
}
