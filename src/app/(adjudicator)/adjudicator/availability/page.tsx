import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAvailability,
  timeslots,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth/session";
import { AvailabilityToggle } from "./availability-toggle";

export default async function AvailabilityPage() {
  const ctx = await requireAuth();
  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });
  if (!profile) {
    return (
      <div className="space-y-4">
        <PageHeader title="Availability" />
        <p className="text-sm text-muted-foreground">
          No adjudicator profile is linked to your account. Ask an administrator.
        </p>
      </div>
    );
  }

  const slots = await db.select().from(timeslots);
  const avail = await db
    .select()
    .from(adjudicatorAvailability)
    .where(eq(adjudicatorAvailability.adjudicatorId, profile.id));
  const availMap = new Map(avail.map((a) => [a.timeslotId, a.available]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description="Mark which timeslots you can adjudicate"
      />
      <ul className="space-y-2">
        {slots.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <div>
              <p className="font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">
                {s.startsAt.toISOString()}
              </p>
            </div>
            <AvailabilityToggle
              adjudicatorId={profile.id}
              timeslotId={s.id}
              available={availMap.get(s.id) ?? false}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
