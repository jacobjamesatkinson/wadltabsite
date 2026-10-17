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
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  title: string;
  items: ClientNavItem[];
  rounds?: RoundNavItem[];
  settingsItems?: ClientNavItem[];
  user: { name: string; email: string };
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
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
