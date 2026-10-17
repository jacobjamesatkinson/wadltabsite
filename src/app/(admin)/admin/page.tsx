import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { LinkButton } from "@/components/link-button";
import { SectionCards } from "@/components/section-cards";
import { getSiteCompetition, getSiteRounds } from "@/lib/competition";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminOverviewPage() {
  const [competition, rounds, teamCount, institutionCount] = await Promise.all([
    getSiteCompetition(),
    getSiteRounds(),
    db.query.teams.findMany().then((r) => r.length),
    db.query.institutions.findMany().then((r) => r.length),
  ]);

  const draftRounds = rounds.filter((r) => r.drawStatus === "draft");
  const firstRound = rounds[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={
          competition
            ? `${competition.name} · ${competition.season}`
            : "Competition operations dashboard"
        }
        actions={
          firstRound ? (
            <LinkButton href={`/admin/rounds/${firstRound.id}/availability`}>
              Open rounds
            </LinkButton>
          ) : (
            <LinkButton href="/admin/settings">Configure competition</LinkButton>
          )
        }
      />
      <SectionCards
        cards={[
          {
            label: "Competition",
            value: competition?.shortName ?? "—",
            hint: competition?.status ?? "Not configured",
          },
          {
            label: "Institutions",
            value: institutionCount,
            hint: "Participating schools",
          },
          {
            label: "Teams",
            value: teamCount,
            hint: "Registered for this competition",
          },
          {
            label: "Draft draws",
            value: draftRounds.length,
            badge: draftRounds.length > 0 ? "Needs review" : "Clear",
            hint: `${rounds.length} rounds total`,
          },
        ]}
      />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Rounds</h2>
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Round</TableHead>
                <TableHead>Draw status</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No rounds yet — add them under Competition settings
                  </TableCell>
                </TableRow>
              ) : (
                rounds.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.drawStatus}</TableCell>
                    <TableCell className="text-right">
                      <LinkButton
                        href={`/admin/rounds/${r.id}/availability`}
                        size="sm"
                        variant="outline"
                      >
                        Availability
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
