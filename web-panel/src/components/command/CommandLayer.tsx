"use client";

import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { Toaster } from "sonner";

/**
 * Capa global de comandos: paleta (Cmd+K), atajos de teclado,
 * y toasts (sonner). Se monta una sola vez en el layout del dashboard.
 *
 * El callback "Ver atajos de teclado" del Command Palette simula
 * la tecla "?" globalmente — el KeyboardShortcuts ya escucha eso.
 */
export function CommandLayer() {
  const showShortcuts = () => {
    const ev = new KeyboardEvent("keydown", { key: "?", shiftKey: true });
    document.dispatchEvent(ev);
  };

  return (
    <>
      <CommandPalette onShowShortcuts={showShortcuts} />
      <KeyboardShortcuts />
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--bg-surface, #0f0f10)",
            border: "1px solid var(--border, #2a2a2d)",
            color: "var(--text-primary, #f5f5f7)",
          },
        }}
      />
    </>
  );
}
