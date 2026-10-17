"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TrendingUp, BarChart3, Target, Clock, ExternalLink } from "lucide-react";
import { StrategyCard } from "@/components/strategy-card";
import { KpiTile } from "@/components/kpi-tile";
import { MiniChart } from "@/components/mini-chart";
import { Strategy, OverviewMetrics } from "@/lib/types";
import { formatCurrency, formatPercent, formatNumber, statusColors } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface HomeClientProps {
  data: {
    strategies: Strategy[];
    metrics: OverviewMetrics;
  };
}

const container = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export function HomeClient({ data }: HomeClientProps) {
  const { strategies, metrics } = data;
  const router = useRouter();

  const liveStrategies = strategies.filter((s) => s.status === "Live");
  const paperStrategies = strategies.filter((s) => s.status === "Paper");

  return (
    <motion.div
      className="p-6 space-y-8"
      variants={container}
      initial="initial"
      animate="animate"
    >
      {/* Portfolio Summary Header */}
      <motion.section variants={item}>
        <div className="glass rounded-apple p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-text-secondary">
              Current Portfolio
            </h2>
            <span className="text-xs font-mono text-text-tertiary">
              Core Portfolio
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-2xl font-display font-semibold text-text">
                {formatCurrency(metrics.portfolioEquity)}
              </p>
              <p className={cn(
                "text-sm mt-1",
                metrics.portfolioReturn >= 0 ? "text-green" : "text-red"
              )}>
                {formatPercent(metrics.portfolioReturn)} total return
              </p>
            </div>
            <div className="md:col-span-2">
              <MiniChart />
            </div>
          </div>
        </div>
      </motion.section>

      {/* KPI Grid */}
      <motion.section variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile
          title="Total Strategies"
          value={formatNumber(metrics.totalStrategies, 0)}
          icon={<BarChart3 size={16} />}
          subtitle={`${metrics.liveCount} live, ${metrics.paperCount} paper`}
        />
        <KpiTile
          title="Avg Win Rate"
          value={formatPercent(metrics.avgWinRate)}
          icon={<Target size={16} />}
          trend="neutral"
          subtitle="Across all strategies"
        />
        <KpiTile
          title="Avg Profit Factor"
          value={metrics.avgProfitFactor.toFixed(2)}
          icon={<TrendingUp size={16} />}
          trend={metrics.avgProfitFactor > 1 ? "up" : "down"}
          subtitle="Risk-adjusted"
        />
        <KpiTile
          title="Avg Sharpe Ratio"
          value={metrics.avgSharpe.toFixed(2)}
          icon={<Clock size={16} />}
          trend={metrics.avgSharpe > 1 ? "up" : "down"}
          subtitle="Annualized"
        />
      </motion.section>

      {/* Strategy Library */}
      <motion.section variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-secondary">
            Strategy Library
          </h3>
          <motion.button
            onClick={() => router.push("/strategies")}
            className={cn(
              "px-3 py-1.5 rounded-apple text-xs font-medium",
              "bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
            )}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            View All
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>
      </motion.section>

      {/* Live Strategies Section */}
      <motion.section variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-secondary">
            Live Strategies ({liveStrategies.length})
          </h3>
          <motion.button
            onClick={() => router.push("/live")}
            className={cn(
              "px-3 py-1.5 rounded-apple text-xs font-medium",
              "bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
            )}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            Manage Live →
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveStrategies.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} compact={true} />
          ))}
        </div>
      </motion.section>

      {/* Paper Trading Section */}
      {paperStrategies.length > 0 && (
        <motion.section variants={item}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-secondary">
              Paper Trading ({paperStrategies.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paperStrategies.map((strategy) => (
              <StrategyCard key={strategy.id} strategy={strategy} paper={true} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Recent Trades Feed placeholder */}
      <motion.section variants={item}>
        <div className="glass rounded-apple p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Recent Closed Trades
          </h3>
          <div className="space-y-2">
            {strategies.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs font-mono px-2 py-0.5 rounded",
                      s.metrics?.avg_r_multiple && s.metrics.avg_r_multiple > 1
                        ? "bg-green/15 text-green"
                        : "bg-red/15 text-red"
                    )}
                  >
                    {s.metrics?.avg_r_multiple
                      ? `${s.metrics.avg_r_multiple.toFixed(1)}R`
                      : "—R"}
                  </span>
                  <span className="text-sm text-text">{s.name}</span>
                  <span className="text-xs text-text-tertiary">{s.symbol}</span>
                </div>
                <span className="text-xs text-text-secondary">
                  {new Date(s.created_at || s.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
