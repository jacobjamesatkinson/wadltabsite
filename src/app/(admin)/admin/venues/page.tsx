import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { VenueForm } from "./venue-form";
import { VenuesTable } from "./venues-table";

export default async function VenuesPage() {
  const [venueRows, roomRows] = await Promise.all([
    db.query.venues.findMany(),
    db.query.rooms.findMany(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues and rooms"
        description="Physical venues and their two-week roster night"
        actions={<VenueForm />}
      />
      <VenuesTable
        venues={venueRows.map((v) => ({
          id: v.id,
          name: v.name,
          address: v.address,
          status: v.status,
          rosterDay: v.rosterDay,
        }))}
        rooms={roomRows.map((r) => {
          const venue = venueRows.find((v) => v.id === r.venueId);
          return {
            id: r.id,
            venueId: r.venueId,
            venueName: venue?.name ?? "—",
            room: r.identifier,
            available: r.available ? "Yes" : "No",
            availableValue: r.available,
            identifier: r.identifier,
          };
        })}
      />
    </div>
  );
}
