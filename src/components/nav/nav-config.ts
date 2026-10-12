import type { Permission } from "@/lib/permissions/types";

/** Icon names only — Lucide components cannot cross the Server/Client boundary. */
export type NavIconName =
  | "LayoutDashboard"
  | "Trophy"
  | "CalendarDays"
  | "Users"
  | "School"
  | "Gavel"
  | "MapPin"
  | "ClipboardList"
  | "Shield"
  | "ScrollText"
  | "Settings"
  | "Building2"
  | "Clock"
  | "ListChecks"
  | "UserCircle";

export type NavItem = {
  title: string;
  href: string;
  icon: NavIconName;
  permission?: Permission;
};

export const adminNav: NavItem[] = [
  { title: "Overview", href: "/admin", icon: "LayoutDashboard" },
  { title: "Competitions", href: "/admin/competitions", icon: "Trophy", permission: "competitions:manage" },
  { title: "Draws", href: "/admin/draws", icon: "CalendarDays", permission: "draws:manage" },
  { title: "Teams", href: "/admin/teams", icon: "Users", permission: "teams:manage_all" },
  { title: "Institutions", href: "/admin/institutions", icon: "School", permission: "institutions:manage" },
  { title: "Adjudicators", href: "/admin/adjudicators", icon: "Gavel", permission: "adjudicators:manage" },
  { title: "Venues", href: "/admin/venues", icon: "MapPin", permission: "venues:manage" },
  { title: "Results", href: "/admin/results", icon: "ClipboardList", permission: "results:manage" },
  { title: "Accounts", href: "/admin/accounts", icon: "Shield", permission: "accounts:manage" },
  { title: "Audit log", href: "/admin/audit", icon: "ScrollText", permission: "audit:view" },
  { title: "Settings", href: "/admin/settings", icon: "Settings", permission: "admin:manage" },
];

export const coordinatorNav: NavItem[] = [
  { title: "Overview", href: "/coordinator", icon: "LayoutDashboard" },
  { title: "My institutions", href: "/coordinator/institutions", icon: "Building2" },
  { title: "My teams", href: "/coordinator/teams", icon: "Users" },
  { title: "Draw", href: "/coordinator/draw", icon: "CalendarDays" },
  { title: "Results", href: "/coordinator/results", icon: "ClipboardList" },
  { title: "Postponements", href: "/coordinator/postponements", icon: "Clock" },
];

export const adjudicatorNav: NavItem[] = [
  { title: "Today", href: "/adjudicator", icon: "LayoutDashboard" },
  { title: "My assignments", href: "/adjudicator/assignments", icon: "ListChecks" },
  { title: "Availability", href: "/adjudicator/availability", icon: "CalendarDays" },
  { title: "Ballots", href: "/adjudicator/ballots", icon: "ClipboardList" },
  { title: "Profile", href: "/adjudicator/profile", icon: "UserCircle" },
];

export const haNav: NavItem[] = [
  { title: "Overview", href: "/ha", icon: "LayoutDashboard" },
  { title: "Venue management", href: "/ha/venues", icon: "MapPin" },
  { title: "Draw & assignments", href: "/ha/draw", icon: "CalendarDays" },
  { title: "Ballots", href: "/ha/ballots", icon: "ClipboardList" },
];
