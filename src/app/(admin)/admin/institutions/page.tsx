import { db } from "@/db";
import { deleteInstitution } from "@/app/actions/institutions";
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <InstitutionForm institution={inst} />
                      <DeleteButton
                        confirmTitle={`Delete ${inst.name}?`}
                        confirmDescription="Institutions with teams cannot be deleted — archive them instead."
                        onDelete={deleteInstitution.bind(null, inst.id)}
                      />
                    </div>
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
