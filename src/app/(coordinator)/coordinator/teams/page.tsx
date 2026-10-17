import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { institutions, speakers, teams } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { institutionIdsFor } from "@/lib/permissions";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { SpeakerEditor } from "./speaker-editor";

export default async function CoordinatorTeamsPage() {
  const ctx = await requireAuth();
  const ids = institutionIdsFor(ctx);
  const [teamRows, institutionRows] = await Promise.all([
    ids.length > 0
      ? db.select().from(teams).where(inArray(teams.institutionId, ids))
      : Promise.resolve([]),
    ids.length > 0
      ? db.select().from(institutions).where(inArray(institutions.id, ids))
      : Promise.resolve([]),
  ]);
  const instMap = new Map(institutionRows.map((i) => [i.id, i]));
  const teamIds = teamRows.map((t) => t.id);
  const speakerRows =
    teamIds.length > 0
      ? await db.select().from(speakers).where(inArray(speakers.teamId, teamIds))
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My teams"
        description="Edit speakers for teams at your institutions"
      />
      <div className="space-y-6">
        {teamRows.map((t) => (
          <section key={t.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  {formatTeamDisplayName(
                    t,
                    t.institutionId ? instMap.get(t.institutionId) : null
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t.identifier} · {t.wins}–{t.losses}
                </p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Speaker</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {speakerRows
                  .filter((s) => s.teamId === t.id)
                  .map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">
                        <SpeakerEditor teamId={t.id} speakerId={s.id} mode="remove" />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            <SpeakerEditor teamId={t.id} mode="add" />
          </section>
        ))}
      </div>
    </div>
  );
}
