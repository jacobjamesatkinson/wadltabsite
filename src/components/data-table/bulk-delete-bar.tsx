"use client";

import type { ReactTable, RowData } from "@tanstack/react-table";
import { DeleteButton } from "@/components/delete-button";
import type { DataTableFeatures } from "@/lib/data-table-features";

export function BulkDeleteBar<TData extends RowData>({
  table,
  entityLabel,
  onDelete,
}: {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  entityLabel: string;
  onDelete: (ids: string[]) => Promise<void>;
}) {
  return (
    <table.Subscribe
      selector={(state) =>
        Object.entries(state.rowSelection)
          .filter(([, selected]) => selected)
          .map(([id]) => id)
      }
    >
      {(ids) => {
        const count = ids.length;
        if (count === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-sm">
              {count} {entityLabel}
              {count === 1 ? "" : "s"} selected
            </span>
            <DeleteButton
              label={`Delete selected`}
              confirmTitle={`Delete ${count} ${entityLabel}${count === 1 ? "" : "s"}?`}
              confirmDescription="This cannot be undone."
              onDelete={async () => {
                await onDelete(ids);
                table.setRowSelection({});
              }}
            />
          </div>
        );
      }}
    </table.Subscribe>
  );
}
