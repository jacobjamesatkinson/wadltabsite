"use client";

import * as React from "react";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableFilterMenu } from "@/components/data-table/data-table-filter-menu";
import { DataTableSortMenu } from "@/components/data-table/data-table-sort-menu";
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
};

export function EntityDataTable<TData extends { id: string }>({
  data,
  columns: columnConfigs,
  ariaLabel,
  pageSize = 20,
  trailingColumn,
}: {
  data: TData[];
  columns: EntityColumn<TData>[];
  ariaLabel: string;
  pageSize?: number;
  trailingColumn?: ColumnDef<DataTableFeatures, TData>;
}) {
  const columns = React.useMemo<ColumnDef<DataTableFeatures, TData>[]>(() => {
    const defs: ColumnDef<DataTableFeatures, TData>[] = columnConfigs.map(
      (col) => ({
        id: col.id,
        accessorKey: col.accessorKey,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label={col.label} />
        ),
        cell: ({ row }) =>
          col.cell ? col.cell(row.original) : String(row.getValue(col.id) ?? "—"),
        meta: {
          label: col.label,
          variant: col.variant ?? "text",
        },
        enableColumnFilter: col.enableColumnFilter ?? true,
      })
    );
    if (trailingColumn) defs.push(trailingColumn);
    return defs;
  }, [columnConfigs, trailingColumn]);

  const { table } = useDataTable({
    mode: "client",
    data,
    columns,
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageIndex: 0, pageSize },
    },
  });

  return (
    <DataTable table={table} aria-label={ariaLabel}>
      <DataTableAdvancedToolbar table={table}>
        <DataTableFilterMenu table={table} />
        <DataTableSortMenu table={table} />
      </DataTableAdvancedToolbar>
    </DataTable>
  );
}
