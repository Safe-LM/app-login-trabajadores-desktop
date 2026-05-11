import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/Skeleton";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import { PanelNotificationsWatcher } from "@/components/notifications/PanelNotificationsWatcher";
import { BrowserPushBridge } from "@/components/notifications/BrowserPushBridge";
import { CommandLayer } from "@/components/command/CommandLayer";
import { NavigationProgress } from "@/components/ui/NavigationProgress";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id as string | undefined;

  return (
    <NotificationProvider>
      {empresaId && (
        <>
          <PanelNotificationsWatcher empresaId={empresaId} />
          <BrowserPushBridge empresaId={empresaId} />
        </>
      )}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <CommandLayer />
      {/* 100dvh en lugar de 100vh: en iOS Safari la barra de URL se
          recoge dinamicamente; con 100vh el contenido se corta. */}
      <div className="dashboard-shell" style={{
        display: "flex",
        height: "100dvh",
        minHeight: "100vh",  /* fallback browsers viejos */
        background: "var(--bg-black)",
        overflow: "hidden",
      }}>
        <SidebarNav userEmail={user.email ?? ""} />
        <main className="dashboard-main" style={{ flex: 1, overflow: "auto" }}>
          <Suspense fallback={<PageSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
    </NotificationProvider>
  );
}
