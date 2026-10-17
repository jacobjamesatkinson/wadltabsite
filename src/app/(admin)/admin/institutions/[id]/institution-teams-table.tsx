"use client";

import Link from "next/link";
import { EntityDataTable } from "@/components/data-table/entity-data-table";
import { Badge } from "@/components/ui/badge";

export type InstitutionTeamRow = {
  id: string;
  name: string;
  identifier: string;
  record: string;
  status: string;
};

export function InstitutionTeamsTable({ rows }: { rows: InstitutionTeamRow[] }) {
  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Institution teams"
      columns={[
        {
          id: "name",
          accessorKey: "name",
          label: "Team",
          cell: (row) => (
            <Link
              href={`/admin/teams/${row.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.name}{" "}
              <span className="text-muted-foreground">({row.identifier})</span>
            </Link>
          ),
        },
        { id: "record", accessorKey: "record", label: "W–L" },
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
      ]}
    />
  );
}
