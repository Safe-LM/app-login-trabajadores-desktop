export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type EstadoConexion = "online" | "alerta" | "offline" | "nunca";

type EmpresaRow = {
  id: string;
  nombre: string;
  slug: string;
  plan: "starter" | "business" | "enterprise";
  activa: boolean;
  creada_en: string;
  max_empleados: number;
  max_estaciones: number;
  logo_url: string | null;
  timezone: string;
};

type SucursalRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  zona: string | null;
  ciudad: string | null;
  direccion: string | null;
  activa: boolean;
  hora_apertura: string | null;
  hora_cierre: string | null;
  tolerancia_min: number;
  lat: number | null;
  lng: number | null;
};

type EmpleadoRow = {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  nombre: string;
  apellido: string;
  employee_code: string | null;
  puesto: string | null;
  departamento: string | null;
  nivel_acceso: number;
  activo: boolean;
  foto_url: string | null;
  enrollado: boolean;
  creado_en: string;
};

type EmbeddingRow = {
  id: string;
  empleado_id: string;
  empresa_id: string;
  embedding: number[];
  modelo_version: string;
  creado_en: string;
};

type DispositivoRow = {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  nombre: string;
  api_key: string;
  activo: boolean;
  ultima_conexion: string | null;
  heartbeat_at: string | null;
  version_app: string | null;
  ip_local: string | null;
  hostname: string | null;
  config: Record<string, unknown>;
};

type RegistroRow = {
  id: string;
  empresa_id: string;
  empleado_id: string;
  dispositivo_id: string | null;
  sucursal_id: string | null;
  tipo: "entrada" | "salida";
  timestamp: string;
  confianza: number | null;
  reconocimiento_facial: boolean;
  sincronizado: boolean;
  notas: string | null;
};

export type Severidad = "info" | "warn" | "error" | "critical";

export type NotificacionRow = {
  id: string;
  empresa_id: string;
  tipo: string;
  severidad: Severidad;
  titulo: string;
  mensaje: string | null;
  metadata: Record<string, unknown>;
  leida_en: string | null;
  creada_en: string;
};

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: EmpresaRow;
        Insert: Partial<Omit<EmpresaRow, "id" | "creada_en">> & Pick<EmpresaRow, "nombre" | "slug">;
        Update: Partial<EmpresaRow>;
        Relationships: [];
      };
      sucursales: {
        Row: SucursalRow;
        Insert: Partial<Omit<SucursalRow, "id">> & Pick<SucursalRow, "empresa_id" | "nombre">;
        Update: Partial<SucursalRow>;
        Relationships: [];
      };
      empleados: {
        Row: EmpleadoRow;
        Insert: Partial<Omit<EmpleadoRow, "id" | "creado_en">> & Pick<EmpleadoRow, "empresa_id" | "nombre" | "apellido">;
        Update: Partial<EmpleadoRow>;
        Relationships: [];
      };
      embeddings_faciales: {
        Row: EmbeddingRow;
        Insert: Partial<Omit<EmbeddingRow, "id" | "creado_en">> & Pick<EmbeddingRow, "empresa_id" | "empleado_id" | "embedding">;
        Update: Partial<EmbeddingRow>;
        Relationships: [];
      };
      dispositivos: {
        Row: DispositivoRow;
        Insert: Partial<Omit<DispositivoRow, "id">> & Pick<DispositivoRow, "empresa_id" | "nombre">;
        Update: Partial<DispositivoRow>;
        Relationships: [];
      };
      notificaciones: {
        Row: NotificacionRow;
        Insert: Partial<Omit<NotificacionRow, "id" | "creada_en">> & Pick<NotificacionRow, "empresa_id" | "tipo" | "severidad" | "titulo">;
        Update: Partial<NotificacionRow>;
        Relationships: [];
      };
      registros_asistencia: {
        Row: RegistroRow;
        Insert: Partial<Omit<RegistroRow, "id">> & Pick<RegistroRow, "empresa_id" | "empleado_id" | "tipo">;
        Update: Partial<RegistroRow>;
        Relationships: [];
      };
    };
    Views: {
      v_asistencias_hoy: {
        Row: {
          empresa_id: string;
          empleado_id: string;
          nombre_completo: string;
          sucursal: string | null;
          ultima_entrada: string | null;
          ultima_salida: string | null;
          estado: "presente" | "ausente" | "salio";
        };
        Relationships: [];
      };
      v_dispositivos_estado: {
        Row: {
          id: string;
          empresa_id: string;
          sucursal_id: string | null;
          nombre: string;
          api_key: string;
          activo: boolean;
          ip_local: string | null;
          hostname: string | null;
          heartbeat_at: string | null;
          version_app: string | null;
          config: Record<string, unknown>;
          sucursal_nombre: string | null;
          estado_conexion: EstadoConexion;
          segundos_desde_heartbeat: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      vincular_estacion_hwid: {
        Args: {
          p_user_id: string;
          p_hwid: string | null;
          p_nombre: string;
          p_sucursal_id: string | null;
        };
        Returns: { ok: boolean; error?: string; dispositivo_id?: string; api_key?: string };
      };
      crear_empresa_onboarding: {
        Args: {
          p_user_id: string;
          p_nombre: string;
          p_slug: string;
          p_timezone: string;
          p_sucursal: string | null;
          p_ciudad: string | null;
        };
        Returns: { ok: boolean; error?: string; empresa_id?: string };
      };
      enviar_comando_estacion: {
        Args: {
          p_dispositivo_id: string;
          p_tipo: string;
          p_payload: Record<string, unknown>;
        };
        Returns: { ok: boolean; error?: string; comando_id?: string };
      };
      get_logs_dispositivo: {
        Args: { p_dispositivo_id: string; p_limit?: number };
        Returns: { logs: Array<{ id: string; tipo: string; detalle: Record<string, unknown>; creado_en: string }> };
      };
      notificar_sync_empleados: {
        Args: { p_empresa_id: string };
        Returns: { ok: boolean };
      };
      validar_token_provisioning: {
        Args: { p_token: string };
        Returns: {
          ok: boolean;
          error?: string;
          hwid_short?: string;
          expires_at?: string;
        };
      };
      activar_token_provisioning: {
        Args: {
          p_token: string;
          p_empresa_id: string;
          p_sucursal_id: string;
          p_nombre: string;
        };
        Returns: { ok: boolean; error?: string; dispositivo_id?: string };
      };
      crear_notificacion: {
        Args: {
          p_empresa_id: string;
          p_tipo: string;
          p_severidad: "info" | "warn" | "error" | "critical";
          p_titulo: string;
          p_mensaje?: string;
          p_metadata?: Record<string, unknown>;
          p_dedupe_key?: string;
          p_dedupe_window_min?: number;
        };
        Returns: string | null;
      };
      marcar_notificaciones_leidas: {
        Args: { p_empresa_id?: string };
        Returns: number;
      };
      crear_notif_estacion: {
        Args: {
          p_api_key: string;
          p_tipo: string;
          p_severidad: "info" | "warn" | "error" | "critical";
          p_titulo: string;
          p_mensaje?: string;
          p_metadata?: Record<string, unknown>;
          p_dedupe_key?: string;
        };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
