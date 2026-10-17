"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  BarChart3,
  BookOpen,
  Settings,
  Search,
  Activity,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: TrendingUp,
    title: "Welcome to EA Index",
    description:
      "Your trading research platform for strategy backtesting, portfolio construction, and performance analysis.",
  },
  {
    icon: BookOpen,
    title: "Strategy Library",
    description:
      "Browse and filter strategies by signal type, family, and status. Each strategy has detailed performance metrics and equity curves.",
  },
  {
    icon: BarChart3,
    title: "Backtesting Lab",
    description:
      "Configure signal types, tune parameters, and run vectorized backtests with realistic commission and slippage modeling.",
  },
  {
    icon: Search,
    title: "Portfolio Builder",
    description:
      "Drag and drop strategies into portfolio books, allocate weights, and validate your portfolio construction.",
  },
  {
    icon: Activity,
    title: "Performance Dashboard",
    description:
      "Analyze portfolio-level KPIs, equity curves, risk contribution, and Monte Carlo simulations.",
  },
  {
    icon: Settings,
    title: "Export & Settings",
    description:
      "Export reports as PDF or CSV, manage data files, and configure risk parameters.",
  },
];

export function Onboarding({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);

  const handleComplete = () => {
    localStorage.setItem("ea-index-onboarded", "1");
    onDismiss();
  };

  const handleSkip = () => {
    localStorage.setItem("ea-index-onboarded", "1");
    onDismiss();
  };

  const handleDismiss = () => {
    localStorage.setItem("ea-index-onboarded", "1");
    onDismiss();
  };

  const current = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm"
      >
        <motion.div
          layout
          className="glass-pop rounded-apple w-full max-w-lg p-8 m-4"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    i === step
                      ? "bg-accent w-6 h-2"
                      : i < step
                      ? "bg-green w-2 h-2"
                      : "bg-border w-2 h-2",
                  )}
                />
              ))}
            </div>
            <motion.button
              onClick={handleDismiss}
              className="p-1 rounded-apple hover:bg-bg-tertiary/50 transition-all"
              whileTap={{ scale: 0.9 }}
            >
              <X size={14} className="text-text-tertiary" />
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-center mb-8"
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <div key={`icon-${step}`}>
                  <current.icon size={24} className="text-accent" />
                </div>
              </div>
              <h2 className="text-xl font-display font-semibold text-text mb-2">
                {current.title}
              </h2>
              <p
                className="text-sm text-text-secondary"
              >
                {current.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3">
            {step > 0 && (
              <motion.button
                onClick={() => setStep(step - 1)}
                className="flex-1 px-4 py-2 rounded-apple border border-border hover:bg-bg-tertiary/30 transition-all text-sm font-medium"
                whileTap={{ scale: 0.97 }}
              >
                Back
              </motion.button>
            )}
            {step < STEPS.length - 1 ? (
              <motion.button
                onClick={() => setStep(step + 1)}
                className={cn(
                  "flex-1 px-4 py-2 rounded-apple bg-accent text-bg font-medium transition-all",
                )}
                whileTap={{ scale: 0.97 }}
              >
                Next
              </motion.button>
            ) : (
              <motion.button
                onClick={handleComplete}
                className="flex-1 px-4 py-2 rounded-apple bg-green text-bg font-medium hover:bg-green/80 transition-all flex items-center justify-center gap-2"
                whileTap={{ scale: 0.97 }}
              >
                <Check size={16} />
                Get Started
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
