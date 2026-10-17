/**
 * Formatting utilities for EA Index.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format large numbers with SI suffixes
export function formatNumber(num: number, decimals: number = 1): string {
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

// Format percentage — supports both 0-1 and 0-100 scales.
// Very small non-zero fractions (< 0.01 absolute, i.e. < 1%) are treated as
// decimal fractions and multiplied by 100 (e.g. 0.006 → 0.60%).
// All other values are passed through as percentage units directly (e.g. 0.6 → 0.60%).
export function formatPercent(num: number, decimals: number = 2): string {
  if (Math.abs(num) < 0.01 && num !== 0) {
    return `${num >= 0 ? "+" : ""}${(num * 100).toFixed(decimals)}%`;
  }
  return `${num >= 0 ? "+" : ""}${num.toFixed(decimals)}%`;
}

export function formatPercentRaw(num: number, decimals: number = 2): string {
  return `${num >= 0 ? "+" : ""}${num.toFixed(decimals)}%`;
}

export function formatCurrency(num: number, currency: string = "$"): string {
  if (Math.abs(num) >= 1e9) return `${currency}${(num / 1e9).toFixed(2)}B`;
  if (Math.abs(num) >= 1e6) return `${currency}${(num / 1e6).toFixed(2)}M`;
  if (Math.abs(num) >= 1e3) return `${currency}${(num / 1e3).toFixed(1)}K`;
  return `${currency}${num.toFixed(2)}`;
}

// Status badge color mapping
export const statusColors = {
  Live: "badge-live",
  Paper: "badge-paper",
  Retired: "badge-retired",
  "Under Review": "badge-review",
} as const;

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    Live: "text-green",
    Paper: "text-accent",
    Retired: "text-text-tertiary",
    "Under Review": "text-amber",
  };
  return map[status] || "text-text-tertiary";
}

// Keyboard shortcut label with platform detection
export function kbd(shortcut: string): string {
  const isMac = typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");
  const parts = shortcut.split("+").map((p) => {
    const key = p.trim();
    if (key === "Cmd") return isMac ? "⌘" : "Ctrl";
    if (key === "Ctrl") return isMac ? "⌘" : "Ctrl";
    if (key === "Alt") return "⌥";
    if (key === "Shift") return "⇧";
    if (key === "Space") return "␣";
    return key.toUpperCase();
  });
  return parts.join(isMac ? " + " : " + ");
}
