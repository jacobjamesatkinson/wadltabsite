"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addUserRole,
  assignCoordinatorInstitution,
  createAccount,
  removeCoordinatorInstitution,
  removeUserRole,
  setUserPassword,
  updateUserProfile,
  updateUserStatus,
} from "@/app/actions/accounts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppRole } from "@/lib/permissions/types";

type InstitutionOpt = { id: string; name: string; shortName: string };
type RoleRow = {
  id: string;
  role: AppRole;
  institutionId: string | null;
};

export function CreateAccountForm({ institutions }: { institutions: InstitutionOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("coordinator");
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleInstitution(id: string) {
    setInstitutionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Create account</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create account</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              await createAccount({
                name,
                email,
                password,
                role,
                institutionIds: role === "coordinator" ? institutionIds : [],
              });
              toast.success("Account created");
              setOpen(false);
              setName("");
              setEmail("");
              setPassword("");
              setInstitutionIds([]);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
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
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <select
              className="flex h-8 w-full rounded-lg border px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
            >
              <option value="coordinator">Coordinator</option>
              <option value="adjudicator">Adjudicator</option>
              <option value="head_adjudicator">Head adjudicator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {role === "coordinator" ? (
            <div className="space-y-2">
              <Label>Institutions</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                {institutions.map((inst) => (
                  <label key={inst.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={institutionIds.includes(inst.id)}
                      onChange={() => toggleInstitution(inst.id)}
                    />
                    {inst.name} ({inst.shortName})
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ManageAccountButton({
  accountUser,
  roles,
  institutions,
}: {
  accountUser: { id: string; name: string; email: string; status: string };
  roles: RoleRow[];
  institutions: InstitutionOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(accountUser.name);
  const [email, setEmail] = useState(accountUser.email);
  const [password, setPassword] = useState("");
  const [assignInstitutionId, setAssignInstitutionId] = useState(institutions[0]?.id ?? "");
  const [addRole, setAddRole] = useState<AppRole>("adjudicator");
  const [loading, setLoading] = useState(false);

  const assignedInstitutionIds = useMemo(
    () =>
      new Set(
        roles
          .filter((r) => r.role === "coordinator" && r.institutionId)
          .map((r) => r.institutionId as string)
      ),
    [roles]
  );

  const unassignedInstitutions = institutions.filter(
    (i) => !assignedInstitutionIds.has(i.id)
  );

  const institutionName = (id: string | null) =>
    institutions.find((i) => i.id === id)?.shortName ?? id ?? "—";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(accountUser.name);
          setEmail(accountUser.email);
          setPassword("");
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Manage</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage {accountUser.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await updateUserProfile(accountUser.id, { name, email });
                toast.success("Profile updated");
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={loading}>
              Save profile
            </Button>
          </form>

          <form
            className="space-y-3 border-t pt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await setUserPassword(accountUser.id, password);
                toast.success("Password updated");
                setPassword("");
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="space-y-1">
              <Label>Set password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={loading}>
              Update password
            </Button>
          </form>

          <div className="space-y-2 border-t pt-4">
            <Label>Status</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={accountUser.status === "active" ? "default" : "outline"}
                onClick={async () => {
                  try {
                    await updateUserStatus(accountUser.id, "active");
                    toast.success("Account enabled");
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                Active
              </Button>
              <Button
                type="button"
                size="sm"
                variant={accountUser.status === "disabled" ? "destructive" : "outline"}
                onClick={async () => {
                  try {
                    await updateUserStatus(accountUser.id, "disabled");
                    toast.success("Account disabled");
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                Disabled
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Roles</Label>
            <ul className="space-y-1 text-sm">
              {roles.length === 0 ? (
                <li className="text-muted-foreground">No roles</li>
              ) : (
                roles.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span>
                      {r.role}
                      {r.role === "coordinator"
                        ? ` · ${institutionName(r.institutionId)}`
                        : ""}
                    </span>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await removeUserRole(r.id);
                          toast.success("Role removed");
                          router.refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))
              )}
            </ul>
            <div className="flex gap-2">
              <select
                className="flex h-8 flex-1 rounded-lg border px-2 text-sm"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as AppRole)}
              >
                <option value="adjudicator">Adjudicator</option>
                <option value="head_adjudicator">Head adjudicator</option>
                <option value="admin">Admin</option>
                <option value="coordinator">Coordinator</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    if (addRole === "coordinator") {
                      if (!assignInstitutionId) {
                        toast.error("Pick an institution");
                        return;
                      }
                      await assignCoordinatorInstitution(
                        accountUser.id,
                        assignInstitutionId
                      );
                    } else {
                      await addUserRole(accountUser.id, addRole);
                    }
                    toast.success("Role added");
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Coordinator institutions</Label>
            <ul className="space-y-1 text-sm">
              {[...assignedInstitutionIds].map((id) => (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span>{institutionName(id)}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await removeCoordinatorInstitution(accountUser.id, id);
                        toast.success("Institution unassigned");
                        router.refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed");
                      }
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
              {assignedInstitutionIds.size === 0 ? (
                <li className="text-muted-foreground">None assigned</li>
              ) : null}
            </ul>
            {unassignedInstitutions.length > 0 ? (
              <div className="flex gap-2">
                <select
                  className="flex h-8 flex-1 rounded-lg border px-2 text-sm"
                  value={assignInstitutionId}
                  onChange={(e) => setAssignInstitutionId(e.target.value)}
                >
                  {unassignedInstitutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await assignCoordinatorInstitution(
                        accountUser.id,
                        assignInstitutionId
                      );
                      toast.success("Institution assigned");
                      router.refresh();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  Assign
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
