import React, { useEffect, useState } from 'react';
import { Camera, Shield, Settings, Users, CheckCircle2, WifiOff, AlertCircle, LogIn, LogOut, RefreshCw, X, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { initBridge } from './lib/bridge';
import type { EmployeeInfo } from './lib/bridge';
import { playWelcome, playGoodbye, playError, playInfo } from './lib/sound';
import { useIdleReset } from './lib/useIdleReset';

/**
 * Config inyectable por el bridge / build:
 *  - window.__SAFELINK_CONFIG__.supervisorPin
 *  - window.__SAFELINK_CONFIG__.idleSeconds
 * Se usa fallback razonable cuando no está definida.
 */
declare global {
  interface Window {
    __SAFELINK_CONFIG__?: {
      supervisorPin?: string;
      idleSeconds?: number;
    };
  }
}

const SUPERVISOR_PIN_DEFAULT = '1234';
const IDLE_SECONDS_DEFAULT = 12;

/** Devuelve "Buenos días", "Buenas tardes" o "Buenas noches" según la hora. */
function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/* ─────────────── SUPERVISOR PANEL ─────────────── */
const SupervisorPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const store = useStore();
  const [pin, setPin]             = useState('');
  const [unlocked, setUnlocked]   = useState(false);
  const [pinError, setPinError]   = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState('');

  const SUPERVISOR_PIN = window.__SAFELINK_CONFIG__?.supervisorPin || SUPERVISOR_PIN_DEFAULT;

  function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    (window as any).bridge?.forceSyncEmpleados?.();
    setTimeout(() => {
      setSyncing(false);
      setSyncMsg('Sincronización iniciada');
    }, 1200);
  }

  function handleLogout() {
    onClose();
    (window as any).bridge?.logout?.();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-end"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="h-full w-96 flex flex-col"
        style={{ background: '#0d0f1a', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-10 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)' }}>
              <Shield size={17} className="text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-none mb-0.5">Panel Supervisor</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{store.stationName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {!unlocked ? (
          /* PIN unlock */
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <Lock size={28} className="text-blue-400" />
              </div>
              <div className="text-center">
                <p className="font-bold text-white mb-1">Acceso restringido</p>
                <p className="text-xs text-gray-500">Ingresa el PIN de supervisor</p>
              </div>
            </div>

            <div className="w-full flex flex-col gap-4">
              <div className="flex gap-3 justify-center">
                {[0,1,2,3].map(i => (
                  <div key={i} className="w-4 h-4 rounded-full border-2 transition-all" style={{ borderColor: pin.length > i ? '#3b82f6' : 'rgba(255,255,255,0.15)', background: pin.length > i ? '#3b82f6' : 'transparent' }} />
                ))}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, idx) => (
                  <button
                    key={idx}
                    disabled={k === ''}
                    onClick={() => {
                      if (k === '⌫') { setPin(p => p.slice(0,-1)); setPinError(false); }
                      else if (k !== '' && pin.length < 4) {
                        const next = pin + String(k);
                        setPin(next);
                        if (next.length === 4) setTimeout(() => {
                          if (next === SUPERVISOR_PIN) { setUnlocked(true); setPinError(false); }
                          else { setPinError(true); setPin(''); }
                        }, 80);
                      }
                    }}
                    className="h-14 rounded-2xl font-bold text-lg transition-all active:scale-95"
                    style={{
                      background: k === '' ? 'transparent' : 'rgba(255,255,255,0.04)',
                      border: k === '' ? 'none' : `1px solid ${pinError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      color: k === '⌫' ? '#94a3b8' : 'white',
                      cursor: k === '' ? 'default' : 'pointer',
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {pinError && (
                <p className="text-center text-xs font-bold text-red-400">PIN incorrecto</p>
              )}
            </div>
          </div>
        ) : (
          /* Supervisor controls */
          <div className="flex-1 flex flex-col gap-6 px-8 py-8 overflow-y-auto">
            {/* Station info */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-3">Info estación</p>
              <div className="flex flex-col gap-2">
                {[
                  ['Nombre', store.stationName],
                  ['Sucursal', store.branchName || '—'],
                  ['Conexión', store.connected ? 'En línea' : 'Offline'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-500">{k}</span>
                    <span className="text-[11px] font-bold text-white">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Acciones</p>

              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl transition-all active:scale-95"
                style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: syncing ? '#60a5fa' : 'white' }}
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin text-blue-400' : 'text-blue-400'} />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-bold">Sincronizar empleados</span>
                  {syncMsg && <span className="text-[10px] text-green-400 mt-0.5">{syncMsg}</span>}
                </div>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl transition-all active:scale-95"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
              >
                <LogOut size={16} />
                <span className="text-sm font-bold">Cerrar sesión de estación</span>
              </button>
            </div>

            {/* Recent records */}
            <div className="flex flex-col gap-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Actividad reciente</p>
              {store.recentRecords.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">Sin registros hoy</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {store.recentRecords.slice(0, 8).map((rec, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className={`w-1.5 h-8 rounded-full ${rec.tipo === 'entrada' ? 'bg-green-500' : 'bg-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{rec.nombre}</p>
                        <p className="text-[10px] text-gray-500 uppercase">{rec.tipo}</p>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">{rec.hora}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

/* ─────────────── ATTENDANCE CONFIRMED OVERLAY ─────────────── */
const AttendanceConfirmedOverlay: React.FC<{
  nombre: string;
  apellido: string;
  tipo: 'entrada' | 'salida';
  hora: string;
  avatarB64: string;
  onDone: () => void;
}> = ({ nombre, apellido, tipo, hora, avatarB64, onDone }) => {
  const isEntrada = tipo === 'entrada';
  const greeting  = isEntrada ? greetingForHour() : 'Hasta luego';
  const subtitle  = isEntrada ? 'Bienvenido a tu jornada' : 'Que tengas un buen resto del día';

  useEffect(() => {
    // Audio feedback
    if (isEntrada) playWelcome();
    else           playGoodbye();
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone, isEntrada]);

  const accentColor = isEntrada ? '#22c55e' : '#3b82f6';
  const accentGlow  = isEntrada ? 'rgba(34,197,94,0.4)' : 'rgba(59,130,246,0.4)';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center z-40 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${isEntrada ? 'rgba(20,60,35,0.96)' : 'rgba(15,25,55,0.96)'} 0%, rgba(5,8,16,0.98) 100%)`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Halo radial detrás del avatar */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.6 }}
        className="absolute"
        style={{
          width: 480, height: 480,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentGlow} 0%, transparent 60%)`,
          filter: 'blur(40px)',
        }}
      />

      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className="relative flex flex-col items-center gap-8 text-center px-12"
      >
        {/* Saludo (tipografía grande arriba) */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-sm font-semibold uppercase tracking-[0.4em]"
          style={{ color: accentColor, opacity: 0.85 }}
        >
          {greeting}
        </motion.p>

        {/* Avatar con ring animado */}
        <div className="relative">
          {/* Anillo pulsante de fondo */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${accentColor}`, opacity: 0.3 }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: 'spring', damping: 14, stiffness: 200 }}
            className="w-44 h-44 rounded-full p-1.5 relative"
            style={{
              background: `conic-gradient(from 0deg, ${accentColor}, transparent 60%, ${accentColor})`,
              boxShadow: `0 0 60px ${accentGlow}, 0 0 120px ${accentGlow}`,
            }}
          >
            <div className="w-full h-full rounded-full overflow-hidden" style={{ background: 'var(--bg-black)' }}>
              {avatarB64 ? (
                <img src={`data:image/jpeg;base64,${avatarB64}`} className="w-full h-full rounded-full object-cover" alt={`${nombre} ${apellido}`} />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: `${accentColor}1a` }}>
                  <Users size={64} style={{ color: accentColor, opacity: 0.6 }} />
                </div>
              )}
            </div>
          </motion.div>

          {/* Badge entrada/salida */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring', damping: 12, stiffness: 320 }}
            className="absolute -bottom-2 -right-2 w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: accentColor,
              border: '4px solid var(--bg-black)',
              boxShadow: `0 8px 24px ${accentGlow}`,
            }}
          >
            {isEntrada ? <LogIn size={22} /> : <LogOut size={22} />}
          </motion.div>
        </div>

        {/* Nombre del empleado */}
        <div className="flex flex-col items-center gap-2">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-5xl font-extrabold tracking-tight leading-tight"
            style={{ letterSpacing: '-0.025em' }}
          >
            {nombre} <span style={{ fontWeight: 500, opacity: 0.85 }}>{apellido}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-base font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            {subtitle}
          </motion.p>
        </div>

        {/* Tipo + hora */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex items-center gap-3 px-5 py-2.5 rounded-full glass-subtle"
          style={{ borderColor: `${accentColor}30` }}
        >
          <CheckCircle2 size={16} style={{ color: accentColor }} />
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: accentColor }}>
            {isEntrada ? 'Entrada' : 'Salida'}
          </span>
          <span style={{ color: 'var(--text-faint)' }}>•</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {hora}
          </span>
        </motion.div>

        {/* Progress bar (cuenta atrás 4s) */}
        <motion.div
          className="w-56 h-0.5 rounded-full overflow-hidden mt-2"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)` }}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 4, ease: 'linear', delay: 0.5 }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

/* ─────────────── HEALTH PANEL ─────────────── */
const HealthPanel: React.FC = () => {
  const { healthScore, healthEmpleados, healthCamara, healthEncodings } = useStore();
  const color = healthScore >= 80 ? '#22c55e' : healthScore >= 40 ? '#f59e0b' : '#ef4444';
  const items: [string, string, string][] = [
    ['Cámara',    healthCamara === true ? 'OK' : healthCamara === false ? 'Error' : '—',
                  healthCamara === true ? '#22c55e' : healthCamara === false ? '#ef4444' : '#52525b'],
    ['Empleados', String(healthEmpleados), healthEmpleados > 0 ? '#22c55e' : '#52525b'],
    ['Encodings', healthEncodings > 0 ? 'Listo' : '—', healthEncodings > 0 ? '#22c55e' : '#52525b'],
  ];
  return (
    // Estilo unificado con las otras cards del sidebar (Actividad,
    // last_reg, Panel de Supervisor): mismo fondo, mismo borde, misma
    // sombra. Asi las 4 se ven como bloques flotantes consistentes.
    <div
      className="rounded-2xl p-4 shadow-lg"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      }}
    >
      {/* Header de la card con titulo + score */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Salud del sistema</span>
        <span className="text-xs font-black tabular-nums" style={{ color }}>{healthScore}/100</span>
      </div>
      {/* Barra de progreso con mas separacion abajo */}
      <div className="h-1.5 w-full rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${healthScore}%`, background: color }} />
      </div>
      {/* Las 3 mini-tarjetas internas (Camara/Empleados/Encodings).
          Padding aumentado para que no se vean apretadas. */}
      <div className="grid grid-cols-3 gap-2">
        {items.map(([label, val, c]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-xl px-2.5 py-2.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-wider">{label}</span>
            <span className="text-[11px] font-black" style={{ color: c }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────── MAIN APP ─────────────── */
const App: React.FC = () => {
  const store = useStore();
  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const [attendanceConfirm, setAttendanceConfirm] = useState<{
    nombre: string; apellido: string; tipo: 'entrada' | 'salida'; hora: string; avatarB64: string;
  } | null>(null);

  // Auto-reset a idle si no se detecta rostro durante X segundos.
  // Evita que la pantalla se quede mostrando un empleado fantasma si Python pierde
  // señal de la cámara silenciosamente.
  useIdleReset({
    idleSeconds: window.__SAFELINK_CONFIG__?.idleSeconds ?? IDLE_SECONDS_DEFAULT,
    onReset: () => setAttendanceConfirm(null),
  });

  useEffect(() => {
    // Register all globals immediately so Python can call them before bridge is ready
    (window as any).setStatus       = store.setStatus;
    (window as any).setStationInfo  = store.setStationInfo;
    (window as any).setConnectivity = (online: boolean, _msg: string) => store.setConnected(online);
    (window as any).setConnected    = store.setConnected;
    (window as any).setConfidence   = store.setConfidence;
    (window as any).setEmployee     = (emp: any, avatar: string) => store.setEmployee(emp, avatar);
    (window as any).setAvatar       = store.setAvatar;
    (window as any).resetEmployee   = store.resetEmployee;
    (window as any).renderStats     = store.setStats;
    (window as any).setEmployees    = store.setEmployees;
    (window as any).addRecentRecord = store.addRecord;
    (window as any).setCamState     = store.setCamState;
    (window as any).updateFrame     = store.setCamFrame;
    (window as any).setBadgeText    = store.setBadgeText;
    (window as any).setLastReg      = store.setLastReg;
    (window as any).setUser         = (_nombre: string) => {};
    (window as any).setEmployeeInfo = (nombre: string, apellido: string, _zona: string, sucursal: string, puesto: string) => {
      const emp: EmployeeInfo = { employee_id: '', nombre, apellido, puesto, sucursal };
      store.setEmployee(emp);
    };
    (window as any).setHealth = store.setHealth;
    (window as any).showNotRecognized      = () => {
      playError();
      store.setNotification({ type: 'not_recognized' });
    };
    (window as any).showAlreadyRegistered  = (tipo: string, hora: string) => {
      playInfo();
      store.setNotification({ type: 'already_registered', data: { tipo, hora } });
    };
    // Full attendance confirmation with avatar
    (window as any).showAttendanceConfirmed = (nombre: string, apellido: string, tipo: string, hora: string, avatarB64: string) => {
      setAttendanceConfirm({ nombre, apellido, tipo: tipo as 'entrada' | 'salida', hora, avatarB64: avatarB64 ?? '' });
    };

    initBridge((bridge) => {
      console.log("Bridge initialized");
      bridge.startCamera();
    });
  }, []);

  // Auto-clear notifications after 3s
  useEffect(() => {
    if (!store.notification) return;
    const t = setTimeout(() => store.setNotification(null), 3000);
    return () => clearTimeout(t);
  }, [store.notification]);

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans" style={{ background: 'var(--bg-black)', color: 'var(--text-primary)' }}>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full h-16 flex items-center justify-between px-8 z-50 pointer-events-none">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              boxShadow: '0 0 20px rgba(59,130,246,0.3)',
            }}
          >
            <Shield size={18} fill="white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-lg leading-none">
              SAFE<span style={{ color: 'var(--accent)' }}>LINK</span>
            </span>
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase mt-0.5" style={{ color: 'var(--text-faint)' }}>
              Monitoring
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>Estación</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{store.stationName}</span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: store.connected ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${store.connected ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`,
            }}
          >
            <div
              className={store.connected ? 'animate-pulse' : ''}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: store.connected ? 'var(--green)' : 'var(--red)',
                boxShadow: store.connected ? '0 0 8px var(--green-glow)' : 'none',
              }}
            />
            <span
              className="text-[10px] font-bold tracking-wider uppercase"
              style={{ color: store.connected ? '#4ade80' : '#f87171' }}
            >
              {store.connected ? 'En línea' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex gap-0 min-h-0">
        {/* Left: Camera Feed Section */}
        <section className="flex-[3] relative flex items-center justify-center p-8 pt-20 pb-8">
          <div className="relative w-full h-full bg-[#0a0c14] rounded-[28px] overflow-hidden border border-white/5 shadow-2xl" style={{ minHeight: 0 }}>

            {/* Camera frame or placeholder */}
            {store.camFrame ? (
              <img
                src={`data:image/jpeg;base64,${store.camFrame}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 cyber-grid flex items-center justify-center">
                <CameraPlaceholder state={store.camState} />
              </div>
            )}

            <div className="scan-line" />

            {/* HUD Corners — minimalistas, alineados a la grilla */}
            <div className="hud-corner top-left"     style={{ top: 24,    left: 24 }} />
            <div className="hud-corner top-right"    style={{ top: 24,    right: 24 }} />
            <div className="hud-corner bottom-left"  style={{ bottom: 24, left: 24 }} />
            <div className="hud-corner bottom-right" style={{ bottom: 24, right: 24 }} />

            {/* Badge text (e.g. "ESPERA 3S") */}
            {store.badgeText && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-full">
                <span className="text-xs font-black tracking-widest text-yellow-300">{store.badgeText}</span>
              </div>
            )}

            {/* Status Overlay */}
            <div className="absolute bottom-10 left-10 flex items-center gap-3 glass px-4 py-2 rounded-2xl pointer-events-none">
              <div className={`w-2 h-2 rounded-full animate-ping ${
                store.statusType === 'good' ? 'bg-green-500' :
                store.statusType === 'bad'  ? 'bg-red-500' :
                store.statusType === 'warn' ? 'bg-yellow-500' : 'bg-blue-500'
              }`} />
              <span className="text-xs font-bold tracking-wide uppercase text-blue-100">{store.status}</span>
            </div>

            {/* Notification overlays */}
            <AnimatePresence>
              {store.notification?.type === 'not_recognized' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 flex items-center justify-center bg-red-900/30 backdrop-blur-sm"
                >
                  <div className="flex flex-col items-center gap-3 text-red-300">
                    <AlertCircle size={64} />
                    <span className="font-black text-xl tracking-tight">No Reconocido</span>
                  </div>
                </motion.div>
              )}
              {store.notification?.type === 'already_registered' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 flex items-center justify-center bg-yellow-900/30 backdrop-blur-sm"
                >
                  <div className="flex flex-col items-center gap-3 text-yellow-300">
                    <CheckCircle2 size={64} />
                    <span className="font-black text-xl tracking-tight">Ya Registrado</span>
                    {store.notification.data && (
                      <span className="text-sm opacity-70">
                        {store.notification.data.tipo} · {store.notification.data.hora}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attendance confirmed full-screen overlay */}
            <AnimatePresence>
              {attendanceConfirm && (
                <AttendanceConfirmedOverlay
                  {...attendanceConfirm}
                  onDone={() => setAttendanceConfirm(null)}
                />
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Right: Info Panel */}
        <aside className="flex-[2] glass border-l border-white/5 p-6 pt-16 flex flex-col space-y-6">
          {/* Clock */}
          <div className="flex flex-col items-center">
            <DateTimeDisplay />
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Recognition Card */}
          <AnimatePresence mode="wait">
            {store.currentEmployee ? (
              <motion.div
                key="employee"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center gap-6"
              >
                <div className="relative">
                  <div className="w-32 h-32 rounded-full p-1 border-2 border-blue-500/30">
                    {store.lastAvatarB64 ? (
                      <img src={`data:image/jpeg;base64,${store.lastAvatarB64}`} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-blue-900/20 flex items-center justify-center">
                        <Users size={48} className="text-blue-500/50" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full border-4 border-[#070810] flex items-center justify-center shadow-lg">
                    <CheckCircle2 size={20} />
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight mb-1">
                    {store.currentEmployee.nombre} {store.currentEmployee.apellido}
                  </h2>
                  <p className="text-blue-400 font-bold text-sm tracking-widest uppercase">
                    {store.currentEmployee.puesto}
                  </p>
                </div>

                {store.confidence >= 0 && (
                  <div className="bg-white/5 rounded-2xl px-6 py-4 border border-white/10 w-full">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-2">
                      <span>Confianza</span>
                      <span>{Math.round(store.confidence)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${store.confidence}%` }}
                        className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center flex-1 text-center opacity-40 py-12"
              >
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-6">
                  <Camera size={32} />
                </div>
                <p className="text-sm font-medium leading-relaxed">
                  Colócate frente a la cámara<br />para registrar tu asistencia
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sidebar — 4 cards independientes. Cada bloque es una card
              completa con su propio padding/borde/fondo, asi se ven
              flotantes y separadas. gap-12 (48px) da el espacio visible
              entre las cards. */}
          <div className="mt-auto flex flex-col space-y-3">
            {/* === CARD 1: Last registration === */}
            {store.lastReg && (
              <div
                className="text-center text-xs font-bold py-3 px-4 rounded-2xl shadow-lg"
                style={{
                  color: store.lastReg.color || '#94a3b8',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                }}
              >
                {store.lastReg.text}
              </div>
            )}

            {/* === CARD 2: Actividad Reciente === */}
            <div
              className="rounded-2xl p-4 shadow-lg"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Actividad Reciente</h3>
                <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-bold text-blue-400">HOY</div>
              </div>

              <div className="flex flex-col space-y-2">
                {store.recentRecords.length > 0 ? store.recentRecords.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-8 rounded-full ${rec.tipo === 'entrada' ? 'bg-green-500' : 'bg-blue-500'}`} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold">{rec.nombre}</span>
                        <span className="text-[10px] text-gray-500 uppercase font-medium tracking-wider">{rec.tipo}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-gray-400">{rec.hora}</span>
                  </div>
                )) : (
                  <div className="text-center py-4 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">Sin registros hoy</div>
                )}
              </div>
            </div>

            {/* === CARD 3: Health status === */}
            <HealthPanel />

            {/* === CARD 4: Panel de Supervisor === */}
            <button
              onClick={() => setSupervisorOpen(true)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl transition-all text-sm font-bold active:scale-95 pointer-events-auto shadow-lg"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              }}
            >
              <Settings size={16} />
              <span>Panel de Supervisor</span>
            </button>
          </div>
        </aside>
      </main>

      {/* Supervisor Panel overlay */}
      <AnimatePresence>
        {supervisorOpen && <SupervisorPanel onClose={() => setSupervisorOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

const CameraPlaceholder: React.FC<{ state: string }> = ({ state }) => {
  if (state === 'error') return (
    <div className="flex flex-col items-center gap-3 text-red-400/60">
      <WifiOff size={48} />
      <span className="text-xs font-bold uppercase tracking-widest">Error de Cámara</span>
    </div>
  );
  if (state === 'connecting' || state === 'preparing') return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-xs font-bold text-blue-400/60 uppercase tracking-widest">
        {state === 'connecting' ? 'Conectando...' : 'Preparando...'}
      </span>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-3 opacity-20">
      <div className="w-64 h-64 border-2 border-white/10 rounded-full border-dashed animate-[spin_10s_linear_infinite]" />
    </div>
  );
};

const DateTimeDisplay: React.FC = () => {
  const [time, setTime] = React.useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center">
      <div className="text-6xl font-black tracking-tighter mb-1 tabular-nums">
        {time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
      <div className="text-xs font-bold text-blue-500/80 uppercase tracking-[0.3em] pl-1">
        {time.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
      </div>
    </div>
  );
};

export default App;
