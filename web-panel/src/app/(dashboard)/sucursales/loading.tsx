export default function Loading() {
  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ height: 28, width: 180, background: "rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 8 }} />
      <div style={{ height: 14, width: 120, background: "rgba(255,255,255,0.04)", borderRadius: 6, marginBottom: 28 }} />
      <div style={{ display: "grid", gap: 12 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            height: 56,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.05)",
          }} />
        ))}
      </div>
    </div>
  );
}
