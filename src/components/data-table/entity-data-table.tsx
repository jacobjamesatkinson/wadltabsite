"use client";

import * as React from "react";
import type { ColumnDef, RowData, SortingState } from "@tanstack/react-table";
import { BulkDeleteBar } from "@/components/data-table/bulk-delete-bar";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableFilterMenu } from "@/components/data-table/data-table-filter-menu";
import { DataTableSortMenu } from "@/components/data-table/data-table-sort-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import type { FilterVariant } from "@/lib/data-table-types";

export type EntityColumn<TData extends RowData> = {
  id: string;
  accessorKey: keyof TData & string;
  label: string;
  variant?: FilterVariant;
  cell?: (row: TData) => React.ReactNode;
  enableColumnFilter?: boolean;
  /** Defaults to alphanumeric for text columns so "2" sorts before "10". */
  sortFn?: "alphanumeric" | "text" | "datetime";
  /** Custom row compare; takes precedence over sortFn when set. */
  compare?: (a: TData, b: TData) => number;
};

export function EntityDataTable<TData extends { id: string }>({
  data,
  columns: columnConfigs,
  ariaLabel,
  pageSize = Number.MAX_SAFE_INTEGER,
  trailingColumn,
  enableRowSelection = false,
  bulkDelete,
  initialSorting,
}: {
  data: TData[];
  columns: EntityColumn<TData>[];
  ariaLabel: string;
  pageSize?: number;
  trailingColumn?: ColumnDef<DataTableFeatures, TData>;
  enableRowSelection?: boolean;
  bulkDelete?: {
    entityLabel: string;
    onDelete: (ids: string[]) => Promise<void>;
  };
  initialSorting?: SortingState;
}) {
  const columns = React.useMemo<ColumnDef<DataTableFeatures, TData>[]>(() => {
    const defs: ColumnDef<DataTableFeatures, TData>[] = [];

    if (enableRowSelection) {
      defs.push({
        id: "select",
        size: 40,
        minSize: 40,
        maxSize: 40,
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={
                table.getIsSomePageRowsSelected() &&
                !table.getIsAllPageRowsSelected()
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
      });
    }

    for (const col of columnConfigs) {
      const variant = col.variant ?? "text";
      defs.push({
        id: col.id,
        accessorKey: col.accessorKey,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label={col.label} />
        ),
        cell: ({ row }) =>
          col.cell
            ? col.cell(row.original)
            : String(row.getValue(col.id) ?? "—"),
        meta: {
          label: col.label,
          variant,
        },
        enableColumnFilter: col.enableColumnFilter ?? true,
        // Prefer natural order for labels like "CCGS 2" before "CCGS 10".
        ...(col.compare
          ? {
              sortFn: (
                rowA: { original: TData },
                rowB: { original: TData }
              ) => col.compare!(rowA.original, rowB.original),
            }
          : col.sortFn
            ? { sortFn: col.sortFn }
            : variant === "number"
              ? {}
              : { sortFn: "alphanumeric" as const }),
      });
    }

    if (trailingColumn) defs.push(trailingColumn);
    return defs;
  }, [columnConfigs, trailingColumn, enableRowSelection]);

  const { table } = useDataTable({
    mode: "client",
    data,
    columns,
    getRowId: (row) => row.id,
    enableRowSelection,
    initialState: {
      pagination: { pageIndex: 0, pageSize },
      sorting: initialSorting,
    },
  });

  return (
    <DataTable
      table={table}
      aria-label={ariaLabel}
      actionBar={
        enableRowSelection && bulkDelete ? (
          <BulkDeleteBar
            table={table}
            entityLabel={bulkDelete.entityLabel}
            onDelete={bulkDelete.onDelete}
          />
        ) : undefined
      }
    >
      <DataTableAdvancedToolbar table={table}>
        <DataTableFilterMenu table={table} />
        <DataTableSortMenu table={table} />
      </DataTableAdvancedToolbar>
    </DataTable>
  );
}
