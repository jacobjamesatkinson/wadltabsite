"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createTeamAccessLink } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";

export function TeamTokenButton({ teamId }: { teamId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const result = await createTeamAccessLink(teamId, true);
            setUrl(result.url);
            await navigator.clipboard.writeText(result.url);
            toast.success("Private link copied to clipboard");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "…" : "Link"}
      </Button>
      {url ? (
        <span className="max-w-[180px] truncate font-mono text-[10px] text-muted-foreground">
          {url}
        </span>
      ) : null}
    </div>
  );
}
