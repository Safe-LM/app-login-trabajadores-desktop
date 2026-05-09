/**
 * sound.ts — Audio feedback con Web Audio API.
 * No requiere archivos externos, sintetiza tonos en runtime.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (AC) ctx = new AC();
    } catch { /* ignore */ }
  }
  return ctx;
}

function tone(freq: number, durationMs: number, when = 0, type: OscillatorType = 'sine', volume = 0.15) {
  const c = getCtx();
  if (!c) return;
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
