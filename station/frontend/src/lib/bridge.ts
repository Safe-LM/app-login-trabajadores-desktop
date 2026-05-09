export interface EmployeeInfo {
  employee_id: string;
  nombre: string;
  apellido: string;
  puesto: string;
  sucursal: string;
}

export interface AttendanceStats {
  total: number;
  entradas_count: number;
  salidas_count: number;
  online: boolean;
  labels: string[];
  entradas_history: number[];
  salidas_history: number[];
}

export interface Bridge {
  startCamera(): void;
  stopCamera(): void;
  registerAttendance(): void;
  startEnrollment(): void;
  logout(): void;
  getStats(): void;
  getEmployees(): void;
  registerManual(id: string, tipo: string): void;
  saveStationConfig(name: string): void;
  relaunchSetup(): void;
  syncEmployees(): void;
}

declare global {
  interface Window {
    bridge?: Bridge;
    qt?: {
      webChannelTransport: any;
    };
    QWebChannel: any;
  }
}

const loadQWebChannelScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'qrc:///qtwebchannel/qwebchannel.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load qwebchannel.js'));
    document.head.appendChild(script);
  });

export const initBridge = (onReady: (bridge: Bridge) => void) => {
  if (typeof window.qt !== 'undefined') {
    const connect = () => {
      new window.QWebChannel(window.qt!.webChannelTransport, (channel: any) => {
        window.bridge = channel.objects.bridge;
        if (window.bridge) onReady(window.bridge);
      });
    };

    if (typeof window.QWebChannel === 'undefined') {
      loadQWebChannelScript()
        .then(connect)
        .catch((err) => console.error('QWebChannel load error:', err));
    } else {
      connect();
    }
  } else {
    console.warn("QWebChannel not detected. Running in mock mode.");
    window.bridge = {
      startCamera: () => console.log("Mock: startCamera"),
      stopCamera: () => console.log("Mock: stopCamera"),
      registerAttendance: () => console.log("Mock: registerAttendance"),
      startEnrollment: () => console.log("Mock: startEnrollment"),
      logout: () => console.log("Mock: logout"),
      getStats: () => console.log("Mock: getStats"),
      getEmployees: () => console.log("Mock: getEmployees"),
      registerManual: (id, tipo) => console.log(`Mock: manual ${id} ${tipo}`),
      saveStationConfig: (name) => console.log(`Mock: config ${name}`),
      relaunchSetup: () => console.log("Mock: relaunchSetup"),
      syncEmployees: () => console.log("Mock: syncEmployees"),
    } as Bridge;
    onReady(window.bridge);
  }
};
