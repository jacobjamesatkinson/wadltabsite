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

const MANAGE_ROUNDS_HREF = "/admin/settings/rounds";

export function NavRounds({ rounds }: { rounds: RoundNavItem[] }) {
  const pathname = usePathname();

  const manageActive =
    pathname === MANAGE_ROUNDS_HREF ||
    pathname.startsWith(`${MANAGE_ROUNDS_HREF}/`);
  const roundOpen = rounds.some((round) => {
    const base = `/admin/rounds/${round.id}`;
    return pathname === base || pathname.startsWith(`${base}/`);
  });
  const open = manageActive || roundOpen;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Rounds</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={open || true} className="group/collapsible">
          <SidebarMenuItem>
            <div className="flex w-full items-center">
              <SidebarMenuButton
                tooltip="Rounds"
                isActive={manageActive}
                className="flex-1"
                render={<Link href={MANAGE_ROUNDS_HREF} />}
              >
                <NavIcon name="CalendarDays" />
                <span>Rounds</span>
              </SidebarMenuButton>
              <CollapsibleTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    aria-label="Toggle rounds list"
                  />
                }
              >
                <ChevronRight className="size-4 transition-transform group-data-open/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <SidebarMenuSub>
                {rounds.length === 0 ? (
                  <SidebarMenuSubItem>
                    <span className="px-2 py-1.5 text-xs text-muted-foreground">
                      No rounds yet
                    </span>
                  </SidebarMenuSubItem>
                ) : (
                  rounds.map((round) => {
                    const base = `/admin/rounds/${round.id}`;
                    const roundActive =
                      pathname === base || pathname.startsWith(`${base}/`);
                    return (
                      <Collapsible
                        key={round.id}
                        defaultOpen={roundActive}
                        className="group/round"
                      >
                        <SidebarMenuSubItem>
                          <CollapsibleTrigger
                            render={
                              <SidebarMenuSubButton
                                isActive={roundActive}
                                render={<button type="button" />}
                              />
                            }
                          >
                            <span>{round.name}</span>
                            <ChevronRight className="ml-auto size-3.5 transition-transform group-data-open/round:rotate-90" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="mr-0 border-l ml-2.5 translate-x-px px-1.5 py-0.5">
                              {ROUND_STEPS.map((step) => {
                                const href = `${base}/${step.slug}`;
                                const active =
                                  pathname === href ||
                                  pathname.startsWith(`${href}/`);
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
                        </SidebarMenuSubItem>
                      </Collapsible>
                    );
                  })
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  );
}
