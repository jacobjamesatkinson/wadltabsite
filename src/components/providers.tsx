"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <DirectionProvider direction="ltr">
        <TooltipProvider>{children}</TooltipProvider>
      </DirectionProvider>
    </NuqsAdapter>
  );
}
