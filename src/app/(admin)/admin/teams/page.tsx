import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamForm } from "./team-form";
import { TeamTokenButton } from "./team-token-button";

export default async function TeamsPage() {
  const [teamRows, institutions, competitions, divisions, speakers] = await Promise.all([
    db.query.teams.findMany(),
    db.query.institutions.findMany(),
    db.query.competitions.findMany(),
    db.query.divisions.findMany(),
    db.query.speakers.findMany(),
  ]);

  const instMap = new Map(institutions.map((i) => [i.id, i.shortName]));
  const speakerCount = new Map<string, number>();
  for (const s of speakers) {
    speakerCount.set(s.teamId, (speakerCount.get(s.teamId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description="Competition teams, speakers and private access links"
        actions={
          <TeamForm
            competitions={competitions.map((c) => ({ id: c.id, name: c.name }))}
            institutions={institutions.map((i) => ({ id: i.id, name: i.name }))}
            divisions={divisions.map((d) => ({
              id: d.id,
              name: d.name,
              competitionId: d.competitionId,
            }))}
          />
        }
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>W–L</TableHead>
              <TableHead>Speakers</TableHead>
              <TableHead className="text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamRows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  {t.name}{" "}
                  <span className="text-muted-foreground">({t.identifier})</span>
                </TableCell>
                <TableCell>{instMap.get(t.institutionId)}</TableCell>
                <TableCell className="tabular-nums">
                  {t.wins}–{t.losses}
                </TableCell>
                <TableCell>{speakerCount.get(t.id) ?? 0}</TableCell>
                <TableCell className="text-right">
                  <TeamTokenButton teamId={t.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
