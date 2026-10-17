"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Library,
  BarChart3,
  BookOpen,
  Target,
  PlayCircle,
  Settings,
  Search,
  Command,
  X,
  HelpCircle,
} from "lucide-react";
import { cn, kbd } from "@/lib/utils";

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  shortcut: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Overview", href: "/", icon: Home, shortcut: "Cmd+0" },
  { key: "strategies", label: "Strategy Library", href: "/strategies", icon: Library, shortcut: "Cmd+1" },
  { key: "research", label: "Research Lab", href: "/research", icon: BarChart3, shortcut: "Cmd+2" },
  { key: "books", label: "Portfolio Books", href: "/books", icon: BookOpen, shortcut: "Cmd+3" },
  { key: "performance", label: "Performance", href: "/performance", icon: Target, shortcut: "Cmd+4" },
  { key: "live", label: "Live Trading", href: "/live", icon: PlayCircle, shortcut: "Cmd+5" },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings, shortcut: "Cmd+6" },
];

export function KeyboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [showHints, setShowHints] = useState(false);
  const [commandPalette, setCommandPalette] = useState(false);

  const navigateTo = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    if (commandPalette) {
      const timer = setTimeout(() => {
        setShowHints(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setShowHints(false);
    }
  }, [commandPalette]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept in input fields
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
        return;
      }
      if (active && active.hasAttribute("contenteditable")) return;

      // Cmd/Ctrl + / for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setCommandPalette(true);
        return;
      }

      // Escape to close command palette
      if (e.key === "Escape") {
        setCommandPalette(false);
        return;
      }

      // Number shortcuts: Cmd/Ctrl + 0-9 for navigation
      if ((e.metaKey || e.ctrlKey) && !isNaN(parseInt(e.key)) && e.key !== " ") {
        e.preventDefault();
        const idx = parseInt(e.key);
        if (idx === 0) {
          navigateTo("/");
        } else if (idx >= 1 && idx <= NAV_ITEMS.length - 1) {
          navigateTo(NAV_ITEMS[idx].href);
        }
        setCommandPalette(false);
        return;
      }

      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Focus search if available
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
        return;
      }

      // Arrow keys for navigation within command palette
      if (commandPalette) {
        const currentIdx = NAV_ITEMS.findIndex((item) => item.href === pathname);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          let newIdx;
          if (e.key === "ArrowDown") {
            newIdx = currentIdx < NAV_ITEMS.length - 1 ? currentIdx + 1 : 0;
          } else {
            newIdx = currentIdx > 0 ? currentIdx - 1 : NAV_ITEMS.length - 1;
          }
          // Dispatch navigation
          navigateTo(NAV_ITEMS[newIdx].href);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigateTo, pathname, commandPalette]);

  return (
    <AnimatePresence>
      {commandPalette && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-bg/60 backdrop-blur-sm"
            onClick={() => setCommandPalette(false)}
          />

          {/* Command palette */}
          <motion.div
            className="relative z-10 w-full max-w-md glass-pop rounded-apple p-2 pointer-events-auto"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {/* Search header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Command size={16} className="text-text-tertiary" />
              <input
                type="search"
                placeholder="Go to page... (↓↑ to navigate, Esc to close)"
                className="flex-1 bg-transparent text-sm focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setCommandPalette(false);
                  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    const currentIdx = NAV_ITEMS.findIndex((item) => item.href === pathname);
                    let newIdx;
                    if (e.key === "ArrowDown") {
                      newIdx = currentIdx < NAV_ITEMS.length - 1 ? currentIdx + 1 : 0;
                    } else {
                      newIdx = currentIdx > 0 ? currentIdx - 1 : NAV_ITEMS.length - 1;
                    }
                    navigateTo(NAV_ITEMS[newIdx].href);
                    setCommandPalette(false);
                  }
                }}
              />
            </div>

            {/* Navigation items */}
            <div className="py-1 max-h-80 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <motion.button
                    key={item.key}
                    onClick={() => {
                      navigateTo(item.href);
                      setCommandPalette(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left text-sm rounded-apple transition-all",
                      isActive
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text hover:bg-bg-tertiary/50",
                    )}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Icon size={16} />
                    <span className="flex-1">{item.label}</span>
                    <kbd className="text-xs text-text-tertiary bg-bg-tertiary/50 px-1.5 py-0.5 rounded">
                      {kbd(item.shortcut)}
                    </kbd>
                  </motion.button>
                );
              })}
            </div>

            {showHints && (
              <motion.div
                className="border-t border-border px-3 py-2 text-xs text-text-tertiary"
              >
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-bg-tertiary/50 rounded">{kbd("Cmd+K")}</kbd>
                  <span>Search strategies</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Global keyboard navigation hook for pages
export function useKeyboardNav() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
        return;
      }
      if (active && active.hasAttribute("contenteditable")) return;

      // Cmd/Ctrl + 0-9 for navigation
      if ((e.metaKey || e.ctrlKey) && !isNaN(parseInt(e.key))) {
        e.preventDefault();
        const idx = parseInt(e.key);
        if (idx === 0) {
          router.push("/");
        } else if (idx >= 1 && idx <= NAV_ITEMS.length - 1) {
          router.push(NAV_ITEMS[idx].href);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router, pathname]);
}
