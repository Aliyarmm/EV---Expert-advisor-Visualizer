"use client";

interface MetricsGridProps {
  metrics: Record<string, number> | Record<string, number | undefined>;
}

interface MetricRow {
  label: string;
  value: string;
  category: string;
}

const metricGroups: Record<string, MetricRow[]> = {
  returns: [
    { label: "Total Return", value: "", category: "returns" },
    { label: "Annual Return", value: "", category: "returns" },
    { label: "Annual Volatility", value: "", category: "returns" },
  ],
  risk: [
    { label: "Max Drawdown", value: "", category: "risk" },
    { label: "Downside Deviation", value: "", category: "risk" },
    { label: "Value at Risk (95%)", value: "", category: "risk" },
  ],
  ratios: [
    { label: "Sharpe Ratio", value: "", category: "ratios" },
    { label: "Sortino Ratio", value: "", category: "ratios" },
    { label: "Calmar Ratio", value: "", category: "ratios" },
  ],
  trades: [
    { label: "Win Rate", value: "", category: "trades" },
    { label: "Profit Factor", value: "", category: "trades" },
    { label: "Avg R-Multiple", value: "", category: "trades" },
    { label: "Total Trades", value: "", category: "trades" },
  ],
};

function formatMetricValue(label: string, value: number | undefined): string {
  if (value === undefined || isNaN(value)) return "—";

  const id = label.toLowerCase().replace(/\s+/g, "_");

  if (id.includes("drawdown") || id.includes("return") || id.includes("volatility")) {
    if (Math.abs(value) < 1) return `${(value * 100).toFixed(2)}%`;
    return `${value.toFixed(2)}%`;
  }
  if (id.includes("rate") || id.includes("ratio")) {
    return value.toFixed(2);
  }
  if (id.includes("trades") || id.includes("trading")) {
    return Math.round(value).toString();
  }
  if (value > 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(2);
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const metricKeyMap: Record<string, string> = {
    "Total Return": "total_return",
    "Annual Return": "annual_return",
    "Annual Volatility": "annual_volatility",
    "Max Drawdown": "max_drawdown",
    "Downside Deviation": "downside_volatility",
    "Value at Risk (95%)": "var_95",
    "Sharpe Ratio": "sharpe_ratio",
    "Sortino Ratio": "sortino_ratio",
    "Calmar Ratio": "calmar_ratio",
    "Win Rate": "win_rate",
    "Profit Factor": "profit_factor",
    "Avg R-Multiple": "avg_r_multiple",
    "Total Trades": "num_trades",
  };

  const renderRow = (row: MetricRow) => {
    const key = metricKeyMap[row.label] || row.label.toLowerCase().replace(/\s+/g, "_");
    const rawValue = metrics[key];
    return (
      <div
        key={row.label}
        className="flex justify-between py-2 border-b border-border/20 last:border-0"
      >
        <span className="text-sm text-text-secondary">{row.label}</span>
        <span className="text-sm font-mono text-text">
          {formatMetricValue(row.label, rawValue)}
        </span>
      </div>
    );
  };

  return (
    <div className="glass rounded-apple p-6 space-y-4">
      <h3 className="text-sm font-medium text-text-secondary">
        Performance Metrics
      </h3>
      {Object.entries(metricGroups).map(([group, rows]) => (
        <div key={group}>
          <div className="space-y-0.5">
            {rows.map(renderRow)}
          </div>
        </div>
      ))}
    </div>
  );
}
