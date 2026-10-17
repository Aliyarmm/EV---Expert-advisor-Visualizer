// Local-first data layer for EV — Expert Advisor Visualizer.
// Caches API responses in localStorage with TTL for offline access.
// On online: sync with backend. On offline: serve from cache.

import { Strategy, OverviewMetrics, Book, BookMetric } from "@/lib/types";

const CACHE_PREFIX = "uv-visualizer-cache-v2";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(key: string): string {
  return `${CACHE_PREFIX}:${key}`;
}

// Check if we're online
export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}

// Get from cache
export function getCached<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(getCacheKey(key));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

// Set in cache
export function setCached<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + TTL,
    };
    localStorage.setItem(getCacheKey(key), JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable
  }
}

// Invalidate cache entry
export function invalidateCache(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getCacheKey(key));
}

// Invalidate all cache (e.g., after logout or manual refresh)
export function invalidateAll(): void {
  if (typeof window === "undefined") return;
  Object.keys(localStorage)
    .filter((k) => k.startsWith(CACHE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}

// Queue for offline mutations
export interface PendingMutation {
  id: string;
  action: "create" | "update" | "delete";
  entity: "book" | "strategy" | "data";
  data: any;
}

export function getPendingMutations(): PendingMutation[] {
  const raw = localStorage.getItem(getCacheKey("pending-mutations"));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addPendingMutation(mutation: Omit<PendingMutation, "id">): void {
  const mutations = getPendingMutations();
  mutations.push({ ...mutation, id: crypto.randomUUID() });
  setCached("pending-mutations", mutations);
}

export function clearPendingMutation(id: string): void {
  const mutations = getPendingMutations().filter((m) => m.id !== id);
  setCached("pending-mutations", mutations);
}

// Sync pending mutations when online
export async function flushPendingMutations(
  apiBase: string
): Promise<{ synced: number; failed: number }> {
  const mutations = getPendingMutations();
  let synced = 0;
  let failed = 0;

  for (const mutation of mutations) {
    try {
      let res: Response;
      const url = `${apiBase}/${mutation.entity === "book" ? "books" : mutation.entity}`;

      switch (mutation.action) {
        case "create":
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mutation.data),
          });
          break;
        case "update":
          res = await fetch(`${url}/${mutation.data.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mutation.data),
          });
          break;
        case "delete":
          res = await fetch(`${url}/${mutation.data.id}`, {
            method: "DELETE",
          });
          break;
      }

      if (res.ok) {
        clearPendingMutation(mutation.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// Enhanced API fetch with cache + offline fallback
export async function cachedFetch<T>(
  path: string,
  key: string,
  init?: RequestInit
): Promise<T> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";
  const url = `${API_BASE}${path}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      ...init,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = (await res.json()) as T;
    setCached(key, data);
    return data;
  } catch {
    const cached = getCached<T>(key);
    if (cached) {
      return cached;
    }
    throw new Error("Network error and no cached data available");
  }
}
