const items = [
  "Более 500 изделий",
  "Оплата картой / СБП",
  "Индивидуальный заказ",
  "Экологичные материалы",
  "Срок изготовления 7–14 дней",
];

export function Marquee() {
  const row = [...items, ...items];
  return (
    <div className="border-y border-espresso/10 bg-parchment overflow-hidden">
      <div className="marquee-track flex whitespace-nowrap py-4">
        {row.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: marquee items are static and never reordered
          <div key={i} className="flex items-center label-caps text-taupe">
            <span className="px-8">{item}</span>
            <span className="w-1 h-1 rounded-full bg-terracotta/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
