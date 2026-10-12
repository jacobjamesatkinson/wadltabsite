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
import { InviteForm } from "./invite-form";

export default async function AccountsPage() {
  const [users, roles, invites] = await Promise.all([
    db.query.user.findMany(),
    db.query.userRoles.findMany(),
    db.query.invitations.findMany(),
  ]);

  const rolesByUser = new Map<string, string[]>();
  for (const r of roles) {
    const list = rolesByUser.get(r.userId) ?? [];
    list.push(r.role);
    rolesByUser.set(r.userId, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts and permissions"
        description="User accounts and assigned roles. Prefer invitations for privileged access."
      />
      <InviteForm />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pending invitations ({invites.filter((i) => !i.acceptedAt).length})</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {invites
            .filter((i) => !i.acceptedAt)
            .map((i) => (
              <li key={i.id}>
                {i.email} → {i.role} (expires {i.expiresAt.toISOString().slice(0, 10)})
              </li>
            ))}
        </ul>
      </section>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.status === "active" ? "default" : "secondary"}>
                    {u.status}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-1">
                  {(rolesByUser.get(u.id) ?? ["none"]).map((role) => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
