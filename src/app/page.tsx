export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { loadPublicDrawData } from "@/lib/public-draw";
import { PublicDrawListings } from "@/app/public/draw/public-draw-listings";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { rows, roundMenus } = await loadPublicDrawData();

  return (
    <main className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[1800px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <PublicDrawListings
        rows={rows}
        roundMenus={roundMenus}
        currentRound={sp.round}
      />
    </main>
  );
}
