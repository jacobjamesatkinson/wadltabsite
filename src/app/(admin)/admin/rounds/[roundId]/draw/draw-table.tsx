"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Clock, Gavel, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableFilterMenu } from "@/components/data-table/data-table-filter-menu";
import { DataTableSortMenu } from "@/components/data-table/data-table-sort-menu";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import type { FilterOption } from "@/lib/data-table-types";

export type DrawTableRow = {
  id: string;
  venue: string;
  room: string;
  timeslot: string;
  affirmative: string;
  negative: string;
  adjudicators: string;
  division: string;
  flags: string;
};

export function DrawDataTable({
  data,
  venueOptions,
  roomOptions,
  timeslotOptions,
}: {
  data: DrawTableRow[];
  venueOptions: FilterOption[];
  roomOptions: FilterOption[];
  timeslotOptions: FilterOption[];
}) {
  const columns = React.useMemo<ColumnDef<DataTableFeatures, DrawTableRow>[]>(
    () => [
      {
        id: "venue",
        accessorKey: "venue",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Venue" />
        ),
        meta: { label: "Venue", variant: "select", options: venueOptions, icon: Building2 },
        enableColumnFilter: true,
      },
      {
        id: "room",
        accessorKey: "room",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Room" />
        ),
        meta: { label: "Room", variant: "select", options: roomOptions },
        enableColumnFilter: true,
      },
      {
        id: "timeslot",
        accessorKey: "timeslot",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Timeslot" />
        ),
        meta: {
          label: "Timeslot",
          variant: "select",
          options: timeslotOptions,
          icon: Clock,
        },
        enableColumnFilter: true,
      },
      {
        id: "affirmative",
        accessorKey: "affirmative",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Aff" />
        ),
        meta: { label: "Aff", variant: "text", icon: Users },
        enableColumnFilter: true,
      },
      {
        id: "negative",
        accessorKey: "negative",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Neg" />
        ),
        meta: { label: "Neg", variant: "text", icon: Users },
        enableColumnFilter: true,
      },
      {
        id: "adjudicators",
        accessorKey: "adjudicators",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Adjudicators" />
        ),
        meta: { label: "Adjudicators", variant: "text", icon: Gavel },
        enableColumnFilter: true,
      },
      {
        id: "division",
        accessorKey: "division",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Division" />
        ),
        meta: { label: "Division", variant: "text" },
        enableColumnFilter: true,
      },
      {
        id: "flags",
        accessorKey: "flags",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Flags" />
        ),
        meta: { label: "Flags", variant: "text" },
        enableColumnFilter: true,
      },
    ],
    [venueOptions, roomOptions, timeslotOptions]
  );

  const { table } = useDataTable({
    mode: "client",
    data,
    columns,
    getRowId: (row) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
  });

  return (
    <DataTable table={table} aria-label="Round draw">
      <DataTableAdvancedToolbar table={table}>
        <DataTableFilterMenu table={table} />
        <DataTableSortMenu table={table} />
      </DataTableAdvancedToolbar>
    </DataTable>
  );
}
