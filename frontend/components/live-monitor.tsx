"use client";

import type { ElementType, FormEvent } from "react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Wifi,
  WifiOff,
  Clock,
  BarChart3,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Zap,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PauseCircle,
  PlayCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { KpiCard } from "@/components/ui/kpi-card";

type BrokerType = "MT5" | "MT4" | "cTrader" | "Demo" | "Tradier" | "Alpaca";

interface BrokerConnection {
  id: string;
  type: BrokerType;
  name: string;
  server: string;
  account: string;
  status: "connected" | "disconnected" | "connecting";
  latency: number;
  lastConnected: string | null;
}

interface LiveTrade {
  id: string;
  strategy: string;
  symbol: string;
  side: "BUY" | "SELL";
  entry_price: number;
  current_price: number;
  pnl: number;
  pnl_pct: number;
  status: "open" | "closed";
  timestamp: string;
  broker_ref: string | null;
}

const BrokerIcon: Record<BrokerType, ElementType> = {
  MT5: Zap,
  MT4: Activity,
  cTrader: BarChart3,
  Demo: PlayCircle,
  Tradier: DollarSign,
  Alpaca: TrendingUp,
};

const BrokerColor: Record<BrokerType, string> = {
  MT5: "text-accent",
  MT4: "text-blue",
  cTrader: "text-purple",
  Demo: "text-green",
  Tradier: "text-orange",
  Alpaca: "text-teal",
};

const BROKER_SERVERS: Record<BrokerType, string[]> = {
  MT5: ["MetaQuotes-Demo", "MetaQuotes-Real", "Exness-MT5", "Pepperstone-MT5"],
  MT4: ["MetaQuotes-Demo", "Exness-MT4", "Pepperstone-MT4"],
  cTrader: ["cTrader-Open", "cTrader-Demo"],
  Demo: ["Simulated"],
  Tradier: ["Tradier-Sandbox", "Tradier-Live"],
  Alpaca: ["Alpaca-Paper", "Alpaca-Live"],
};

// Seed data for first install only — user removals persist to localStorage.
const SEED_CONNECTIONS: BrokerConnection[] = [
  {
    id: "conn-1",
    type: "MT5",
    name: "MetaQuotes Demo",
    server: "MetaQuotes-Demo",
    account: "12345678",
    status: "connected",
    latency: 12,
    lastConnected: "2024-10-13T09:31:00Z",
  },
  {
    id: "conn-2",
    type: "cTrader",
    name: "cTrader Live",
    server: "cTrader-Open",
    account: "TRADER-001",
    status: "connecting",
    latency: 0,
    lastConnected: null,
  },
  {
    id: "conn-3",
    type: "Demo",
    name: "Simulated Feed",
    server: "Simulated",
    account: "sim-01",
    status: "disconnected",
    latency: 0,
    lastConnected: "2024-10-13T08:00:00Z",
  },
];

const SEED_TRADES: LiveTrade[] = [
  {
    id: "1",
    strategy: "Nasdaq Racer",
    symbol: "NQZ4",
    side: "BUY",
    entry_price: 19250.0,
    current_price: 19312.5,
    pnl: 625.0,
    pnl_pct: 3.25,
    status: "open",
    timestamp: "2024-10-13T09:31:00Z",
    broker_ref: "MT5",
  },
  {
    id: "2",
    strategy: "Gold Breakout",
    symbol: "XAUUSD",
    side: "BUY",
    entry_price: 2745.0,
    current_price: 2738.3,
    pnl: -67.0,
    pnl_pct: -2.44,
    status: "open",
    timestamp: "2024-10-13T09:45:00Z",
    broker_ref: "cTrader",
  },
  {
    id: "3",
    strategy: "EUR/USD Momentum",
    symbol: "EURUSD",
    side: "SELL",
    entry_price: 1.085,
    current_price: 1.0832,
    pnl: 180.0,
    pnl_pct: 2.1,
    status: "open",
    timestamp: "2024-10-13T09:52:00Z",
    broker_ref: "Demo",
  },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

export function LiveMonitor() {
  const [connections, setConnections] = useState<BrokerConnection[]>(() =>
    loadFromStorage("ea-index-connections", SEED_CONNECTIONS),
  );

  const [showAddBroker, setShowAddBroker] = useState(false);
  const [newBroker, setNewBroker] = useState<Partial<BrokerConnection>>({
    type: "MT5",
  });
  const [showBrokerConnections, setShowBrokerConnections] = useState(true);

  // Persist toggle preference
  useEffect(() => {
    const saved = localStorage.getItem("ea-index-show-broker-connections");
    if (saved !== null) setShowBrokerConnections(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("ea-index-show-broker-connections", String(showBrokerConnections));
  }, [showBrokerConnections]);

  const [trades, setTrades] = useState<LiveTrade[]>(() =>
    loadFromStorage("ea-index-trades", SEED_TRADES),
  );

  // Persist connections & trades to localStorage
  useEffect(() => {
    localStorage.setItem("ea-index-connections", JSON.stringify(connections));
  }, [connections]);

  useEffect(() => {
    localStorage.setItem("ea-index-trades", JSON.stringify(trades));
  }, [trades]);

  // Start as null so SSR markup matches the client's first render, then set
  // the real clock after mount (avoids a React #418 hydration mismatch).
  const [time, setTime] = useState<Date | null>(null);

  const connectedCount = connections.filter((c) => c.status === "connected").length;
  const totalPnl = trades.filter((t) => t.status === "open").reduce((sum, t) => sum + t.pnl, 0);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
      // Simulate latency fluctuation on connected connections only
      setConnections((prev) =>
        prev.map((c) => {
          if (c.status === "connected") {
            return { ...c, latency: Math.max(5, Math.round(c.latency + (Math.random() - 0.5) * 4)) };
          }
          return c;
        }),
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddBroker = (e: FormEvent) => {
    e.preventDefault();
    const broker: BrokerConnection = {
      id: `conn-${Date.now()}`,
      type: newBroker.type as BrokerType,
      name: newBroker.name || `${newBroker.type} Account`,
      server: newBroker.server || "",
      account: newBroker.account || "",
      status: "connecting",
      latency: 0,
      lastConnected: null,
    };
    setConnections((prev) => [broker, ...prev]);
    setShowAddBroker(false);
    setNewBroker({ type: "MT5" });
    window.setTimeout(() => {
      setConnections((prev) =>
        prev.map((c) =>
          c.id === broker.id
            ? { ...c, status: "connected", latency: 8 + Math.floor(Math.random() * 30), lastConnected: new Date().toISOString() }
            : c,
        ),
      );
    }, 1800);
  };

  const removeConnection = (id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const removeTrade = (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleConnection = (id: string) => {
    setConnections((prev) => {
      const target = prev.find((c) => c.id === id);
      const willConnect = target && target.status !== "connected";
      if (willConnect) {
        window.setTimeout(() => {
          setConnections((cur) =>
            cur.map((c) =>
              c.id === id && c.status === "connecting"
                ? { ...c, status: "connected", latency: 8 + Math.floor(Math.random() * 30), lastConnected: new Date().toISOString() }
                : c,
            ),
          );
        }, 1200);
      }
      return prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: c.status === "connected" ? "disconnected" : "connecting",
              lastConnected: c.status === "disconnected" ? new Date().toISOString() : c.lastConnected,
            }
          : c,
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Broker Connections */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-mono uppercase tracking-widest text-text-tertiary">
            Broker Connections ({connectedCount} of {connections.length} connected)
          </h2>
          <motion.button
            onClick={() => setShowBrokerConnections(!showBrokerConnections)}
            className={cn(
              "p-1 rounded-apple text-text-tertiary hover:text-text hover:bg-bg-tertiary/50 transition-all",
            )}
            whileTap={{ scale: 0.9 }}
            title={showBrokerConnections ? "Hide connected accounts" : "Show connected accounts"}
          >
            {showBrokerConnections ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </motion.button>
        </div>
        <motion.button
          onClick={() => setShowAddBroker(true)}
          className={cn(
            "px-3 py-1.5 rounded-apple text-xs font-medium flex items-center gap-1.5",
            "bg-accent text-bg hover:bg-accent/80 transition-all",
          )}
          whileTap={{ scale: 0.98 }}
        >
          <Plus size={13} /> Add Broker
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {showBrokerConnections && (
          <motion.div
            key="broker-connections"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="grid grid-cols-3 gap-4"
          >
            {connections.map((conn, i) => {
          const Icon = BrokerIcon[conn.type];
          return (
            <motion.div
              key={conn.id}
              className="glass rounded-apple p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={cn("flex-shrink-0", BrokerColor[conn.type])} />
                <div>
                  <p className="text-sm font-medium text-text">{conn.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {conn.type} • {conn.server} • #{conn.account}
                  </p>
                  {conn.lastConnected && (
                    <p className="text-xs text-text-tertiary">
                      {/* Deterministic UTC slice: locale/timezone-dependent
                          toLocaleTimeString() differs between SSR and client. */}
                      Last connected: {conn.lastConnected.slice(11, 19)} UTC
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                    conn.status === "connected" && "bg-green/10 text-green",
                    conn.status === "connecting" && "bg-yellow/10 text-yellow",
                    conn.status === "disconnected" && "bg-red/10 text-red",
                  )}
                >
                  {conn.status === "connected" && <Wifi size={12} />}
                  {conn.status === "connecting" && <RefreshCw size={12} className="animate-spin" />}
                  {conn.status === "disconnected" && <WifiOff size={12} />}
                  {conn.status === "connected" && `${conn.latency}ms`}
                  {conn.status === "connecting" && "Connecting..."}
                  {conn.status === "disconnected" && "Offline"}
                </div>
                <motion.button
                  onClick={() => toggleConnection(conn.id)}
                  className={cn(
                    "p-1 rounded-apple hover:bg-bg-tertiary/50 transition-all",
                    conn.status === "connected" ? "text-yellow" : "text-green",
                  )}
                  whileTap={{ scale: 0.9 }}
                  title={conn.status === "connected" ? "Disconnect" : "Connect"}
                >
                  {conn.status === "connected" ? (
                    <PauseCircle size={14} />
                  ) : (
                    <PlayCircle size={14} />
                  )}
                </motion.button>
                <motion.button
                  onClick={() => removeConnection(conn.id)}
                  className="p-1 rounded-apple hover:bg-red/10 hover:text-red transition-all"
                  whileTap={{ scale: 0.9 }}
                  title="Remove connection"
                >
                  <Trash2 size={14} />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live P&L Summary */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Total Open P&L"
          value={totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`}
          icon={BarChart3}
          color={totalPnl >= 0 ? "text-green" : "text-red"}
        />
        <KpiCard
          label="Open Positions"
          value={trades.filter((t) => t.status === "open").length.toString()}
          icon={Activity}
          color="text-accent"
        />
        <KpiCard
          label="Winning"
          value={trades.filter((t) => t.status === "open" && t.pnl > 0).length.toString()}
          icon={TrendingUp}
          color="text-green"
        />
        <KpiCard
          label="Last Update"
          value={time ? time.toLocaleTimeString() : "—"}
          icon={Clock}
          color="text-text-tertiary"
        />
      </div>

      {/* Live Trades */}
      <div className="glass rounded-apple overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-mono uppercase tracking-widest text-text-tertiary">
            Live Positions
          </h3>
          <div className="text-xs text-text-tertiary">
            Latency updates every 2s
          </div>
        </div>
        <div className="overflow-y-auto max-h-96">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-3 px-4 text-xs text-text-tertiary">Strategy</th>
                <th className="text-left py-3 px-4 text-xs text-text-tertiary">Symbol</th>
                <th className="text-left py-3 px-4 text-xs text-text-tertiary">Broker</th>
                <th className="text-right py-3 px-4 text-xs text-text-tertiary">Entry</th>
                <th className="text-right py-3 px-4 text-xs text-text-tertiary">Current</th>
                <th className="text-right py-3 px-4 text-xs text-text-tertiary">P&L</th>
                <th className="text-right py-3 px-4 text-xs text-text-tertiary">Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const brokerConn = connections.find((c) => c.type === trade.broker_ref);
                const brokerLabel = brokerConn ? brokerConn.name : trade.broker_ref ?? "—";
                const BrokerBadgeIcon = trade.broker_ref ? BrokerIcon[trade.broker_ref as BrokerType] : Activity;
                return (
                  <motion.tr
                    key={trade.id}
                    className="border-b border-border/20 hover:bg-bg-tertiary/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-text">{trade.strategy}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text-secondary">{trade.symbol}</span>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.25 rounded",
                            trade.side === "BUY"
                              ? "bg-green/10 text-green"
                              : "bg-red/10 text-red",
                          )}
                        >
                          {trade.side}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <BrokerBadgeIcon size={12} className={cn(BrokerColor[trade.broker_ref as BrokerType] || "text-text-tertiary")} />
                        <span className="text-xs text-text-tertiary">{brokerLabel}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-text-secondary">
                      {trade.entry_price.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-text-secondary">
                      {trade.current_price.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          trade.pnl >= 0 ? "text-green" : "text-red",
                        )}
                      >
                        {trade.pnl >= 0 ? "+" : ""}
                        {formatCurrency(trade.pnl)} ({formatPercent(trade.pnl_pct)})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-text-tertiary text-xs">
                      {trade.timestamp.slice(11, 19)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <motion.button
                        onClick={() => removeTrade(trade.id)}
                        className="p-1 rounded-apple hover:bg-red/10 hover:text-red transition-all"
                        whileTap={{ scale: 0.9 }}
                        title="Remove position"
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Broker Dialog */}
      <AnimatePresence>
        {showAddBroker && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-bg/60 backdrop-blur-sm"
              onClick={() => setShowAddBroker(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md glass-pop rounded-apple p-6 m-4"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-semibold text-text">
                  Add Broker Connection
                </h3>
                <motion.button
                  onClick={() => setShowAddBroker(false)}
                  className="p-1 rounded-apple hover:bg-bg-tertiary/50 transition-all"
                  whileTap={{ scale: 0.9 }}
                >
                  <XCircle size={18} className="text-text-tertiary" />
                </motion.button>
              </div>

              <form onSubmit={handleAddBroker} className="space-y-4">
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Broker Type
                  </label>
                  <select
                    value={newBroker.type ?? "MT5"}
                    onChange={(e) =>
                      setNewBroker({ ...newBroker, type: e.target.value as BrokerType })
                    }
                    className={cn(
                      "w-full mt-1 px-3 py-2 rounded-apple bg-bg-tertiary/30",
                      "border border-border text-sm focus:outline-none focus:border-accent",
                      "text-text",
                    )}
                    required
                  >
                    {(Object.keys(BrokerIcon) as BrokerType[]).map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Account Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My MT5 Account"
                    value={newBroker.name ?? ""}
                    onChange={(e) => setNewBroker({ ...newBroker, name: e.target.value })}
                    className={cn(
                      "w-full mt-1 px-3 py-2 rounded-apple bg-bg-tertiary/30",
                      "border border-border text-sm focus:outline-none focus:border-accent",
                      "text-text placeholder:text-text-tertiary/50",
                    )}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Server
                  </label>
                  <select
                    value={newBroker.server ?? ""}
                    onChange={(e) => setNewBroker({ ...newBroker, server: e.target.value })}
                    className={cn(
                      "w-full mt-1 px-3 py-2 rounded-apple bg-bg-tertiary/30",
                      "border border-border text-sm focus:outline-none focus:border-accent",
                      "text-text",
                    )}
                    required
                  >
                    <option value="" disabled>
                      Select a server
                    </option>
                    {(BROKER_SERVERS[newBroker.type as BrokerType] ?? []).map((srv) => (
                      <option key={srv} value={srv}>
                        {srv}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
                    Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12345678"
                    value={newBroker.account ?? ""}
                    onChange={(e) => setNewBroker({ ...newBroker, account: e.target.value })}
                    className={cn(
                      "w-full mt-1 px-3 py-2 rounded-apple bg-bg-tertiary/30",
                      "border border-border text-sm focus:outline-none focus:border-accent",
                      "text-text placeholder:text-text-tertiary/50",
                    )}
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <motion.button
                    type="button"
                    onClick={() => setShowAddBroker(false)}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-apple text-xs font-medium",
                      "bg-bg-tertiary/30 hover:bg-bg-tertiary/50 transition-all",
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-apple text-xs font-medium flex items-center justify-center gap-1.5",
                      "bg-accent text-bg hover:bg-accent/80 transition-all",
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <CheckCircle size={13} />
                    Connect
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

