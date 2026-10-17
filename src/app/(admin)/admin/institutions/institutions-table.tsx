"use client";

import Link from "next/link";
import { EntityDataTable } from "@/components/data-table/entity-data-table";
import { Badge } from "@/components/ui/badge";

export type InstitutionRow = {
  id: string;
  name: string;
  shortName: string;
  status: string;
  teams: number;
  coordinators: number;
};

export function InstitutionsTable({ rows }: { rows: InstitutionRow[] }) {
  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Institutions"
      columns={[
        {
          id: "name",
          accessorKey: "name",
          label: "Name",
          cell: (row) => (
            <Link
              href={`/admin/institutions/${row.id}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {row.name}
            </Link>
          ),
        },
        { id: "shortName", accessorKey: "shortName", label: "Short name" },
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
          id: "teams",
          accessorKey: "teams",
          label: "Teams",
          variant: "number",
        },
        {
          id: "coordinators",
          accessorKey: "coordinators",
          label: "Coordinators",
          variant: "number",
        },
      ]}
    />
  );
}
