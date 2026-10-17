"use client";

import type { ElementType } from "react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ElementType;
  positive?: boolean;
  sub?: string;
  color?: string;
}

/** Shared KpiCard — consolidates the 4 local duplicates across the app.
 *  Accepts both `positive` (most callers) and `color` (live-monitor) APIs. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  positive,
  sub,
  color,
}: KpiCardProps) {
  const iconColor = color
    ? color
    : "text-accent";
  const valueColor = color
    ? color
    : positive === true
      ? "text-text"
      : positive === false
        ? "text-red"
        : "text-text";

  return (
    <div
      className="glass rounded-apple p-4"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-6 h-6 rounded-lg bg-bg-tertiary/50 flex items-center justify-center">
          <Icon size={14} className={iconColor} />
        </div>
        <span className="text-xs text-text-tertiary">{label}</span>
      </div>
      <p className={cn("text-xl font-display font-semibold", valueColor)}>
        {value}
      </p>
      {sub && (
        <p className={cn("text-xs mt-1", positive ? "text-green" : "text-red")}>
          {sub}
        </p>
      )}
    </div>
  );
}
