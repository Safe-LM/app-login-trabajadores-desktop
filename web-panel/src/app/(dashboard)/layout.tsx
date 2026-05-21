import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";
import { DashboardTopBar } from "./topbar";
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

  // Empresa nombre para el OrgSwitcher (silencioso si falla)
  let empresaNombre: string | null = null;
  let unreadCount = 0;
  if (empresaId) {
    const [empRes, notifRes] = await Promise.all([
      supabase.from("empresas").select("nombre").eq("id", empresaId).maybeSingle(),
      supabase
        .from("notificaciones")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .is("leida_en", null),
    ]);
    empresaNombre = empRes.data?.nombre ?? null;
    unreadCount   = notifRes.count ?? 0;
  }

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
      {/* 100dvh: en iOS Safari la barra de URL se recoge dinamicamente.  */}
      <div className="dashboard-shell" style={{
        display: "flex",
        height: "100dvh",
        minHeight: "100vh",
        background: "var(--bg-black)",
        overflow: "hidden",
      }}>
        <SidebarNav userEmail={user.email ?? ""} empresaNombre={empresaNombre} />
        <div className="dashboard-main-col" style={{
          flex: 1, display: "flex", flexDirection: "column",
          minWidth: 0, overflow: "hidden",
        }}>
          <DashboardTopBar unreadCount={unreadCount} userEmail={user.email ?? ""} />
          <main className="dashboard-main" style={{ flex: 1, overflow: "auto" }}>
            <Suspense fallback={<PageSkeleton />}>
              {children}
            </Suspense>
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
