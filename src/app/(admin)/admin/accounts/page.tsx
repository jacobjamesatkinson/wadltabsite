import { db } from "@/db";
import { deleteAccount, deleteInvitation } from "@/app/actions/accounts";
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
import { CreateAccountForm, ManageAccountButton } from "./account-forms";
import { InviteForm } from "./invite-form";
import type { AppRole } from "@/lib/permissions/types";

export default async function AccountsPage() {
  const [users, roles, invites, institutions] = await Promise.all([
    db.query.user.findMany(),
    db.query.userRoles.findMany(),
    db.query.invitations.findMany(),
    db.query.institutions.findMany(),
  ]);

  const rolesByUser = new Map<string, typeof roles>();
  for (const r of roles) {
    const list = rolesByUser.get(r.userId) ?? [];
    list.push(r);
    rolesByUser.set(r.userId, list);
  }

  const institutionOpts = institutions.map((i) => ({
    id: i.id,
    name: i.name,
    shortName: i.shortName,
  }));
  const institutionName = new Map(institutions.map((i) => [i.id, i.shortName]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts and permissions"
        description="Create users, assign coordinators to institutions, and set passwords."
        actions={<CreateAccountForm institutions={institutionOpts} />}
      />
      <InviteForm institutions={institutionOpts} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Pending invitations ({invites.filter((i) => !i.acceptedAt).length})
        </h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {invites
            .filter((i) => !i.acceptedAt)
            .map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span>
                  {i.email} → {i.role}
                  {i.institutionId
                    ? ` · ${institutionName.get(i.institutionId) ?? i.institutionId}`
                    : ""}{" "}
                  (expires {i.expiresAt.toISOString().slice(0, 10)})
                </span>
                <DeleteButton
                  label="Revoke"
                  confirmTitle="Revoke invitation?"
                  onDelete={deleteInvitation.bind(null, i.id)}
                />
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const userRoles = rolesByUser.get(u.id) ?? [];
              return (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "default" : "secondary"}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {userRoles.length === 0 ? (
                      <Badge variant="outline">none</Badge>
                    ) : (
                      userRoles.map((role) => (
                        <Badge key={role.id} variant="outline">
                          {role.role}
                          {role.institutionId
                            ? `:${institutionName.get(role.institutionId) ?? "?"}`
                            : ""}
                        </Badge>
                      ))
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ManageAccountButton
                        accountUser={u}
                        roles={userRoles.map((r) => ({
                          id: r.id,
                          role: r.role as AppRole,
                          institutionId: r.institutionId,
                        }))}
                        institutions={institutionOpts}
                      />
                      <DeleteButton
                        confirmTitle={`Delete ${u.name}?`}
                        confirmDescription="This permanently removes the account and related roles."
                        onDelete={deleteAccount.bind(null, u.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
