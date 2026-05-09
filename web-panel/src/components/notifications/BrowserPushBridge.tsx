"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificacionRow } from "@/types/database";

const STORAGE_KEY = "safelink:browser-push-enabled";

/**
 * BrowserPushBridge — registra el service worker y muestra notificaciones
 * nativas del navegador cuando llegan eventos críticos de Supabase Realtime,
 * solo si la pestaña NO está visible (el toast del panel ya cubre el caso visible).
 */
export function BrowserPushBridge({ empresaId }: { empresaId: string }) {
  const enabledRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    enabledRef.current = localStorage.getItem(STORAGE_KEY) === "1";

    // Re-leer cuando cambia el toggle desde la UI (custom event)
    function onToggle(e: Event) {
      enabledRef.current = (e as CustomEvent<boolean>).detail;
    }
    window.addEventListener("safelink:push-toggle", onToggle);

    // Registrar SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* ignorar errores */ });
    }

    return () => window.removeEventListener("safelink:push-toggle", onToggle);
  }, []);

  // Realtime — mostrar notificación nativa si está enabled y la página no está visible
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`browser-push:${empresaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones", filter: `empresa_id=eq.${empresaId}` },
        (payload) => {
          if (!enabledRef.current) return;
          if (Notification.permission !== "granted") return;
          // Solo mostrar si la pestaña no está visible (no duplicar con el toast)
          if (document.visibilityState === "visible") return;

          const n = payload.new as NotificacionRow;
          // Solo críticos/errores cuando la pestaña está oculta
          if (n.severidad !== "critical" && n.severidad !== "error") return;

          try {
            new Notification(n.titulo, {
              body: n.mensaje ?? "",
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              tag: `safelink-${n.id}`,
              data: { url: "/notificaciones" },
              requireInteraction: n.severidad === "critical",
            });
          } catch {
            /* no-op: navegadores que requieren SW notification — fallback silencioso */
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [empresaId]);

  return null;
}

/**
 * Hook para que la página /notificaciones controle el toggle de push.
 */
export function useBrowserPushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    if ("Notification" in window) setPermission(Notification.permission);
  }, []);

  async function toggle() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      alert("Tu navegador no soporta notificaciones.");
      return;
    }

    if (!enabled) {
      // Pedir permiso
      let perm: NotificationPermission = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      setPermission(perm);
      if (perm !== "granted") {
        alert("Permiso de notificaciones denegado. Actívalo en la configuración del navegador.");
        return;
      }
      localStorage.setItem(STORAGE_KEY, "1");
      setEnabled(true);
      window.dispatchEvent(new CustomEvent("safelink:push-toggle", { detail: true }));
      // Notificación de prueba
      try {
        new Notification("Notificaciones activadas", {
          body: "Recibirás alertas críticas aquí cuando el panel esté oculto.",
          icon: "/favicon.ico",
        });
      } catch { /* ignore */ }
    } else {
      localStorage.setItem(STORAGE_KEY, "0");
      setEnabled(false);
      window.dispatchEvent(new CustomEvent("safelink:push-toggle", { detail: false }));
    }
  }

  return { enabled, permission, toggle };
}
