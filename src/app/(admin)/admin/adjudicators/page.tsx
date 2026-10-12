import { db } from "@/db";
import { adjudicatorProfiles, user } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdjudicatorsAdminPage() {
  const profiles = await db.select().from(adjudicatorProfiles);
  const users = await db.select().from(user);
  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adjudicators"
        description="Profiles, availability and assignments"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Qualifications</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => {
              const u = userMap.get(p.userId);
              return (
                <TableRow key={p.id}>
                  <TableCell>{u?.name}</TableCell>
                  <TableCell>{u?.email}</TableCell>
                  <TableCell>{p.qualifications ?? "—"}</TableCell>
                  <TableCell>{p.active ? "Yes" : "No"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
