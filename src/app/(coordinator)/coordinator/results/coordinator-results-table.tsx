"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { cn } from "@/lib/utils";

export type RoundResultCell = {
  outcome: "won" | "lost";
  opponent: string;
} | null;

export type CoordinatorResultsRow = {
  id: string;
  name: string;
  institution: string;
  division: string;
  record: string;
  results: Record<string, RoundResultCell>;
};

export type ResultsRoundColumn = {
  id: string;
  name: string;
  number: number;
};

function ResultMark({ cell }: { cell: RoundResultCell }) {
  if (!cell) {
    return <span className="text-muted-foreground">—</span>;
  }
  const won = cell.outcome === "won";
  const label = `${won ? "Won" : "Lost"} against ${cell.opponent}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-1 hover:bg-muted"
            aria-label={label}
          />
        }
      >
        {won ? (
          <ArrowUp className="size-4 text-emerald-600" />
        ) : (
          <ArrowDown className="size-4 text-red-600" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function CoordinatorResultsTable({
  rows,
  rounds,
}: {
  rows: CoordinatorResultsRow[];
  rounds: ResultsRoundColumn[];
}) {
  const institutionOptions = React.useMemo(
    () =>
      [...new Set(rows.map((r) => r.institution))]
        .filter((v) => v && v !== "—")
        .sort()
        .map((value) => ({ label: value, value })),
    [rows]
  );
  const divisionOptions = React.useMemo(
    () =>
      [...new Set(rows.map((r) => r.division))]
        .filter((v) => v && v !== "—")
        .sort()
        .map((value) => ({ label: value, value })),
    [rows]
  );

  const columns = React.useMemo<
    ColumnDef<DataTableFeatures, CoordinatorResultsRow>[]
  >(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Team" />
        ),
        meta: { label: "Team", variant: "text", placeholder: "Search teams…" },
        enableColumnFilter: true,
      },
      {
        id: "institution",
        accessorKey: "institution",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Institution" />
        ),
        meta: {
          label: "Institution",
          variant: "multiSelect",
          options: institutionOptions,
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
        id: "record",
        accessorKey: "record",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="W–L" />
        ),
        meta: { label: "W–L", variant: "text" },
        enableColumnFilter: false,
      },
      ...rounds.map(
        (round): ColumnDef<DataTableFeatures, CoordinatorResultsRow> => ({
          id: round.id,
          accessorFn: (row) => row.results[round.id]?.outcome ?? "",
          header: ({ column }) => (
            <DataTableColumnHeader column={column} label={round.name} />
          ),
          cell: ({ row }) => (
            <ResultMark cell={row.original.results[round.id] ?? null} />
          ),
          meta: {
            label: round.name,
            variant: "select",
            options: [
              { label: "Won", value: "won" },
              { label: "Lost", value: "lost" },
            ],
          },
          enableColumnFilter: true,
          enableSorting: false,
        })
      ),
    ],
    [rounds, institutionOptions, divisionOptions]
  );

  const { table } = useDataTable({
    mode: "client",
    data: rows,
    columns,
    getRowId: (row) => row.id,
    queryKeys: {
      page: "coord-results-page",
      perPage: "coord-results-perPage",
      sort: "coord-results-sort",
      joinOperator: "coord-results-join",
    },
    initialState: {
      sorting: [{ id: "name", desc: false }],
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  });

  return (
    <DataTable
      table={table}
      aria-label="Institution results"
      pagination={false}
      className={cn("text-[15px] [&_td]:px-3 [&_td]:py-2 [&_th]:px-3")}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
