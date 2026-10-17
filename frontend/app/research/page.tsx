import { ResearchLab } from "@/components/research-lab-client";

export const metadata = {
  title: "Research Lab — EA Index",
  description: "Strategy development, backtesting, and Monte Carlo simulation workspace",
};

export default function ResearchPage() {
  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-text mb-1">
          Research Lab
        </h1>
        <p className="text-sm text-text-tertiary">
          Configure strategies, run vectorized backtests, and analyze robustness
          with Monte Carlo simulations.
        </p>
      </div>
      <ResearchLab />
    </main>
  );
}
