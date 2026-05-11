"use client";

interface Props {
  /** Foto opcional. Si no hay, se muestran iniciales. */
  src?: string | null;
  /** Texto para iniciales y para alt. */
  name: string;
  /** Tamaño en px (default 36). */
  size?: number;
  /** Forma (circulo por defecto). */
  shape?: "circle" | "square";
}

/**
 * Avatar con foto o iniciales. El color de fondo cuando no hay foto
 * es determinista basado en el nombre — el mismo empleado siempre
 * tendra el mismo color.
 */
export function Avatar({ src, name, size = 36, shape = "circle" }: Props) {
  const initials = getInitials(name);
  const color = colorForName(name);
  const radius = shape === "circle" ? "50%" : 8;

  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: radius,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, overflow: "hidden",
    fontSize: Math.max(10, size * 0.4), fontWeight: 600,
    color: "#fff", lineHeight: 1,
  };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} style={{ ...style, objectFit: "cover" }} />
    );
  }

  return (
    <span
      aria-label={name}
      style={{
        ...style,
        background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
      }}
    >
      {initials}
    </span>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Paleta de gradientes — suficientemente distintos para distinguir
// empleados sin foto en una lista.
const PALETTE: Array<{ from: string; to: string }> = [
  { from: "#3b82f6", to: "#1e40af" }, // azul
  { from: "#10b981", to: "#047857" }, // verde
  { from: "#f59e0b", to: "#b45309" }, // amber
  { from: "#8b5cf6", to: "#6d28d9" }, // violeta
  { from: "#ec4899", to: "#be185d" }, // pink
  { from: "#06b6d4", to: "#0e7490" }, // cyan
  { from: "#ef4444", to: "#b91c1c" }, // rojo
  { from: "#84cc16", to: "#4d7c0f" }, // lime
];

function colorForName(name: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
