"use client";

import Link from "next/link";
import { EntityDataTable } from "@/components/data-table/entity-data-table";
import { DivisionChip } from "@/components/division-chip";
import { Badge } from "@/components/ui/badge";

export type InstitutionTeamRow = {
  id: string;
  name: string;
  division: string;
  divisionSort: number;
  divisionChipColor: string | null;
  identifier: string;
  record: string;
  status: string;
};

export function InstitutionTeamsTable({ rows }: { rows: InstitutionTeamRow[] }) {
  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Institution teams"
      initialSorting={[{ id: "name", desc: false }]}
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
              {row.name}
            </Link>
          ),
        },
        {
          id: "division",
          accessorKey: "division",
          label: "Division",
          cell: (row) => (
            <DivisionChip name={row.division} color={row.divisionChipColor} />
          ),
          compare: (a, b) =>
            a.divisionSort - b.divisionSort ||
            a.division.localeCompare(b.division),
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
