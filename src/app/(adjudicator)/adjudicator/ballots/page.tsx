import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { BallotSubmitForm } from "./ballot-submit-form";

export default async function AdjudicatorBallotsPage() {
  const ctx = await requireAuth();
  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });
  const assignments = profile
    ? await db
        .select()
        .from(adjudicatorAssignments)
        .where(eq(adjudicatorAssignments.adjudicatorId, profile.id))
    : [];
  const debateIds = assignments.map((a) => a.debateId);
  const debateRows =
    debateIds.length > 0
      ? await db.query.debates.findMany({
          where: (t, { inArray }) => inArray(t.id, debateIds),
        })
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ballots and feedback"
        description="Submit results for assigned debates. Unassigned submissions are flagged for review."
      />
      <div className="space-y-4">
        {debateRows.map((d) => (
          <BallotSubmitForm
            key={d.id}
            debateId={d.id}
            affirmativeTeamId={d.affirmativeTeamId!}
            negativeTeamId={d.negativeTeamId!}
            affirmativeName={d.affirmativeTeamName ?? "Affirmative"}
            negativeName={d.negativeTeamName ?? "Negative"}
          />
        ))}
        {debateRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assigned debates.</p>
        ) : null}
      </div>
    </div>
  );
}
