import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { divisions, rounds } from "@/db/schema";
import { deleteCompetition, deleteRound } from "@/app/actions/competitions";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompetitionEditForm } from "../competition-edit-form";
import { AddRoundForm } from "./add-round-form";
import { StatusActions } from "./status-actions";

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!competition) notFound();

  const divs = await db.select().from(divisions).where(eq(divisions.competitionId, id));
  const rnds = await db.select().from(rounds).where(eq(rounds.competitionId, id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={competition.name}
        description={`${competition.season} · ${competition.shortName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <CompetitionEditForm competition={competition} />
            <StatusActions id={id} status={competition.status} />
            <DeleteButton
              confirmTitle={`Delete ${competition.name}?`}
              confirmDescription="Teams, rounds and draws for this competition will also be removed."
              onDelete={deleteCompetition.bind(null, id)}
              redirectTo="/admin/competitions"
            />
          </div>
        }
      />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status</span>
        <Badge>{competition.status}</Badge>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Divisions</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.name}</TableCell>
                  <TableCell className="capitalize">{d.level}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Rounds</h2>
          <AddRoundForm competitionId={id} nextNumber={rnds.length + 1} />
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Draw</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rnds
                .sort((a, b) => a.number - b.number)
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.number}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.drawStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteButton
                        confirmTitle={`Delete ${r.name}?`}
                        onDelete={deleteRound.bind(null, r.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border p-4 text-sm">
        <h2 className="font-semibold">Competition policy (summary)</h2>
        <ul className="list-inside list-disc text-muted-foreground">
          <li>Format: {competition.config.format}</li>
          <li>Ranking: wins, then {competition.config.ranking.tiebreakers.join(", ")}</li>
          <li>
            Bye: prefer {competition.config.bye.prefer}; counts as win:{" "}
            {String(competition.config.bye.countsAsWin)}
          </li>
          <li>Panel size: {competition.config.panelSize}</li>
          <li>Student speaker edit: {String(competition.config.studentSpeakerEdit)}</li>
        </ul>
      </section>
    </div>
  );
}
