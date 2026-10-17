"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import type { ClientNavItem } from "@/components/nav/nav-config";
import { NavIcon } from "@/components/nav/nav-icons";

export function NavSettings({ items }: { items: ClientNavItem[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const open = items.some(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.title.toLowerCase().includes(q));
  }, [items, query]);

  if (items.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Settings</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={open || true} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger
              render={<SidebarMenuButton tooltip="Settings" isActive={open} />}
            >
              <NavIcon name="Settings" />
              <span>Settings</span>
              <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-2 pb-1 pt-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search settings…"
                    className="h-8 border bg-background pl-7 text-xs"
                  />
                </div>
              </div>
              <SidebarMenuSub>
                {filtered.length === 0 ? (
                  <SidebarMenuSubItem>
                    <span className="px-2 py-1.5 text-xs text-muted-foreground">
                      No matches
                    </span>
                  </SidebarMenuSubItem>
                ) : (
                  filtered.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/admin/settings" &&
                        pathname.startsWith(`${item.href}/`)) ||
                      (item.href === "/admin/settings" &&
                        pathname === "/admin/settings");
                    return (
                      <SidebarMenuSubItem key={item.href}>
                        <SidebarMenuSubButton
                          isActive={active}
                          render={<Link href={item.href} />}
                        >
                          <NavIcon name={item.icon} />
                          <span>{item.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
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
