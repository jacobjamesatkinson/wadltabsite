"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Clock, Minus } from "lucide-react";
import { BallotReviewActions } from "@/app/(admin)/admin/results/ballot-review-actions";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableFilterMenu } from "@/components/data-table/data-table-filter-menu";
import { DataTableSortMenu } from "@/components/data-table/data-table-sort-menu";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { cn } from "@/lib/utils";

export type HaBallotRow = {
  id: string;
  roundId: string;
  status: "none" | "unconfirmed" | "confirmed";
  version: number | null;
  venue: string;
  timeslot: string;
  room: string;
  division: string;
  institutions: string;
  affirmative: string;
  negative: string;
  incomplete: boolean;
  score: string;
  enteredBy: string;
  ballotId: string | null;
};

const STATUS_LABEL: Record<HaBallotRow["status"], string> = {
  none: "No ballot",
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
};

function uniqueOptions(values: string[]) {
  return [...new Set(values.filter((v) => v && v !== "—"))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((value) => ({ label: value, value }));
}

export function HaBallotsTable({ data }: { data: HaBallotRow[] }) {
  const venueOptions = React.useMemo(
    () => uniqueOptions(data.map((r) => r.venue)),
    [data]
  );
  const timeslotOptions = React.useMemo(
    () => uniqueOptions(data.map((r) => r.timeslot)),
    [data]
  );
  const divisionOptions = React.useMemo(
    () => uniqueOptions(data.map((r) => r.division)),
    [data]
  );
  const institutionOptions = React.useMemo(
    () =>
      uniqueOptions(
        data.flatMap((r) =>
          r.institutions
            .split(", ")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      ),
    [data]
  );

  const columns = React.useMemo<ColumnDef<DataTableFeatures, HaBallotRow>[]>(
    () => [
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Status" />
        ),
        cell: ({ row }) => {
          const s = row.original.status;
          return (
            <span className="inline-flex items-center gap-1.5 text-xs">
              {s === "confirmed" ? (
                <Check className="size-4 text-emerald-600" />
              ) : s === "unconfirmed" ? (
                <Clock className="size-4 text-amber-600" />
              ) : (
                <Minus className="size-4 text-muted-foreground" />
              )}
              <span className={cn(s === "none" && "text-muted-foreground")}>
                {STATUS_LABEL[s]}
              </span>
              {row.original.version ? (
                <span className="text-muted-foreground">v{row.original.version}</span>
              ) : null}
            </span>
          );
        },
        meta: {
          label: "Status",
          variant: "select",
          options: [
            { label: "No ballot", value: "none" },
            { label: "Unconfirmed", value: "unconfirmed" },
            { label: "Confirmed", value: "confirmed" },
          ],
        },
        enableColumnFilter: true,
      },
      {
        id: "institution",
        accessorKey: "institutions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Institution" />
        ),
        filterFn: (row, _id, filterValue) => {
          const selected = Array.isArray(filterValue)
            ? filterValue.map(String)
            : filterValue
              ? [String(filterValue)]
              : [];
          if (!selected.length) return true;
          const names = row.original.institutions
            .split(", ")
            .map((s) => s.trim());
          return names.some((n) => selected.includes(n));
        },
        meta: {
          label: "Institution",
          variant: "multiSelect",
          options: institutionOptions,
        },
        enableColumnFilter: true,
      },
      {
        id: "venue",
        accessorKey: "venue",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Venue" />
        ),
        meta: {
          label: "Venue",
          variant: "multiSelect",
          options: venueOptions,
        },
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
          variant: "multiSelect",
          options: timeslotOptions,
        },
        enableColumnFilter: true,
      },
      {
        id: "division",
        accessorKey: "division",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Division" />
        ),
        meta: {
          label: "Division",
          variant: "multiSelect",
          options: divisionOptions,
        },
        enableColumnFilter: true,
      },
      {
        id: "room",
        accessorKey: "room",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Room" />
        ),
        meta: { label: "Room", variant: "text" },
        enableColumnFilter: true,
      },
      {
        id: "affirmative",
        accessorKey: "affirmative",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Aff" />
        ),
        filterFn: (row, _id, filterValue) => {
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
        id: "negative",
        accessorKey: "negative",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Neg" />
        ),
        meta: { label: "Neg", variant: "text" },
        enableColumnFilter: false,
      },
      {
        id: "score",
        accessorKey: "score",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Result" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.score}</span>
        ),
        enableColumnFilter: false,
      },
      {
        id: "enteredBy",
        accessorKey: "enteredBy",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Entered by" />
        ),
        meta: { label: "Entered by", variant: "text" },
        enableColumnFilter: true,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) =>
          row.original.incomplete ? (
            <span className="text-xs text-destructive">Fix matchup</span>
          ) : (
            <BallotReviewActions
              debateId={row.original.id}
              roundId={row.original.roundId}
              ballotId={row.original.ballotId}
              status={row.original.status}
              editHref={`/adjudicator/ballots/${row.original.id}`}
            />
          ),
        enableSorting: false,
        enableColumnFilter: false,
      },
    ],
    [venueOptions, timeslotOptions, divisionOptions, institutionOptions]
  );

  const { table } = useDataTable({
    mode: "client",
    data,
    columns,
    getRowId: (row) => row.id,
    queryKeys: {
      page: "ha-ballots-page",
      perPage: "ha-ballots-perPage",
      sort: "ha-ballots-sort",
      joinOperator: "ha-ballots-join",
    },
    initialState: {
      sorting: [{ id: "status", desc: false }],
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  });

  return (
    <DataTable table={table} aria-label="Ballots" pagination={false}>
      <DataTableAdvancedToolbar table={table}>
        <DataTableFilterMenu table={table} />
        <DataTableSortMenu table={table} />
      </DataTableAdvancedToolbar>
    </DataTable>
  );
}
