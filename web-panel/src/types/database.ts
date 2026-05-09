export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string;
          nombre: string;
          slug: string;
          plan: "starter" | "business" | "enterprise";
          activa: boolean;
          creada_en: string;
          max_empleados: number;
          max_estaciones: number;
        };
        Insert: Omit<Database["public"]["Tables"]["empresas"]["Row"], "id" | "creada_en">;
        Update: Partial<Database["public"]["Tables"]["empresas"]["Insert"]>;
      };
      sucursales: {
        Row: {
          id: string;
          empresa_id: string;
          nombre: string;
          zona: string | null;
          ciudad: string | null;
          activa: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["sucursales"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["sucursales"]["Insert"]>;
      };
      empleados: {
        Row: {
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
        Insert: Omit<Database["public"]["Tables"]["empleados"]["Row"], "id" | "creado_en">;
        Update: Partial<Database["public"]["Tables"]["empleados"]["Insert"]>;
      };
      embeddings_faciales: {
        Row: {
          id: string;
          empleado_id: string;
          empresa_id: string;
          embedding: number[];
          modelo_version: string;
          creado_en: string;
        };
        Insert: Omit<Database["public"]["Tables"]["embeddings_faciales"]["Row"], "id" | "creado_en">;
        Update: Partial<Database["public"]["Tables"]["embeddings_faciales"]["Insert"]>;
      };
      dispositivos: {
        Row: {
          id: string;
          empresa_id: string;
          sucursal_id: string | null;
          nombre: string;
          api_key: string;
          activo: boolean;
          ultima_conexion: string | null;
          version_app: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["dispositivos"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["dispositivos"]["Insert"]>;
      };
      registros_asistencia: {
        Row: {
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
        Insert: Omit<Database["public"]["Tables"]["registros_asistencia"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["registros_asistencia"]["Insert"]>;
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
      };
    };
  };
}
