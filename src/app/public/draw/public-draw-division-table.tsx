"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MapPin } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import type { PublicDrawRow } from "./types";

function uniqueOptions(values: string[]) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    )
    .map((value) => ({ label: value, value }));
}

export function PublicDrawDivisionTable({
  rows,
  ariaLabel,
  idPrefix,
  hideInstitutionFilter = false,
}: {
  rows: PublicDrawRow[];
  ariaLabel: string;
  idPrefix: string;
  hideInstitutionFilter?: boolean;
}) {
  const venueOptions = React.useMemo(
    () => uniqueOptions(rows.map((r) => r.venue)),
    [rows]
  );
  const roomOptions = React.useMemo(
    () => uniqueOptions(rows.map((r) => r.room)),
    [rows]
  );
  const timeslotOptions = React.useMemo(
    () => uniqueOptions(rows.map((r) => r.timeslot)),
    [rows]
  );
  const institutionOptions = React.useMemo(
    () => uniqueOptions(rows.flatMap((r) => r.institutions)),
    [rows]
  );

  const institutionColumnId = `${idPrefix}-institution`;

  const columns = React.useMemo<ColumnDef<DataTableFeatures, PublicDrawRow>[]>(
    () => [
      {
        id: `${idPrefix}-venue`,
        accessorKey: "venue",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Venue" />
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
            {row.original.venue}
          </span>
        ),
        meta: {
          label: "Venue",
          variant: "multiSelect",
          options: venueOptions,
          icon: MapPin,
        },
        enableColumnFilter: true,
      },
      {
        id: `${idPrefix}-timeslot`,
        accessorKey: "timeslot",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Timeslot" />
        ),
        sortingFn: (
          a: { original: PublicDrawRow },
          b: { original: PublicDrawRow }
        ) =>
          a.original.timeslotSort - b.original.timeslotSort ||
          a.original.timeslot.localeCompare(b.original.timeslot),
        meta: {
          label: "Timeslot",
          variant: "multiSelect",
          options: timeslotOptions,
        },
        enableColumnFilter: true,
      },
      {
        id: `${idPrefix}-room`,
        accessorKey: "room",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Room" />
        ),
        meta: {
          label: "Room",
          variant: "multiSelect",
          options: roomOptions,
        },
        enableColumnFilter: true,
      },
      {
        id: institutionColumnId,
        accessorFn: (row) => row.institutions.join("|"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Institution" />
        ),
        cell: ({ row }) => row.original.institutions.join(", ") || "—",
        filterFn: (row, _columnId, filterValue) => {
          const selected = Array.isArray(filterValue)
            ? filterValue.map(String)
            : filterValue
              ? [String(filterValue)]
              : [];
          if (selected.length === 0) return true;
          return row.original.institutions.some((name) => selected.includes(name));
        },
        meta: {
          label: "Institution",
          variant: "multiSelect",
          options: institutionOptions,
        },
        enableColumnFilter: !hideInstitutionFilter,
      },
      {
        id: `${idPrefix}-affirmative`,
        accessorKey: "affirmative",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Affirmative" />
        ),
        filterFn: (row, _columnId, filterValue) => {
          const q = String(filterValue ?? "")
            .trim()
            .toLowerCase();
          if (!q) return true;
          return (
            row.original.affirmative.toLowerCase().includes(q) ||
            row.original.negative.toLowerCase().includes(q)
          );
        },
        meta: {
          label: "Team",
          variant: "text",
          placeholder: "Search teams…",
        },
        enableColumnFilter: true,
      },
      {
        id: `${idPrefix}-negative`,
        accessorKey: "negative",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Negative" />
        ),
        meta: { label: "Negative", variant: "text" },
        enableColumnFilter: false,
      },
      {
        id: `${idPrefix}-comments`,
        accessorKey: "comments",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Comments" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.comments}</span>
        ),
        meta: { label: "Comments", variant: "text" },
        enableColumnFilter: false,
      },
    ],
    [
      idPrefix,
      institutionColumnId,
      venueOptions,
      roomOptions,
      timeslotOptions,
      institutionOptions,
      hideInstitutionFilter,
    ]
  );

  const { table } = useDataTable({
    mode: "client",
    data: rows,
    columns,
    getRowId: (row) => row.id,
    queryKeys: {
      page: `${idPrefix}-page`,
      perPage: `${idPrefix}-perPage`,
      sort: `${idPrefix}-sort`,
      joinOperator: `${idPrefix}-join`,
    },
    initialState: {
      sorting: [{ id: `${idPrefix}-timeslot`, desc: false }],
      columnVisibility: { [institutionColumnId]: false },
      // Effectively unlimited — show the full draw without paging
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  });

  return (
    <DataTable
      table={table}
      aria-label={ariaLabel}
      pagination={false}
      className="text-[15px] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3"
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
