"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  Gavel,
  LayoutDashboard,
  ListChecks,
  MapPin,
  School,
  ScrollText,
  Settings,
  Shield,
  Trophy,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { NavIconName, NavItem } from "@/components/nav/nav-config";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const ICONS: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  Trophy,
  CalendarDays,
  Users,
  School,
  Gavel,
  MapPin,
  ClipboardList,
  Shield,
  ScrollText,
  Settings,
  Building2,
  Clock,
  ListChecks,
  UserCircle,
};

export function AppSidebar({
  items,
  title,
  userName,
}: {
  items: NavItem[];
  title: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/" className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold tracking-tight">WADL Tab</span>
          <span className="text-xs text-muted-foreground">{title}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                const active =
                  pathname === item.href ||
                  (item.href !== items[0]?.href && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex flex-col gap-2 px-1">
          <p className="truncate text-xs text-muted-foreground">{userName}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            Sign out
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
