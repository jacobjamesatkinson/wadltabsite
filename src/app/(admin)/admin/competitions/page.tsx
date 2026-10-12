import { db } from "@/db";
import { deleteCompetition } from "@/app/actions/competitions";
import { DeleteButton } from "@/components/delete-button";
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
import { CompetitionForm } from "./competition-form";
import { CompetitionEditForm } from "./competition-edit-form";

export default async function CompetitionsPage() {
  const rows = await db.query.competitions.findMany();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competitions"
        description="Seasons, divisions and competition configuration"
        actions={<CompetitionForm />}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Season</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.name}{" "}
                  <span className="text-muted-foreground">({c.shortName})</span>
                </TableCell>
                <TableCell>{c.season}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{c.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <LinkButton href={`/admin/competitions/${c.id}`} size="sm" variant="outline">
                      Manage
                    </LinkButton>
                    <CompetitionEditForm competition={c} />
                    <DeleteButton
                      confirmTitle={`Delete ${c.name}?`}
                      confirmDescription="Teams, rounds and draws for this competition will also be removed."
                      onDelete={deleteCompetition.bind(null, c.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
