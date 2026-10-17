"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getOrCreateTeamAccessLink,
  regenerateTeamAccessLink,
} from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TeamPrivateLink({
  teamId,
  initialUrl,
}: {
  teamId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [pending, startTransition] = useTransition();

  function copy(value: string) {
    void navigator.clipboard.writeText(value);
    toast.success("Private link copied");
  }

  return (
    <div className="space-y-3 border p-4">
      <div>
        <h2 className="text-sm font-semibold">Private team URL</h2>
        <p className="text-xs text-muted-foreground">
          This link stays the same until you regenerate it.
        </p>
      </div>
      {url ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => copy(url)}
          >
            Copy
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No private link yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!url ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await getOrCreateTeamAccessLink(teamId, true);
                  setUrl(result.url);
                  copy(result.url);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              })
            }
          >
            {pending ? "Creating…" : "Create private link"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (
                  !confirm(
                    "Regenerate this link? The old URL will stop working."
                  )
                ) {
                  return;
                }
                try {
                  const result = await regenerateTeamAccessLink(teamId, true);
                  setUrl(result.url);
                  copy(result.url);
                  toast.success("New private link created");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              })
            }
          >
            {pending ? "Regenerating…" : "Regenerate link"}
          </Button>
        )}
      </div>
    </div>
  );
}
