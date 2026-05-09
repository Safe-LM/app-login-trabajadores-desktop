import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export type IdleResetConfig = {
  /** Segundos sin detección de rostro antes de volver a idle. Default 12s. */
  idleSeconds?: number;
  /** Frecuencia del check (ms). Default 1000. */
  pollMs?: number;
  /** Callback opcional cuando se dispara el reset. */
  onReset?: () => void;
  /** Callback opcional cuando el rostro vuelve después de inactividad. */
  onResume?: () => void;
};

/**
 * Resetea el kiosco a estado idle si no se detecta un rostro en X segundos.
 *
 * - Cualquier llamada al setter `setConfidence(c >= 0)` cuenta como "rostro presente"
 *   (es lo que dispara el bridge cuando hay detección activa de cámara).
 * - Si pasan `idleSeconds` sin actualización válida y hay un empleado activo o
 *   notificación en pantalla, se limpia el estado para volver al saludo neutral.
 *
 * Diseñado para ser robusto frente a pérdida silenciosa de señal del backend Python:
 * la UI no se queda atorada mostrando un empleado fantasma.
 */
export function useIdleReset(config: IdleResetConfig = {}) {
  const idleSeconds = config.idleSeconds ?? 12;
  const pollMs = config.pollMs ?? 1_000;

  const lastFaceAt = useRef<number>(Date.now());
  const wasIdle = useRef<boolean>(false);
  const onReset = useRef(config.onReset);
  const onResume = useRef(config.onResume);
  onReset.current = config.onReset;
  onResume.current = config.onResume;

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, prev) => {
      const becamePresent =
        state.confidence >= 0 && (state.confidence !== prev.confidence || prev.confidence < 0);
      const employeeJustSet = !!state.currentEmployee && !prev.currentEmployee;

      if (becamePresent || employeeJustSet) {
        lastFaceAt.current = Date.now();
        if (wasIdle.current) {
          wasIdle.current = false;
          onResume.current?.();
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - lastFaceAt.current) / 1000;
      if (elapsedSec < idleSeconds) return;

      const { currentEmployee, notification, badgeText, confidence, resetEmployee, setConfidence, setNotification, setBadgeText, setStatus } = useStore.getState();

      const needsReset = !!currentEmployee || !!notification || !!badgeText || confidence >= 0;
      if (!needsReset) return;

      resetEmployee();
      setConfidence(-1);
      setNotification(null);
      setBadgeText('');
      setStatus('Sistema listo', 'info');
      wasIdle.current = true;
      onReset.current?.();
    }, pollMs);

    return () => clearInterval(interval);
  }, [idleSeconds, pollMs]);
}
