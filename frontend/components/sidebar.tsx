"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Library,
  BarChart3,
  BookOpen,
  Settings,
  GitBranch,
  PlayCircle,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", href: "/", icon: Home },
  { name: "Strategy Library", href: "/strategies", icon: Library },
  { name: "Research Lab", href: "/research", icon: BarChart3 },
  { name: "Portfolio Books", href: "/books", icon: BookOpen },
  { name: "Performance", href: "/performance", icon: Target },
  { name: "Live Trading", href: "/live", icon: PlayCircle },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="w-64 h-screen overflow-y-auto glass border-r transition-theme"
    >
      <div className="h-full px-3 py-8">
        <div className="mb-8 px-2">
          <h1
            className="text-xs font-mono uppercase tracking-widest text-text-tertiary"
          >
            EA Index
          </h1>
        </div>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-apple text-sm font-medium transition-colors duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-accent/30",
                      isActive
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text hover:bg-bg-tertiary/50",
                    )}
                  >
                    <motion.div
                      animate={{ scale: isActive ? 1.1 : 1 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <Icon size={18} />
                    </motion.div>
                    {item.name}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
