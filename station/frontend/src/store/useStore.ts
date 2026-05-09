import { create } from 'zustand';
import type { EmployeeInfo, AttendanceStats } from '../lib/bridge';

export type CamState = 'offline' | 'connecting' | 'preparing' | 'live' | 'error';

interface AppState {
  status: string;
  statusType: 'info' | 'warn' | 'bad' | 'good';
  connected: boolean;
  stationName: string;
  branchName: string;
  confidence: number;
  currentEmployee: EmployeeInfo | null;
  lastAvatarB64: string;
  recentRecords: Array<{nombre: string, tipo: string, hora: string}>;
  stats: AttendanceStats | null;
  employees: any[];
  camState: CamState;
  camFrame: string;
  badgeText: string;
  lastReg: { text: string; color: string } | null;
  notification: { type: 'not_recognized' | 'already_registered'; data?: any } | null;

  // Health metrics (updated by Python via window globals)
  healthScore: number;
  healthEmpleados: number;
  healthCamara: boolean | null;
  healthEncodings: number;
  setHealth: (score: number, empleados: number, camara: boolean | null, encodings: number) => void;

  // UI States
  isSupervisorOpen: boolean;
  isConfirmOpen: boolean;
  isPinOpen: boolean;

  // Actions
  setStatus: (msg: string, type?: 'info' | 'warn' | 'bad' | 'good') => void;
  setStationInfo: (name: string, branch: string) => void;
  setConnected: (val: boolean) => void;
  setConfidence: (val: number) => void;
  setEmployee: (emp: EmployeeInfo | null, avatar?: string) => void;
  setAvatar: (b64: string) => void;
  resetEmployee: () => void;
  setStats: (stats: AttendanceStats) => void;
  setEmployees: (list: any[]) => void;
  addRecord: (nombre: string, tipo: string, hora: string) => void;
  setCamState: (state: CamState) => void;
  setCamFrame: (b64: string) => void;
  setBadgeText: (text: string) => void;
  setLastReg: (text: string, color: string) => void;
  setNotification: (n: AppState['notification']) => void;
  toggleSupervisor: (val: boolean) => void;
  toggleConfirm: (val: boolean) => void;
  togglePin: (val: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  status: 'Sistema listo',
  statusType: 'info',
  connected: false,
  stationName: 'Cargando...',
  branchName: '—',
  confidence: -1,
  currentEmployee: null,
  lastAvatarB64: '',
  recentRecords: [],
  stats: null,
  employees: [],
  camState: 'offline',
  camFrame: '',
  badgeText: '',
  lastReg: null,
  notification: null,

  healthScore: 0,
  healthEmpleados: 0,
  healthCamara: null,
  healthEncodings: 0,
  setHealth: (score, empleados, camara, encodings) => set({ healthScore: score, healthEmpleados: empleados, healthCamara: camara, healthEncodings: encodings }),

  isSupervisorOpen: false,
  isConfirmOpen: false,
  isPinOpen: false,

  setStatus: (msg, type = 'info') => set({ status: msg, statusType: type }),
  setStationInfo: (name, branch) => set({ stationName: name, branchName: branch }),
  setConnected: (val) => set({ connected: val }),
  setConfidence: (val) => set({ confidence: val }),
  setEmployee: (emp, avatar = '') => set({ currentEmployee: emp, lastAvatarB64: avatar }),
  setAvatar: (b64) => set({ lastAvatarB64: b64 }),
  resetEmployee: () => set({ currentEmployee: null, lastAvatarB64: '', confidence: -1 }),
  setStats: (stats) => set({ stats }),
  setEmployees: (list) => set({ employees: list }),
  addRecord: (nombre, tipo, hora) => set((state) => ({
    recentRecords: [{ nombre, tipo, hora }, ...state.recentRecords].slice(0, 10)
  })),
  setCamState: (camState) => set({ camState }),
  setCamFrame: (camFrame) => set({ camFrame }),
  setBadgeText: (badgeText) => set({ badgeText }),
  setLastReg: (text, color) => set({ lastReg: { text, color } }),
  setNotification: (notification) => set({ notification }),
  toggleSupervisor: (val) => set({ isSupervisorOpen: val }),
  toggleConfirm: (val) => set({ isConfirmOpen: val }),
  togglePin: (val) => set({ isPinOpen: val }),
}));
