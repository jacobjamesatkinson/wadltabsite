"use client";

import Link from "next/link";
import * as React from "react";
import { NavMain } from "@/components/nav-main";
import { NavRounds } from "@/components/nav/nav-rounds";
import { NavSettings } from "@/components/nav/nav-settings";
import { NavUser } from "@/components/nav-user";
import type { ClientNavItem, RoundNavItem } from "@/components/nav/nav-config";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CommandIcon } from "lucide-react";

export function AppSidebar({
  title,
  items,
  rounds,
  settingsItems,
  user,
  showAuthActions = true,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  title: string;
  items: ClientNavItem[];
  rounds?: RoundNavItem[];
  settingsItems?: ClientNavItem[];
  user: { name: string; email: string };
  /** When false, footer shows identity only (no log out) — used by team portals. */
  showAuthActions?: boolean;
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">WADL Tab</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 pb-1 text-xs text-muted-foreground">{title}</p>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
        {rounds ? <NavRounds rounds={rounds} /> : null}
        {settingsItems ? <NavSettings items={settingsItems} /> : null}
      </SidebarContent>
      <SidebarFooter>
        {showAuthActions ? (
          <NavUser user={user} />
        ) : (
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
