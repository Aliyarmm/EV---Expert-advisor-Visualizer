import { PerformanceDashboard } from "@/components/performance-dashboard-client";

export const metadata = {
  title: "Performance — EV — Expert Advisor Visualizer",
  description: "Portfolio performance dashboard with equity curves, risk contribution, and metrics",
};

export default function PerformancePage() {
  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-text mb-1">
          Performance Dashboard
        </h1>
        <p className="text-sm text-text-tertiary">
          Portfolio-level analytics, equity curves, risk contribution, and
          performance metrics.
        </p>
      </div>
      <PerformanceDashboard />
    </main>
  );
}
