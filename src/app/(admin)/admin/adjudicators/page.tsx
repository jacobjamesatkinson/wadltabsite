import { db } from "@/db";
import { adjudicatorProfiles, user } from "@/db/schema";
import { deleteAdjudicatorProfile } from "@/app/actions/adjudicators";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdjudicatorCreateForm, AdjudicatorEditForm } from "./adjudicator-form";

export default async function AdjudicatorsAdminPage() {
  const profiles = await db.select().from(adjudicatorProfiles);
  const users = await db.select().from(user);
  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adjudicators"
        description="Profiles, availability and assignments"
        actions={<AdjudicatorCreateForm />}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Qualifications</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No adjudicators yet
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((p) => {
                const u = userMap.get(p.userId);
                return (
                  <TableRow key={p.id}>
                    <TableCell>{u?.name}</TableCell>
                    <TableCell>{u?.email}</TableCell>
                    <TableCell>{p.qualifications ?? "—"}</TableCell>
                    <TableCell>{p.active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <AdjudicatorEditForm
                          profile={{
                            id: p.id,
                            name: u?.name ?? "",
                            qualifications: p.qualifications,
                            notes: p.notes,
                            active: p.active,
                          }}
                        />
                        <DeleteButton
                          confirmTitle={`Delete adjudicator ${u?.name ?? ""}?`}
                          onDelete={deleteAdjudicatorProfile.bind(null, p.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
