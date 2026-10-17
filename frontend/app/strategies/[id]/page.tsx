import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StrategyDetailClient } from "@/components/strategy-detail-client";
import { fetchStrategyDetail } from "@/lib/data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const strategy = await fetchStrategyDetail(id);
  return {
    title: `${strategy?.strategy?.name ?? "Strategy"} — EV — Expert Advisor Visualizer`,
    description: strategy?.strategy?.logic ?? "Trading strategy detail",
  };
}

export default async function StrategyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const data = await fetchStrategyDetail(resolvedParams.id);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-full">
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <StrategyDetailClient data={data} />
      </Suspense>
    </main>
  );
}
