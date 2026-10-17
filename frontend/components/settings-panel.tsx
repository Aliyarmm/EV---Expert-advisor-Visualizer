"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Upload,
  Download,
  Trash2,
  Save,
  FileText,
  FileImage,
  Bell,
  Shield,
  Moon,
  Activity,
  TrendingUp,
  Check,
  AlertTriangle,
  RefreshCw,
  FileDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { downloadCsv, toCsvObjects } from "@/lib/csv";
import { API_BASE } from "@/lib/api";

interface DataFile {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  rows: number;
  lastModified: string;
  size: string;
}

interface RiskSetting {
  id: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  unit: string;
}

// Build properly URL-encoded export URL
function buildExportUrl(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "object" && value !== null) {
      searchParams.append(key, JSON.stringify(value));
    } else {
      searchParams.append(key, String(value));
    }
  });
  return `${API_BASE}/backtest/export?${searchParams.toString()}`;
}

const DEFAULT_BACKTEST_PARAMS = {
  symbol: "SPY",
  timeframe: "D1",
  start_date: "2020-01-01",
  end_date: "2024-01-01",
  initial_capital: 100000,
  commission: 0.001,
  slippage: 0.0005,
  signal_type: "sma_crossover",
  signal_params: { fast: 20, slow: 50 },
};

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<"data" | "cleaning" | "risk" | "export">("data");
  const [collapseDataFiles, setCollapseDataFiles] = useState(false);
  const [collapseColumnMapping, setCollapseColumnMapping] = useState(false);
  const [collapseOutlier, setCollapseOutlier] = useState(false);
  const [collapseNotif, setCollapseNotif] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [outlierThreshold, setOutlierThreshold] = useState(3.0);
  const [dataVersions, setDataVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Fetch data files and versions on mount
  useEffect(() => {
    fetch(`${API_BASE}/data/files`)
      .then((r) => r.json())
      .then((data) => {
        const files = data.files || data || [];
        setDataFiles(files);
        setDataVersions(files);
      })
      .catch(() => {});
  }, []);

  const handleExport = async (type: string) => {
    setExporting(true);
    try {
      const url = buildExportUrl(DEFAULT_BACKTEST_PARAMS);

      switch (type) {
        case "pdf": {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const data = await res.json();

          const { default: jsPDF } = await import("jspdf");
          const { default: autoTable } = await import("jspdf-autotable");
          const doc = new jsPDF({ unit: "pt", format: "a4" });

          doc.setFontSize(20);
          doc.setFont("helvetica", "bold");
          doc.text("EA Index — Trading Performance Report", 59, 59);
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}`, 59, 75);

          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "bold");
          doc.text("Strategy Details", 59, 105);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const details = [
            ["Symbol", data.symbol],
            ["Timeframe", data.timeframe],
            ["Period", `${data.data.config.start_date} → ${data.data.config.end_date}`],
            ["Initial Capital", `$${data.data.config.initial_capital.toLocaleString()}`],
          ];
          let y = 120;
          details.forEach(([k, v]) => {
            doc.text(`${k}: ${v}`, 59, y);
            y += 15;
          });

          doc.setFont("helvetica", "bold");
          doc.text("Market Regime", 59, y + 10);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          y += 25;
          const regime = [
            ["Regime", data.data.regime.regime],
            ["Volatility (Annual)", `${(data.data.regime.volatility * 100).toFixed(2)}%`],
            ["Trend Strength", data.data.regime.trend_strength.toFixed(3)],
          ];
          regime.forEach(([k, v]) => {
            doc.text(`${k}: ${v}`, 59, y);
            y += 15;
          });

          doc.setFont("helvetica", "bold");
          doc.text("Performance Metrics", 59, y + 10);
          doc.setFont("helvetica", "normal");
          y += 30;
          autoTable(doc, {
            startY: y,
            head: [["Metric", "Value"]],
            body: [
              ["Total Return", `${(data.data.metrics.total_return * 100).toFixed(2)}%`],
              ["Annual Return", `${(data.data.metrics.annual_return * 100).toFixed(2)}%`],
              ["Sharpe Ratio", data.data.metrics.sharpe_ratio.toFixed(3)],
              ["Sortino Ratio", data.data.metrics.sortino_ratio.toFixed(3)],
              ["Calmar Ratio", data.data.metrics.calmar_ratio.toFixed(3)],
              ["Max Drawdown", `${(data.data.metrics.max_drawdown * 100).toFixed(2)}%`],
              ["Win Rate", `${(data.data.metrics.win_rate * 100).toFixed(1)}%`],
              ["Profit Factor", data.data.metrics.profit_factor.toFixed(3)],
              ["Total Trades", data.data.metrics.num_trades.toString()],
            ],
            theme: "grid",
            styles: { fontSize: 9 },
            headStyles: { fillColor: [100, 100, 100] },
          });

          const pdfBlob = doc.output("blob");
          const downloadUrl = URL.createObjectURL(pdfBlob);
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `ea-index-report-${data.symbol}.pdf`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
          break;
        }
        case "csv": {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const data = await res.json();
          const csv = [
            "date,value,total_return,annual_return,sharpe_ratio,max_drawdown,win_rate",
            ...data.data.equity_curve.map((p: any) =>
              `${p.date},${p.value},${data.data.metrics.total_return},${data.data.metrics.annual_return},${data.data.metrics.sharpe_ratio},${data.data.metrics.max_drawdown},${data.data.metrics.win_rate}`
            ),
          ].join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `ea-index-export-${data.symbol}.csv`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
          break;
        }
        case "png": {
          // Capture the dashboard view as PNG via html2canvas
          try {
            const { default: html2canvas } = await import("html2canvas");
            const dashboard = document.querySelector("main") || document.body;
            const canvas = await html2canvas(dashboard, {
              backgroundColor: "#00000000",
              scale: 2,
              logging: false,
            });
            canvas.toBlob((blob) => {
              if (!blob) return;
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `ea-index-dashboard-${new Date().toISOString().slice(0, 10)}.png`;
              a.click();
              URL.revokeObjectURL(url);
            });
          } catch {
            alert("PNG export requires html2canvas. Please install it: npm install html2canvas");
          }
          break;
        }
        case "trades": {
          // Export trade history CSV from backtest API
          const btRes = await fetch(`${API_BASE}/backtest/export?${new URLSearchParams(
            Object.entries(DEFAULT_BACKTEST_PARAMS).reduce((acc: Record<string, string>, [k, v]) => {
              acc[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
              return acc;
            }, {})
          )}`);
          if (!btRes.ok) throw new Error(`API error: ${btRes.status}`);
          const btData = await btRes.json();
          const csv = [
            "date,value,total_return,annual_return,sharpe_ratio,max_drawdown,win_rate",
            ...(btData.data?.equity_curve || []).map((p: any) =>
              `${p.date},${p.value},${btData.data.metrics.total_return},${btData.data.metrics.annual_return},${btData.data.metrics.sharpe_ratio},${btData.data.metrics.max_drawdown},${btData.data.metrics.win_rate}`
            ),
          ].join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `ea-index-trades-${btData.symbol}.csv`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
          break;
        }
        case "html": {
          const url = buildExportUrl(DEFAULT_BACKTEST_PARAMS);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const data = await res.json();
          const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>EA Index Report</title>
<style>
body { font-family: -apple-system, sans-serif; margin: 40px; background: #0a0a0a; color: #e0e0e0; }
h1 { color: #00aaff; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #333; padding: 6px 12px; text-align: left; }
th { background: #222; }
.positive { color: #4ade80; }
.negative { color: #f87171; }
</style></head><body>
<h1>EA Index — Trading Performance Report</h1>
<p><strong>Symbol:</strong> ${data.symbol} | <strong>Timeframe:</strong> ${data.timeframe}</p>
<p><strong>Period:</strong> ${data.data.config.start_date} → ${data.data.config.end_date}</p>
<h2>Performance Metrics</h2>
<table><tr><th>Metric</th><th>Value</th></tr>
${Object.entries(data.data.metrics).map(([k, v]: [string, any]) =>
  `<tr><td>${k}</td><td>${typeof v === 'number' ? v.toFixed(4) : v}</td></tr>`
).join("")}
</table>
<h2>Market Regime</h2>
<p>Regime: <strong>${data.data.regime.regime}</strong> | Volatility: ${data.data.regime.volatility.toFixed(2)}</p>
<h2>Equity Curve</h2>
<pre>${JSON.stringify(data.data.equity_curve, null, 2).slice(0, 2000)}...</pre>
</body></html>`;
          const blob = new Blob([htmlContent], { type: "text/html" });
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `ea-index-report-${data.symbol}.html`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
          break;
        }
        default:
          break;
      }
    } catch (e) {
      console.error("Export error:", e);
      alert("Export failed. Check console for details.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPerformanceCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      // Export equity curve
      const equityCurve = data.equity_curve || [];
      if (equityCurve.length > 0) {
        const equityCsv = toCsvObjects(
          equityCurve.map((p: { date: string; value: number }) => ({
            date: p.date,
            value: p.value,
          })),
          ["date", "value"]
        );
        downloadCsv("performance-equity-curve.csv", equityCsv);
      }

      // Export metrics
      const metrics = data.metrics || {};
      const metricRows = Object.entries(metrics)
        .filter(([, v]) => v != null && !isNaN(Number(v)))
        .map(([k, v]) => ({ metric: k, value: v }));
      if (metricRows.length > 0) {
        const metricsCsv = toCsvObjects(metricRows, ["metric", "value"]);
        downloadCsv("performance-metrics.csv", metricsCsv);
      }

      // Export book metrics
      const bookMetrics = data.book_metrics || [];
      if (bookMetrics.length > 0) {
        const bookCsv = toCsvObjects(
          bookMetrics.map((item: any) => ({
            strategy_id: item.strategy_id,
            name: item.name,
            weight: item.weight,
            win_rate: item.win_rate,
            profit_factor: item.profit_factor,
            sharpe: item.sharpe,
            max_dd: item.max_dd,
          })),
          ["strategy_id", "name", "weight", "win_rate", "profit_factor", "sharpe", "max_dd"]
        );
        downloadCsv("performance-book-metrics.csv", bookCsv);
      }

      showToast("Performance data exported as CSV");
    } catch {
      alert("Performance CSV export failed. Check that the backend is running.");
    } finally {
      setExporting(false);
    }
  };

  const showToast = (msg: string) => {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 glass-strong px-4 py-2 rounded-apple text-sm text-text z-50";
    document.body.appendChild(el);
    window.setTimeout(() => document.body.removeChild(el), 2000);
  };

  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);

  const [riskSaved, setRiskSaved] = useState(false);
  const [riskSettings, setRiskSettings] = useState<RiskSetting[]>([
    {
      id: "max_risk_per_trade",
      label: "Max Risk Per Trade",
      description: "Maximum capital at risk on a single trade",
      value: 2.0,
      min: 0.1,
      max: 10,
      unit: "%",
    },
    {
      id: "max_portfolio_heat",
      label: "Max Portfolio Heat",
      description: "Maximum simultaneous exposure across all positions",
      value: 50.0,
      min: 10,
      max: 200,
      unit: "%",
    },
    {
      id: "max_strategies_per_book",
      label: "Max Strategies Per Book",
      description: "Cap on strategies in a single portfolio book",
      value: 8,
      min: 1,
      max: 20,
      unit: "",
    },
    {
      id: "correlation_threshold",
      label: "Correlation Threshold",
      description: "Minimum correlation for portfolio overlap warning",
      value: 0.7,
      min: 0,
      max: 1,
      unit: "",
    },
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ea-index-risk-settings");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, number>;
        setRiskSettings((prev) =>
          prev.map((s) =>
            parsed[s.id] != null ? { ...s, value: parsed[s.id] } : s,
          ),
        );
      }
    } catch {
      // corrupted storage — fall back to defaults
    }
  }, []);

  const updateRiskSetting = (id: string, value: number) => {
    setRiskSettings(
      riskSettings.map((s) => (s.id === id ? { ...s, value } : s)),
    );
  };

  const saveRiskSettings = () => {
    try {
      const values: Record<string, number> = {};
      riskSettings.forEach((s) => {
        values[s.id] = s.value;
      });
      localStorage.setItem("ea-index-risk-settings", JSON.stringify(values));
      setRiskSaved(true);
      window.setTimeout(() => setRiskSaved(false), 2000);
    } catch {
      // storage unavailable — ignore
    }
  };

  const removeDataFile = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/data/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      // Remove from both lists — match by id OR by filename name field,
      // since dataVersions entries may use "name" or "filename" as their identifier.
      setDataFiles((prev) => prev.filter((f) => {
        if (f.id === id) return false;
        // also match name-based ids from the API
        const nameId = f.name?.split(".")[0];
        return nameId !== id;
      }));
      setDataVersions((prev) => prev.filter((v) => {
        if (v.id === id) return false;
        if (v.name === id) return false;
        if (v.filename === id) return false;
        const nameId = v.name?.split(".")[0];
        const fileId = v.filename?.split(".")[0];
        return nameId !== id && fileId !== id;
      }));
      showToast("Data file removed");
    } catch {
      showToast("Could not remove file");
    }
  };

  const tabs = [
    { id: "data", label: "Data Management", icon: Database },
    { id: "cleaning", label: "Data Cleaning", icon: RefreshCw },
    { id: "risk", label: "Risk Settings", icon: Shield },
    { id: "export", label: "Export", icon: Download },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus("idle");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/data/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const result = await res.json();

      // Parse detected columns from response
      const cols = result.columns || ["open", "high", "low", "close", "volume"];
      setDetectedColumns(cols);
      setColumnMapping({});
      setUploadStatus("success");

      // Refresh data versions
      const filesRes = await fetch(`${API_BASE}/data/files`);
      if (filesRes.ok) {
        const data = await filesRes.json();
        setDataVersions(data.files || data || []);
      }
    } catch {
      setUploadStatus("error");
    } finally {
      setUploading(false);
    }
  };

  const handleColumnMapping = (stdCol: string, actualCol: string) => {
    setColumnMapping((prev) => ({ ...prev, [stdCol]: actualCol }));
  };

  const handleCleanData = async () => {
    if (!detectedColumns.length) return;
    try {
      const fileId = dataVersions[0]?.id || dataVersions[0]?.name?.split(".")[0];
      if (!fileId) return;

      const res = await fetch(`${API_BASE}/data/clean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: fileId,
          column_mapping: columnMapping,
          outlier_threshold: outlierThreshold,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const result = await res.json();

      // Update data versions with cleaned status
      setDataVersions(dataVersions.map((v) => ({
        ...v,
        cleaned: true,
        outliers_removed: result.outliers_detected
          ? Object.values(result.outliers_detected).reduce(
              (sum: number, info: any) => sum + (info?.count || 0), 0
            )
          : 0,
      })));

      setUploadStatus(result.outliers_detected ? "success" : "idle");
    } catch (e) {
      console.error("Cleaning error:", e);
      setUploadStatus("error");
    }
  };

  return (
    <motion.div
      className="space-y-6"
    >
      {/* Tab Navigation — Apple segmented control style */}
      <motion.div
        className="flex gap-2 p-1.5 rounded-full bg-bg-tertiary/30"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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
          {activeTab === "data" && (
            <div className="space-y-6">
              {/* Upload */}
              <motion.div
                className="glass rounded-apple p-6 border-2 border-dashed border-border hover:border-border-hover transition-all"
              >
                <div className="text-center">
                  <motion.div
                    className="text-text-tertiary mx-auto mb-3"
                  >
                    <Upload size={32} className="text-text-tertiary mx-auto mb-3" />
                  </motion.div>
                  <p className="text-sm text-text-secondary mb-1">
                    Drop CSV or Parquet files here to upload
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Supported: .csv, .parquet • Max 50MB per file
                  </p>
                </div>
              </motion.div>

              {/* Data Files — collapsible */}
              <div className="glass rounded-apple overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Data Files
                  </h3>
                  <motion.button
                    onClick={() => setCollapseDataFiles(!collapseDataFiles)}
                    className={cn(
                      "p-1 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all",
                    )}
                    whileTap={{ scale: 0.9 }}
                  >
                    {collapseDataFiles ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {!collapseDataFiles && (
                    <motion.div
                      key="data-files-table"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/30">
                            <th className="text-left py-3 px-4 text-xs text-text-tertiary">Name</th>
                            <th className="text-left py-3 px-4 text-xs text-text-tertiary">Symbol</th>
                            <th className="text-left py-3 px-4 text-xs text-text-tertiary">TF</th>
                            <th className="text-right py-3 px-4 text-xs text-text-tertiary">Rows</th>
                            <th className="text-right py-3 px-4 text-xs text-text-tertiary">Size</th>
                            <th className="text-right py-3 px-4 text-xs text-text-tertiary">Modified</th>
                            <th className="py-3 px-4" />
                          </tr>
                        </thead>
                        <tbody>
                          {dataFiles.map((file) => (
                            <motion.tr
                              key={file.id}
                              className="border-b border-border/20 hover:bg-bg-tertiary/20 transition-colors"
                            >
                              <td className="py-3 px-4 text-sm text-text">{file.name}</td>
                              <td className="py-3 px-4 text-sm text-text-tertiary">{file.symbol}</td>
                              <td className="py-3 px-4 text-sm text-text-tertiary">{file.timeframe}</td>
                              <td className="py-3 px-4 text-right text-sm text-text-tertiary">{file.rows.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right text-sm text-text-tertiary">{file.size}</td>
                              <td className="py-3 px-4 text-right text-sm text-text-tertiary">{file.lastModified}</td>
                              <td className="py-3 px-4">
                                <motion.button
                                  onClick={() => removeDataFile(file.id)}
                                  className="p-1 rounded-apple hover:bg-red/10 hover:text-red transition-all"
                                  whileTap={{ scale: 0.95 }}
                                  title="Delete data file"
                                >
                                  <Trash2 size={14} />
                                </motion.button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Upload Area with file input */}
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.parquet"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <motion.div
                  className={cn(
                    "border-2 border-dashed rounded-apple p-4 text-center transition-all",
                    uploading
                      ? "border-accent/50 bg-accent/5"
                      : "border-border hover:border-border-hover",
                  )}
                >
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-text">
                      <RefreshCw size={16} className="animate-spin" />
                      Uploading…
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      Or click to select a file
                    </p>
                  )}
                </motion.div>
              </div>

              {uploadStatus === "success" && (
                <motion.div
                  className="flex items-center gap-2 p-3 rounded-apple bg-green/10 text-green text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Check size={14} />
                  File uploaded successfully!
                </motion.div>
              )}
              {uploadStatus === "error" && (
                <motion.div
                  className="flex items-center gap-2 p-3 rounded-apple bg-red/10 text-red text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <AlertTriangle size={14} />
                  Upload failed. Please try again.
                </motion.div>
              )}
            </div>
          )}

          {activeTab === "cleaning" && (
            <div className="space-y-6">
              {/* Column Mapping */}
              {detectedColumns.length > 0 && (
                <div className="glass rounded-apple p-6">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-4">
                    Column Mapping
                  </h3>
                  <p className="text-xs text-text-secondary mb-4">
                    Detected columns: {detectedColumns.join(", ")}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {["open", "high", "low", "close", "volume"].map((stdCol) => {
                      const match = detectedColumns.find(
                        (c) => c.toLowerCase().includes(stdCol) || columnMapping[stdCol]
                      );
                      const mappedCol = columnMapping[stdCol] || match || stdCol;
                      return (
                        <div key={stdCol} className="flex items-center gap-2">
                          <span className="text-xs text-text-tertiary w-16">{stdCol}:</span>
                          <select
                            value={columnMapping[stdCol] || mappedCol}
                            onChange={(e) => handleColumnMapping(stdCol, e.target.value)}
                            className={cn(
                              "px-2 py-1 rounded-apple bg-bg-tertiary/30 border border-border",
                              "text-sm text-text focus:outline-none focus:border-accent",
                            )}
                          >
                            {detectedColumns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Outlier Detection — collapsible */}
              <div className="glass rounded-apple overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Outlier Detection
                  </h3>
                  <motion.button
                    onClick={() => setCollapseOutlier(!collapseOutlier)}
                    className={cn(
                      "p-1 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all",
                    )}
                    whileTap={{ scale: 0.9 }}
                  >
                    {collapseOutlier ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {!collapseOutlier && (
                    <motion.div
                      key="outlier-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <div className="p-4 space-y-4">
                        <div>
                          <label className="flex items-center justify-between">
                            <span className="text-sm text-text-secondary">
                              Z-score Threshold: {outlierThreshold.toFixed(1)}σ
                            </span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="0.1"
                              value={outlierThreshold}
                              onChange={(e) => setOutlierThreshold(Number(e.target.value))}
                              className="w-32 h-1.5 bg-bg-tertiary/50 rounded-full appearance-none cursor-pointer slider"
                            />
                          </label>
                        </div>
                        <p className="text-xs text-text-tertiary">
                          Readings beyond {outlierThreshold.toFixed(1)} standard deviations will be flagged for review.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Data Versions */}
              <div className="glass rounded-apple overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Data Versions
                  </h3>
                  <motion.button
                    onClick={() => setCollapseDataFiles(!collapseDataFiles)}
                    className={cn(
                      "p-1 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all",
                    )}
                    whileTap={{ scale: 0.9 }}
                  >
                    {collapseDataFiles ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {!collapseDataFiles && (
                    <motion.div
                      key="data-versions-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <div className="p-4">
                        {versionsLoading ? (
                          <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <RefreshCw size={14} className="animate-spin" />
                            Loading versions...
                          </div>
                        ) : dataVersions.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/30">
                                <th className="text-left py-2 text-xs text-text-tertiary">File</th>
                                <th className="text-left py-2 text-xs text-text-tertiary">Checksum</th>
                                <th className="text-left py-2 text-xs text-text-tertiary">Rows</th>
                                <th className="text-right py-2 text-xs text-text-tertiary">Modified</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dataVersions.map((v, i) => (
                                <tr key={i} className="border-b border-border/20">
                                  <td className="py-2 text-text">{v.filename || v.name || "unknown"}</td>
                                  <td className="py-2 text-text-tertiary font-mono text-xs">
                                    {v.checksum || "—"}
                                  </td>
                                  <td className="py-2 text-text-tertiary">{v.rows || "—"}</td>
                                  <td className="py-2 text-right text-text-tertiary text-xs">
                                    {v.last_modified || v.lastModified || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-xs text-text-tertiary">No data versions found.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Clean Button */}
              <motion.button
                onClick={handleCleanData}
                disabled={!detectedColumns.length}
                className={cn(
                  "px-4 py-2 rounded-apple text-xs font-medium flex items-center gap-1.5",
                  "bg-accent text-bg hover:bg-accent/80 transition-all",
                  !detectedColumns.length && "opacity-50 cursor-not-allowed",
                )}
                whileTap={{ scale: 0.98 }}
              >
                <RefreshCw size={14} />
                Apply Cleaning
              </motion.button>
            </div>
          )}

          {activeTab === "risk" && (
            <div className="space-y-6">
              {riskSettings.map((setting) => (
                <motion.div
                  key={setting.id}
                  className="glass rounded-apple p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-medium text-text">{setting.label}</h3>
                      <p className="text-xs text-text-tertiary mt-1">
                        {setting.description}
                      </p>
                    </div>
                    <span className="text-sm font-mono text-text">
                      {setting.value.toFixed(1)}
                      {setting.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={setting.min}
                    max={setting.max}
                    step="0.1"
                    value={setting.value}
                    onChange={(e) =>
                      updateRiskSetting(setting.id, Number(e.target.value))
                    }
                    className="w-full h-1.5 bg-bg-tertiary/50 rounded-full appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-text-tertiary mt-1">
                    <span>
                      {setting.min}
                      {setting.unit}
                    </span>
                    <span>
                      {setting.max}
                      {setting.unit}
                    </span>
                  </div>
                </motion.div>
              ))}
              <motion.button
                onClick={saveRiskSettings}
                className="px-4 py-2 bg-accent text-bg rounded-apple font-medium hover:bg-accent/80 transition-all flex items-center gap-2"
                whileTap={{ scale: 0.98 }}
              >
                <Save size={16} />
                {riskSaved ? "Saved ✓" : "Save Risk Settings"}
              </motion.button>
            </div>
          )}

          {activeTab === "export" && (
            <div className="space-y-6">
              <div className="glass rounded-apple p-6">
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-4">
                  Export Reports
                </h3>
                <div className="space-y-3">
                  <ExportOption
                    icon={FileText}
                    label="Strategy Performance Report"
                    description="PDF with full backtest results, equity curves, and metrics"
                    onClick={() => handleExport("pdf")}
                  />
                  <ExportOption
                    icon={FileImage}
                    label="Dashboard Snapshot"
                    description="PNG image of current dashboard view"
                    onClick={() => handleExport("png")}
                  />
                  <ExportOption
                    icon={Database}
                    label="Portfolio Book"
                    description="Export current book weights and strategy allocations"
                    onClick={() => handleExport("csv")}
                  />
                  <ExportOption
                    icon={FileText}
                    label="Trade History CSV"
                    description="Download all trades as structured CSV"
                    onClick={() => handleExport("trades")}
                  />
                  <ExportOption
                    icon={FileDown}
                    label="Performance Data CSV"
                    description="Export portfolio equity curve, metrics, and book weights"
                    onClick={handleExportPerformanceCsv}
                  />
                  <ExportOption
                    icon={FileText}
                    label="HTML Performance Report"
                    description="Interactive HTML report with charts and metrics"
                    onClick={() => handleExport("html")}
                  />
                </div>
              </div>

              <div className="glass rounded-apple overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Notification Settings
                  </h3>
                  <motion.button
                    onClick={() => setCollapseNotif(!collapseNotif)}
                    className={cn(
                      "p-1 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all",
                    )}
                    whileTap={{ scale: 0.9 }}
                  >
                    {collapseNotif ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {!collapseNotif && (
                    <motion.div
                      key="notif-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <div className="p-4 space-y-4">
                        <ToggleRow
                          icon={Bell}
                          label="Position Alerts"
                          description="Notify when positions move beyond threshold"
                          defaultChecked={true}
                        />
                        <ToggleRow
                          icon={Activity}
                          label="Connection Status"
                          description="Notify when broker connections drop"
                          defaultChecked={true}
                        />
                        <ToggleRow
                          icon={TrendingUp}
                          label="Performance Reports"
                          description="Daily and weekly performance summaries"
                          defaultChecked={false}
                        />
                        <ToggleRow
                          icon={Shield}
                          label="Risk Warnings"
                          description="Alert when portfolio heat exceeds limits"
                          defaultChecked={true}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="glass rounded-apple overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Display
                  </h3>
                  <motion.button
                    onClick={() => setCollapseOutlier(!collapseOutlier)}
                    className={cn(
                      "p-1 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all",
                    )}
                    whileTap={{ scale: 0.9 }}
                  >
                    {collapseOutlier ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {!collapseOutlier && (
                    <motion.div
                      key="display-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <div className="p-4 space-y-4">
                        <ToggleRow
                          icon={Moon}
                          label="Dark Mode"
                          description="Use dark theme (Apple design standard)"
                          defaultChecked={true}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  defaultChecked = false,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <motion.div
      className="flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="w-5 h-5 rounded-lg bg-bg-tertiary/50 flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          <Icon size={12} className="text-text-secondary" />
        </motion.div>
        <div>
          <p className="text-sm font-medium text-text">{label}</p>
          <p className="text-xs text-text-tertiary">{description}</p>
        </div>
      </div>
      <motion.button
        onClick={() => setChecked(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 rounded-full transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent/30",
          checked ? "bg-accent" : "bg-bg-tertiary/50",
        )}
        whileTap={{ scale: 0.9 }}
      >
        <motion.span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </motion.button>
    </motion.div>
  );
}

function ExportOption({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-4 p-4 rounded-apple",
        "hover:bg-bg-tertiary/50 transition-all text-left",
      )}
      whileTap={{ scale: 0.98 }}
    >
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-accent" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-text-tertiary mt-1">{description}</p>
      </div>
      <Download size={14} className="text-text-tertiary" />
    </motion.button>
  );
}
