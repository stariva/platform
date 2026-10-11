"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { reachGoal } from "@/lib/analytics";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  goal: string;
  goalParams?: Record<string, unknown>;
};

/** Ссылка, которая отправляет цель в Яндекс Метрику — для оптимизации Директа. */
export function TrackedLink({
  goal,
  goalParams,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        reachGoal(goal, goalParams);
        onClick?.(event);
      }}
    />
  );
}
