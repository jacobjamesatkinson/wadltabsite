"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  assignCoordinatorInstitution,
  createAccount,
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

type UserOpt = { id: string; name: string; email: string };

export function InstitutionCoordinatorForm({
  institutionId,
  availableUsers,
}: {
  institutionId: string;
  availableUsers: UserOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"assign" | "create">("assign");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setMode(availableUsers.length > 0 ? "assign" : "create");
    setUserId("");
    setName("");
    setEmail("");
    setPassword("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        Add coordinator
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add coordinator</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "assign" ? "default" : "outline"}
            disabled={availableUsers.length === 0}
            onClick={() => setMode("assign")}
          >
            Existing account
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "create" ? "default" : "outline"}
            onClick={() => setMode("create")}
          >
            New account
          </Button>
        </div>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              if (mode === "assign") {
                if (!userId) throw new Error("Select a user");
                await assignCoordinatorInstitution(userId, institutionId);
                toast.success("Coordinator assigned");
              } else {
                await createAccount({
                  name,
                  email,
                  password,
                  role: "coordinator",
                  institutionIds: [institutionId],
                });
                toast.success("Coordinator account created");
              }
              setOpen(false);
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          {mode === "assign" ? (
            <div className="space-y-1">
              <Label>Account</Label>
              <select
                className="flex h-8 w-full rounded-lg border px-2 text-sm"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              >
                <option value="">Select user…</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
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
            </>
          )}
          <Button
            type="submit"
            disabled={
              loading || (mode === "assign" && (!userId || availableUsers.length === 0))
            }
          >
            {loading ? "Saving…" : mode === "assign" ? "Assign" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
