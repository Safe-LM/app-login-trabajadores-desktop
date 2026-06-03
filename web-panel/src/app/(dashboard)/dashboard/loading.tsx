export default function Loading() {
  return (
    <div style={{ padding: "28px 32px" }}>
      <div className="skeleton" style={{ height: 28, width: 180, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 28 }} />
      <div style={{ display: "grid", gap: 12 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton" style={{ height: 56 }} />
        ))}
      </div>
    </div>
  );
}
