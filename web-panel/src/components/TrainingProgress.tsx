"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Brain, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";

/**
 * S2.3: Vista de progreso de training facial en vivo.
 * Agrega los eventos training_started, training_completed,
 * embedding_generated y embedding_failed de UN dispositivo.
 *
 * Muestra:
 *  - Barra de progreso con # empleados procesados vs total esperado.
 *  - Contadores OK / Fallidos.
 *  - Lista de empleados que fallaron con razon.
 */
type LogRow = {
  id: string;
  tipo: string;
  detalle: Record<string, unknown>;
  creado_en: string;
};

type TrainingStats = {
  started: boolean;
  totalFotos: number;
  generados: number;
  fallidos: number;
  fallidosDetalle: Array<{ empleado_id: string; razon: string }>;
  completed: boolean;
  embeddingsTotales: number;
  embeddingsPorPersona: number;
  lastEvent: string;
};

const EMPTY: TrainingStats = {
  started: false, totalFotos: 0, generados: 0, fallidos: 0,
  fallidosDetalle: [], completed: false,
  embeddingsTotales: 0, embeddingsPorPersona: 0, lastEvent: "",
};

export function TrainingProgress({ dispositivoId }: { dispositivoId: string }) {
  const [stats, setStats] = useState<TrainingStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  // Carga inicial de logs recientes + realtime
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data } = await sb
        .from("logs_estacion")
        .select("id, tipo, detalle, creado_en")
        .eq("dispositivo_id", dispositivoId)
        .in("tipo", ["training_started", "training_completed", "embedding_generated", "embedding_failed"])
        .order("creado_en", { ascending: false })
        .limit(100);
      if (mounted) {
        setStats(aggregate(data ?? []));
        setLoading(false);
      }
    }
    load();

    // Realtime: suscribirse a logs nuevos del mismo dispositivo
    const channel = supabase
      .channel(`training-${dispositivoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT", schema: "public", table: "logs_estacion",
          filter: `dispositivo_id=eq.${dispositivoId}`,
        },
        () => { load(); }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [dispositivoId]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>
        Cargando estado del training...
      </div>
    );
  }

  if (!stats.started && !stats.completed) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 12, lineHeight: 1.6 }}>
        <Brain size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <div>Sin actividad de training reciente</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>
          Cuando esta estación procese empleados, verás el progreso aquí.
        </div>
      </div>
    );
  }

  const pct = stats.totalFotos > 0
    ? Math.round(((stats.generados + stats.fallidos) / stats.totalFotos) * 100)
    : stats.completed ? 100 : 0;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: stats.completed ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
          color: stats.completed ? "#10b981" : "#f59e0b",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {stats.completed ? <CheckCircle2 size={16} /> : <Brain size={16} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {stats.completed ? "Entrenamiento completado" : "Entrenamiento en curso"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            {stats.completed
              ? `${stats.embeddingsTotales} embeddings (~${stats.embeddingsPorPersona.toFixed(1)} por persona)`
              : stats.totalFotos > 0
                ? `${stats.generados + stats.fallidos} de ${stats.totalFotos} procesadas`
                : "Iniciando..."}
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
          <span>{pct}%</span>
          <span>{stats.generados + stats.fallidos} / {stats.totalFotos || "?"}</span>
        </div>
        <div style={{
          width: "100%", height: 8, borderRadius: 4,
          background: "var(--bg-elevated)", overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: stats.completed
              ? "linear-gradient(90deg, #10b981, #059669)"
              : "linear-gradient(90deg, #3b82f6, #8b5cf6)",
            transition: "width 300ms ease-out",
          }} />
        </div>
      </div>

      {/* Contadores */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <StatTile color="#06b6d4" icon={<ImageIcon size={14} />} label="Procesados" value={stats.generados} />
        <StatTile color="#ef4444" icon={<AlertCircle size={14} />} label="Fallidos" value={stats.fallidos} />
        <StatTile color="#8b5cf6" icon={<Brain size={14} />} label="Embeddings" value={stats.embeddingsTotales} />
      </div>

      {/* Lista de fallidos */}
      {stats.fallidosDetalle.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ fontSize: 11, color: "var(--text-faint)", cursor: "pointer", padding: "6px 0" }}>
            Ver {stats.fallidosDetalle.length} fallido{stats.fallidosDetalle.length === 1 ? "" : "s"}
          </summary>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {stats.fallidosDetalle.slice(0, 15).map((f, i) => (
              <div key={i} style={{
                padding: "6px 10px", fontSize: 11,
                background: "var(--bg-elevated)", borderRadius: 6,
                display: "flex", justifyContent: "space-between", gap: 8,
              }}>
                <code style={{ color: "var(--text-faint)", fontSize: 10 }}>
                  {f.empleado_id.slice(0, 8)}
                </code>
                <span style={{ color: "#f87171", fontSize: 11 }}>
                  {f.razon}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function StatTile({ color, icon, label, value }: {
  color: string; icon: React.ReactNode; label: string; value: number;
}) {
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 8,
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Agrega logs en stats. Encuentra el ultimo training_completed y los
 * embedding_* posteriores al training_started mas reciente.
 */
function aggregate(rows: LogRow[]): TrainingStats {
  if (rows.length === 0) return EMPTY;

  // ordenar mas recientes primero (asi vienen del query, pero por si acaso)
  const sorted = [...rows].sort((a, b) => b.creado_en.localeCompare(a.creado_en));

  // Buscar el ultimo training_started — todo log entre el y ahora es del run actual
  const lastStartIdx = sorted.findIndex((r) => r.tipo === "training_started");
  if (lastStartIdx === -1) return EMPTY;

  const start = sorted[lastStartIdx];
  // detalle del start
  const totalFotos = Number((start.detalle?.fotos_encontradas as number | undefined) ?? 0);

  // Eventos relevantes: los que estan ANTES del start en sorted (mas recientes)
  const since = sorted.slice(0, lastStartIdx);

  let generados = 0;
  let fallidos = 0;
  const fallidosDetalle: Array<{ empleado_id: string; razon: string }> = [];

  // Buscar el training_completed si ya termino
  const completedRow = since.find((r) => r.tipo === "training_completed");

  for (const r of since) {
    if (r.tipo === "embedding_generated") generados++;
    if (r.tipo === "embedding_failed") {
      fallidos++;
      fallidosDetalle.push({
        empleado_id: String(r.detalle?.empleado_id ?? "?"),
        razon:       String(r.detalle?.razon ?? "?"),
      });
    }
  }

  // Si hay training_completed, usar sus totales (mas fiables)
  let embeddingsTotales = 0;
  let embeddingsPorPersona = 0;
  if (completedRow) {
    embeddingsTotales    = Number(completedRow.detalle?.embeddings_totales ?? 0);
    embeddingsPorPersona = Number(completedRow.detalle?.embeddings_por_persona ?? 0);
    // Si el server reporta otros conteos, preferir esos
    generados = Math.max(generados, Number(completedRow.detalle?.empleados_procesados ?? generados));
    fallidos  = Math.max(fallidos,  Number(completedRow.detalle?.empleados_fallidos   ?? fallidos));
  }

  return {
    started: true,
    totalFotos,
    generados,
    fallidos,
    fallidosDetalle,
    completed: !!completedRow,
    embeddingsTotales,
    embeddingsPorPersona,
    lastEvent: sorted[0]?.creado_en ?? "",
  };
}
