"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Settings,
  BarChart3,
  RefreshCw,
  Target,
  TrendingUp,
  BarChart,
  Layers,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GitCompare,
  Bot,
  Send,
  Brain,
  Copy,
  ExternalLink,
  Check,
  X,
  Activity,
  Shield,
  FileDown,
} from "lucide-react";

import { BacktestConfig, BacktestResult, MonteCarloResult, MonteCarloStressResult, StrategySignals, WalkForwardResult } from "@/lib/types";
import { runBacktest, runMonteCarlo, fetchStrategySignals, runWalkForward, runComparison, runMonteCarloStress } from "@/lib/data";
import { cn, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { downloadCsv, toCsvObjects } from "@/lib/csv";
import { EquityCurveChart } from "@/components/charts/equity-curve-chart";
import { MetricsGrid } from "@/components/metrics/metrics-grid";
import { KpiCard } from "@/components/ui/kpi-card";

const SIGNAL_TYPES = [
  {
    value: "sma_crossover",
    label: "SMA Crossover",
    description: "Moving average crossover strategy",
    params: ["fast", "slow"],
  },
  {
    value: "rsi",
    label: "RSI Reversal",
    description: "Mean-reversion based on RSI",
    params: ["period", "oversold", "overbought"],
  },
  {
    value: "bollinger",
    label: "Bollinger Bands",
    description: "Price band breakout strategy",
    params: ["period", "std_mult"],
  },
  {
    value: "momentum",
    label: "Momentum",
    description: "Trend-following momentum strategy",
    params: ["lookback", "threshold"],
  },
];

const DEFAULT_PARAMS: Record<string, Record<string, number>> = {
  sma_crossover: { fast: 20, slow: 50 },
  rsi: { period: 14, oversold: 30, overbought: 70 },
  bollinger: { period: 20, std_mult: 2.0 },
  momentum: { lookback: 10, threshold: 0.0 },
};

const SYMBOLS = ["SPY", "QQQ", "IWM", "AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "GC", "CL", "EURUSD"];
const TIMEFRAMES = ["D1", "H4", "H1", "M15"];
const INITIAL_CAPITALS = [25000, 50000, 100000, 250000, 500000, 1000000];

// LLM Research Agent prompts
const RESEARCH_ASSISTANT_PROMPTS = [
  "What's a good SMA crossover configuration for trending markets?",
  "Suggest a momentum strategy with low correlation to SPY",
  "Generate a Bollinger Band strategy with RSI filter",
  "What parameter set would maximize Sharpe ratio for mean-reversion?",
  "Design a portfolio of uncorrelated strategies",
];

export function ResearchLab() {
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: "SPY",
    timeframe: "D1",
    start_date: "2020-01-01",
    end_date: "2024-01-01",
    initial_capital: 100000,
    commission: 0.001,
    slippage: 0.0005,
    signal: {
      type: "sma_crossover",
      params: { fast: 20, slow: 50 },
    },
  });

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [mcStressResult, setMcStressResult] = useState<MonteCarloStressResult | null>(null);
  const [wfResult, setWfResult] = useState<WalkForwardResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningMC, setIsRunningMC] = useState(false);
  const [isRunningWF, setIsRunningWF] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [signalsData, setSignalsData] = useState<StrategySignals | null>(null);

  // Side-by-side comparison
  const [comparisons, setComparisons] = useState<Array<{ id: string; config: BacktestConfig; result: BacktestResult | null; running: boolean }>>([]);

  // LLM Research Agent
  const [showResearchAgent, setShowResearchAgent] = useState(false);
  const [agentMessages, setAgentMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);

  useEffect(() => {
    fetchStrategySignals("default").then(setSignalsData);
  }, []);

  const updateParam = (key: string, value: number) => {
    setConfig((prev) => ({
      ...prev,
      signal: {
        ...prev.signal,
        params: { ...prev.signal.params, [key]: value },
      },
    }));
  };

  const handleRunBacktest = async () => {
    setIsRunning(true);
    const res = await runBacktest(config);
    setResult(res);
    setIsRunning(false);
  };

  const handleRunMonteCarlo = async () => {
    if (!result) return;
    setIsRunningMC(true);
    const strategyId = `${config.symbol}-${config.signal.type}`;
    const res = await runMonteCarlo(strategyId, 1000);
    setMcResult(res);
    setIsRunningMC(false);
  };

  const handleRunMonteCarloStress = async () => {
    if (!result) return;
    setIsRunningMC(true);
    const res = await runMonteCarloStress({
      strategy_id: `${config.symbol}-${config.signal.type}`,
      equity_curve: result.equity_curve.map((p) => ({
        date: p.date,
        value: p.value,
      })),
      n_simulations: 1000,
      n_periods: 252,
      initial_capital: config.initial_capital,
    });
    setMcStressResult(res);
    setIsRunningMC(false);
  };

  const handleRunWalkForward = async () => {
    setIsRunningWF(true);
    const res = await runWalkForward(config);
    setWfResult(res);
    setIsRunningWF(false);
  };

  const handleAddComparison = () => {
    const id = `comp-${Date.now()}`;
    setComparisons([...comparisons, {
      id,
      config: { ...config },
      result: null,
      running: false,
    }]);
  };

  const handleRunComparison = async (compId: string, compConfig: BacktestConfig) => {
    setComparisons(comparisons.map(c => c.id === compId ? { ...c, running: true } : c));
    const res = await runBacktest(compConfig);
    setComparisons(comparisons.map(c => c.id === compId ? { ...c, result: res, running: false } : c));
  };

  const handleRemoveComparison = (compId: string) => {
    setComparisons(comparisons.filter(c => c.id !== compId));
  };

  const handleAgentSend = async () => {
    if (!agentInput.trim()) return;

    const userMsg = { role: "user" as const, content: agentInput };
    setAgentMessages([...agentMessages, userMsg]);
    setAgentInput("");
    setAgentLoading(true);

    // Simulate LLM research agent response
    setTimeout(() => {
      const responses: Record<string, string> = {
        "sma crossover": "Based on the equity curve analysis, a faster SMA (10/30) may capture more trend moves in momentum regimes. Consider adding a volatility filter.",
        "momentum": "The current lookback of 10 may be too sensitive to noise. Try 5 or 15 for smoother signals. Also consider a minimum trend threshold of 2%.",
        "bollinger": "Your current std_mult of 2.0 is standard. For mean-reversion, try 2.5 to catch more bounces. For breakout, reduce to 1.5 for tighter bands.",
        "rsi": "The RSI(14) with 30/70 is classic. For trending markets, try RSI(9) with 20/80 for earlier entries. Add a trend filter (price above 50-SMA) for better win rate.",
        "what's a good": "For trending markets (ADX > 25), a 10/30 SMA crossover with a 2% ATR trailing stop typically performs well. In ranging markets, Bollinger Bands with RSI filter works better.",
        "sugges": "Consider a dual-momentum strategy: 1) Long assets with 3-month price momentum > 10%, 2) Short assets with momentum < -5%, 3) Neutral when flat. This tends to have low correlation to pure trend-following.",
        "generate": "Bollinger Band squeeze strategy: Buy when BB width < 2nd percentile (squeeze), exit when price closes above upper band. Add volume filter > 20-day average.",
        "parameter": "To maximize Sharpe for mean-reversion, a shorter RSI period (7-9) with tighter thresholds (20/80) usually improves risk-adjusted returns in range-bound markets.",
        "portfolio": "For low correlation: 1) Trend-following (momentum), 2) Mean-reversion (RSI), 3) Volatility breakout (Bollinger). Keep weights at 33% each for diversification.",
      };

      let response = "I can analyze your backtest results and suggest parameter optimizations. Based on the current config, I recommend: a faster signal for trending regimes, and adding a volatility filter. Would you like me to generate specific parameter sets to test?";
      const lower = agentInput.toLowerCase();
      for (const [key, val] of Object.entries(responses)) {
        if (lower.includes(key)) {
          response = val;
          break;
        }
      }

      setAgentMessages(prev => [...prev, { role: "assistant", content: response }]);
      setAgentLoading(false);
    }, 1500);
  };

  const signalType = SIGNAL_TYPES.find((s) => s.value === config.signal.type);
  const currentParams = DEFAULT_PARAMS[config.signal.type] || {};

  const hasComparisons = comparisons.length > 0;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Config Panel */}
      <div className="col-span-4 space-y-6">
        <div className="glass rounded-apple p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
            Strategy Configuration
          </h2>

          {/* Signal Type */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Signal Type
            </label>
            <div className="space-y-2">
              {SIGNAL_TYPES.map((st) => (
                <button
                  key={st.value}
                  onClick={() =>
                    setConfig({
                      ...config,
                      signal: {
                        type: st.value as BacktestConfig["signal"]["type"],
                        params: DEFAULT_PARAMS[st.value],
                      },
                    })
                  }
                  className={cn(
                    "w-full p-3 rounded-apple text-left transition-all",
                    config.signal.type === st.value
                      ? "bg-accent/15 border border-accent/30"
                      : "bg-bg-tertiary/30 hover:bg-bg-tertiary/50 border border-transparent",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{st.label}</span>
                    {config.signal.type === st.value && (
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">{st.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Symbol & Timeframe */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                Symbol
              </label>
              <select
                value={config.symbol}
                onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
                className="w-full px-3 py-2 rounded-apple bg-bg-tertiary/30 border border-border text-sm focus:outline-none focus:border-accent"
              >
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                Timeframe
              </label>
              <select
                value={config.timeframe}
                onChange={(e) => setConfig({ ...config, timeframe: e.target.value })}
                className="w-full px-3 py-2 rounded-apple bg-bg-tertiary/30 border border-border text-sm focus:outline-none focus:border-accent"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={config.start_date}
                onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-apple bg-bg-tertiary/30 border border-border text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                End Date
              </label>
              <input
                type="date"
                value={config.end_date}
                onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-apple bg-bg-tertiary/30 border border-border text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Capital */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Initial Capital
            </label>
            <select
              value={config.initial_capital}
              onChange={(e) => setConfig({ ...config, initial_capital: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-apple bg-bg-tertiary/30 border border-border text-sm focus:outline-none focus:border-accent"
            >
              {INITIAL_CAPITALS.map((c) => (
                <option key={c} value={c}>{formatCurrency(c)}</option>
              ))}
            </select>
          </div>

          {/* Advanced Settings */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-3 rounded-apple hover:bg-bg-tertiary/50 transition-all text-sm"
          >
            <span className="flex items-center gap-2">
              <Settings size={16} />
              Advanced Settings
            </span>
            {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-4 border-t border-border">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-2">
                      Commission ({formatPercent(config.commission * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.01"
                      step="0.0001"
                      value={config.commission}
                      onChange={(e) => setConfig({ ...config, commission: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-2">
                      Slippage ({formatPercent(config.slippage * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.02"
                      step="0.0001"
                      value={config.slippage}
                      onChange={(e) => setConfig({ ...config, slippage: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Position Sizing */}
                <div className="pt-4 border-t border-border space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-2">
                      Position Sizing Mode
                    </label>
                    <select
                      value={config.position_sizing || "fixed"}
                      onChange={(e) => setConfig({ ...config, position_sizing: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-apple bg-bg-tertiary/30 border border-border text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="percent_risk">Percent Risk</option>
                      <option value="volatility_adjusted">Volatility Adjusted</option>
                      <option value="Kelly">Kelly Criterion</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-2">
                      Max Risk Per Trade ({formatPercent(config.max_risk_per_trade || 2.0)}%)
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={config.max_risk_per_trade || 2.0}
                      onChange={(e) => setConfig({ ...config, max_risk_per_trade: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Signal Params */}
          {signalType && (
            <motion.div
              key={config.signal.type}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-4 p-4 bg-bg-tertiary/20 rounded-apple border border-border"
            >
              <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-3">
                {signalType.label} Parameters
              </h3>
              <div className="space-y-3">
                {Object.entries(currentParams).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-text-secondary">{key}</label>
                      <span className="text-xs text-text-tertiary">{val}</span>
                    </div>
                    <input
                      type="range"
                      min={key === "std_mult" ? "0.5" : key === "threshold" ? "0" : "5"}
                      max={key === "std_mult" ? "4" : key === "threshold" ? "0.05" : "100"}
                      step={key === "std_mult" ? "0.1" : key === "threshold" ? "0.001" : "1"}
                      value={val}
                      onChange={(e) => updateParam(key, Number(e.target.value))}
                      className="w-full mt-1"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Run Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRunBacktest}
            disabled={isRunning}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-3 rounded-apple font-medium transition-all",
              isRunning
                ? "bg-bg-tertiary/30 cursor-not-allowed"
                : "bg-accent text-bg hover:bg-accent/80 shadow-lg shadow-accent/20",
            )}
          >
            {isRunning ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Play size={18} />
            )}
            {isRunning ? "Running Backtest..." : "Run Backtest"}
          </button>

          <button
            onClick={handleRunMonteCarlo}
            disabled={isRunningMC || !result}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-3 rounded-apple font-medium transition-all",
              isRunningMC || !result
                ? "bg-bg-tertiary/30 cursor-not-allowed"
                : "bg-purple hover:bg-purple/80 shadow-lg shadow-purple/20",
            )}
          >
            {isRunningMC ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <BarChart3 size={18} />
            )}
            {isRunningMC ? "Running Simulation..." : "Monte Carlo Analysis"}
          </button>

          <button
            onClick={handleRunMonteCarloStress}
            disabled={isRunningMC || !result}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-3 rounded-apple font-medium transition-all",
              isRunningMC || !result
                ? "bg-bg-tertiary/30 cursor-not-allowed"
                : "bg-orange hover:bg-orange/80 shadow-lg shadow-orange/20",
            )}
          >
            {isRunningMC ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Shield size={18} />
            )}
            {isRunningMC ? "Running Stress..." : "Monte Carlo Stress Test"}
          </button>

          <button
            onClick={handleRunWalkForward}
            disabled={isRunningWF || !result}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-3 rounded-apple font-medium transition-all",
              isRunningWF || !result
                ? "bg-bg-tertiary/30 cursor-not-allowed"
                : "bg-teal hover:bg-teal/80 shadow-lg shadow-teal/20",
            )}
          >
            {isRunningWF ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <GitCompare size={18} />
            )}
            {isRunningWF ? "Running WFO..." : "Walk-Forward / OOS"}
          </button>

          <button
            onClick={handleAddComparison}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-3 rounded-apple font-medium transition-all",
              "bg-bg-tertiary/30 hover:bg-bg-tertiary/50 border border-border",
            )}
          >
            <Plus size={18} />
            Add Comparison Variant
          </button>

          <button
            onClick={() => setShowResearchAgent(!showResearchAgent)}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-3 rounded-apple font-medium transition-all",
              "bg-bg-tertiary/30 hover:bg-bg-tertiary/50 border border-border",
            )}
          >
            <Bot size={18} />
            {showResearchAgent ? "Close Research Agent" : "AI Research Assistant"}
          </button>
        </div>
      </div>

      {/* Results Panel */}
      <div className="col-span-8 space-y-6">
        {/* AI Research Agent Modal */}
        <AnimatePresence>
          {showResearchAgent && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="glass-pop rounded-apple w-full max-w-2xl m-4 h-[500px] flex flex-col"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain size={20} className="text-accent" />
                    <h3 className="font-medium text-text">AI Research Assistant</h3>
                  </div>
                  <button
                    onClick={() => setShowResearchAgent(false)}
                    className="p-1 rounded-apple hover:bg-bg-tertiary/50 transition-all"
                  >
                    <X size={14} className="text-text-tertiary" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {agentMessages.length === 0 ? (
                    <div className="text-center text-text-tertiary py-8">
                      <Bot size={48} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm mb-4">Ask me about strategy optimization, parameter tuning, or portfolio construction.</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {RESEARCH_ASSISTANT_PROMPTS.map((p) => (
                          <button
                            key={p}
                            onClick={() => setAgentInput(p)}
                            className="text-xs px-3 py-1.5 rounded-full bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-all text-text-secondary"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    agentMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        className={cn(
                          "max-w-[80%] p-3 rounded-apple",
                          msg.role === "user"
                            ? "ml-auto bg-accent/15"
                            : "bg-bg-tertiary/20",
                        )}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      >
                        <p className="text-sm text-text">{msg.content}</p>
                      </motion.div>
                    ))
                  )}
                  {agentLoading && (
                    <motion.div
                      className="bg-bg-tertiary/20 p-3 rounded-apple max-w-[80%]"
                    >
                      <div className="flex items-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-accent" />
                        <span className="text-xs text-text-tertiary">Analyzing...</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !agentLoading && handleAgentSend()}
                      placeholder="Ask about strategy optimization..."
                      className="flex-1 px-3 py-2 rounded-apple bg-bg-tertiary/30 border border-border text-sm focus:outline-none focus:border-accent"
                      disabled={agentLoading}
                    />
                    <button
                      onClick={handleAgentSend}
                      disabled={agentLoading || !agentInput.trim()}
                      className={cn(
                        "px-3 py-2 rounded-apple bg-accent text-bg transition-all",
                        agentLoading || !agentInput.trim() ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/80",
                      )}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Side-by-Side Comparison */}
        <AnimatePresence>
          {hasComparisons && (
            <motion.div
              className="glass rounded-apple p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary">
                  Side-by-Side Comparison
                </h3>
                <button
                  onClick={() => setComparisons([])}
                  className="text-xs text-text-tertiary hover:text-text transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-3">
                {comparisons.map((comp) => (
                  <motion.div
                    key={comp.id}
                    className="glass rounded-apple p-4"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-text-tertiary">
                          {comp.config.signal.type} ({comp.config.symbol})
                        </span>
                        <span className="text-xs text-text-tertiary">
                          Params: {JSON.stringify(comp.config.signal.params)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!comp.result && !comp.running ? (
                          <motion.button
                            onClick={() => handleRunComparison(comp.id, comp.config)}
                            className="px-2 py-1 text-xs rounded-apple bg-accent/10 text-accent hover:bg-accent/20 transition-all"
                            whileTap={{ scale: 0.95 }}
                          >
                            Run
                          </motion.button>
                        ) : comp.running ? (
                          <RefreshCw size={14} className="animate-spin text-accent" />
                        ) : (
                          <Check size={14} className="text-green" />
                        )}
                        <button
                          onClick={() => handleRemoveComparison(comp.id)}
                          className="p-1 rounded-apple hover:bg-red/10 hover:text-red transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {comp.result && (
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div>
                          <p className="text-xs text-text-tertiary">Return</p>
                          <p className="text-sm font-medium text-text">
                            {formatPercent(comp.result.metrics.total_return * 100)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-tertiary">Sharpe</p>
                          <p className="text-sm font-medium text-text">
                            {comp.result.metrics.sharpe_ratio.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-tertiary">Max DD</p>
                          <p className="text-sm font-medium text-red">
                            {formatPercent(comp.result.metrics.max_drawdown * 100)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-tertiary">Trades</p>
                          <p className="text-sm font-medium text-text">
                            {comp.result.metrics.num_trades}
                          </p>
                        </div>
                      </div>
                    )}

                    {!comp.result && !comp.running && (
                      <p className="text-xs text-text-tertiary">Click Run to execute backtest</p>
                    )}
                  </motion.div>
                ))}

                {/* Combined comparison chart */}
                {comparisons.some((c) => c.result) && (
                  <motion.div
                    className="glass rounded-apple p-4 mt-4"
                  >
                    <h4 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-3">
                      Equity Curves
                    </h4>
                    <div className="h-48">
                      <EquityCurveChart
                        series={comparisons
                          .filter((c) => c.result)
                          .map((c) => ({
                            name: `${c.config.signal.type} (${c.config.symbol})`,
                            data: c.result!.equity_curve.map((p) => ({
                              time: p.date,
                              value: p.value,
                            })),
                          }))}
                        height={192}
                        multiSeries
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!result && !hasComparisons && (
          <div className="glass rounded-apple p-12 text-center h-full flex flex-col items-center justify-center min-h-[500px]">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <TrendingUp size={32} className="text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">Ready to Backtest</h3>
            <p className="text-text-tertiary max-w-md">
              Configure your strategy parameters above and run a backtest to see
              performance metrics, equity curves, and trade analysis. Add comparison
              variants to test multiple parameter sets side-by-side.
            </p>
          </div>
        )}

        {result && (
          <>
            {/* KPI Summary */}
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                label="Total Return"
                value={formatPercent(result.metrics.total_return * 100)}
                icon={TrendingUp}
                positive={result.metrics.total_return > 0}
              />
              <KpiCard
                label="Annual Return"
                value={formatPercent(result.metrics.annual_return * 100)}
                icon={Target}
                positive={result.metrics.annual_return > 0}
              />
              <KpiCard
                label="Sharpe Ratio"
                value={result.metrics.sharpe_ratio.toFixed(2)}
                icon={BarChart}
                positive={result.metrics.sharpe_ratio > 1}
              />
              <KpiCard
                label="Max Drawdown"
                value={formatPercent(result.metrics.max_drawdown * 100)}
                icon={AlertCircle}
                positive={result.metrics.max_drawdown > -0.15}
              />
            </div>

            {/* Equity Curve */}
            <div className="glass rounded-apple p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary">
                  Equity Curve
                </h3>
                <button
                  onClick={() => {
                    const csv = toCsvObjects(
                      result.equity_curve.map((p) => ({ date: p.date, value: p.value })),
                      ["date", "value"]
                    );
                    downloadCsv("backtest-equity-curve.csv", csv);
                  }}
                  className="p-1.5 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all"
                  title="Export equity curve as CSV"
                >
                  <FileDown size={14} />
                </button>
              </div>
              <div className="h-64">
                <EquityCurveChart
                  data={result.equity_curve.map((p) => ({
                    time: p.date,
                    value: p.value,
                  }))}
                  height={260}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="glass rounded-apple p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary">
                    Performance Metrics
                  </h3>
                  <button
                    onClick={() => {
                      const rows = Object.entries(result.metrics)
                        .filter(([, v]) => v != null && !isNaN(Number(v)))
                        .map(([k, v]) => ({ metric: k, value: v }));
                      const csv = toCsvObjects(rows, ["metric", "value"]);
                      downloadCsv("backtest-metrics.csv", csv);
                    }}
                    className="p-1 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all"
                    title="Export metrics as CSV"
                  >
                    <FileDown size={12} />
                  </button>
                </div>
                <button
                  onClick={handleRunWalkForward}
                  disabled={isRunningWF}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs rounded-apple",
                    isRunningWF
                      ? "bg-bg-tertiary/30 cursor-not-allowed"
                      : "bg-teal/10 text-teal hover:bg-teal/20 transition-all",
                  )}
                >
                  {isRunningWF ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <GitCompare size={12} />
                  )}
                  {isRunningWF ? "Running..." : "Run WFO/OOS"}
                </button>
              </div>
              <MetricsGrid metrics={result.metrics as unknown as Record<string, number>} />
            </div>

            {/* Walk-Forward / OOS Diagnostics */}
            {wfResult && (
              <motion.div
                className="glass rounded-apple p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
                  Walk-Forward / OOS Diagnostics
                </h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <KpiCard
                    label="WFO Out-of-Sample Return"
                    value={formatPercent(wfResult.oos_return * 100)}
                    icon={Target}
                    positive={wfResult.oos_return > 0}
                  />
                  <KpiCard
                    label="WFO Sharpe Ratio"
                    value={wfResult.oos_sharpe.toFixed(2)}
                    icon={BarChart}
                    positive={wfResult.oos_sharpe > 1}
                  />
                  <KpiCard
                    label="PBO (Prob of Backtest Overfit)"
                    value={formatPercent(wfResult.pbo * 100, 1)}
                    icon={AlertCircle}
                    positive={wfResult.pbo < 0.1}
                  />
                  <KpiCard
                    label="Deflated Sharpe"
                    value={wfResult.deflated_sharpe.toFixed(2)}
                    icon={Activity}
                    positive={wfResult.deflated_sharpe > 1}
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Rolling Windows
                  </h4>
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
                      <span className="w-12 text-right text-text-secondary">
                        {formatPercent(w.oos_return * 100)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Monte Carlo Results */}
            {mcResult && (
              <motion.div
                className="glass rounded-apple p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
                  Monte Carlo Analysis
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <KpiCard
                    label="Median Final"
                    value={formatCurrency(mcResult.final_values.median)}
                    icon={BarChart3}
                  />
                  <KpiCard
                    label="10th Percentile"
                    value={formatCurrency(mcResult.final_values.p10)}
                    icon={BarChart3}
                  />
                  <KpiCard
                    label="90th Percentile"
                    value={formatCurrency(mcResult.final_values.p90)}
                    icon={BarChart3}
                  />
                  <KpiCard
                    label="Survival Rate"
                    value={`${(mcResult.survival_rate * 100).toFixed(1)}%`}
                    icon={Layers}
                    positive={mcResult.survival_rate > 0.5}
                  />
                </div>
              </motion.div>
            )}

            {/* Monte Carlo Stress Test Results */}
            {mcStressResult && (
              <motion.div
                className="glass rounded-apple p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
                  Monte Carlo Stress Test
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <KpiCard
                    label="VaR (5%)"
                    value={formatCurrency(mcStressResult.final_values.p5)}
                    icon={AlertCircle}
                    positive={mcStressResult.final_values.p5 > mcStressResult.initial_capital * 0.9}
                  />
                  <KpiCard
                    label="Worst Case (5%)"
                    value={formatCurrency(mcStressResult.final_values.min)}
                    icon={AlertCircle}
                    positive={mcStressResult.final_values.min > mcStressResult.initial_capital * 0.8}
                  />
                  <KpiCard
                    label="Survival Rate"
                    value={formatPercent(mcStressResult.survival_rate * 100)}
                    icon={Target}
                    positive={mcStressResult.survival_rate > 0.5}
                  />
                  <KpiCard
                    label="Prob. of Loss"
                    value={formatPercent(mcStressResult.probability_of_loss * 100)}
                    icon={BarChart}
                    positive={mcStressResult.probability_of_loss < 0.5}
                  />
                </div>
              </motion.div>
            )}

            {/* Recent Trades */}
            <div className="glass rounded-apple p-6">
              <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary mb-4">
                Trade Log ({result.trades.length} trades)
              </h3>
              <div className="overflow-y-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-text-secondary">Date</th>
                      <th className="text-left py-2 text-text-secondary">Type</th>
                      <th className="text-right py-2 text-text-secondary">Price</th>
                      <th className="text-right py-2 text-text-secondary">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 20).map((trade, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 text-text-secondary">{trade.date}</td>
                        <td className="py-2">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              trade.type === "BUY" ? "text-green-400" : "text-red-400",
                            )}
                          >
                            {trade.type}
                          </span>
                        </td>
                        <td className="py-2 text-right text-text-secondary">
                          {trade.price.toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-text-secondary">
                          {trade.quantity.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

