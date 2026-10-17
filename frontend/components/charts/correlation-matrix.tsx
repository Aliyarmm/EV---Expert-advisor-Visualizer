"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { fetchStrategyCorrelations } from "@/lib/data";
import { cn } from "@/lib/utils";

interface CorrelationMatrixProps {
  strategyId: string;
}

export function CorrelationMatrix({ strategyId }: CorrelationMatrixProps) {
  const [strategies, setStrategies] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetIdx = 0;

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchStrategyCorrelations(strategyId)
      .then((data: { strategies: string[]; matrix: number[][] }) => {
        setStrategies(data.strategies || []);
        setMatrix(data.matrix || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load correlation data:", err);
        setError("Failed to load correlation data");
        setLoading(false);
      });
  }, [strategyId]);

  const getCorrelationColor = (val: number): string => {
    if (val >= 0.7) return "bg-green";
    if (val >= 0.3) return "bg-green/60";
    if (val >= -0.3) return "bg-gray-500/30";
    if (val >= -0.7) return "bg-red/60";
    return "bg-red";
  };

  if (loading) {
    return (
      <div className="glass rounded-apple p-6">
        <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
          Correlation Matrix
        </h3>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-bg-tertiary/30 rounded w-3/4 mb-3" />
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(8, 1fr)` }}>
            {Array.from({ length: 72 }).map((_, i) => (
              <div key={i} className="aspect-square bg-bg-tertiary/20 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-apple p-6">
        <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
          Correlation Matrix
        </h3>
        <div className="flex items-center gap-2 text-text-tertiary">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!strategies.length || !matrix.length) {
    return (
      <div className="glass rounded-apple p-6">
        <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
          Correlation Matrix
        </h3>
        <p className="text-sm text-text-tertiary">
          No correlation data available. Generate equity curves for multiple
          strategies to see how they relate to each other.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="glass rounded-apple p-6"
    >
      <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
        Correlation Matrix
      </h3>

      <div className="overflow-x-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `60px repeat(${strategies.length}, 1fr)`,
          }}
        >
          {/* Header row */}
          <div />
          {strategies.map((name, j) => {
            const isTarget = j === targetIdx;
            return (
              <div
                key={`h-${j}`}
                className={cn(
                  "text-xs font-mono text-text-tertiary text-center",
                  "transition-all",
                  isTarget && "text-accent font-semibold"
                )}
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
                title={name}
              >
                {name.split(" ")[0]}
              </div>
            );
          })}

          {/* Matrix rows */}
          {matrix.map((row, i) => {
            const isTargetRow = i === targetIdx;
            return (
              <>
                <div
                  key={`l-${i}`}
                  className={cn(
                    "text-xs font-mono text-text-secondary py-1",
                    "transition-all",
                    isTargetRow && "text-accent font-semibold"
                  )}
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    height: "auto",
                  }}
                  title={strategies[i]}
                >
                  {strategies[i].split(" ")[0]}
                </div>
                {row.map((val, j) => {
                  const isTarget = i === targetIdx || j === targetIdx;
                  return (
                    <motion.div
                      key={`c-${i}-${j}`}
                      className={cn(
                        "aspect-square flex items-center justify-center text-xs font-mono",
                        getCorrelationColor(val),
                        "text-white transition-all",
                        isTarget && "ring-2 ring-offset-2 ring-offset-bg ring-accent",
                      )}
                      title={`${strategies[i]} vs ${strategies[j]}: ${val.toFixed(2)}`}
                    >
                      {val.toFixed(2)}
                    </motion.div>
                  );
                })}
              </>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 text-xs text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red rounded-sm" />
          Strong negative (−1.0)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-gray-500/30 rounded-sm" />
          Neutral (0.0)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green rounded-sm" />
          Strong positive (1.0)
        </span>
      </div>
    </motion.div>
  );
}
