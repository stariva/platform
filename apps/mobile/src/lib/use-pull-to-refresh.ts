import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

/** Сколько потянуть вниз, чтобы обновление запустилось. */
const TRIGGER_PX = 72;

export interface PullToRefresh {
  /** Состояние для индикатора: на сколько пикселей вытянут контент. */
  pull: number;
  /** Идёт обновление. */
  refreshing: boolean;
}

/**
 * Pull-to-refresh для скроллящегося контейнера. Слушает касания напрямую
 * (React-обработчики здесь не подходят: нужен touchmove на контейнере).
 * preventDefault не требуется: вверху списка тянуть вниз некуда, а цепочка
 * overscroll обрезана `overscroll-behavior-y: contain`.
 *
 * Обновление — инвалидация всех запросов react-query: экраны сами перечитают
 * то, что показывают.
 */
export function usePullToRefresh(container: HTMLElement | null): PullToRefresh {
  const queryClient = useQueryClient();
  const pullDistance = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!container) return;

    let startY = 0;
    let tracking = false;

    const onTouchStart = (event: TouchEvent) => {
      if (container.scrollTop > 0 || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      startY = touch.clientY;
      pullDistance.current = 0;
      tracking = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      const touch = event.touches[0];
      if (!touch) return;
      // Дистанция с сопротивлением: дальше тянуть всё тяжелее
      const distance = Math.max(0, touch.clientY - startY);
      pullDistance.current = Math.min(distance * 0.5, TRIGGER_PX * 1.5);
      setPull(pullDistance.current);
    };

    const finish = () => {
      if (!tracking) return;
      tracking = false;
      if (pullDistance.current >= TRIGGER_PX * 0.9) {
        setRefreshing(true);
        void queryClient.invalidateQueries().finally(() => {
          setRefreshing(false);
        });
      }
      pullDistance.current = 0;
      setPull(0);
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", finish, { passive: true });
    container.addEventListener("touchcancel", finish, { passive: true });
    return () => {
      if (tracking) setPull(0);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", finish);
      container.removeEventListener("touchcancel", finish);
    };
  }, [container, queryClient]);

  return { pull, refreshing };
}
