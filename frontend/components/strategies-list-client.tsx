"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Search, ChevronDown, ChevronRight, Upload, Check, X, AlertTriangle, Trash2 } from "lucide-react";
import { StrategyCard } from "@/components/strategy-card";
import { Strategy } from "@/lib/types";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";
import { invalidateStrategyCache } from "@/lib/data";

interface StrategiesListClientProps {
  strategies: Strategy[];
}

const statuses = ["All", "Live", "Paper", "Under Review", "Retired"];

// Group strategies by family
function groupByFamily(strategies: Strategy[]): Record<string, Strategy[]> {
  const groups: Record<string, Strategy[]> = {};
  strategies.forEach((s) => {
    const family = s.family || "Uncategorized";
    if (!groups[family]) groups[family] = [];
    groups[family].push(s);
  });
  return groups;
}

// Family display names
const FAMILY_LABELS: Record<string, string> = {
  "Breakouts": "Breakouts",
  "Session Breakouts": "Session Breakouts",
  "Opening Momentum": "Opening Momentum",
  "Mean Reversion / Dip Buyer": "Mean Reversion",
  "Front-runners": "Front-runners",
  "Racers": "Racers",
};

export function StrategiesListClient({ strategies }: StrategiesListClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    () => new Set(Object.keys(groupByFamily(strategies)))
  );
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<"success" | "error" | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteStrategy = async (id: string, name: string) => {
    if (!window.confirm(`Delete strategy "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/strategies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      invalidateStrategyCache();
      window.location.reload();
    } catch {
      alert("Could not delete strategy. The backend may be unavailable.");
      setDeletingId(null);
    }
  };

  const handleImportStrategies = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Handle both single strategy and array of strategies
      const strategiesToImport = Array.isArray(parsed) ? parsed : [parsed];
      let successCount = 0;

      for (const strategyDef of strategiesToImport) {
        const res = await fetch(`${API_BASE}/strategies/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(strategyDef),
        });
        if (res.ok) successCount++;
      }

      setImportedCount(successCount);
      setImportResult(successCount > 0 ? "success" : "error");
      if (successCount > 0) {
        // Refresh the page to show imported strategies
        window.location.reload();
      }
    } catch {
      setImportResult("error");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const toggleFamily = (family: string) => {
    const newSet = new Set(expandedFamilies);
    if (newSet.has(family)) {
      newSet.delete(family);
    } else {
      newSet.add(family);
    }
    setExpandedFamilies(newSet);
  };

  const filtered = strategies.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === "All" || s.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const families = groupByFamily(filtered);
  const familyOrder = Object.keys(families).sort();

  return (
    <motion.div
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-semibold text-text">
          Strategy Library
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-tertiary">
            {filtered.length} strategies
          </span>
          <label className="relative flex items-center gap-2 px-3 py-1.5 rounded-apple bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-all cursor-pointer">
            <Upload size={13} />
            {importing ? "Importing..." : "Import Strategies"}
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportStrategies}
              disabled={importing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Import Feedback */}
      <AnimatePresence>
        {importResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "flex items-center gap-2 p-3 rounded-apple text-sm",
              importResult === "success"
                ? "bg-green/10 text-green"
                : "bg-red/10 text-red"
            )}
          >
            {importResult === "success" ? (
              <Check size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {importResult === "success"
              ? `Successfully imported ${importedCount} strateg${importedCount === 1 ? "y" : "ies"}! Reloading...`
              : "Import failed. Please check the file format."}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <motion.div
        className="glass rounded-apple p-4"
      >
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder="Search strategies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full pl-10 pr-3 py-2 rounded-apple bg-bg-tertiary/30",
                "border border-border focus:border-accent/50 focus:outline-none",
                "text-sm text-text placeholder-text-tertiary transition-colors",
              )}
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {statuses.map((s) => (
              <motion.button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-accent/30",
                  selectedStatus === s
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:text-text hover:bg-bg-tertiary/50",
                )}
                whileTap={{ scale: 0.97 }}
              >
                {s}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Family Groups */}
      <div className="space-y-4">
        {familyOrder.map((family, familyIdx) => {
          const familyStrategies = families[family];
          const isExpanded = expandedFamilies.has(family);
          const familyLabel = FAMILY_LABELS[family] || family;

          // Compute family-level aggregate metrics
          const familyMetrics = familyStrategies.map((s) => s.metrics || {});
          const avgSharpe = familyMetrics.reduce((sum, m) => sum + (m.sharpe_ratio || 0), 0) / familyMetrics.length;
          const avgWinRate = familyMetrics.reduce((sum, m) => sum + (m.win_rate || 0), 0) / familyMetrics.length;

          return (
            <motion.div
              key={family}
            >
              {/* Family Header — collapsible */}
              <motion.div
                className={cn(
                  "glass rounded-apple p-3 cursor-pointer",
                  "hover:bg-bg-tertiary/30 transition-all",
                )}
                onClick={() => toggleFamily(family)}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: isExpanded ? 0 : -90 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <ChevronDown size={16} className="text-text-tertiary" />
                    </motion.div>
                    <span className="font-medium text-text">{familyLabel}</span>
                    <span className="text-xs text-text-tertiary">
                      ({familyStrategies.length} strategies)
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-tertiary">
                    <span>Sharpe: {avgSharpe.toFixed(2)}</span>
                    <span>WR: {avgWinRate.toFixed(1)}%</span>
                  </div>
                </div>
              </motion.div>

              {/* Family Strategies Grid */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key={`grid-${family}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      duration: 0.25,
                      ease: "easeOut",
                    }}
                    className="overflow-hidden"
                  >
                    <div
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
                    >
                      {familyStrategies.map((strategy) => (
                        <div
                          key={strategy.id}
                          className="relative group"
                        >
                          <StrategyCard strategy={strategy} />
                          <motion.button
                            onClick={() => handleDeleteStrategy(strategy.id, strategy.name)}
                            disabled={deletingId === strategy.id}
                            className={cn(
                              "absolute top-2 right-2 p-1.5 rounded-apple",
                              "bg-bg-tertiary/50 text-text-tertiary hover:text-red hover:bg-red/10",
                              "opacity-0 group-hover:opacity-100 transition-all",
                              "focus:outline-none focus:ring-2 focus:ring-accent/30",
                            )}
                            whileTap={{ scale: 0.9 }}
                            title="Delete strategy"
                          >
                            {deletingId === strategy.id ? (
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
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <motion.div
            className="glass rounded-apple p-12 text-center"
          >
            <Search size={48} className="text-text-tertiary mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-text mb-2">No Strategies Found</h3>
            <p className="text-text-tertiary max-w-md mx-auto">
              {searchTerm || selectedStatus !== "All"
                ? "No strategies match your current filters. Try adjusting your search or filter criteria."
                : "Your strategy library is empty. Import strategies or configure backtest parameters to get started."}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
