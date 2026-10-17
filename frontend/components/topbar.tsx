"use client";

import { Moon, Sun, Bell, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  return (
    <header
      className="glass border-b px-4 h-14 flex items-center justify-between transition-theme"
    >
      <div className="flex items-center gap-4">
        <h2
          className="text-sm font-medium text-text-secondary"
        >
          Trading Research Platform
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          onClick={toggleTheme}
          className={cn(
            "p-2 rounded-full transition-colors duration-200",
            "hover:bg-bg-tertiary/50 text-text-secondary hover:text-text",
          )}
          aria-label="Toggle theme"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>

        <motion.button
          onClick={() => router.push("/live")}
          className={cn(
            "p-2 rounded-full transition-colors duration-200",
            "hover:bg-bg-tertiary/50 text-text-secondary hover:text-text relative",
          )}
          aria-label="Notifications"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <Bell size={18} />
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full"
          />
        </motion.button>

        <motion.button
          onClick={() => router.push("/settings")}
          className={cn(
            "p-1.5 rounded-full transition-colors duration-200",
            "hover:bg-bg-tertiary/50",
          )}
          aria-label="User menu"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <User size={20} />
        </motion.button>
      </div>
    </header>
  );
}
