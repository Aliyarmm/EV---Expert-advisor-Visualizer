import { Suspense } from "react";
import { HomeClient } from "@/components/home-client";
import { fetchOverviewData } from "@/lib/data";

export default async function HomePage() {
  const data = await fetchOverviewData();

  return (
    <main className="min-h-full">
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <HomeClient data={data} />
      </Suspense>
    </main>
  );
}
