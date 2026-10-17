import { Suspense } from "react";
import { StrategiesListClient } from "@/components/strategies-list-client";
import { fetchOverviewData } from "@/lib/data";

export const metadata = {
  title: "Strategy Library — EA Index",
};

// Disable static regeneration — data fetched at request time from API
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StrategiesPage() {
  const data = await fetchOverviewData();

  return (
    <main className="p-6">
      <Suspense fallback={<div>Loading...</div>}>
        <StrategiesListClient strategies={data.strategies} />
      </Suspense>
    </main>
  );
}
