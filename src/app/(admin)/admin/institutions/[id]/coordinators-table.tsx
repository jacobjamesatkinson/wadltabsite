"use client";

import { EntityDataTable } from "@/components/data-table/entity-data-table";
import { Badge } from "@/components/ui/badge";

export type CoordinatorRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  permission: string;
};

export function CoordinatorsTable({ rows }: { rows: CoordinatorRow[] }) {
  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Institution coordinators"
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
          id: "permission",
          accessorKey: "permission",
          label: "Permission",
          variant: "text",
        },
      ]}
    />
  );
}
