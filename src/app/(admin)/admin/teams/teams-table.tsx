"use client";

import Link from "next/link";
import { EntityDataTable } from "@/components/data-table/entity-data-table";

export type TeamTableRow = {
  id: string;
  name: string;
  identifier: string;
  institution: string;
  record: string;
  speakers: number;
  status: string;
};

export function TeamsTable({ rows }: { rows: TeamTableRow[] }) {
  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Teams"
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
        { id: "institution", accessorKey: "institution", label: "Institution" },
        { id: "record", accessorKey: "record", label: "W–L", variant: "text" },
        {
          id: "speakers",
          accessorKey: "speakers",
          label: "Speakers",
          variant: "number",
        },
        {
          id: "status",
          accessorKey: "status",
          label: "Status",
          variant: "select",
        },
      ]}
    />
  );
}
