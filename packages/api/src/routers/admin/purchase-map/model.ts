/** Заказ с сайта, из которого берём место покупки. */
export interface PurchaseRow {
  /** Сумма в копейках. */
  amountTotal: number;
  userId: string | null;
  contactPhone: string;
  deliveryAddress: unknown;
  visitor: {
    city?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
  } | null;
}

export interface Place {
  city: string;
  lat: number;
  lng: number;
  /** Откуда город: пункт выдачи при оформлении или IP покупателя. */
  source: "delivery" | "ip";
  /** По IP покупатель из другой страны: на карте России его нет. */
  abroad?: boolean;
}

export interface PurchasePlace extends Place {
  orders: number;
  customers: number;
  /** Сумма заказов в рублях. */
  revenue: number;
  /** Сколько заказов места определено по IP, а не по доставке. */
  byIp: number;
  /** Место внутри России: остальные в таблице есть, на карте нет. */
  inRussia: boolean;
}

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const coordinate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Грубый прямоугольник вокруг России: за ним — не наша карта. */
export function insideRussia(lat: number, lng: number) {
  const east = lng < 0 ? lng + 360 : lng;
  return lat >= 41 && lat <= 82 && east >= 19 && east <= 191;
}

/**
 * Город из адреса пункта выдачи, когда сайт не сохранил locality
 * (старые заказы): «Россия, Ленинградская Область, …» → «Ленинградская
 * Область». Не город, но правильное место на карте.
 */
function areaOf(address: string | null) {
  const parts = (address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const first = parts[0]?.toLowerCase() === "россия" ? parts[1] : parts[0];
  return first ?? null;
}

/**
 * Где человек купил. Надёжнее всего пункт выдачи или адрес курьера:
 * туда поедет заказ. Если доставка согласуется вручную (изделие под заказ),
 * остаётся город по IP при оформлении. Без координат места нет.
 */
export function placeOf(row: PurchaseRow): Place | null {
  const raw = (row.deliveryAddress ?? {}) as Record<string, unknown>;
  const lat = coordinate(raw.lat);
  const lng = coordinate(raw.lng);
  const city = text(raw.locality) ?? areaOf(text(raw.address));
  if (lat !== null && lng !== null && city) {
    return { city, lat, lng, source: "delivery" };
  }

  const visitor = row.visitor;
  const visitorCity = text(visitor?.city);
  const visitorLat = coordinate(visitor?.latitude);
  const visitorLng = coordinate(visitor?.longitude);
  if (visitorCity && visitorLat !== null && visitorLng !== null) {
    return {
      city: visitorCity,
      lat: visitorLat,
      lng: visitorLng,
      source: "ip",
      abroad: !!visitor?.countryCode && visitor.countryCode !== "RU",
    };
  }
  return null;
}

const customerKey = (row: PurchaseRow) =>
  row.userId ?? row.contactPhone.replace(/\D/g, "");

/**
 * Города с числом заказов, покупателей и суммой — самые крупные первыми.
 * Один город из разных пунктов выдачи и от разных покупателей сливается
 * в одну точку по названию; координаты — середина его пунктов.
 * `unplaced` — заказы, у которых не удалось определить место.
 */
export function placesOf(rows: PurchaseRow[]) {
  const groups = new Map<
    string,
    {
      city: string;
      latSum: number;
      lngSum: number;
      points: number;
      revenue: number;
      orders: number;
      byIp: number;
      abroad: boolean;
      customers: Set<string>;
    }
  >();
  let unplaced = 0;

  for (const row of rows) {
    const place = placeOf(row);
    if (!place) {
      unplaced += 1;
      continue;
    }
    const key = place.city.toLowerCase().replaceAll("ё", "е");
    const group = groups.get(key) ?? {
      city: place.city,
      latSum: 0,
      lngSum: 0,
      points: 0,
      revenue: 0,
      orders: 0,
      byIp: 0,
      abroad: false,
      customers: new Set<string>(),
    };
    // Долготу усредняем в одной «стороне» света, чтобы Чукотка не развалилась на 180°
    group.latSum += place.lat;
    group.lngSum += place.lng < 0 ? place.lng + 360 : place.lng;
    group.points += 1;
    group.revenue += row.amountTotal;
    group.orders += 1;
    if (place.source === "ip") group.byIp += 1;
    if (place.abroad) group.abroad = true;
    group.customers.add(customerKey(row));
    groups.set(key, group);
  }

  const places: PurchasePlace[] = [...groups.values()]
    .map((group) => {
      const lat = group.latSum / group.points;
      const east = group.lngSum / group.points;
      const lng = east > 180 ? east - 360 : east;
      return {
        city: group.city,
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
        source:
          group.byIp === group.orders ? ("ip" as const) : ("delivery" as const),
        orders: group.orders,
        customers: group.customers.size,
        revenue: group.revenue / 100,
        byIp: group.byIp,
        inRussia: !group.abroad && insideRussia(lat, lng),
      };
    })
    .sort(
      (a, b) =>
        b.orders - a.orders ||
        b.revenue - a.revenue ||
        a.city.localeCompare(b.city, "ru"),
    );

  return { places, unplaced };
}
