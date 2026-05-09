import React from "react";

export function Skeleton({
  width,
  height = 16,
  rounded = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  rounded?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{
        width: width ?? "100%",
        height,
        borderRadius: rounded,
        ...style,
      }}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <Skeleton width={140} height={24} style={{ marginBottom: 8 }} />
        <Skeleton width={220} height={12} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <Skeleton width={80} height={10} style={{ marginBottom: 12 }} />
            <Skeleton width={60} height={28} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={10} />
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <Skeleton width={120} height={14} />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 100px 80px 60px",
              gap: 12,
              padding: "14px 18px",
              borderBottom: i < 5 ? "1px solid var(--border)" : "none",
              alignItems: "center",
            }}
          >
            <Skeleton width={28} height={28} rounded={8} />
            <Skeleton height={12} />
            <Skeleton width={70} height={10} />
            <Skeleton width={60} height={20} rounded={6} />
            <Skeleton width={40} height={10} />
          </div>
        ))}
      </div>
    </div>
  );
}
