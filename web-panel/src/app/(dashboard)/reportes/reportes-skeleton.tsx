import { Skeleton } from "@/components/Skeleton";

export function ReportesSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <Skeleton width={80} height={10} style={{ marginBottom: 10 }} />
            <Skeleton width={70} height={26} style={{ marginBottom: 6 }} />
            <Skeleton width={100} height={10} />
          </div>
        ))}
      </div>
      <div className="card" style={{ height: 320, padding: 20 }}>
        <Skeleton width={160} height={14} style={{ marginBottom: 16 }} />
        <Skeleton height={260} />
      </div>
      <div className="card" style={{ padding: 16 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <Skeleton key={i} height={36} style={{ marginBottom: 8 }} />
        ))}
      </div>
    </div>
  );
}
