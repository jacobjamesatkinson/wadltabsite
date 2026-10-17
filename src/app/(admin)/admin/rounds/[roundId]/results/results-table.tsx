"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, MapPin, Users, X } from "lucide-react";
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
  status: string;
  ballotLabel: string;
  enteredBy: string;
  enteredAt: string;
  room: string;
  affirmative: string;
  negative: string;
  winnerSide: "aff" | "neg" | "none";
  adjudicators: string;
  score: string;
  reviewBallotId: string | null;
};

export function ResultsDataTable({ data }: { data: ResultsRow[] }) {
  const columns = React.useMemo<ColumnDef<DataTableFeatures, ResultsRow>[]>(
    () => [
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Status" />
        ),
        cell: ({ row }) => {
          const ok =
            row.original.status === "accepted" ||
            row.original.status === "submitted";
          return (
            <span className="inline-flex items-center gap-1">
              {ok ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <X className="size-4 text-muted-foreground" />
              )}
              <span className="text-xs capitalize">{row.original.status}</span>
            </span>
          );
        },
        meta: { label: "Status", variant: "select", options: [
          { label: "Pending", value: "pending" },
          { label: "Submitted", value: "submitted" },
          { label: "Accepted", value: "accepted" },
          { label: "Disputed", value: "disputed" },
        ] },
        enableColumnFilter: true,
      },
      {
        id: "ballotLabel",
        accessorKey: "ballotLabel",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Ballot" />
        ),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-violet-700">
              {row.original.ballotLabel}
            </div>
            {row.original.enteredBy !== "—" ? (
              <div className="text-xs text-teal-700">
                {row.original.enteredAt} · {row.original.enteredBy}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No ballot yet</div>
            )}
          </div>
        ),
        meta: { label: "Ballot", variant: "text" },
        enableColumnFilter: true,
      },
      {
        id: "room",
        accessorKey: "room",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Room" />
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-sm">
            <MapPin className="size-3.5 text-muted-foreground" />
            {row.original.room}
          </span>
        ),
        meta: { label: "Room", variant: "text", icon: MapPin },
        enableColumnFilter: true,
      },
      {
        id: "affirmative",
        accessorKey: "affirmative",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Aff" />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm",
              row.original.winnerSide === "aff" && "font-semibold text-emerald-700",
              row.original.winnerSide === "neg" && "text-muted-foreground"
            )}
          >
            {row.original.winnerSide === "aff" ? "▲ " : row.original.winnerSide === "neg" ? "▼ " : ""}
            {row.original.affirmative}
          </span>
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
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm",
              row.original.winnerSide === "neg" && "font-semibold text-emerald-700",
              row.original.winnerSide === "aff" && "text-muted-foreground"
            )}
          >
            {row.original.winnerSide === "neg" ? "▲ " : row.original.winnerSide === "aff" ? "▼ " : ""}
            {row.original.negative}
          </span>
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
        meta: { label: "Adjudicators", variant: "text" },
        enableColumnFilter: true,
      },
      {
        id: "score",
        accessorKey: "score",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Score" />
        ),
        meta: { label: "Score", variant: "text" },
        enableColumnFilter: false,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) =>
          row.original.reviewBallotId ? (
            <BallotReviewActions ballotId={row.original.reviewBallotId} />
          ) : null,
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
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
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
