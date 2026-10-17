import { db } from "@/db";
import { PageHeader } from "@/components/page-header";
import { InstitutionForm } from "./institution-form";
import { InstitutionsTable } from "./institutions-table";

export default async function InstitutionsPage() {
  const [institutions, teams, memberships, roles] = await Promise.all([
    db.query.institutions.findMany(),
    db.query.teams.findMany(),
    db.query.institutionMemberships.findMany(),
    db.query.userRoles.findMany(),
  ]);

  const teamCount = new Map<string, number>();
  for (const t of teams) {
    if (!t.institutionId) continue;
    teamCount.set(t.institutionId, (teamCount.get(t.institutionId) ?? 0) + 1);
  }

  const coordCount = new Map<string, number>();
  for (const m of memberships) {
    coordCount.set(m.institutionId, (coordCount.get(m.institutionId) ?? 0) + 1);
  }
  for (const r of roles) {
    if (r.role === "coordinator" && r.institutionId) {
      // memberships already counted; roles without membership still count
      if (!memberships.some(
        (m) => m.userId === r.userId && m.institutionId === r.institutionId
      )) {
        coordCount.set(
          r.institutionId,
          (coordCount.get(r.institutionId) ?? 0) + 1
        );
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutions"
        description="Schools and organisations in this competition"
        actions={<InstitutionForm />}
      />
      <InstitutionsTable
        rows={institutions.map((inst) => ({
          id: inst.id,
          name: inst.name,
          shortName: inst.shortName,
          status: inst.status,
          teams: teamCount.get(inst.id) ?? 0,
          coordinators: coordCount.get(inst.id) ?? 0,
        }))}
      />
    </div>
  );
}
