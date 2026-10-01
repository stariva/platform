"use client";

import {
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@stariva/ui";
import { useState } from "react";

export interface ReviewProductOption {
  id: string;
  name: string;
  ozonOfferId: string | null;
}

interface Props {
  products: ReviewProductOption[];
  selected: string[];
  disabled?: boolean;
  onChange: (productIds: string[]) => void;
}

/**
 * Выбор товаров, на карточках которых виден отзыв. Объявление на маркетплейсе
 * бывает моделью во всех цветах — тогда отмечают все её карточки.
 */
export function ReviewProductsPicker({
  products,
  selected,
  disabled,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");
  const byId = new Map(products.map((p) => [p.id, p]));
  const needle = query.trim().toLowerCase();
  const options = products.filter(
    (p) =>
      needle === "" ||
      p.name.toLowerCase().includes(needle) ||
      p.ozonOfferId?.toLowerCase().includes(needle),
  );

  const toggle = (id: string, checked: boolean) =>
    onChange(
      checked ? [...selected, id] : selected.filter((other) => other !== id),
    );

  return (
    <div className="space-y-1.5">
      {selected.length === 0 ? (
        <span className="text-muted-foreground text-xs">
          о мастерской — без товара
        </span>
      ) : (
        <ul className="space-y-0.5 text-xs">
          {selected.map((id) => (
            <li key={id}>{byId.get(id)?.name ?? "товар удалён"}</li>
          ))}
        </ul>
      )}
      <Popover>
        <PopoverTrigger
          disabled={disabled}
          render={<Button variant="outline" size="sm" />}
        >
          {selected.length === 0 ? "Привязать" : "Изменить"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-96 p-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название или артикул"
            aria-label="Поиск товара"
            className="mb-2"
          />
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {options.length === 0 && (
              <p className="text-muted-foreground px-2 py-4 text-center text-sm">
                Ничего не нашлось
              </p>
            )}
            {options.map((product) => (
              // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox из Base UI — контрол внутри label
              <label
                key={product.id}
                className="hover:bg-muted flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm"
              >
                <Checkbox
                  checked={selected.includes(product.id)}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggle(product.id, checked)}
                  className="mt-0.5"
                />
                <span>
                  {product.name}
                  {product.ozonOfferId && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {product.ozonOfferId}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
