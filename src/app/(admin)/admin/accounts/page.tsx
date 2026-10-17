import { db } from "@/db";
import { deleteInvitation } from "@/app/actions/accounts";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import type { AppRole } from "@/lib/permissions/types";
import { CreateAccountForm } from "./account-forms";
import { AccountsTable } from "./accounts-table";
import { InviteForm } from "./invite-form";

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

  const rows = users.map((u) => {
    const userRoles = rolesByUser.get(u.id) ?? [];
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      rolesLabel:
        userRoles.length === 0
          ? "none"
          : userRoles
              .map(
                (r) =>
                  `${r.role}${
                    r.institutionId
                      ? `:${institutionName.get(r.institutionId) ?? "?"}`
                      : ""
                  }`
              )
              .join(", "),
      roles: userRoles.map((r) => ({
        id: r.id,
        role: r.role as AppRole,
        institutionId: r.institutionId,
      })),
    };
  });

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
      <AccountsTable rows={rows} institutions={institutionOpts} />
    </div>
  );
}
