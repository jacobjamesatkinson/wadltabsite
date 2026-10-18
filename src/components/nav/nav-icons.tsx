"use client";

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Gavel,
  LayoutDashboard,
  ListChecks,
  MapPin,
  School,
  ScrollText,
  Settings,
  Shield,
  Shuffle,
  Trophy,
  Upload,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "./nav-config";

const icons: Record<NavIconName, LucideIcon> = {
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
  Eye,
  Shuffle,
  CheckCircle2,
  Upload,
};

export function NavIcon({
  name,
  className,
}: {
  name: NavIconName;
  className?: string;
}) {
  const Icon = icons[name] ?? LayoutDashboard;
  return <Icon className={className} />;
}
