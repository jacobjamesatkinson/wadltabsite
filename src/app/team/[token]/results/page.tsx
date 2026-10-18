import { ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadTeamPortal, loadTeamPortalResults } from "@/lib/team-portal/load";

export default async function TeamPortalResultsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadTeamPortal(token);
  const rows = await loadTeamPortalResults(ctx.team.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Results"
        description={`${ctx.displayName} · ${ctx.team.wins}–${ctx.team.losses}`}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Round</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No confirmed results yet
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.roundName}</TableCell>
                  <TableCell>{row.opponent}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      {row.outcome === "won" ? (
                        <>
                          <ArrowUp className="size-4 text-emerald-600" />
                          Won
                        </>
                      ) : (
                        <>
                          <ArrowDown className="size-4 text-red-600" />
                          Lost
                        </>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {row.margin != null ? row.margin : "—"}
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
