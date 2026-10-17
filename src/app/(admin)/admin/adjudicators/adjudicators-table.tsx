"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { deleteAdjudicatorProfile } from "@/app/actions/adjudicators";
import { DeleteButton } from "@/components/delete-button";
import { EntityDataTable } from "@/components/data-table/entity-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { AdjudicatorEditForm } from "./adjudicator-form";

export type AdjudicatorRow = {
  id: string;
  name: string;
  email: string;
  qualifications: string;
  active: string;
  userId: string;
  notes: string | null;
  rawActive: boolean;
};

export function AdjudicatorsTable({ rows }: { rows: AdjudicatorRow[] }) {
  const trailingColumn: ColumnDef<DataTableFeatures, AdjudicatorRow> = {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const p = row.original;
      return (
        <div className="flex justify-end gap-2">
          <AdjudicatorEditForm
            profile={{
              id: p.id,
              name: p.name,
              qualifications: p.qualifications === "—" ? null : p.qualifications,
              notes: p.notes,
              active: p.rawActive,
            }}
          />
          <DeleteButton
            confirmTitle={`Remove ${p.name}?`}
            onDelete={async () => {
              await deleteAdjudicatorProfile(p.id);
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
      ariaLabel="Adjudicators"
      trailingColumn={trailingColumn}
      columns={[
        { id: "name", accessorKey: "name", label: "Name" },
        { id: "email", accessorKey: "email", label: "Email" },
        {
          id: "qualifications",
          accessorKey: "qualifications",
          label: "Qualifications",
        },
        {
          id: "active",
          accessorKey: "active",
          label: "Active",
          variant: "select",
        },
      ]}
    />
  );
}
