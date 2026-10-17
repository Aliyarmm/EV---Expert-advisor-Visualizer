// Data fetching layer for EA Index.
// Uses local-first caching: API responses cached in localStorage for offline access.
import {
  Strategy,
  OverviewMetrics,
  StrategyDetail,
  BacktestConfig,
  BacktestResult,
  MonteCarloResult,
  StrategySignals,
  WalkForwardResult,
  CorrelationMatrixData,
  RegimeDetection,
  CorrelationClusterData,
  BookMetric,
  Book,
} from "@/lib/types";

import { API_BASE } from "@/lib/api";
import { cachedFetch, invalidateCache, flushPendingMutations } from "@/lib/local-data";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return cachedFetch<T>(path, `api:${path}`, init);
}

// Initialize online/offline sync listeners
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushPendingMutations(API_BASE);
  });
}

// Invalidate cache helper for mutations
export function invalidateStrategyCache(id?: string): void {
  if (id) {
    invalidateCache(`api:/strategies/${id}`);
  }
  invalidateCache("api:/strategies");
}

export function invalidateBookCache(id?: string): void {
  if (id) {
    invalidateCache(`api:/books/${id}`);
  }
  invalidateCache("api:/books");
  invalidateCache("api:/portfolio");
  invalidateCache(`api:/books/book-core-portfolio`);
}

export async function fetchOverviewData(): Promise<{
  strategies: Strategy[];
  metrics: OverviewMetrics;
}> {
  const [strategies, portfolioData] = await Promise.allSettled([
    api<Strategy[]>("/strategies"),
    api<{
      metrics: Record<string, number>;
      equity_curve: { date: string; value: number }[];
    }>("/portfolio"),
  ]);

  const stratList: Strategy[] = strategies.status === "fulfilled" ? strategies.value : [];
  // /portfolio returns the aggregated (weighted) equity curve; /books/:id
  // returns no curve at all, so it is the wrong source for these numbers.
  const bookData = portfolioData.status === "fulfilled" ? portfolioData.value : null;

  const metrics: OverviewMetrics = {
    totalStrategies: stratList.length,
    liveCount: stratList.filter((s) => s.status === "Live").length,
    paperCount: stratList.filter((s) => s.status === "Paper").length,
    avgWinRate: stratList.reduce((sum, s) => sum + (s.metrics?.win_rate ?? 0), 0) / stratList.length || 0,
    avgProfitFactor: stratList.reduce((sum, s) => sum + (s.metrics?.profit_factor ?? 0), 0) / stratList.length || 0,
    avgSharpe: stratList.reduce((sum, s) => sum + (s.metrics?.sharpe_ratio ?? 0), 0) / stratList.length || 0,
    portfolioEquity: bookData?.equity_curve?.length
      ? bookData.equity_curve[bookData.equity_curve.length - 1].value
      : 0,
    portfolioReturn: bookData?.equity_curve?.length
      ? ((bookData.equity_curve[bookData.equity_curve.length - 1].value /
          bookData.equity_curve[0].value) -
          1) *
        100
      : 0,
  };

  return { strategies: stratList, metrics };
}

export async function fetchStrategyDetail(id: string): Promise<StrategyDetail | null> {
  try {
    return await api<StrategyDetail>(`/strategies/${id}`);
  } catch {
    return null;
  }
}

export async function fetchStrategyCorrelations(
  strategyId: string
): Promise<CorrelationMatrixData> {
  try {
    return await api<CorrelationMatrixData>(
      `/strategies/${strategyId}/correlations`
    );
  } catch {
    // Fallback: return empty matrix
    return { strategies: [], matrix: [] };
  }
}

export async function fetchStrategySignals(strategyId: string): Promise<StrategySignals | null> {
  try {
    return await api<StrategySignals>(`/backtest/strategies/${strategyId}/signals`);
  } catch {
    return null;
  }
}

export async function runBacktest(config: BacktestConfig & {
  position_sizing?: string;
  max_risk_per_trade?: number;
}): Promise<BacktestResult | null> {
  try {
    const res = await fetch(`${API_BASE}/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return (await res.json()) as BacktestResult;
  } catch {
    return null;
  }
}

export async function runMonteCarlo(
  strategyId: string = "default",
  nSimulations: number = 1000
): Promise<MonteCarloResult | null> {
  try {
    const res = await fetch(
      `${API_BASE}/backtest/monte-carlo?strategy_id=${strategyId}&n_simulations=${nSimulations}`
    );
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return (await res.json()) as MonteCarloResult;
  } catch {
    return null;
  }
}

export interface MonteCarloStressRequest {
  strategy_id: string;
  equity_curve?: Array<{ date: string; value: number }>;
  n_simulations?: number;
  n_periods?: number;
  initial_capital?: number;
  confidence_levels?: number[];
}

export interface MonteCarloStressResult {
  strategy_id: string;
  n_simulations: number;
  n_periods: number;
  initial_capital: number;
  drawdown_analysis: Record<string, number>;
  final_values: {
    median: number;
    p25: number;
    p75: number;
    p10: number;
    p90: number;
    p5: number;
    p95: number;
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  confidence_levels: Record<string, number>;
  survival_rate: number;
  probability_of_loss: number;
}

export async function runMonteCarloStress(
  request: MonteCarloStressRequest
): Promise<MonteCarloStressResult | null> {
  try {
    const res = await fetch(`${API_BASE}/backtest/monte-carlo-stress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return (await res.json()) as MonteCarloStressResult;
  } catch {
    return null;
  }
}

export async function runWalkForward(
  config: BacktestConfig
): Promise<WalkForwardResult | null> {
  try {
    const res = await fetch(`${API_BASE}/backtest/walk-forward`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return (await res.json()) as WalkForwardResult;
  } catch {
    return null;
  }
}

interface ComparisonResult {
  strategy_id: string;
  equity_curve: Array<{ date: string; value: number }>;
  metrics: Record<string, number>;
  label: string;
  error?: string;
}

export async function runComparison(configs: BacktestConfig[]): Promise<ComparisonResult[]> {
  try {
    const res = await fetch(`${API_BASE}/backtest/run-comparison`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

export async function fetchPortfolioData(): Promise<{
  equity_curve: { date: string; value: number }[];
  metrics: {
    total_strategies: number;
    avg_sharpe: number;
    avg_profit_factor: number;
    avg_win_rate: number;
  };
  book_metrics: BookMetric[];
} | null> {
  try {
    return await api<any>("/portfolio");
  } catch {
    return null;
  }
}

export async function fetchBooks(): Promise<Book[]> {
  try {
    return await api<Book[]>("/books");
  } catch {
    return [];
  }
}

export async function fetchBook(bookId: string): Promise<Book | null> {
  try {
    return await api<Book>(`/books/${bookId}`);
  } catch {
    return null;
  }
}

export async function saveBook(bookId: string, book: Book): Promise<Book> {
  const res = await fetch(`${API_BASE}/books/${bookId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(book),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchWalkForward(
  config: BacktestConfig
): Promise<WalkForwardResult | null> {
  return runWalkForward(config);
}

export async function fetchRegimeDetection(
  symbol: string
): Promise<RegimeDetection | null> {
  try {
    return await api<RegimeDetection>(
      `/backtest/regime?symbol=${encodeURIComponent(symbol)}`
    );
  } catch {
    return null;
  }
}

export async function fetchCorrelationClusters(
  strategyId: string
): Promise<CorrelationClusterData | null> {
  try {
    return await api<CorrelationClusterData>(
      `/backtest/correlation-clusters/${strategyId}`
    );
  } catch {
    return null;
  }
}
