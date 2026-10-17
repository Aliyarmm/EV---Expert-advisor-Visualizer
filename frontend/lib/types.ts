/**
 * Type definitions for EA Index Trading Research Platform.
 * These mirror the backend Pydantic models and DB response shapes.
 */

export type StrategyStatus = "Live" | "Paper" | "Retired" | "Under Review";

export interface StrategyMetric {
  win_rate?: number;
  profit_factor?: number;
  max_drawdown?: number;
  sharpe_ratio?: number;
  calmar_ratio?: number;
  total_trades?: number;
  years_of_data?: number;
  avg_r_multiple?: number;
  annual_volatility?: number;
}

export interface Strategy {
  id: string;
  name: string;
  family: string;
  symbol: string;
  timeframe: string;
  status: StrategyStatus;
  logic?: string;
  params?: Record<string, any>;
  tags?: string[];
  created_at: string;
  updated_at: string;
  metrics?: StrategyMetric;
}

export interface StrategyDetail {
  strategy: Strategy;
  metrics: Record<string, number>;
  equity_curve: EquityPoint[];
}

export interface EquityPoint {
  date: string;
  value: number;
}

export interface OverviewMetrics {
  totalStrategies: number;
  liveCount: number;
  paperCount: number;
  avgWinRate: number;
  avgProfitFactor: number;
  avgSharpe: number;
  portfolioEquity: number;
  portfolioReturn: number;
}

export interface Book {
  id: string;
  name: string;
  weights: string;
  items?: BookItem[];
}

export interface BookItem {
  strategy_id: string;
  weight: number;
  side: "long" | "short";
  name: string;
  family: string;
  symbol: string;
}

export type SignalType = "sma_crossover" | "rsi" | "bollinger" | "momentum";

export interface SignalConfig {
  type: SignalType;
  params: Record<string, any>;
}

export type PositionSizingMode = "fixed" | "percent_risk" | "volatility_adjusted" | "Kelly";

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  commission: number;
  slippage: number;
  signal: SignalConfig;
  strategy_params?: Record<string, any>;
  position_sizing?: PositionSizingMode;
  max_risk_per_trade?: number; // percentage of capital at risk per trade
}

export interface BacktestMetrics {
  total_return: number;
  annual_return: number;
  annual_volatility: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  num_trades: number;
}

export interface BacktestTrade {
  date: string;
  type: "BUY" | "SELL";
  price: number;
  quantity: number;
}

export interface BacktestResult {
  strategy_id: string;
  equity_curve: EquityPoint[];
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  signals: Array<{ date: string; signal: number }>;
}

export interface MonteCarloResult {
  strategy_id: string;
  n_simulations: number;
  drawdown_analysis: Record<string, number>;
  final_values: {
    median: number;
    p25: number;
    p75: number;
    p10: number;
    p90: number;
    min: number;
    max: number;
  };
  survival_rate: number;
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

export interface StrategySignals {
  strategy_id: string;
  signal_types: string[];
  default_params: Record<string, Record<string, number>>;
}

export interface WalkForwardWindow {
  in_sample_start: string;
  in_sample_end: string;
  oos_start: string;
  oos_end: string;
  in_sample_return: number;
  oos_return: number;
  oos_sharpe: number;
}

export interface WalkForwardResult {
  strategy_id: string;
  windows: WalkForwardWindow[];
  oos_return: number;
  oos_sharpe: number;
  pbo: number;
  deflated_sharpe: number;
}

export interface CorrelationMatrixData {
  strategies: string[];
  matrix: number[][];
}

export interface RegimeDetection {
  symbol: string;
  regime: string;
  volatility: number;
  vol_percentile: number;
  trend_strength: number;
  momentum_20d: number;
  last_price: number;
}

export interface CorrelationClusterStrategy {
  id: string;
  name: string;
  correlation: number;
}

export interface CorrelationCluster {
  cluster_id: string;
  strategies: CorrelationClusterStrategy[];
}

export interface CorrelationClusterData {
  strategies: Array<{
    id: string;
    name: string;
  }>;
  clusters: CorrelationCluster[];
}

export interface BookMetric {
  strategy_id: string;
  name: string;
  weight: number;
  win_rate: number;
  profit_factor: number;
  max_dd: number;
  sharpe: number;
}
