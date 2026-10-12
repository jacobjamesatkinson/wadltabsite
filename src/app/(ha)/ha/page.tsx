import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { LinkButton } from "@/components/link-button";

export default async function HaOverviewPage() {
  const [venues, debates, ballots] = await Promise.all([
    db.query.venues.findMany(),
    db.query.debates.findMany(),
    db.query.ballots.findMany(),
  ]);
  const pending = ballots.filter((b) => b.needsReview || b.status === "submitted");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Head adjudicator overview"
        description="Venue and debate workspace for your authorised scope"
        actions={
          <LinkButton href="/ha/draw" size="sm">
            Open draw
          </LinkButton>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground">Venues</p>
          <p className="mt-2 text-3xl font-semibold">{venues.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground">Debates</p>
          <p className="mt-2 text-3xl font-semibold">{debates.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground">Ballots to review</p>
          <p className="mt-2 text-3xl font-semibold">{pending.length}</p>
        </div>
      </div>
    </div>
  );
}
