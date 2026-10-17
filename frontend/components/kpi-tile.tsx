"use client";

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "neutral";

interface KpiTileProps {
  title: string;
  value: string;
  icon?: ReactNode;
  trend?: Trend;
  subtitle?: string;
}

const trendIcons = {
  up: <TrendingUp size={14} className="text-green" />,
  down: <TrendingDown size={14} className="text-red" />,
  neutral: <Minus size={14} className="text-text-tertiary" />,
};

const trendColors = {
  up: "text-green",
  down: "text-red",
  neutral: "text-text-tertiary",
};

export function KpiTile({ title, value, icon, trend = "neutral", subtitle }: KpiTileProps) {
  return (
    <div
      className="glass rounded-apple p-4"
    >
      <div className="flex items-center gap-2 text-text-secondary mb-2">
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn("text-2xl font-display font-semibold", trendColors[trend])}
        >
          {value}
        </span>
        <div>
          {trendIcons[trend]}
        </div>
      </div>
      {subtitle && (
        <p
          className="text-xs text-text-tertiary mt-1"
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
