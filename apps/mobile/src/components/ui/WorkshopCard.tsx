import type { CatalogWorkshop } from "@/lib/catalog";
import { Badge } from "@/components/ui/Primitives";

export function WorkshopCard({
  workshop,
  variant = "large",
  onOpen,
}: {
  workshop: CatalogWorkshop;
  variant?: "large" | "horizontal" | "compact";
  onOpen: () => void;
}) {
  if (variant === "large")
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative block w-full overflow-hidden rounded-[var(--radius-xl)] text-left shadow-[var(--shadow-2)]"
      >
        <img
          src={workshop.image}
          alt=""
          className="aspect-[4/5] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute inset-x-5 bottom-5 text-white">
          <span className="text-xs uppercase tracking-widest">
            {workshop.category}
          </span>
          <h3 className="mt-2 font-display text-[2.6rem] font-semibold leading-none">
            {workshop.title}
          </h3>
          <p className="mt-2 text-sm">{workshop.level}</p>
        </div>
      </button>
    );
  if (variant === "compact")
    return (
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 overflow-hidden rounded-[var(--radius-lg)] bg-surface text-left shadow-[var(--shadow-1)]"
      >
        <img
          src={workshop.image}
          alt=""
          className="aspect-[4/5] w-full object-cover"
        />
        <span className="block p-3">
          <span className="text-xs font-semibold text-accent">
            {workshop.category}
          </span>
          <strong className="mt-1 block font-display text-[1.6rem] leading-none">
            {workshop.title}
          </strong>
          <span className="mt-2 block text-xs text-muted">
            {workshop.level}
          </span>
        </span>
      </button>
    );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-32 w-full items-center gap-4 rounded-[var(--radius-lg)] bg-surface p-3 text-left shadow-[var(--shadow-1)]"
    >
      <img
        src={workshop.image}
        alt=""
        className="size-28 shrink-0 rounded-[var(--radius-md)] object-cover"
      />
      <span className="min-w-0">
        <Badge>{workshop.category}</Badge>
        <strong className="mt-2 block font-display text-[1.65rem] leading-none">
          {workshop.title}
        </strong>
        <span className="mt-2 block text-xs text-muted">{workshop.level}</span>
      </span>
    </button>
  );
}
