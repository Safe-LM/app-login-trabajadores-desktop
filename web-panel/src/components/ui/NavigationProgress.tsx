"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Loading bar global tipo YouTube/GitHub que aparece arriba de la
 * pagina durante navegacion entre rutas. Da sensacion de velocidad
 * incluso cuando la pagina tarda algo en cargar.
 *
 * Funciona escuchando cambios de pathname/searchParams. No requiere
 * configuracion adicional.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    setVisible(true);
    setProgress(15);

    // Sube progresivamente hasta 80% mientras "espera"
    intervalId = setInterval(() => {
      setProgress((p) => (p < 80 ? p + (Math.random() * 10) : p));
    }, 250);

    // Finaliza a 100% y oculta
    timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    }, 600);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pathname, params]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: 2, zIndex: 10000,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease-out",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
          boxShadow: "0 0 8px rgba(59, 130, 246, 0.5)",
          transition: "width 200ms ease-out",
        }}
      />
    </div>
  );
}
