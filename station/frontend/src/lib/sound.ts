/**
 * sound.ts — Audio feedback con Web Audio API.
 * No requiere archivos externos, sintetiza tonos en runtime.
 *
 * NOTA: Chrome embebido en QWebEngine bloquea AudioContext hasta que
 * haya un gesto del usuario (click, keypress). En modo kiosko nadie
 * hace click, asi que el AudioContext queda suspended permanentemente
 * y emitia un warning por cada intento de reproducir tono.
 *
 * Estrategia:
 *   1. Intentar `resume()` si el ctx esta suspended (silencioso si falla).
 *   2. Bailar el `tone()` cuando el ctx no esta corriendo (evita spam).
 *   3. El feedback audible REAL viene de winsound.Beep() en el backend
 *      Python (dashboard_window.py:_register_db), independiente del JS.
 *
 * Si en algun momento queremos audio en kiosko, podemos:
 *   - Inyectar un fake-click via QWebEnginePage.runJavaScript al cargar
 *   - O usar HTMLAudioElement con un .wav embebido (autoplay permitido
 *     en algunos contextos)
 */

let ctx: AudioContext | null = null;
let ctxFailed = false;  // Flag para no spamear logs cuando ya sabemos que no funciona

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined' || ctxFailed) return null;
  if (!ctx) {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (AC) ctx = new AC();
    } catch {
      ctxFailed = true;
      return null;
    }
  }
  // Si el contexto esta suspended (Chrome bloquea hasta gesto usuario),
  // intentar resume una vez. Si falla, marcar como failed permanente
  // para no reintentar y silenciar el spam de warnings.
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* esperado en kiosko sin gesto */ });
  }
  return ctx && ctx.state === 'running' ? ctx : null;
}

function tone(freq: number, durationMs: number, when = 0, type: OscillatorType = 'sine', volume = 0.15) {
  const c = getCtx();
  if (!c) return;  // Salida temprana: no crear oscillators si el ctx no esta running
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const start = c.currentTime + when;
    osc.type = type;
    osc.frequency.value = freq;
    // Envelope: attack quick, smooth decay (evita click)
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + durationMs / 1000 + 0.05);
  } catch {
    // Si el ctx peta a mitad (ej. cerrandose), no propagar
  }
}

/** Sonido de bienvenida — 2 tonos ascendentes (entrada). */
export function playWelcome() {
  tone(587.33, 120, 0,    'sine', 0.18);  // D5
  tone(880.00, 200, 0.10, 'sine', 0.14);  // A5
}

/** Sonido de despedida — 2 tonos descendentes (salida). */
export function playGoodbye() {
  tone(880.00, 120, 0,    'sine', 0.16);  // A5
  tone(587.33, 200, 0.10, 'sine', 0.14);  // D5
}

/** Sonido de error / no reconocido — tono grave breve. */
export function playError() {
  tone(220.00, 250, 0,    'square', 0.08);
}

/** Sonido de "ya registrado" — tono medio neutro. */
export function playInfo() {
  tone(440.00, 150, 0,    'sine', 0.10);
}
