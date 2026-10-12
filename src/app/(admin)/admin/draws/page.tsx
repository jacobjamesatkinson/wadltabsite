import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { LinkButton } from "@/components/link-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DrawsPage() {
  const rounds = await db.query.rounds.findMany();
  const competitions = await db.query.competitions.findMany();
  const byId = new Map(competitions.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draws"
        description="Generate, review and publish round draws"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competition</TableHead>
              <TableHead>Round</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rounds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No rounds yet — create a competition round first
                </TableCell>
              </TableRow>
            ) : (
              rounds
                .sort((a, b) => a.number - b.number)
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{byId.get(r.competitionId)?.name ?? "—"}</TableCell>
                    <TableCell>
                      {r.name}{" "}
                      <span className="text-muted-foreground">#{r.number}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.drawStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <LinkButton href={`/admin/draws/${r.id}`} size="sm" variant="outline">
                        Open
                      </LinkButton>
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
