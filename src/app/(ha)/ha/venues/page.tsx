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
import { RoomForm } from "@/app/(admin)/admin/venues/room-form";

export default async function HaVenuesPage() {
  const [venues, rooms] = await Promise.all([
    db.query.venues.findMany(),
    db.query.rooms.findMany(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue management"
        description="Logical room layout — floor plans optional"
      />
      {venues.map((v) => {
        const venueRooms = rooms.filter((r) => r.venueId === v.id);
        return (
          <section key={v.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{v.name}</h2>
                <p className="text-sm text-muted-foreground">{v.address}</p>
                {v.rosterDay ? (
                  <p className="mt-1 text-sm">Roster: {v.rosterDay}</p>
                ) : null}
              </div>
              <RoomForm venueId={v.id} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {venueRooms.map((r) => (
                <div key={r.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">Room {r.identifier}</p>
                  <p className="text-muted-foreground">
                    {r.available ? "Open" : "Closed"}
                  </p>
                </div>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venueRooms.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.identifier}</TableCell>
                    <TableCell>{r.available ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        );
      })}
    </div>
  );
}
