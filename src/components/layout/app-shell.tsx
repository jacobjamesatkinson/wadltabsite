import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./app-sidebar";
import type { NavItem } from "@/components/nav/nav-config";
import { hasPermission } from "@/lib/permissions";
import type { AuthContext } from "@/lib/permissions/types";

export function AppShell({
  ctx,
  items,
  title,
  children,
}: {
  ctx: AuthContext;
  items: NavItem[];
  title: string;
  children: React.ReactNode;
}) {
  const filtered = items.filter(
    (item) => !item.permission || hasPermission(ctx, item.permission)
  );

  return (
    <SidebarProvider>
      <AppSidebar items={filtered} title={title} userName={ctx.name} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
