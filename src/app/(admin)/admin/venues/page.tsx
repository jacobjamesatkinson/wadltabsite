import { db } from "@/db";
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
import { RoomForm } from "./room-form";

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
                <RoomForm venueId={v.id} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No rooms
                      </TableCell>
                    </TableRow>
                  ) : (
                    rooms.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.identifier}</TableCell>
                        <TableCell>{r.capacity ?? "—"}</TableCell>
                        <TableCell>{r.available ? "Yes" : "No"}</TableCell>
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
