import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import type { ClientNavItem } from "@/components/nav/nav-config";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function TeamPortalShell({
  title,
  items,
  teamLabel,
  children,
}: {
  title: string;
  items: ClientNavItem[];
  teamLabel: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        title={title}
        items={items}
        user={{ name: teamLabel, email: "Private team link" }}
        showAuthActions={false}
      />
      <SidebarInset>
        <SiteHeader title={title} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
