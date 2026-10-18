"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Clock, MapPin, Minus, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableFilterMenu } from "@/components/data-table/data-table-filter-menu";
import { DataTableSortMenu } from "@/components/data-table/data-table-sort-menu";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { BallotReviewActions } from "@/app/(admin)/admin/results/ballot-review-actions";
import { cn } from "@/lib/utils";

export type ResultsRow = {
  id: string;
  roundId: string;
  status: "none" | "unconfirmed" | "confirmed";
  version: number | null;
  versions: number;
  enteredBy: string;
  enteredAt: string;
  confirmedBy: string | null;
  venue: string;
  timeslot: string;
  room: string;
  affirmative: string;
  negative: string;
  incomplete: boolean;
  winnerSide: "aff" | "neg" | "none";
  adjudicators: string;
  score: string;
  ballotId: string | null;
};

const STATUS_LABEL: Record<ResultsRow["status"], string> = {
  none: "No ballot",
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
};

export function ResultsDataTable({ data }: { data: ResultsRow[] }) {
  const columns = React.useMemo<ColumnDef<DataTableFeatures, ResultsRow>[]>(
    () => [
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} label="Status" />,
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
              <span className={cn(s === "none" && "text-muted-foreground")}>{STATUS_LABEL[s]}</span>
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
        id: "venue",
        accessorKey: "venue",
        header: ({ column }) => <DataTableColumnHeader column={column} label="Venue" />,
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.venue}
            <div className="text-xs text-muted-foreground">{row.original.timeslot}</div>
          </div>
        ),
        meta: { label: "Venue", variant: "text", icon: MapPin },
        enableColumnFilter: true,
      },
      {
        id: "room",
        accessorKey: "room",
        header: ({ column }) => <DataTableColumnHeader column={column} label="Room" />,
        meta: { label: "Room", variant: "text" },
        enableColumnFilter: true,
      },
      {
        id: "affirmative",
        accessorKey: "affirmative",
        header: ({ column }) => <DataTableColumnHeader column={column} label="Aff" />,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm",
              row.original.incomplete && "text-destructive",
              row.original.winnerSide === "aff" && "font-semibold text-emerald-700",
              row.original.winnerSide === "neg" && "text-muted-foreground"
            )}
          >
            {row.original.affirmative}
          </span>
        ),
        meta: { label: "Aff", variant: "text", icon: Users },
        enableColumnFilter: true,
      },
      {
        id: "negative",
        accessorKey: "negative",
        header: ({ column }) => <DataTableColumnHeader column={column} label="Neg" />,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm",
              row.original.incomplete && "text-destructive",
              row.original.winnerSide === "neg" && "font-semibold text-emerald-700",
              row.original.winnerSide === "aff" && "text-muted-foreground"
            )}
          >
            {row.original.negative}
          </span>
        ),
        meta: { label: "Neg", variant: "text", icon: Users },
        enableColumnFilter: true,
      },
      {
        id: "score",
        accessorKey: "score",
        header: ({ column }) => <DataTableColumnHeader column={column} label="Result" />,
        cell: ({ row }) => <span className="tabular-nums">{row.original.score}</span>,
        meta: { label: "Result", variant: "text" },
        enableColumnFilter: false,
      },
      {
        id: "adjudicators",
        accessorKey: "adjudicators",
        header: ({ column }) => <DataTableColumnHeader column={column} label="Adjudicator" />,
        meta: { label: "Adjudicator", variant: "text" },
        enableColumnFilter: true,
      },
      {
        id: "enteredBy",
        accessorKey: "enteredBy",
        header: ({ column }) => <DataTableColumnHeader column={column} label="Entered by" />,
        cell: ({ row }) =>
          row.original.enteredBy === "—" ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <div className="text-xs">
              <div>{row.original.enteredBy}</div>
              <div className="text-muted-foreground">
                {row.original.enteredAt}
                {row.original.confirmedBy ? ` · confirmed by ${row.original.confirmedBy}` : ""}
              </div>
            </div>
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
            />
          ),
        enableSorting: false,
        enableColumnFilter: false,
      },
    ],
    []
  );

  const { table } = useDataTable({
    mode: "client",
    data,
    columns,
    getRowId: (row) => row.id,
  });

  return (
    <DataTable table={table} aria-label="Round results">
      <DataTableAdvancedToolbar table={table}>
        <DataTableFilterMenu table={table} />
        <DataTableSortMenu table={table} />
      </DataTableAdvancedToolbar>
    </DataTable>
  );
}
