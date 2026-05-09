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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
