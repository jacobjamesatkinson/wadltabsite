import { db } from "@/db";
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
import { InstitutionForm } from "./institution-form";

export default async function InstitutionsPage() {
  const rows = await db.query.institutions.findMany();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutions"
        description="Schools and organisations participating in competitions"
        actions={<InstitutionForm />}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Short name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No institutions yet
                </TableCell>
              </TableRow>
            ) : (
              rows.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell>{inst.shortName}</TableCell>
                  <TableCell>
                    <Badge variant={inst.status === "active" ? "default" : "secondary"}>
                      {inst.status}
                    </Badge>
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
