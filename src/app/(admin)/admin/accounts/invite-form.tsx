"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInvitation } from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm({
  institutions,
}: {
  institutions: Array<{ id: string; name: string; shortName: string }>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"coordinator" | "adjudicator" | "head_adjudicator" | "admin">(
    "coordinator"
  );
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? "");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await createInvitation({
            email,
            role,
            institutionId: role === "coordinator" ? institutionId : undefined,
          });
          setInviteUrl(res.inviteUrl);
          await navigator.clipboard.writeText(res.inviteUrl);
          toast.success("Invitation created — link copied");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
    >
      <h2 className="text-sm font-semibold">Invite privileged user</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Role</Label>
          <select
            className="flex h-8 w-full rounded-lg border px-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="coordinator">Coordinator</option>
            <option value="adjudicator">Adjudicator</option>
            <option value="head_adjudicator">Head adjudicator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {role === "coordinator" ? (
          <div className="space-y-1 sm:col-span-2">
            <Label>Institution</Label>
            <select
              className="flex h-8 w-full rounded-lg border px-2 text-sm"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              required
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.shortName})
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <Button type="submit" size="sm">
        Create invitation
      </Button>
      {inviteUrl ? (
        <p className="break-all font-mono text-xs text-muted-foreground">{inviteUrl}</p>
      ) : null}
    </form>
  );
}
