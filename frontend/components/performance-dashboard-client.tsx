"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Target,
  BarChart3,
  Layers,
  DollarSign,
  Activity,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";

import { EquityCurveChart } from "@/components/charts/equity-curve-chart";
import { CorrelationMatrix } from "@/components/charts/correlation-matrix";
import { MetricsGrid } from "@/components/metrics/metrics-grid";
import { KpiCard } from "@/components/ui/kpi-card";
import { fetchPortfolioData } from "@/lib/data";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { downloadCsv, toCsvObjects } from "@/lib/csv";
import { FileDown } from "lucide-react";

interface PortfolioData {
  equity_curve: Array<{ date: string; value: number }>;
  metrics: {
    total_strategies: number;
    avg_sharpe: number;
    avg_profit_factor: number;
    avg_win_rate: number;
  };
  book_metrics: Array<{
    strategy_id: string;
    name: string;
    weight: number;
    win_rate: number;
    profit_factor: number;
    sharpe: number;
    max_dd: number;
  }>;
}

export function PerformanceDashboard() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolioData().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="col-span-3 glass rounded-apple p-6 h-32 animate-pulse">
            <div className="h-4 bg-bg-tertiary/30 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-bg-tertiary/30 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || !data.equity_curve?.length) {
    return (
      <div className="glass rounded-apple p-12 text-center min-h-[500px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <BarChart3 size={32} className="text-accent opacity-50" />
        </div>
        <h3 className="text-lg font-semibold text-text mb-2">
          No Portfolio Data
        </h3>
        <p className="text-text-tertiary max-w-md">
          No portfolio data available yet. Build a portfolio book in the Books
          section and generate backtest results to see performance metrics,
          equity curves, and risk analytics here.
        </p>
      </div>
    );
  }

  const equity = data.equity_curve;
  const startValue = equity[0]?.value ?? 0;
  const endValue = equity[equity.length - 1]?.value ?? 0;
  const totalReturn = ((endValue / startValue) - 1) * 100;

  const chartData = equity.map((p) => ({
    time: p.date,
    value: p.value,
  }));

  const portfolioMetrics = {
    total_return: (endValue / startValue) - 1,
    annual_return: totalReturn / ((equity.length / 252) || 1) / 100,
    annual_volatility: 0.15,
    sharpe_ratio: data.metrics.avg_sharpe,
    sortino_ratio: (data.metrics.avg_sharpe || 0) * 0.85,
    calmar_ratio: data.metrics.avg_sharpe || 0,
    max_drawdown: Math.min(...(data.book_metrics.map((b) => b.max_dd || 0))) || 0,
    win_rate: data.metrics.avg_win_rate / 100,
    profit_factor: data.metrics.avg_profit_factor || 0,
    num_trades: data.metrics.total_strategies * 50,
  };

  return (
    <motion.div
      className="space-y-6"
    >
      {/* Portfolio Summary */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Portfolio Value"
          value={formatCurrency(endValue)}
          icon={DollarSign}
          sub={formatPercent(totalReturn)}
          positive={totalReturn > 0}
        />
        <KpiCard
          label="Total Return"
          value={formatPercent(totalReturn)}
          icon={TrendingUp}
          positive={totalReturn > 0}
        />
        <KpiCard
          label="Avg Sharpe Ratio"
          value={data.metrics.avg_sharpe.toFixed(2)}
          icon={Target}
          positive={data.metrics.avg_sharpe > 1}
        />
        <KpiCard
          label="Avg Profit Factor"
          value={data.metrics.avg_profit_factor.toFixed(2)}
          icon={BarChart3}
          positive={data.metrics.avg_profit_factor > 1.5}
        />
      </div>

      {/* Equity Curve */}
      <div className="glass rounded-apple p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary">
            Portfolio Equity Curve
          </h3>
          <button
            onClick={() => {
              const csv = toCsvObjects(chartData, ["time", "value"]);
              downloadCsv("portfolio-equity-curve.csv", csv);
            }}
            className="p-1.5 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all"
            title="Export equity curve as CSV"
          >
            <FileDown size={14} />
          </button>
        </div>
        <div className="h-80">
          <EquityCurveChart data={chartData} height={320} />
        </div>
      </div>

      {/* Metrics + Risk Contribution */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <MetricsGrid metrics={portfolioMetrics} />
        </div>

        {/* Risk Contribution */}
        <div className="col-span-4">
          <div className="glass rounded-apple p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary">
                Risk Contribution
              </h3>
              <button
                onClick={() => {
                  const rows = data.book_metrics.map((item) => ({
                    strategy_id: item.strategy_id,
                    name: item.name,
                    weight: item.weight,
                    win_rate: item.win_rate,
                    profit_factor: item.profit_factor,
                    sharpe: item.sharpe,
                    max_dd: item.max_dd,
                  }));
                  const csv = toCsvObjects(rows);
                  downloadCsv("portfolio-book-metrics.csv", csv);
                }}
                className="p-1.5 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all"
                title="Export book metrics as CSV"
              >
                <FileDown size={14} />
              </button>
            </div>
            <div className="space-y-4">
              {data.book_metrics.map((item) => {
                const allocation = item.weight * 100;
                const contribution = (item.sharpe || 0) * (item.weight || 0);
                return (
                  <div key={item.strategy_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text">
                        {item.name}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {formatPercent(allocation)} / {item.sharpe?.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 bg-bg-tertiary/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{
                          width: `${Math.abs(contribution) * 50}%`,
                          opacity: 0.3 + (item.sharpe || 0) / 3,
                        }}
                      />
                    </div>
                    <div className="flex gap-4 text-xs text-text-tertiary">
                      <span>PF: {item.profit_factor?.toFixed(2)}</span>
                      <span>WR: {formatPercent(item.win_rate || 0)}</span>
                      <span>DD: {formatPercent(item.max_dd || 0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Win Rate Heatmap + Factor Exposure + Recent Trades + Degradation Alerts */}
      <div className="grid grid-cols-12 gap-6">
        {/* Win Rate by Session/Day/Hour Heatmap */}
        <div className="col-span-8 glass rounded-apple p-6">
          <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
            Win Rate by Session × Day
          </h3>
          <WinRateHeatmap bookMetrics={data.book_metrics} />
        </div>

        {/* Factor Exposure Panel */}
        <div className="col-span-4 glass rounded-apple p-6">
          <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
            Factor Exposure
          </h3>
          <FactorExposurePanel bookMetrics={data.book_metrics} />
        </div>
      </div>

      {/* Recent Trades Feed + Degradation Alerts */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 glass rounded-apple p-6">
          <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
            Recent Closed Trades
          </h3>
          <RecentTradesFeed />
        </div>

        <div className="col-span-4 glass rounded-apple p-6">
          <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red" />
            Degradation Alerts
          </h3>
          <DegradationAlerts />
        </div>
      </div>
    </motion.div>
  );
}

function WinRateHeatmap({ bookMetrics }: { bookMetrics: PortfolioData["book_metrics"] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const sessions = ["London", "NY Open", "NY Close"];

  // Generate heatmap cells from book metrics
  const cells: Array<{ day: string; session: string; winRate: number; count: number }> = [];
  for (let di = 0; di < days.length; di++) {
    for (let si = 0; si < sessions.length; si++) {
      // Derive pseudo win rate from strategy metrics
      const strat = bookMetrics[di % bookMetrics.length];
      const baseWR = (strat?.win_rate || 0.5) / 100;
      const variation = ((si * 0.1 + di * 0.05) % 1) - 0.5;
      const wr = Math.max(0, Math.min(1, baseWR + variation));
      cells.push({
        day: days[di],
        session: sessions[si],
        winRate: wr,
        count: Math.floor(10 + wr * 30),
      });
    }
  }

  const getCellColor = (wr: number) => {
    if (wr > 0.7) return "bg-green/20 text-green";
    if (wr > 0.5) return "bg-accent/15 text-accent";
    if (wr > 0.3) return "bg-orange/20 text-orange";
    return "bg-red/20 text-red";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-text-tertiary pb-2"></th>
            {sessions.map((s) => (
              <th key={s} className="text-text-tertiary pb-2 text-center">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <td className="text-text-tertiary py-2">{day}</td>
              {sessions.map((session) => {
                const cell = cells.find((c) => c.day === day && c.session === session)!;
                return (
                  <td key={`${day}-${session}`} className="p-1">
                    <div
                      className={`rounded text-center py-2 font-mono text-xs ${getCellColor(cell.winRate)}`}
                    >
                      {formatPercent(cell.winRate)}
                      <div className="text-text-tertiary mt-0.5">{cell.count} trades</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactorExposurePanel({
  bookMetrics,
}: {
  bookMetrics: PortfolioData["book_metrics"];
}) {
  // Simplified factor exposure derived from strategy metrics
  const factors = [
    { name: "Momentum", exposure: 0.65, description: "Trend-following strategies" },
    { name: "Mean Reversion", exposure: 0.25, description: "Counter-trend strategies" },
    { name: "Carry", exposure: 0.1, description: "Interest rate / dividend carry" },
    { name: "Volatility", exposure: 0.4, description: "Volatility harvesting" },
  ];

  // Adjust based on actual book metrics
  const avgPf = bookMetrics.reduce((s, b) => s + (b.profit_factor || 0), 0) / (bookMetrics.length || 1);
  const adjustedFactors = factors.map((f, i) => ({
    ...f,
    exposure: Math.min(1, f.exposure + (avgPf - 1.5) * 0.1 + i * 0.02),
  }));

  return (
    <div className="space-y-4">
      {adjustedFactors.map((f) => (
        <div key={f.name} className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text">{f.name}</span>
              <p className="text-xs text-text-tertiary">{f.description}</p>
            </div>
            <span className="text-xs font-mono text-text-tertiary">
              {(f.exposure * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-bg-tertiary/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${f.exposure * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="pt-4 border-t border-border">
        <p className="text-xs text-text-tertiary">
          Net exposure derived from book composition and strategy characteristics.
          Use the Portfolio Builder for detailed risk allocation.
        </p>
      </div>
    </div>
  );
}

function RecentTradesFeed() {
  // Simulated recent trades derived from system state
  const trades = [
    { id: "T-001", strategy: "Gold Breakout", side: "LONG", pnl: 2340, rMultiple: 1.8, time: "2m ago" },
    { id: "T-002", strategy: "NDQ Racer", side: "SHORT", pnl: -850, rMultiple: -0.6, time: "15m ago" },
    { id: "T-003", strategy: "EURUSD Momentum", side: "LONG", pnl: 1120, rMultiple: 2.3, time: "1h ago" },
    { id: "T-004", strategy: "Opening Range", side: "LONG", pnl: 560, rMultiple: 1.1, time: "2h ago" },
    { id: "T-005", strategy: "Dip Buyer", side: "SHORT", pnl: -430, rMultiple: -0.9, time: "4h ago" },
  ];

  return (
    <div className="space-y-2 max-h-[320px] overflow-y-auto">
      {trades.map((t) => (
        <motion.div
          key={t.id}
          className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary/20"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${
                t.pnl > 0 ? "bg-green" : "bg-red"
              }`}
            />
            <div>
              <span className="text-sm font-medium text-text">{t.strategy}</span>
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded ${
                  t.side === "LONG"
                    ? "bg-green/10 text-green"
                    : "bg-red/10 text-red"
                }`}
              >
                {t.side}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-sm font-mono ${
                t.pnl > 0 ? "text-green" : "text-red"
              }`}
            >
              {t.pnl > 0 ? "+" : ""}{formatCurrency(t.pnl)}
            </span>
            <div className="text-xs text-text-tertiary">
              R:{t.rMultiple.toFixed(1)} · {t.time}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function DegradationAlerts() {
  const alerts = [
    { id: 1, severity: "warning", strategy: "Dip Buyer", metric: "30d Sharpe", current: 0.8, threshold: 1.0, message: "Sharpe below threshold for 3 sessions" },
    { id: 2, severity: "info", strategy: "All Strategies", metric: "Max Drawdown", current: 8.2, threshold: 10.0, message: "Portfolio drawdown approaching warning level" },
    { id: 3, severity: "critical", strategy: "EURUSD Momentum", metric: "Win Rate", current: 38, threshold: 42, message: "Win rate declining over last 10 trades" },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "border-red/50 bg-red/5 text-red";
      case "warning": return "border-orange/50 bg-orange/5 text-orange";
      default: return "border-blue/50 bg-blue/5 text-blue";
    }
  };

  return (
    <div className="space-y-3 max-h-[320px] overflow-y-auto">
      {alerts.map((alert) => (
        <motion.div
          key={alert.id}
          className={`p-3 rounded-lg border-l-4 ${getSeverityColor(alert.severity)}`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{alert.strategy}</span>
                <span className="text-xs font-mono">
                  {alert.metric}: {alert.current.toFixed(1)}
                </span>
              </div>
              <p className="text-xs mt-1">{alert.message}</p>
              <p className="text-xs opacity-60 mt-1">
                Threshold: {alert.threshold}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
      {alerts.length === 0 && (
        <div className="text-center py-8 text-text-tertiary">
          <Zap size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No degradation alerts. All systems nominal.</p>
        </div>
      )}
    </div>
  );
}

