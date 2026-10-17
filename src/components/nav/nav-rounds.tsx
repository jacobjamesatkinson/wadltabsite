"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ROUND_STEPS, type RoundNavItem } from "@/components/nav/nav-config";
import { NavIcon } from "@/components/nav/nav-icons";

export function NavRounds({ rounds }: { rounds: RoundNavItem[] }) {
  const pathname = usePathname();

  if (rounds.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Rounds</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled className="text-muted-foreground">
              No rounds yet
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Rounds</SidebarGroupLabel>
      <SidebarMenu>
        {rounds.map((round) => {
          const base = `/admin/rounds/${round.id}`;
          const open =
            pathname === base || pathname.startsWith(`${base}/`);
          return (
            <Collapsible
              key={round.id}
              defaultOpen={open}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger
                  render={
                    <SidebarMenuButton
                      tooltip={round.name}
                      isActive={open}
                    />
                  }
                >
                  <NavIcon name="CalendarDays" />
                  <span>{round.name}</span>
                  <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {ROUND_STEPS.map((step) => {
                      const href = `${base}/${step.slug}`;
                      const active =
                        pathname === href || pathname.startsWith(`${href}/`);
                      return (
                        <SidebarMenuSubItem key={step.slug}>
                          <SidebarMenuSubButton
                            isActive={active}
                            render={<Link href={href} />}
                          >
                            <NavIcon name={step.icon} />
                            <span>{step.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
