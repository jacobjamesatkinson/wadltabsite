import { db } from "@/db";
import { defaultCompetitionConfig } from "@/db/schema";
import { computeStandings } from "@/lib/results/standings";
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
import { BallotReviewActions } from "./ballot-review-actions";

export default async function ResultsPage() {
  const [ballotRows, teamRows, competitions] = await Promise.all([
    db.query.ballots.findMany(),
    db.query.teams.findMany(),
    db.query.competitions.findMany(),
  ]);
  const config = competitions[0]?.config ?? defaultCompetitionConfig;
  const standings = computeStandings(
    teamRows.map((t) => ({
      teamId: t.id,
      name: t.name,
      wins: t.wins,
      losses: t.losses,
      byes: t.byes,
      speakerPoints: t.speakerPoints,
      played: t.wins + t.losses,
    })),
    config
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Results and ballots"
        description="Review submissions, accept results and view standings"
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Ballots</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ballotRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No ballots submitted
                  </TableCell>
                </TableRow>
              ) : (
                ballotRows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.debateId}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{b.status}</Badge>
                    </TableCell>
                    <TableCell>{b.needsReview ? "Needs review" : "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {b.affirmativePoints}–{b.negativePoints}
                    </TableCell>
                    <TableCell className="text-right">
                      {b.status === "submitted" || b.status === "disputed" ? (
                        <BallotReviewActions ballotId={b.id} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Standings</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>W–L</TableHead>
                <TableHead>Byes</TableHead>
                <TableHead>Speaker pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((s, i) => (
                <TableRow key={s.teamId}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="tabular-nums">
                    {s.wins}–{s.losses}
                  </TableCell>
                  <TableCell>{s.byes}</TableCell>
                  <TableCell className="tabular-nums">{s.speakerPoints}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
