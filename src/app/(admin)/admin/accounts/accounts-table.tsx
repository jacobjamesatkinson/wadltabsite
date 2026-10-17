"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { deleteAccount } from "@/app/actions/accounts";
import { DeleteButton } from "@/components/delete-button";
import { EntityDataTable } from "@/components/data-table/entity-data-table";
import { Badge } from "@/components/ui/badge";
import type { DataTableFeatures } from "@/lib/data-table-features";
import type { AppRole } from "@/lib/permissions/types";
import { ManageAccountButton } from "./account-forms";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  rolesLabel: string;
  roles: Array<{ id: string; role: AppRole; institutionId: string | null }>;
};

export function AccountsTable({
  rows,
  institutions,
}: {
  rows: AccountRow[];
  institutions: Array<{ id: string; name: string; shortName: string }>;
}) {
  const trailingColumn: ColumnDef<DataTableFeatures, AccountRow> = {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="flex justify-end gap-2">
          <ManageAccountButton
            accountUser={{
              id: u.id,
              name: u.name,
              email: u.email,
              status: u.status,
            }}
            roles={u.roles}
            institutions={institutions}
          />
          <DeleteButton
            confirmTitle={`Delete ${u.name}?`}
            confirmDescription="This permanently removes the account and related roles."
            onDelete={async () => {
              await deleteAccount(u.id);
            }}
          />
        </div>
      );
    },
    enableSorting: false,
    enableColumnFilter: false,
  };

  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Accounts"
      trailingColumn={trailingColumn}
      columns={[
        { id: "name", accessorKey: "name", label: "Name" },
        { id: "email", accessorKey: "email", label: "Email" },
        {
          id: "status",
          accessorKey: "status",
          label: "Status",
          variant: "select",
          cell: (row) => (
            <Badge variant={row.status === "active" ? "default" : "secondary"}>
              {row.status}
            </Badge>
          ),
        },
        {
          id: "rolesLabel",
          accessorKey: "rolesLabel",
          label: "Roles",
          cell: (row) =>
            row.roles.length === 0 ? (
              <Badge variant="outline">none</Badge>
            ) : (
              <span className="inline-flex flex-wrap gap-1">
                {row.roles.map((role) => (
                  <Badge key={role.id} variant="outline">
                    {role.role}
                    {role.institutionId
                      ? `:${institutions.find((i) => i.id === role.institutionId)?.shortName ?? "?"}`
                      : ""}
                  </Badge>
                ))}
              </span>
            ),
        },
      ]}
    />
  );
}
