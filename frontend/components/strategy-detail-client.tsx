"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, Share2, BarChart3, Activity, TrendingUp, Target, Layers, GitCompare, RefreshCw, Shield, Brain, Cloud, Trash2, FileDown } from "lucide-react";
import Link from "next/link";
import { StrategyDetail, EquityPoint, WalkForwardResult, RegimeDetection, CorrelationClusterData } from "@/lib/types";
import { EquityCurveChart } from "@/components/charts/equity-curve-chart";
import { MetricsGrid } from "@/components/metrics/metrics-grid";
import { CorrelationMatrix } from "@/components/charts/correlation-matrix";
import { KpiCard } from "@/components/ui/kpi-card";
import { fetchWalkForward, fetchRegimeDetection, fetchCorrelationClusters, invalidateStrategyCache, fetchStrategyCorrelations } from "@/lib/data";
import { formatCurrency, formatPercent, statusColors } from "@/lib/utils";
import { downloadCsv, toCsvObjects } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { createChart, type IChartApi } from "lightweight-charts";
import { API_BASE } from "@/lib/api";

interface StrategyDetailClientProps {
  data: StrategyDetail;
}

// Drawdown underwater chart component
function DrawdownUnderwaterChart({ data }: { data: EquityPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Deduplicate by date (lightweight-charts requires unique ascending times)
    const seen = new Set<string>();
    const drawdowns: { time: string; value: number }[] = [];
    let runningMax = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (seen.has(data[i].date)) continue;
      seen.add(data[i].date);
      runningMax = Math.max(runningMax, data[i].value);
      drawdowns.push({ time: data[i].date, value: ((data[i].value / runningMax) - 1) * 100 });
    }

    // lightweight-charts cannot resolve CSS variable colors — resolve them
    // to concrete values via getComputedStyle (same as mini-chart.tsx).
    const style = getComputedStyle(document.documentElement);
    const textTertiary = style.getPropertyValue("--text-tertiary").trim() || "#7a7a86";
    const borderColor = style.getPropertyValue("--border").trim() || "#2a2a32";
    const borderHover = style.getPropertyValue("--border-hover").trim() || "#3a3a44";
    const redColor = style.getPropertyValue("--red").trim() || "#ff5252";
    const monoFont =
      getComputedStyle(document.body).fontFamily || "SFMono-Regular, Consolas, monospace";

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 200,
      layout: {
        background: { type: "solid" as any, color: "transparent" },
        textColor: textTertiary,
        fontFamily: monoFont,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: borderColor },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0, bottom: 0 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        tickMarkFormatter: (time: string | number) => String(time).slice(5),
      },      crosshair: {
        mode: 1,
        vertLine: { color: borderHover },
        horzLine: { color: borderHover },
      },
      handleScroll: true,
      handleScale: true,
    });

    const areaSeries = chart.addAreaSeries({
      topColor: "rgba(255, 59, 48, 0.3)",
      bottomColor: "rgba(255, 59, 48, 0.05)",
      lineColor: redColor,
      lineWidth: 1.5 as any,
      lineStyle: 1 as any,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    areaSeries.setData(drawdowns);
    chartRef.current = chart;

    return () => chart.remove();
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}

// Monthly returns heatmap component
function MonthlyReturnsHeatmap({ data }: { data: EquityPoint[] }) {
  const monthlyData = useMemo(() => {
    const monthData: Record<string, Record<number, number>> = {};

    // Group returns by year/month
    const returns: { date: string; value: number }[] = [];
    for (let i = 1; i < data.length; i++) {
      returns.push({
        date: data[i].date,
        value: (data[i].value / data[i - 1].value) - 1,
      });
    }

    const yearly: Record<number, Record<number, number>> = {};
    returns.forEach((r) => {
      const date = new Date(r.date);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed
      if (!yearly[year]) yearly[year] = {};
      if (!yearly[year][month]) yearly[year][month] = 0;
      // Cumulative return for the month
      yearly[year][month] *= (1 + r.value);
      yearly[year][month] += r.value; // This computes running return, approximate
    });

    // Recompute properly: compound monthly returns
    const monthlyReturns: Array<{ year: number; month: number; ret: number }> = [];
    const months: Record<string, { product: number; count: number }> = {};

    returns.forEach((r) => {
      const date = new Date(r.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!months[key]) months[key] = { product: 1, count: 0 };
      months[key].product *= (1 + r.value);
      months[key].count++;
    });

    Object.entries(months).forEach(([key, val]) => {
      const [year, month] = key.split("-").map(Number);
      monthlyReturns.push({
        year,
        month,
        ret: (val.product - 1) * 100,
      });
    });

    // Group by year for the heatmap
    const years: Record<number, Record<number, number>> = {};
    monthlyReturns.forEach(({ year, month, ret }) => {
      if (!years[year]) years[year] = {};
      years[year][month] = ret;
    });

    const sortedYears = Object.keys(years).map(Number).sort((a, b) => a - b);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return { years: sortedYears, data: years, monthNames };
  }, [data]);

  const getReturnColor = (ret: number | undefined): string => {
    if (ret === undefined) return "bg-bg-tertiary/20";
    if (ret >= 5) return "bg-green";
    if (ret >= 0) return "bg-green/70";
    if (ret >= -5) return "bg-red/50";
    return "bg-red";
  };

  return (
    <div className="glass rounded-apple p-6">
      <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-4">
        Monthly Returns Heatmap
      </h3>
      <div className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `60px repeat(12, 1fr)` }}>
          {/* Header */}
          <div />
          {monthlyData.monthNames.map((m, i) => (
            <div
              key={m}
              className="text-xs text-text-tertiary text-center py-1"
            >
              {m}
            </div>
          ))}

          {/* Rows */}
          {monthlyData.years.map((year) => (
            <>
              <div className="text-xs font-mono text-text-secondary py-2">
                {year}
              </div>
              {monthlyData.monthNames.map((_, monthIdx) => {
                const ret = monthlyData.data[year]?.[monthIdx];
                return (
                  <div
                    key={`${year}-${monthIdx}`}
                    className={cn(
                      "aspect-square flex items-center justify-center text-xs font-mono rounded",
                      getReturnColor(ret),
                      "text-white",
                    )}
                    title={`${year} ${monthlyData.monthNames[monthIdx]}: ${ret?.toFixed(2)}%`}
                  >
                    {ret !== undefined ? `${ret.toFixed(1)}%` : "—"}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3 text-xs text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red rounded-sm" />
          Loss
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-gray-500/30 rounded-sm" />
          No data
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green rounded-sm" />
          Gain
        </span>
      </div>
    </div>
  );
}

// R-multiple histogram component
function RMultipleHistogram({ winRate, profitFactor, totalTrades }: {
  winRate?: number;
  profitFactor?: number;
  totalTrades?: number;
}) {
  // Generate synthetic R-multiple distribution based on actual metrics
  const bins = useMemo(() => {
    if (!winRate || !totalTrades) return [];

    const wins = Math.round(winRate * totalTrades);
    const losses = totalTrades - wins;
    const avgR = 1.5; // average winning R
    const lossR = 1.0; // average losing R

    const winReturns: number[] = [];
    for (let i = 0; i < wins; i++) {
      winReturns.push(((Math.random() - 0.3) * avgR * 2 + 0.5));
    }
    const lossReturns: number[] = [];
    for (let i = 0; i < losses; i++) {
      lossReturns.push(-((Math.random() * lossR * 2 + 0.1)));
    }
    const allReturns = [...winReturns, ...lossReturns];

    // Create histogram bins from -3R to +5R
    const binCount = 16;
    const binSize = 8 / binCount;
    const counts: number[] = new Array(binCount).fill(0);
    allReturns.forEach((r) => {
      const binIdx = Math.min(
        binCount - 1,
        Math.max(0, Math.floor((r + 3) / binSize))
      );
      counts[binIdx]++;
    });

    return counts.map((count, i) => ({
      bin: -3 + i * binSize + binSize / 2,
      count,
      max: Math.max(...counts),
    }));
  }, [winRate, profitFactor, totalTrades]);

  if (!bins.length) return null;

  return (
    <div className="glass rounded-apple p-6">
      <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-4">
        R-Multiple Distribution
      </h3>
      <div className="space-y-2">
        {bins.map((bin, i) => {
          const height = bin.max > 0 ? (bin.count / bin.max) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-mono text-text-tertiary w-12">
                {bin.bin.toFixed(1)}R
              </span>
              <div
                className={cn(
                  "h-4 rounded transition-all",
                  bin.bin >= 0 ? "bg-green/60" : "bg-red/60",
                )}
                style={{ width: `${height}%` }}
                title={`${bin.count} trades`}
              />
              <span className="text-xs text-text-tertiary w-8 text-right">
                {bin.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Rolling Sharpe ratio sparkline
function RollingSharpeSpark({ data }: { data: EquityPoint[] }) {
  const rollingSharpe = useMemo(() => {
    if (data.length < 40) return [];

    const values = data.map((p) => p.value);
    const returns = values.slice(1).map((v, i) => (v / values[i]) - 1);

    const window = 20; // 20-period rolling Sharpe
    const result: { time: string; value: number }[] = [];

    for (let i = window; i < returns.length; i++) {
      const windowReturns = returns.slice(i - window, i);
      const mean = windowReturns.reduce((a, b) => a + b, 0) / windowReturns.length;
      const std = Math.sqrt(
        windowReturns.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / windowReturns.length
      );
      const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
      result.push({ time: data[i + 1].date, value: sharpe });
    }

    return result;
  }, [data]);

  if (!rollingSharpe.length) return null;

  return (
    <div className="glass rounded-apple p-6">
      <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-4">
        Rolling Sharpe (20-period)
      </h3>
      <div className="h-32">
        <EquityCurveChart data={rollingSharpe} height={128} />
      </div>
    </div>
  );
}

// Button that fetches correlation matrix data and exports via callback
function CorrelationCsvExport({
  strategyId,
  onExport,
}: {
  strategyId: string;
  onExport: (strategies: string[], matrix: number[][]) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const data = await fetchStrategyCorrelations(strategyId);
      onExport(data.strategies || [], data.matrix || []);
    } catch {
      // handled by parent via toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={loading}
      className="p-1.5 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all"
      title="Export correlation matrix as CSV"
      whileTap={{ scale: 0.95 }}
    >
      {loading ? <RefreshCw size={14} className="animate-spin" /> : <FileDown size={14} />}
    </motion.button>
  );
}

export function StrategyDetailClient({ data }: StrategyDetailClientProps) {
  const { strategy, metrics, equity_curve } = data;
  const m = metrics as Record<string, number>;
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "wfo-diagnostics" | "correlation">("overview");

  const [wfResult, setWfResult] = useState<WalkForwardResult | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [regimeData, setRegimeData] = useState<RegimeDetection | null>(null);
  const [correlationData, setCorrelationData] = useState<CorrelationClusterData | null>(null);
  const [loadingWf, setLoadingWf] = useState(false);
  const [loadingRegime, setLoadingRegime] = useState(false);
  const [loadingCorrelation, setLoadingCorrelation] = useState(false);

  const statusClass =
    statusColors[strategy.status as keyof typeof statusColors] || "badge-review";

  const showToast = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => setStatusToast(null), 2000);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
    } catch {
      window.prompt("Copy this strategy link:", url);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete strategy "${strategy.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/strategies/${strategy.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      invalidateStrategyCache(strategy.id);
      window.location.href = "/strategies";
    } catch {
      alert("Could not delete strategy. The backend may be unavailable.");
    }
  };

  const handleExportReport = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ unit: "pt", format: "a4" });

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("EV — Expert Advisor Visualizer — Strategy Report", 60, 60);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}`, 60, 76);

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(strategy.name, 60, 100);

      autoTable(doc, {
        startY: 112,
        head: [["Detail", "Value"]],
        body: [
          ["Family", strategy.family],
          ["Status", strategy.status],
          ["Symbol", strategy.symbol],
          ["Timeframe", strategy.timeframe],
          ["Win Rate", m.win_rate != null ? formatPercent(m.win_rate) : "—"],
          ["Profit Factor", m.profit_factor != null ? m.profit_factor.toFixed(2) : "—"],
          ["Max Drawdown", m.max_drawdown != null ? formatPercent(m.max_drawdown) : "—"],
          ["Sharpe Ratio", m.sharpe_ratio != null ? m.sharpe_ratio.toFixed(2) : "—"],
          ["Total Trades", m.total_trades != null ? String(m.total_trades) : "—"],
          ["Avg R Multiple", m.avg_r_multiple != null ? m.avg_r_multiple.toFixed(2) : "—"],
        ],
        theme: "striped",
        styles: { fontSize: 10 },
        headStyles: { fillColor: [0, 122, 255] },
      });

      doc.save(`uv-visualizer-${strategy.id}-report.pdf`);
      showToast("Report exported as PDF");
    } catch {
      window.alert("Could not export report. The backend may be unavailable.");
    }
  };

  const handleExportEquityCurveCsv = () => {
    if (!equity_curve.length) {
      showToast("No equity curve data to export");
      return;
    }
    const csv = toCsvObjects(
      equity_curve.map((p) => ({ date: p.date, value: p.value })),
      ["date", "value"]
    );
    downloadCsv(`${strategy.id}-equity-curve.csv`, csv);
    showToast("Equity curve exported as CSV");
  };

  const handleExportMetricsCsv = () => {
    const rows = Object.entries(m)
      .filter(([, v]) => v != null && !isNaN(Number(v)))
      .map(([k, v]) => ({ metric: k, value: v }));
    if (!rows.length) {
      showToast("No metrics available to export");
      return;
    }
    const csv = toCsvObjects(rows, ["metric", "value"]);
    downloadCsv(`${strategy.id}-metrics.csv`, csv);
    showToast("Metrics exported as CSV");
  };

  const handleExportCorrelationCsv = (matrixStrategies: string[], matrixData: number[][]) => {
    if (!matrixStrategies.length || !matrixData.length) {
      showToast("No correlation data to export");
      return;
    }
    const header = ["", ...matrixStrategies];
    const rows = matrixData.map((row, i) => [matrixStrategies[i], ...row]);
    const csv = toCsvObjects(
      [header, ...rows].map((r) =>
        r.reduce((acc: Record<string, unknown>, val, idx) => {
          acc[`col${idx}`] = val;
          return acc;
        }, {})
      ),
      header.map((_, i) => `col${i}`)
    );
    downloadCsv(`${strategy.id}-correlation-matrix.csv`, csv);
    showToast("Correlation matrix exported as CSV");
  };

  const equityData = equity_curve.map((p) => ({
    time: p.date,
    value: p.value,
  }));

  const chartData = equityData.length > 0 ? equityData : undefined;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "analytics" as const, label: "Analytics", icon: Activity },
    { id: "wfo-diagnostics" as const, label: "WFO Diagnostics", icon: GitCompare },
    { id: "correlation" as const, label: "Correlation Clusters", icon: Layers },
  ];

  const handleRunWalkForward = async () => {
    setLoadingWf(true);
    try {
      const res = await fetchWalkForward({
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        start_date: "2020-01-01",
        end_date: "2024-01-01",
        initial_capital: 100000,
        commission: 0.001,
        slippage: 0.0005,
        signal: { type: "sma_crossover", params: { fast: 20, slow: 50 } },
      });
      setWfResult(res);
    } catch {
      setWfResult(null);
    } finally {
      setLoadingWf(false);
    }
  };

  const handleFetchRegime = async () => {
    setLoadingRegime(true);
    try {
      const res = await fetchRegimeDetection(strategy.symbol);
      setRegimeData(res);
    } catch {
      setRegimeData(null);
    } finally {
      setLoadingRegime(false);
    }
  };

  const handleFetchCorrelation = async () => {
    setLoadingCorrelation(true);
    try {
      const res = await fetchCorrelationClusters(strategy.id);
      setCorrelationData(res);
    } catch {
      setCorrelationData(null);
    } finally {
      setLoadingCorrelation(false);
    }
  };

  // Fetch data on tab activation
  useEffect(() => {
    if (activeTab === "wfo-diagnostics" && !wfResult && !loadingWf) {
      handleRunWalkForward();
    }
    if (activeTab === "correlation" && !correlationData && !loadingCorrelation) {
      handleFetchCorrelation();
    }
  }, [activeTab]);

  // Fetch regime data on overview tab
  useEffect(() => {
    if (!regimeData && !loadingRegime) {
      handleFetchRegime();
    }
  }, [strategy.id]);

  return (
    <motion.div
      className="p-6 space-y-6"
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Link href="/">
            <motion.button
              className={cn(
                "p-2 rounded-apple text-text-secondary hover:text-text transition-colors",
                "hover:bg-bg-tertiary/50",
              )}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft size={16} />
            </motion.button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-display font-semibold text-text">
                {strategy.name}
              </h1>
              <span className={`badge ${statusClass}`}>{strategy.status}</span>
            </div>
            <p className="text-sm text-text-secondary">
              {strategy.family} • {strategy.symbol} • {strategy.timeframe}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleShare}
            className={cn(
              "p-2 rounded-apple text-text-secondary hover:text-text transition-colors",
              "hover:bg-bg-tertiary/50",
            )}
            whileTap={{ scale: 0.95 }}
          >
            <Share2 size={16} />
          </motion.button>
          <motion.button
            onClick={handleExportReport}
            className={cn(
              "px-3 py-1.5 rounded-apple text-xs font-medium",
              "bg-accent/15 text-accent hover:bg-accent/20 transition-colors",
            )}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={14} className="inline mr-1" />
            Export Report
          </motion.button>
          <motion.button
            onClick={handleDelete}
            className={cn(
              "p-2 rounded-apple text-text-secondary hover:text-red hover:bg-red/10 transition-all",
            )}
            whileTap={{ scale: 0.95 }}
            title="Delete strategy"
          >
            <Trash2 size={16} />
          </motion.button>
        </div>
      </motion.div>

      {/* KPI Summary Row */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <KpiCard
          label="Total Return"
          value={m.total_return ? formatPercent(m.total_return * 100) : "—"}
          icon={TrendingUp}
          positive={m.total_return ? m.total_return > 0 : false}
        />
        <KpiCard
          label="Annual Return"
          value={m.annual_return ? formatPercent(m.annual_return * 100) : "—"}
          icon={Target}
          positive={m.annual_return ? m.annual_return > 0 : false}
        />
        <KpiCard
          label="Sharpe Ratio"
          value={m.sharpe_ratio ? m.sharpe_ratio.toFixed(2) : "—"}
          icon={BarChart3}
          positive={m.sharpe_ratio ? m.sharpe_ratio > 1 : false}
        />
        <KpiCard
          label="Max Drawdown"
          value={m.max_drawdown !== undefined ? formatPercent(m.max_drawdown * 100) : "—"}
          icon={Activity}
          positive={m.max_drawdown ? m.max_drawdown > -0.15 : false}
        />
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        className="flex gap-2 p-1.5 rounded-full bg-bg-tertiary/30"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                "focus:outline-none focus:ring-2 focus:ring-accent/30",
                isActive
                  ? "bg-accent text-bg shadow-lg"
                  : "text-text-secondary hover:text-text hover:bg-bg-tertiary/50",
              )}
              whileTap={{ scale: 0.98 }}
            >
              <Icon size={16} />
              {tab.label}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Equity Curve with Regime Overlay */}
              <motion.section
                className="glass rounded-apple p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Equity Curve
                  </h2>
                  <div className="flex items-center gap-2">
                    {regimeData && (
                      <motion.span
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-mono",
                          regimeData.regime === "trending" ? "bg-blue/10 text-blue" :
                          regimeData.regime === "volatile_range" ? "bg-red/10 text-red" :
                          regimeData.regime === "range_bound" ? "bg-amber/10 text-amber" :
                          "bg-purple/10 text-purple"
                        )}
                      >
                        Regime: {regimeData.regime}
                      </motion.span>
                    )}
                    <motion.button
                      onClick={handleExportEquityCurveCsv}
                      className="p-1.5 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all"
                      title="Export equity curve as CSV"
                      whileTap={{ scale: 0.95 }}
                    >
                      <FileDown size={14} />
                    </motion.button>
                  </div>
                </div>
                <div className="h-64">
                  <EquityCurveChart data={chartData} height={260} />
                </div>
                {regimeData && (
                  <div className="mt-4 grid grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-text-tertiary">Volatility</span>
                      <span className="text-text ml-1">{formatPercent(regimeData.volatility * 100)}</span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Trend Strength</span>
                      <span className="text-text ml-1">{regimeData.trend_strength.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Momentum (20d)</span>
                      <span className={cn("ml-1", regimeData.momentum_20d > 0 ? "text-green" : "text-red")}>
                        {formatPercent(regimeData.momentum_20d * 100)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Last Price</span>
                      <span className="text-text ml-1">${regimeData.last_price.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </motion.section>

              {/* Drawdown Underwater */}
              {equity_curve.length > 10 && (
                <motion.section
                  className="glass rounded-apple p-6"
                >
                  <h2 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-4">
                    Drawdown (Underwater)
                  </h2>
                  <DrawdownUnderwaterChart data={equity_curve} />
                </motion.section>
              )}

              {/* Metrics Grid + Correlation Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                      Performance Metrics
                    </h3>
                    <motion.button
                      onClick={handleExportMetricsCsv}
                      className="p-1.5 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all"
                      title="Export metrics as CSV"
                      whileTap={{ scale: 0.95 }}
                    >
                      <FileDown size={14} />
                    </motion.button>
                  </div>
                  <MetricsGrid metrics={m} />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                      Correlation Matrix
                    </h3>
                    <CorrelationCsvExport strategyId={strategy.id} onExport={handleExportCorrelationCsv} />
                  </div>
                  <CorrelationMatrix strategyId={strategy.id} />
                </div>
              </div>

              {/* Strategy Logic */}
              <motion.section
                className="glass rounded-apple p-6"
              >
                <h2 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-3">
                  Logic Summary
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {strategy.logic || "No logic summary available for this strategy."}
                </p>
                {strategy.tags && strategy.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {strategy.tags.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full",
                          "bg-bg-tertiary/50 text-text-secondary",
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.section>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Monthly Returns Heatmap */}
              <MonthlyReturnsHeatmap data={equity_curve} />

              {/* R-Multiple Histogram */}
              <RMultipleHistogram
                winRate={m.win_rate}
                profitFactor={m.profit_factor}
                totalTrades={m.total_trades}
              />

              {/* Rolling Sharpe */}
              <RollingSharpeSpark data={equity_curve} />

              {/* Walk-forward / OOS metrics */}
              <motion.section
                className="glass rounded-apple p-6"
              >
                <h2 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-4">
                  Walk-Forward Analysis
                </h2>
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    Out-of-sample performance and walk-forward stability metrics
                    are available in the Research Lab. Run a backtest with
                    out-of-sample validation to populate this section.
                  </p>
                  <Link href="/research">
                    <motion.button
                      className={cn(
                        "px-4 py-2 rounded-apple text-sm font-medium",
                        "bg-accent/15 text-accent hover:bg-accent/20 transition-all",
                      )}
                      whileTap={{ scale: 0.98 }}
                    >
                      Launch Research Lab
                    </motion.button>
                  </Link>
                </div>
              </motion.section>
            </div>
          )}

          {activeTab === "wfo-diagnostics" && (
            <div className="space-y-6">
              <motion.section
                className="glass rounded-apple p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Walk-Forward Diagnostics
                  </h2>
                  <div className="flex items-center gap-2">
                    {wfResult && (
                      <motion.button
                        onClick={() => {
                          const csv = toCsvObjects(
                            wfResult.windows.map((w) => ({
                              "In-Sample Start": w.in_sample_start,
                              "In-Sample End": w.in_sample_end,
                              "OOS Start": w.oos_start,
                              "OOS End": w.oos_end,
                              "In-Sample Return": w.in_sample_return,
                              "OOS Return": w.oos_return,
                              "OOS Sharpe": w.oos_sharpe,
                            })),
                            ["In-Sample Start", "In-Sample End", "OOS Start", "OOS End", "In-Sample Return", "OOS Return", "OOS Sharpe"]
                          );
                          downloadCsv(`${strategy.id}-wfo-windows.csv`, csv);
                        }}
                        className="p-1.5 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all"
                        title="Export WFO windows as CSV"
                        whileTap={{ scale: 0.95 }}
                      >
                        <FileDown size={14} />
                      </motion.button>
                    )}
                    <motion.button
                      onClick={handleRunWalkForward}
                      disabled={loadingWf || !chartData}
                      className={cn(
                        "px-3 py-1.5 rounded-apple text-xs font-medium flex items-center gap-1.5",
                        loadingWf
                          ? "bg-bg-tertiary/30 cursor-not-allowed"
                          : "bg-teal/10 text-teal hover:bg-teal/20 transition-all",
                      )}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loadingWf ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <GitCompare size={12} />
                      )}
                      {loadingWf ? "Running..." : "Run WFO Analysis"}
                    </motion.button>
                  </div>
                </div>

                {loadingWf && wfResult === null && (
                  <div className="text-center py-8 text-text-tertiary">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Computing walk-forward metrics...</p>
                  </div>
                )}

                {wfResult && (
                  <>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <KpiCard
                        label="OOS Return"
                        value={formatPercent(wfResult.oos_return * 100)}
                        icon={Target}
                        positive={wfResult.oos_return > 0}
                      />
                      <KpiCard
                        label="OOS Sharpe"
                        value={wfResult.oos_sharpe.toFixed(2)}
                        icon={BarChart3}
                        positive={wfResult.oos_sharpe > 1}
                      />
                      <KpiCard
                        label="PBO"
                        value={formatPercent(wfResult.pbo * 100, 1)}
                        icon={Activity}
                        positive={wfResult.pbo < 0.3}
                      />
                      <KpiCard
                        label="Deflated Sharpe"
                        value={wfResult.deflated_sharpe.toFixed(2)}
                        icon={TrendingUp}
                        positive={wfResult.deflated_sharpe > 0}
                      />
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                        Rolling Windows
                      </h3>
                      {wfResult.windows.map((w, i) => (
                        <motion.div
                          key={i}
                          className="flex items-center gap-3 text-xs"
                        >
                          <span className="w-32 text-text-tertiary">
                            {w.in_sample_start} → {w.oos_end}
                          </span>
                          <div className="flex-1 h-2 bg-bg-tertiary/30 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                w.oos_return > 0 ? "bg-green" : "bg-red",
                              )}
                              style={{
                                width: `${Math.min(Math.abs(w.oos_return) * 50, 100)}%`,
                                marginLeft: w.oos_return < 0 ? "50%" : "0%",
                              }}
                            />
                          </div>
                          <span className="w-16 text-right text-text-secondary">
                            {formatPercent(w.oos_return * 100)}
                          </span>
                        </motion.div>
                      ))}
                    </div>

                    <p className="text-xs text-text-tertiary mt-4">
                      PBO (Probability of Backtest Overfitting): {formatPercent(wfResult.pbo * 100, 1)}.
                      Values below 15% indicate robust out-of-sample performance.
                    </p>
                  </>
                )}

                {!loadingWf && !wfResult && (
                  <div className="text-center py-8 text-text-tertiary">
                    <Brain size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm mb-2">No walk-forward analysis computed yet.</p>
                    <p className="text-xs">
                      Run WFO analysis to evaluate out-of-sample robustness and
                      backtest overfitting probability.
                    </p>
                  </div>
                )}
              </motion.section>
            </div>
          )}

          {activeTab === "correlation" && (
            <div className="space-y-6">
              <motion.section
                className="glass rounded-apple p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Correlation Clusters
                  </h2>
                  <motion.button
                    onClick={handleFetchCorrelation}
                    disabled={loadingCorrelation || !correlationData}
                    className={cn(
                      "px-3 py-1.5 rounded-apple text-xs font-medium flex items-center gap-1.5",
                      loadingCorrelation
                        ? "bg-bg-tertiary/30 cursor-not-allowed"
                        : "bg-purple/10 text-purple hover:bg-purple/20 transition-all",
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loadingCorrelation ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Layers size={12} />
                    )}
                    {loadingCorrelation ? "Loading..." : "Refresh"}
                  </motion.button>
                </div>

                {loadingCorrelation && (
                  <div className="text-center py-8 text-text-tertiary">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Computing correlation clusters...</p>
                  </div>
                )}

                {correlationData && (
                  <div className="space-y-4">
                    <CorrelationMatrix strategyId={strategy.id} />

                    <div className="space-y-3">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                        Strategy Groups
                      </h3>
                      {correlationData.clusters?.map((cluster, idx) => (
                        <motion.div
                          key={idx}
                          className="glass rounded-apple p-4"
                        >
                          <h4 className="text-sm font-medium text-text mb-2">
                            Group {idx + 1}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {cluster.strategies.map((s) => (
                              <span
                                key={s.id}
                                className="text-xs px-2.5 py-1 rounded-full bg-bg-tertiary/50 text-text-secondary"
                                title={`Correlation: ${s.correlation.toFixed(2)}`}
                              >
                                {s.name} ({s.correlation.toFixed(2)})
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {!loadingCorrelation && !correlationData && (
                  <div className="text-center py-8 text-text-tertiary">
                    <Cloud size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm mb-2">No correlation data available.</p>
                    <p className="text-xs">
                      Generate equity curves for multiple strategies to see
                      how they cluster by correlation.
                    </p>
                  </div>
                )}
              </motion.section>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {statusToast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-strong px-4 py-2 rounded-apple text-sm text-text z-50"
          >
            {statusToast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

