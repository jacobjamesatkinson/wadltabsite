import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { speakers } from "@/db/schema";
import { SpeakersManager } from "@/app/(admin)/admin/teams/[id]/speakers-manager";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/session";
import { canAccessInstitution } from "@/lib/permissions";
import { formatTeamDisplayName } from "@/lib/teams/display-name";

export default async function CoordinatorTeamSpeakersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuth();
  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!team) notFound();
  if (!canAccessInstitution(ctx, team.institutionId)) notFound();

  const institution = team.institutionId
    ? await db.query.institutions.findFirst({
        where: (t, { eq: e }) => e(t.id, team.institutionId!),
      })
    : null;

  const speakerRows = await db
    .select()
    .from(speakers)
    .where(eq(speakers.teamId, id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatTeamDisplayName(team, institution)}
        description="Edit the speaker list for this team"
        actions={
          <Button variant="outline" render={<Link href="/coordinator/teams" />}>
            Back to teams
          </Button>
        }
      />
      <section className="max-w-xl space-y-3">
        <h2 className="text-sm font-semibold">Speakers</h2>
        <SpeakersManager
          teamId={team.id}
          speakers={speakerRows.map((s) => ({ id: s.id, name: s.name }))}
        />
      </section>
    </div>
  );
}
