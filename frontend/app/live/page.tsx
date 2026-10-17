import { LiveMonitor } from "@/components/live-monitor";

export const metadata = {
  title: "Live Trading — EA Index",
  description: "Real-time position monitoring and connection status",
};

export default function LivePage() {
  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-text mb-1">
          Live Trading Monitor
        </h1>
        <p className="text-sm text-text-tertiary">
          Real-time position monitoring across connected brokers. P&L updates every
          2 seconds with live price feeds.
        </p>
      </div>
      <LiveMonitor />
    </main>
  );
}
