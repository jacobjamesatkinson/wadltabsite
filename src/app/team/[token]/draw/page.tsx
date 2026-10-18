import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadTeamPortal, loadTeamPortalDraw } from "@/lib/team-portal/load";

export default async function TeamPortalDrawPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadTeamPortal(token);
  const rows = await loadTeamPortalDraw(ctx.team.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draw"
        description="Your published debates across all rounds"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Round</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead>Adjudicator</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  No published debates for this team yet
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.roundName}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.venue}</TableCell>
                  <TableCell>{row.timeslot}</TableCell>
                  <TableCell>{row.room}</TableCell>
                  <TableCell>{row.side}</TableCell>
                  <TableCell>{row.opponent}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.adjudicators}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
