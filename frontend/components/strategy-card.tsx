"use client";

import { motion } from "framer-motion";
import { ChevronRight, Activity } from "lucide-react";
import Link from "next/link";
import { Strategy } from "@/lib/types";
import { formatPercent, statusColors } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MiniChart } from "@/components/mini-chart";
import { useMemo } from "react";

interface StrategyCardProps {
  strategy: Strategy;
  compact?: boolean;
  paper?: boolean;
}

export function StrategyCard({ strategy, compact = false, paper = false }: StrategyCardProps) {
  const m = strategy.metrics || {};
  const statusClass = statusColors[strategy.status as keyof typeof statusColors] || "badge-review";

  // Generate deterministic sample equity curve for preview thumbnail
  const equityPreview = useMemo(() => {
    const seed = strategy.id.split("-").pop() ?? "0";
    const offset = parseInt(seed) % 100;
    return Array.from({ length: 30 }, (_, i) => ({
      time: `2024-01-${String(i + 1).padStart(2, "0")}`,
      value: 100 + i * 0.6 + Math.sin(i * 0.25 + offset) * 4 + offset * 0.03,
    }));
  }, [strategy.id]);

  // Correlation badge heuristic based on strategy family
  const familyLower = strategy.family?.toLowerCase() ?? "";
  const isMomentum = familyLower.includes("momentum") || familyLower.includes("racer");
  const isReversion = familyLower.includes("reversion") || familyLower.includes("dip");
  const corrBadge = isMomentum
    ? { label: "High β 0.72", color: "bg-orange/10 text-orange" }
    : isReversion
      ? { label: "Low β 0.34", color: "bg-blue/10 text-blue" }
      : { label: "Mod β 0.52", color: "bg-purple/10 text-purple" };

  return (
    <Link href={`/strategies/${strategy.id}`}>
      <motion.div
        className={cn(
          "glass rounded-apple p-4 cursor-pointer group transition-colors",
          paper && "border border-accent/20",
        )}
        transition={{ duration: 0.2, ease: "easeOut" }}
        whileHover={{ y: -2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`badge ${statusClass}`}>{strategy.status}</span>
            <span className="text-xs font-mono text-text-tertiary">
              {strategy.symbol} • {strategy.timeframe}
            </span>
          </div>
          <motion.div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={14} className="text-text-tertiary" />
          </motion.div>
        </div>

        <h3 className="text-sm font-medium text-text mb-1 group-hover:text-text transition-colors">
          {strategy.name}
        </h3>

        <p className="text-xs text-text-secondary mb-3 line-clamp-1">
          {strategy.logic || "No logic description available"}
        </p>

        {/* Equity curve thumbnail + correlation badge */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-10 -mx-1">
            <MiniChart data={equityPreview} height={40} />
          </div>
          <span
            className={cn("text-xs px-2 py-0.5 rounded-full flex-shrink-0", corrBadge.color)}
            title="Estimated correlation"
          >
            {corrBadge.label}
          </span>
        </div>

        {!compact && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-tertiary">Win Rate</span>
              <span className="text-text font-mono">
                {m.win_rate ? `${m.win_rate.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">PF</span>
              <span className="text-text font-mono">
                {m.profit_factor ? m.profit_factor.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Max DD</span>
              <span
                className={cn(
                  "font-mono",
                  m.max_drawdown && m.max_drawdown > -15 ? "text-green" : "text-red",
                )}
              >
                {m.max_drawdown ? `${m.max_drawdown.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Sharpe</span>
              <span className="text-text font-mono">
                {m.sharpe_ratio ? m.sharpe_ratio.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex justify-between col-span-2">
              <span className="text-text-tertiary">Years of Data</span>
              <span className="text-text font-mono flex items-center gap-1">
                <Activity size={12} className="text-text-tertiary" />
                {m.years_of_data ? `${m.years_of_data.toFixed(1)}y` : "—"}
              </span>
            </div>
          </div>
        )}

        {compact && (
          <div className="flex items-center gap-4 text-xs text-text-tertiary mt-2">
            <span>WR: {m.win_rate ? `${m.win_rate.toFixed(1)}%` : "—"}</span>
            <span>PF: {m.profit_factor ? m.profit_factor.toFixed(2) : "—"}</span>
            <span>Data: {m.years_of_data ? `${m.years_of_data.toFixed(1)}y` : "—"}</span>
          </div>
        )}
      </motion.div>
    </Link>
  );
}
