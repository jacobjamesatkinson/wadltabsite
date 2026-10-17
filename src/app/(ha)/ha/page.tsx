import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { LinkButton } from "@/components/link-button";
import { SectionCards } from "@/components/section-cards";

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
      <SectionCards
        cards={[
          { label: "Venues", value: venues.length, hint: "In your scope" },
          { label: "Debates", value: debates.length, hint: "Scheduled and completed" },
          {
            label: "Ballots to review",
            value: pending.length,
            badge: pending.length > 0 ? "Action needed" : "Clear",
          },
        ]}
      />
    </div>
  );
}
