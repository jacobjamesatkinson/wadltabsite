import { db } from "@/db";
import { deleteRoom, deleteVenue } from "@/app/actions/venues";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VenueForm } from "./venue-form";
import { RoomEditButton, RoomForm } from "./room-form";

export default async function VenuesPage() {
  const [venueRows, roomRows] = await Promise.all([
    db.query.venues.findMany(),
    db.query.rooms.findMany(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues and rooms"
        description="Physical venues used for competition nights"
        actions={<VenueForm />}
      />
      <div className="space-y-6">
        {venueRows.map((v) => {
          const rooms = roomRows.filter((r) => r.venueId === v.id);
          return (
            <section key={v.id} className="space-y-3 rounded-lg border p-4">
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
                    onDelete={deleteVenue.bind(null, v.id)}
                  />
                  <RoomForm venueId={v.id} />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No rooms
                      </TableCell>
                    </TableRow>
                  ) : (
                    rooms.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.identifier}</TableCell>
                        <TableCell>{r.capacity ?? "—"}</TableCell>
                        <TableCell>{r.available ? "Yes" : "No"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <RoomEditButton room={r} />
                            <DeleteButton onDelete={deleteRoom.bind(null, r.id)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
