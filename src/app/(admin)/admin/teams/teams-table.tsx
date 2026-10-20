"use client";

import Link from "next/link";
import { deleteTeams } from "@/app/actions/teams";
import { EntityDataTable } from "@/components/data-table/entity-data-table";

export type TeamTableRow = {
  id: string;
  name: string;
  identifier: string;
  institution: string;
  division: string;
  venue: string;
  timeslot: string;
  record: string;
  speakers: number;
  status: string;
};

export function TeamsTable({ rows }: { rows: TeamTableRow[] }) {
  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Teams"
      enableRowSelection
      initialSorting={[{ id: "name", desc: false }]}
      bulkDelete={{
        entityLabel: "team",
        onDelete: async (ids) => {
          await deleteTeams(ids);
        },
      }}
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
        { id: "institution", accessorKey: "institution", label: "Institution" },
        {
          id: "division",
          accessorKey: "division",
          label: "Division",
          variant: "select",
        },
        { id: "venue", accessorKey: "venue", label: "Venue" },
        { id: "timeslot", accessorKey: "timeslot", label: "Timeslot" },
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
