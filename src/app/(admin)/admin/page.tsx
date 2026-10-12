import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { LinkButton } from "@/components/link-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminOverviewPage() {
  const [competitionCount, teamCount, institutionCount, roundCount] =
    await Promise.all([
      db.query.competitions.findMany().then((r) => r.length),
      db.query.teams.findMany().then((r) => r.length),
      db.query.institutions.findMany().then((r) => r.length),
      db.query.rounds.findMany().then((r) => r.length),
    ]);

  const rounds = await db.query.rounds.findMany();
  const draftRounds = rounds.filter((r) => r.drawStatus === "draft");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Competition operations dashboard"
        actions={<LinkButton href="/admin/draws">Manage draws</LinkButton>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Competitions", value: competitionCount },
          { label: "Institutions", value: institutionCount },
          { label: "Teams", value: teamCount },
          { label: "Rounds", value: roundCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Draft draws awaiting publication</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Round</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftRounds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No draft draws
                  </TableCell>
                </TableRow>
              ) : (
                draftRounds.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.drawStatus}</TableCell>
                    <TableCell className="text-right">
                      <LinkButton href={`/admin/draws/${r.id}`} size="sm" variant="outline">
                        Review
                      </LinkButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
