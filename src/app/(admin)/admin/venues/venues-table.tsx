"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { deleteRoom, deleteVenue } from "@/app/actions/venues";
import { DeleteButton } from "@/components/delete-button";
import { EntityDataTable } from "@/components/data-table/entity-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { RoomEditButton, RoomForm } from "./room-form";
import { VenueForm } from "./venue-form";

export type RoomTableRow = {
  id: string;
  venueId: string;
  venueName: string;
  room: string;
  capacity: string;
  available: string;
  capacityValue: number | null;
  availableValue: boolean;
  identifier: string;
};

export type VenueHeader = {
  id: string;
  name: string;
  address: string | null;
  status: string;
};

export function VenuesTable({
  venues,
  rooms,
}: {
  venues: VenueHeader[];
  rooms: RoomTableRow[];
}) {
  const trailingColumn: ColumnDef<DataTableFeatures, RoomTableRow> = {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="flex justify-end gap-2">
          <RoomEditButton
            room={{
              id: r.id,
              identifier: r.identifier,
              capacity: r.capacityValue,
              available: r.availableValue,
            }}
          />
          <DeleteButton
            onDelete={async () => {
              await deleteRoom(r.id);
            }}
          />
        </div>
      );
    },
    enableSorting: false,
    enableColumnFilter: false,
  };

  return (
    <div className="space-y-6">
      {venues.map((v) => (
        <section key={v.id} className="space-y-3 border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{v.name}</h2>
              <p className="text-sm text-muted-foreground">{v.address}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <VenueForm venue={v} />
              <DeleteButton
                confirmTitle={`Delete ${v.name}?`}
                confirmDescription="Rooms in this venue will also be deleted."
                onDelete={async () => {
                  await deleteVenue(v.id);
                }}
              />
              <RoomForm venueId={v.id} />
            </div>
          </div>
          <EntityDataTable
            data={rooms.filter((r) => r.venueId === v.id)}
            ariaLabel={`${v.name} rooms`}
            trailingColumn={trailingColumn}
            columns={[
              { id: "room", accessorKey: "room", label: "Room" },
              {
                id: "capacity",
                accessorKey: "capacity",
                label: "Capacity",
                variant: "text",
              },
              {
                id: "available",
                accessorKey: "available",
                label: "Available",
                variant: "select",
              },
            ]}
          />
        </section>
      ))}
    </div>
  );
}
