"use client";

import { EntityDataTable } from "@/components/data-table/entity-data-table";

export type AuditRow = {
  id: string;
  when: string;
  action: string;
  entity: string;
  actor: string;
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Audit log"
      columns={[
        { id: "when", accessorKey: "when", label: "When" },
        { id: "action", accessorKey: "action", label: "Action" },
        { id: "entity", accessorKey: "entity", label: "Entity" },
        { id: "actor", accessorKey: "actor", label: "Actor" },
      ]}
    />
  );
}
