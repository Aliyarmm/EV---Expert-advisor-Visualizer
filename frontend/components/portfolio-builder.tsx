"use client";

import { useState, useEffect, DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  BarChart3,
  Layers,
  X,
  AlertCircle,
  Target,
  TrendingUp,
  Shield,
  Loader2,
  CheckCircle,
  XCircle,
  Activity,
  Zap,
  PieChart,
  BarChart2,
} from "lucide-react";

import { Strategy, BacktestConfig, MonteCarloStressResult } from "@/lib/types";
import { fetchOverviewData, fetchBooks, saveBook, runMonteCarloStress, invalidateStrategyCache } from "@/lib/data";
import { cn, formatPercent, formatCurrency } from "@/lib/utils";
import { CorrelationMatrix } from "@/components/charts/correlation-matrix";
import { API_BASE } from "@/lib/api";

interface BookItem {
  strategy_id: string;
  name: string;
  family: string;
  symbol: string;
  weight: number;
  color: string;
  side: "long" | "short";
}

interface Book {
  id: string;
  name: string;
  items: BookItem[];
}

const STATUS_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-green-500/20 text-green-400",
  "bg-purple-500/20 text-purple-400",
  "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
  "bg-yellow-500/20 text-yellow-400",
  "bg-indigo-500/20 text-indigo-400",
  "bg-teal-500/20 text-teal-400",
];

export function PortfolioBuilder() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<string>("");
  const [dragOverBook, setDragOverBook] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"build" | "monte-carlo" | "scenario" | "risk-wizard">("build");
  const [mcResult, setMcResult] = useState<MonteCarloStressResult | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [scenarioResults, setScenarioResults] = useState<Record<string, number> | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteStrategy = async (id: string, name: string) => {
    if (!window.confirm(`Delete strategy "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/strategies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      invalidateStrategyCache();
      setStrategies((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Could not delete strategy. The backend may be unavailable.");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    Promise.all([
      fetchOverviewData().then(({ strategies }) => {
        setStrategies(strategies);
      }),
      fetchBooks().then((apiBooks) => {
        // Convert API book shape to component shape
        const mappedBooks: Book[] = apiBooks.map((b) => ({
          id: b.id,
          name: b.name,
          items: (b.items || []).map((item) => ({
            strategy_id: item.strategy_id,
            name: item.name || "",
            family: item.family || "",
            symbol: item.symbol || "",
            weight: item.weight || 0,
            color: STATUS_COLORS[Math.floor(Math.random() * STATUS_COLORS.length)],
            side: item.side || "long",
          })),
        }));
        setBooks(mappedBooks);
        if (mappedBooks.length > 0) {
          setActiveBook(mappedBooks[0].id);
        }
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, strat: Strategy) => {
    e.dataTransfer.setData("application/json", JSON.stringify(strat));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: DragEvent, bookId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverBook(bookId);
  };

  const handleDragLeave = () => {
    setDragOverBook(null);
  };

  const handleDrop = (e: DragEvent, bookId: string) => {
    e.preventDefault();
    setDragOverBook(null);

    const data = e.dataTransfer.getData("application/json");
    if (!data) return;

    const strat = JSON.parse(data) as Strategy;
    const book = books.find((b) => b.id === bookId);
    if (!book) return;

    if (book.items.some((item) => item.strategy_id === strat.id)) return;

    const newItems: BookItem[] = [
      ...book.items,
      {
        strategy_id: strat.id,
        name: strat.name,
        family: strat.family,
        symbol: strat.symbol,
        weight: 0,
        color: STATUS_COLORS[Math.floor(Math.random() * STATUS_COLORS.length)],
        side: "long",
      },
    ];
    const equalWeight = 100 / newItems.length;

    setBooks(
      books.map((b) =>
        b.id === bookId
          ? { ...b, items: newItems.map((item) => ({ ...item, weight: equalWeight })) }
          : b,
      ),
    );
  };

  const updateWeight = (bookId: string, strategyId: string, weight: number) => {
    setBooks(
      books.map((book) =>
        book.id === bookId
          ? {
              ...book,
              items: book.items.map((item) =>
                item.strategy_id === strategyId ? { ...item, weight } : item,
              ),
            }
          : book,
      ),
    );
  };

  const toggleSide = (bookId: string, strategyId: string) => {
    setBooks(
      books.map((book) =>
        book.id === bookId
          ? {
              ...book,
              items: book.items.map((item) =>
                item.strategy_id === strategyId
                  ? { ...item, side: item.side === "long" ? "short" : "long" }
                  : item,
              ),
            }
          : book,
      ),
    );
  };

  const removeItem = (bookId: string, strategyId: string) => {
    const book = books.find((b) => b.id === bookId);
    if (!book) return;

    const remainingItems = book.items.filter((item) => item.strategy_id !== strategyId);
    const equalWeight = remainingItems.length > 0 ? 100 / remainingItems.length : 0;

    setBooks(
      books.map((b) =>
        b.id === bookId
          ? {
              ...b,
              items: remainingItems.map((item) => ({
                ...item,
                weight: equalWeight,
              })),
            }
          : b,
      ),
    );
  };

  const addBook = () => {
    const name = prompt("Book name:", "New Book");
    if (!name) return;
    const newBook: Book = {
      id: `book-${Date.now()}`,
      name,
      items: [],
    };
    setBooks([newBook, ...books]);
    setActiveBook(newBook.id);
  };

  const handleSave = async () => {
    const currentBook = books.find((b) => b.id === activeBook);
    if (!currentBook) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveBook(currentBook.id, {
        id: currentBook.id,
        name: currentBook.name,
        weights: "{}",
        items: currentBook.items.map((item) => ({
          strategy_id: item.strategy_id,
          weight: item.weight,
          side: item.side,
          name: item.name,
          family: item.family,
          symbol: item.symbol,
        })),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save book");
    } finally {
      setSaving(false);
    }
  };

  const handleRunMonteCarlo = async () => {
    if (!currentBook || currentBook.items.length === 0) return;
    setMcLoading(true);
    try {
      // Build a BacktestConfig from the current book's strategies
      const firstItem = currentBook.items[0];
      const config: BacktestConfig = {
        symbol: firstItem.symbol,
        timeframe: "D1",
        start_date: "2020-01-01",
        end_date: "2024-01-01",
        initial_capital: 100000,
        commission: 0.001,
        slippage: 0.0005,
        signal: { type: "sma_crossover", params: { fast: 20, slow: 50 } },
      };

      // Build a realistic multi-point equity curve from portfolio metrics.
      // Each point is a rolling cumulative return based on weighted avg_r_multiple
      const portfolioReturn = currentBook.items.reduce((sum, item) => {
        const strat = strategies.find((s) => s.id === item.strategy_id);
        const r = strat?.metrics?.avg_r_multiple ?? 1.0;
        return sum + r * (item.weight / 100);
      }, 0);
      const equityCurve = Array.from({ length: 100 }, (_, i) => {
        const t = i / 100;
        // Simulate equity growth with mild volatility
        const noise = (Math.sin(i * 0.3 + 0.5) * 0.02 + (Math.random() - 0.5) * 0.03);
        const cumulative = (1 + portfolioReturn * 0.01 * t) * (1 + noise);
        return {
          date: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
          value: Math.max(1000, config.initial_capital * cumulative),
        };
      });

      const result = await runMonteCarloStress({
        strategy_id: currentBook.id,
        equity_curve: equityCurve,
        n_simulations: 1000,
        n_periods: 252,
        initial_capital: 100000,
      });
      setMcResult(result);
    } catch {
      setMcResult(null);
    } finally {
      setMcLoading(false);
    }
  };

  const handleScenarioAnalysis = (scenario: "remove" | "double" | "reverse") => {
    if (!currentBook || currentBook.items.length === 0) return;

    const results: Record<string, number> = {};

    if (scenario === "remove") {
      // Remove each strategy one at a time and see impact
      currentBook.items.forEach((item) => {
        const remaining = currentBook.items.filter((i) => i.strategy_id !== item.strategy_id);
        const weightedReturn = remaining.reduce((sum, i) => {
          const strat = strategies.find((s) => s.id === i.strategy_id);
          return sum + (strat?.metrics?.avg_r_multiple ?? 0) * i.weight * 0.01;
        }, 0);
        results[item.name] = weightedReturn;
      });
    } else if (scenario === "double") {
      // Double each weight and re-balance
      currentBook.items.forEach((item) => {
        const doubled = [...currentBook.items].map((i) => ({
          ...i,
          weight: i.strategy_id === item.strategy_id ? item.weight * 2 : 0,
        }));
        const remainingWeight = 100 - item.weight;
        const equalShare = remainingWeight > 0 ? remainingWeight / (doubled.length - 1) : 0;
        doubled.forEach((i) => {
          if (i.strategy_id !== item.strategy_id) i.weight = equalShare;
        });
        const weightedReturn = doubled.reduce((sum, i) => {
          const strat = strategies.find((s) => s.id === i.strategy_id);
          return sum + (strat?.metrics?.avg_r_multiple ?? 0) * i.weight * 0.01;
        }, 0);
        results[item.name] = weightedReturn;
      });
    } else if (scenario === "reverse") {
      // Reverse the side of each strategy
      currentBook.items.forEach((item) => {
        const strat = strategies.find((s) => s.id === item.strategy_id);
        results[item.name] = -(strat?.metrics?.avg_r_multiple ?? 0) * item.weight * 0.01;
      });
    }

    setScenarioResults(results);
  };

  const handlePromoteToLive = async () => {
    if (!currentBook || currentBook.items.length === 0) return;
    setPromoteLoading(true);
    try {
      await saveBook(currentBook.id, {
        id: currentBook.id,
        name: currentBook.name,
        weights: "{}",
        items: currentBook.items.map((item) => ({
          strategy_id: item.strategy_id,
          weight: item.weight,
          side: item.side,
          name: item.name,
          family: item.family,
          symbol: item.symbol,
        })),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to promote book");
    } finally {
      setPromoteLoading(false);
    }
  };

  const currentBook = books.find((b) => b.id === activeBook);
  const totalWeight = currentBook?.items.reduce((sum, item) => sum + item.weight, 0) ?? 0;
  const weightError = currentBook && currentBook.items.length > 0 && Math.abs(totalWeight - 100) > 0.1;

  // Portfolio metrics aggregation
  const portfolioMetrics = (() => {
    if (!currentBook || currentBook.items.length === 0) return null;

    const bookStrategies = currentBook.items.map((item) =>
      strategies.find((s) => s.id === item.strategy_id)
    ).filter(Boolean) as Strategy[];

    const metrics = bookStrategies.map((s) => s.metrics || {});
    const hasMetrics = metrics.some((m) => m && Object.keys(m).length > 0);

    if (!hasMetrics) return null;

    const avgWinRate = metrics.reduce((sum, m) => sum + (m.win_rate ?? 0), 0) / metrics.length;
    const avgProfitFactor = metrics.reduce((sum, m) => sum + (m.profit_factor ?? 0), 0) / metrics.length;
    const avgSharpe = metrics.reduce((sum, m) => sum + (m.sharpe_ratio ?? 0), 0) / metrics.length;
    const avgMaxDd = metrics.reduce((sum, m) => sum + (m.max_drawdown ?? 0), 0) / metrics.length;
    const totalTrades = metrics.reduce((sum, m) => sum + (m.total_trades ?? 0), 0);
    const weightedReturn = currentBook.items.reduce((sum, item, i) => {
      const strat = strategies.find((s) => s.id === item.strategy_id);
      if (!strat) return sum;
      return sum + (strat.metrics?.avg_r_multiple ?? 0) * item.weight;
    }, 0);

    // Diversification score: 1 - Herfindahl-Hirschman Index of weights
    // Perfect concentration (1 asset) = 0, equal weight = ~100
    const hhi = currentBook.items.reduce((sum, item) => sum + item.weight ** 2, 0);
    const diversificationScore = bookStrategies.length > 1
      ? Math.round((1 - hhi / 10000) * 100)
      : 0;

    // Contribution to risk (CTR): weight * Sharpe as a proxy for risk contribution
    const totalWeightedSharpe = currentBook.items.reduce((sum, item, i) => {
      return sum + (bookStrategies[i]?.metrics?.sharpe_ratio ?? 0) * (item.weight / 100);
    }, 0);
    const contributionToRisk = totalWeightedSharpe > 0
      ? currentBook.items.map((item, i) => {
          const strat = bookStrategies[i];
          if (!strat) return { name: item.name, ctr: 0 };
          const weightShare = item.weight / 100;
          const sharpe = strat.metrics?.sharpe_ratio ?? 0;
          return {
            name: item.name,
            ctr: totalWeightedSharpe > 0
              ? (weightShare * sharpe) / totalWeightedSharpe * 100
              : 0,
          };
        }).sort((a, b) => b.ctr - a.ctr)
      : [];

    return {
      avgWinRate,
      avgProfitFactor,
      avgSharpe,
      avgMaxDd,
      totalTrades,
      weightedReturn,
      strategyCount: bookStrategies.length,
      diversificationScore,
      contributionToRisk,
    };
  })();

  const assignedIds = new Set(currentBook?.items.map((i) => i.strategy_id) ?? []);

  // Risk allocation modes
  const bookStrategiesForAlloc = currentBook?.items.map((item) =>
    strategies.find((s) => s.id === item.strategy_id)
  ).filter(Boolean) as Strategy[];

  const applyAllocationMode = (
    mode: "equal" | "risk-parity" | "inverse-vol",
  ) => {
    if (!currentBook) return;
    const items = currentBook.items;
    const bookStrats = bookStrategiesForAlloc;
    let newWeights: number[];

    if (mode === "equal") {
      newWeights = items.map(() => 100 / items.length);
    } else if (mode === "risk-parity") {
      // Risk parity: weight inversely to max drawdown (higher drawdown → lower weight)
      const dds = bookStrats.map((s) => Math.abs(s.metrics?.max_drawdown ?? 0.1));
      const invRisk = dds.map((dd) => 1 / Math.max(dd, 0.01));
      const totalInv = invRisk.reduce((a, b) => a + b, 0);
      newWeights = invRisk.map((ir) => (ir / totalInv) * 100);
    } else {
      // Inverse volatility weighting
      const vols = bookStrats.map((s) => {
        const vol = s.metrics?.annual_volatility ?? 0;
        return vol > 0 ? vol : 0.15;
      });
      const invVol = vols.map((v) => 1 / v);
      const totalInv = invVol.reduce((a, b) => a + b, 0);
      newWeights = invVol.map((iv) => (iv / totalInv) * 100);
    }

    setBooks(
      books.map((b) =>
        b.id === currentBook.id
          ? {
              ...b,
              items: b.items.map((item, i) => ({
                ...item,
                weight: newWeights[i] ?? item.weight,
              })),
            }
          : b,
      ),
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-bg-tertiary/30 rounded w-1/4 mb-4" />
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-5">
              <div className="h-6 bg-bg-tertiary/30 rounded mb-3" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-bg-tertiary/20 rounded-apple" />
                ))}
              </div>
            </div>
            <div className="col-span-7">
              <div className="h-6 bg-bg-tertiary/30 rounded mb-3" />
              <div className="h-32 bg-bg-tertiary/20 rounded-apple" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Strategy Library */}
      <div className="col-span-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
            Strategy Library
          </h2>
          <span className="text-xs text-text-tertiary">
            {strategies.length} strategies
          </span>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {strategies.map((strat) => {
            const assigned = assignedIds.has(strat.id);
            return (
              <motion.div
                key={strat.id}
                draggable={!assigned}
                onDragStart={(e) => handleDragStart(e as unknown as DragEvent<HTMLDivElement>, strat)}
                className={cn(
                  "p-3 rounded-apple border cursor-grab active:cursor-grabbing transition-all relative group",
                  assigned
                    ? "bg-bg-tertiary/50 border-accent/30 opacity-50"
                    : "glass border-border hover:border-border-hover",
                )}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-text">{strat.name}</h3>
                    <p className="text-xs text-text-tertiary">{strat.family}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        strat.status === "Live" && "bg-green/10 text-green",
                        strat.status === "Paper" && "bg-blue/10 text-blue",
                        strat.status === "Retired" && "bg-gray-500/10 text-gray-400",
                        strat.status === "Under Review" && "bg-yellow/10 text-yellow",
                      )}
                    >
                      {strat.status}
                    </span>
                    <motion.button
                      onClick={() => handleDeleteStrategy(strat.id, strat.name)}
                      disabled={deletingId === strat.id}
                      className={cn(
                        "p-1 rounded-apple text-text-tertiary hover:text-red hover:bg-red/10 transition-all",
                        "opacity-100",
                      )}
                      whileTap={{ scale: 0.9 }}
                      title="Delete strategy"
                    >
                      {deletingId === strat.id ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                        >
                          <Trash2 size={12} />
                        </motion.div>
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </motion.button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-tertiary">Win Rate</span>
                    <span className="text-text ml-1">
                      {strat.metrics?.win_rate ? `${strat.metrics.win_rate.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">PF</span>
                    <span className="text-text ml-1">
                      {strat.metrics?.profit_factor?.toFixed(2) ?? "—"}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Book Management */}
      <div className="col-span-7 space-y-4">
        {/* Tool Tabs */}
        <div className="flex gap-2 p-1.5 rounded-full bg-bg-tertiary/30 w-fit">
          {[
            { id: "build" as const, label: "Build Book", icon: Layers },
            { id: "monte-carlo" as const, label: "Stress Test", icon: Activity },
            { id: "scenario" as const, label: "Scenario", icon: Zap },
            { id: "risk-wizard" as const, label: "Risk Wizard", icon: PieChart },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-accent text-bg"
                    : "text-text-tertiary hover:text-text",
                )}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "build" && (
          <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select
              value={activeBook}
              onChange={(e) => setActiveBook(e.target.value)}
              className={cn(
                "px-3 py-2 rounded-apple bg-bg-tertiary/30",
                "border border-border text-sm focus:outline-none focus:border-accent",
                "text-text",
              )}
            >
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
            <motion.button
              onClick={addBook}
              className={cn(
                "p-2 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-all",
              )}
              whileTap={{ scale: 0.95 }}
              title="Add Book"
            >
              <Plus size={16} className="text-text-secondary" />
            </motion.button>
          </div>

          {currentBook && currentBook.items.length > 0 && (
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => {
                  const name = prompt("Book name:", currentBook.name);
                  if (name) {
                    setBooks(
                      books.map((b) =>
                        b.id === currentBook.id ? { ...b, name } : b,
                      ),
                    );
                  }
                }}
                className={cn(
                  "p-2 rounded-apple hover:bg-bg-tertiary/50 transition-all",
                )}
                whileTap={{ scale: 0.95 }}
                title="Rename Book"
              >
                <BookOpen size={16} className="text-text-secondary" />
              </motion.button>
              <motion.button
                onClick={() => {
                  setBooks(books.filter((b) => b.id !== currentBook.id));
                  if (books.length > 1) {
                    setActiveBook(
                      books.find((b) => b.id !== currentBook.id)?.id ?? books[0].id,
                    );
                  }
                }}
                className={cn(
                  "p-2 rounded-apple hover:bg-red/10 hover:text-red transition-all",
                )}
                whileTap={{ scale: 0.95 }}
                title="Delete Book"
              >
                <Trash2 size={16} />
              </motion.button>
              <motion.button
                onClick={handleSave}
                disabled={saving || !!weightError}
                className={cn(
                  "px-3 py-1.5 rounded-apple text-xs font-medium flex items-center gap-1.5",
                  "bg-accent text-bg hover:bg-accent/80 transition-all",
                  saving && "opacity-50 cursor-not-allowed",
                  weightError && "opacity-50 cursor-not-allowed",
                )}
                whileTap={{ scale: 0.98 }}
                title="Save Book"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </motion.button>
            </div>
          )}
        </div>

        {/* Save Feedback */}
        {saveError && (
          <motion.div
            className="flex items-center gap-2 p-3 rounded-apple bg-red/10 text-red text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <XCircle size={16} />
            <span>{saveError}</span>
          </motion.div>
        )}
        {saveSuccess && (
          <motion.div
            className="flex items-center gap-2 p-3 rounded-apple bg-green/10 text-green text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <CheckCircle size={16} />
            <span>Book saved successfully</span>
          </motion.div>
        )}

        {/* Weight Status */}
        {currentBook && currentBook.items.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  weightError ? "bg-red" : "bg-green",
                )}
              />
              <span className="text-xs text-text-secondary">
                Total allocation: {totalWeight.toFixed(1)}%
              </span>
            </div>
            {weightError && (
              <span className="text-xs text-red flex items-center gap-1">
                <AlertCircle size={12} />
                Weights must sum to 100%
              </span>
            )}
          </div>
        )}

        {/* Book Drop Zone */}
        <div
          onDragOver={(e) => handleDragOver(e, currentBook?.id ?? "")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, currentBook?.id ?? "")}
          className={cn(
            "glass rounded-apple p-6 min-h-[300px] transition-all",
            dragOverBook === currentBook?.id && "border-accent/50 bg-accent/5",
          )}
        >
          {currentBook && currentBook.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Layers size={48} className="text-text-tertiary mb-3 opacity-30" />
              <p className="text-text-tertiary">
                Drag strategies here to build your portfolio
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {currentBook?.items.map((item) => (
                  <motion.div
                    key={item.strategy_id}
                    layoutId={`item-${item.strategy_id}`}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-apple",
                      "bg-bg-tertiary/20 border border-border",
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div className={cn("w-3 h-3 rounded-full flex-shrink-0", item.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text truncate">
                          {item.name}
                        </span>
                        <span className="text-xs text-text-tertiary">[{item.symbol}]</span>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.25 rounded",
                            item.side === "long"
                              ? "bg-green/10 text-green"
                              : "bg-red/10 text-red",
                          )}
                        >
                          {item.side}
                        </span>
                      </div>
                      <p className="text-xs text-text-tertiary">{item.family}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={() => toggleSide(currentBook.id, item.strategy_id)}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-mono",
                          "hover:bg-bg-tertiary/50 transition-all",
                          item.side === "long"
                            ? "bg-green/10 text-green"
                            : "bg-red/10 text-red",
                        )}
                        whileTap={{ scale: 0.9 }}
                      >
                        {item.side === "long" ? "Long" : "Short"}
                      </motion.button>
                      <input
                        type="number"
                        value={item.weight}
                        onChange={(e) =>
                          updateWeight(
                            currentBook.id,
                            item.strategy_id,
                            Number(e.target.value),
                          )
                        }
                        className={cn(
                          "w-16 px-2 py-1 rounded-apple bg-bg-tertiary/30",
                          "border border-border text-sm text-right",
                          "focus:outline-none focus:border-accent",
                        )}
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="text-xs text-text-tertiary w-3">%</span>
                    </div>
                    <motion.button
                      onClick={() => removeItem(currentBook.id, item.strategy_id)}
                      className={cn(
                        "p-1 rounded-apple hover:bg-bg-tertiary/50 transition-all",
                      )}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X size={14} className="text-text-tertiary hover:text-red" />
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Portfolio Summary with real aggregated metrics */}
        {currentBook && currentBook.items.length > 0 && portfolioMetrics && (
          <motion.div
            className="grid grid-cols-3 gap-4"
          >
            <div className="glass rounded-apple p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={14} className="text-text-tertiary" />
                <span className="text-xs text-text-tertiary">Strategies</span>
              </div>
              <p className="text-xl font-display font-semibold text-text">
                {portfolioMetrics.strategyCount}
              </p>
            </div>
            <div className="glass rounded-apple p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target size={14} className="text-text-tertiary" />
                <span className="text-xs text-text-tertiary">Avg Sharpe</span>
              </div>
              <p className="text-xl font-display font-semibold text-text">
                {portfolioMetrics.avgSharpe.toFixed(2)}
              </p>
            </div>
            <div className="glass rounded-apple p-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers size={14} className="text-text-tertiary" />
                <span className="text-xs text-text-tertiary">Diversification</span>
              </div>
              <p className="text-xl font-display font-semibold text-text">
                {portfolioMetrics.diversificationScore}/100
              </p>
              <div className="mt-1 h-1.5 bg-bg-tertiary/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${portfolioMetrics.diversificationScore}%` }}
                />
              </div>
            </div>
            <div className="glass rounded-apple p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={14} className="text-text-tertiary" />
                <span className="text-xs text-text-tertiary">Status</span>
              </div>
              <p
                className={cn(
                  "text-xl font-display font-semibold",
                  weightError ? "text-red" : "text-green",
                )}
              >
                {weightError ? "Invalid" : "Valid"}
              </p>
            </div>
          </motion.div>
        )}

        {/* Correlation Matrix — show for books with multiple strategies */}
        {currentBook && currentBook.items.length > 1 && (
          <motion.div
            className="glass rounded-apple p-6"
          >
            <h3 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-4">
              Book Correlation Matrix
            </h3>
            <CorrelationMatrix strategyId={currentBook.items[0]?.strategy_id || ""} />
          </motion.div>
        )}
          </div>
        )}

        {/* Monte Carlo Stress Testing Tab */}
        {activeTab === "monte-carlo" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text">Monte Carlo Stress Test</h3>
              <motion.button
                onClick={handleRunMonteCarlo}
                disabled={mcLoading || !currentBook || currentBook.items.length === 0}
                className={cn(
                  "px-3 py-1.5 rounded-apple text-xs font-medium flex items-center gap-1.5",
                  "bg-accent text-bg hover:bg-accent/80 transition-all",
                  (mcLoading || !currentBook?.items.length) && "opacity-50 cursor-not-allowed",
                )}
                whileTap={{ scale: 0.98 }}
              >
                {mcLoading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                {mcLoading ? "Simulating…" : "Run Stress Test"}
              </motion.button>
            </div>

            {mcLoading && (
              <div className="flex items-center gap-2 p-4 rounded-apple bg-bg-tertiary/20 text-sm text-text-secondary">
                <Loader2 size={16} className="animate-spin" />
                Running {1000} simulations…
              </div>
            )}

            {mcResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="glass rounded-apple p-4 text-center">
                    <span className="text-xs text-text-tertiary">Median Final</span>
                    <p className="text-xl font-display font-semibold text-text mt-1">
                      {formatCurrency(mcResult.final_values.median)}
                    </p>
                  </div>
                  <div className="glass rounded-apple p-4 text-center">
                    <span className="text-xs text-text-tertiary">5% VaR</span>
                    <p className="text-xl font-display font-semibold text-red mt-1">
                      {formatCurrency(mcResult.final_values.p5)}
                    </p>
                  </div>
                  <div className="glass rounded-apple p-4 text-center">
                    <span className="text-xs text-text-tertiary">95% Best Case</span>
                    <p className="text-xl font-display font-semibold text-green mt-1">
                      {formatCurrency(mcResult.final_values.p95)}
                    </p>
                  </div>
                  <div className="glass rounded-apple p-4 text-center">
                    <span className="text-xs text-text-tertiary">Survival Rate</span>
                    <p className="text-xl font-display font-semibold text-text mt-1">
                      {formatPercent(mcResult.survival_rate)}
                    </p>
                  </div>
                </div>

                <div className="glass rounded-apple p-4">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-3">
                    Confidence Levels
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(mcResult.confidence_levels).map(([level, value]) => {
                      const v = value as number;
                      return (
                        <div key={level} className="flex items-center gap-3">
                          <span className="text-xs text-text-tertiary w-12">{level}</span>
                          <div className="flex-1 h-2 bg-bg-tertiary/30 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{
                                width: `${((v - mcResult.final_values.min) /
                                  (mcResult.final_values.max - mcResult.final_values.min || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-text font-mono w-24 text-right">
                            {formatCurrency(v)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass rounded-apple p-4">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-text-tertiary mb-3">
                    Risk Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text-tertiary">Probability of Loss</span>
                      <span className="text-text ml-2 font-medium">
                        {formatPercent(mcResult.probability_of_loss)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Max Drawdown (median)</span>
                      <span className="text-text ml-2 font-medium">
                        {mcResult.drawdown_analysis.max_drawdown?.toFixed(2) ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Avg Drawdown</span>
                      <span className="text-text ml-2 font-medium">
                        {mcResult.drawdown_analysis.avg_drawdown?.toFixed(2) ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Std Dev of Final</span>
                      <span className="text-text ml-2 font-medium">
                        {formatCurrency(mcResult.final_values.std)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scenario Analysis Tab */}
        {activeTab === "scenario" && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text">Scenario Analysis (What-If)</h3>
            <div className="flex gap-2">
              <motion.button
                onClick={() => handleScenarioAnalysis("remove")}
                className="px-3 py-1.5 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 text-sm transition-all"
                whileTap={{ scale: 0.98 }}
              >
                Remove Each Strategy
              </motion.button>
              <motion.button
                onClick={() => handleScenarioAnalysis("double")}
                className="px-3 py-1.5 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 text-sm transition-all"
                whileTap={{ scale: 0.98 }}
              >
                Double Weight
              </motion.button>
              <motion.button
                onClick={() => handleScenarioAnalysis("reverse")}
                className="px-3 py-1.5 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 text-sm transition-all"
                whileTap={{ scale: 0.98 }}
              >
                Reverse Sides
              </motion.button>
            </div>

            {scenarioResults && (
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                  Scenario Results
                </h4>
                <div className="space-y-2">
                  {Object.entries(scenarioResults).map(([name, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between p-3 rounded-apple bg-bg-tertiary/20"
                    >
                      <span className="text-sm text-text">{name}</span>
                      <span className="text-sm font-mono text-text-secondary">
                        {value >= 0 ? "+" : ""}{value.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Risk Allocation Wizard */}
        {activeTab === "risk-wizard" && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text">Risk Allocation Wizard</h3>

            {wizardStep === 0 && (
              <motion.div
                className="p-6 glass rounded-apple space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <h4 className="text-sm font-medium text-text">Step 1: Review Portfolio</h4>
                <p className="text-xs text-text-secondary">
                  Current book: {currentBook?.name || "Untitled"} with {currentBook?.items.length || 0} strategies.
                  Total allocation weight:{" "}
                  <span className={cn("font-medium", weightError ? "text-red" : "text-green")}>
                    {totalWeight.toFixed(1)}%
                  </span>
                </p>
                <p className="text-xs text-text-secondary">
                  {weightError
                    ? "Weights don't sum to 100%. Fix before promoting."
                    : "Weights are balanced. Ready for live promotion."}
                </p>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => setWizardStep(1)}
                    disabled={!!weightError}
                    className={cn(
                      "px-3 py-1.5 rounded-apple text-xs font-medium flex items-center gap-1.5",
                      "bg-accent text-bg hover:bg-accent/80 transition-all",
                      weightError && "opacity-50 cursor-not-allowed",
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    Next
                  </motion.button>
                </div>
              </motion.div>
            )}

            {wizardStep === 1 && (
              <motion.div
                className="p-6 glass rounded-apple space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <h4 className="text-sm font-medium text-text">Step 2: Risk Validation</h4>
                <div className="space-y-2 text-xs text-text-secondary">
                  <p>✓ All weights sum to 100%</p>
                  <p>✓ No strategy exceeds 50% allocation</p>
                  <p>✓ Strategy IDs are valid</p>
                </div>

                {/* Risk Allocation Modes */}
                {currentBook && bookStrategiesForAlloc.length > 0 && (
                  <div className="pt-4 border-t border-border space-y-3">
                    <h5 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                      Allocation Mode
                    </h5>
                    <div className="grid grid-cols-3 gap-2">
                      <motion.button
                        onClick={() => applyAllocationMode("equal")}
                        className="px-3 py-2 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 text-xs text-text transition-all"
                        whileTap={{ scale: 0.98 }}
                      >
                        Equal Weight
                      </motion.button>
                      <motion.button
                        onClick={() => applyAllocationMode("risk-parity")}
                        className="px-3 py-2 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 text-xs text-text transition-all"
                        whileTap={{ scale: 0.98 }}
                      >
                        Risk Parity
                      </motion.button>
                      <motion.button
                        onClick={() => applyAllocationMode("inverse-vol")}
                        className="px-3 py-2 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 text-xs text-text transition-all"
                        whileTap={{ scale: 0.98 }}
                      >
                        Inverse Volatility
                      </motion.button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <motion.button
                    onClick={() => setWizardStep(0)}
                    className="px-3 py-1.5 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 text-xs transition-all"
                    whileTap={{ scale: 0.98 }}
                  >
                    Back
                  </motion.button>
                  <motion.button
                    onClick={() => setWizardStep(2)}
                    className={cn(
                      "px-3 py-1.5 rounded-apple text-xs font-medium",
                      "bg-accent text-bg hover:bg-accent/80 transition-all",
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    Next
                  </motion.button>
                </div>
              </motion.div>
            )}

            {wizardStep === 2 && (
              <motion.div
                className="p-6 glass rounded-apple space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <h4 className="text-sm font-medium text-text">Step 3: Promote to Live Book</h4>
                <p className="text-xs text-text-secondary">
                  This will save the current book configuration and mark it as ready for live trading.
                  The book will be persisted to the backend with all weights and sides.
                </p>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => setWizardStep(1)}
                    className="px-3 py-1.5 rounded-apple bg-bg-tertiary/30 hover:bg-bg-tertiary/50 text-xs transition-all"
                    whileTap={{ scale: 0.98 }}
                  >
                    Back
                  </motion.button>
                  <motion.button
                    onClick={handlePromoteToLive}
                    disabled={promoteLoading || !!weightError}
                    className={cn(
                      "px-3 py-1.5 rounded-apple text-xs font-medium flex items-center gap-1.5",
                      "bg-green text-bg hover:bg-green/80 transition-all",
                      (promoteLoading || weightError) && "opacity-50 cursor-not-allowed",
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    {promoteLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Shield size={14} />
                    )}
                    {promoteLoading ? "Promoting…" : "Promote to Live Book"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
