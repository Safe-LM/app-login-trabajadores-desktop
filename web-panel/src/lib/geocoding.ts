const NOMINATIM = "https://nominatim.openstreetmap.org";

export function normalizeQuery(q: string): string {
  let cleaned = q;
  cleaned = cleaned.replace(/\bC\b\.?/gi, "Calle");
  cleaned = cleaned.replace(/\bPte\b\.?/gi, "Poniente");
  cleaned = cleaned.replace(/\bOte\b\.?/gi, "Oriente");
  cleaned = cleaned.replace(/\bNte\b\.?/gi, "Norte");
  cleaned = cleaned.replace(/\bAv\b\.?/gi, "Avenida");
  cleaned = cleaned.replace(/\bCol\b\.?/gi, "Colonia");
  cleaned = cleaned.replace(/\bFracc\b\.?/gi, "Fraccionamiento");
  cleaned = cleaned.replace(/\bPue\b\.?/gi, "Puebla");
  return cleaned;
}

export async function fetchNominatim(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `${NOMINATIM}/search?format=jsonv2&limit=1&accept-language=es&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error("geocode failed");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0];
  return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: hit.display_name as string };
}

export async function geocodeAddress(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const cleanQ = normalizeQuery(q);
  
  // 1. Intentar con query limpio / normalizado
  try {
    const hit = await fetchNominatim(cleanQ);
    if (hit) return hit;
  } catch (e) {
    console.error("Geocoding primary try failed:", e);
  }

  // 2. Fallback 1: Quitar prefijo "Calle" si existe al inicio
  const withoutCalle = cleanQ.replace(/^Calle\s+/i, "").trim();
  if (withoutCalle !== cleanQ) {
    try {
      const hit = await fetchNominatim(withoutCalle);
      if (hit) return hit;
    } catch {}
  }

  // 3. Fallback 2: Quitar número de casa (3 a 4 dígitos)
  const withoutHouse = cleanQ.replace(/\b\d{3,4}\b/g, "").replace(/\s+/g, " ").trim();
  if (withoutHouse !== cleanQ) {
    try {
      const hit = await fetchNominatim(withoutHouse);
      if (hit) return hit;
    } catch {}
  }

  // 4. Fallback 3: Quitar prefijo "Calle" Y número de casa
  const withoutBoth = withoutCalle.replace(/\b\d{3,4}\b/g, "").replace(/\s+/g, " ").trim();
  if (withoutBoth !== withoutCalle && withoutBoth !== withoutHouse) {
    try {
      const hit = await fetchNominatim(withoutBoth);
      if (hit) return hit;
    } catch {}
  }

  // 5. Fallback 4: Quitar código postal de la opción sin calle y sin número
  const withoutZip = withoutBoth.replace(/\b\d{5}\b/g, "").replace(/\s+/g, " ").trim();
  if (withoutZip !== withoutBoth) {
    try {
      const hit = await fetchNominatim(withoutZip);
      if (hit) return hit;
    } catch {}
  }

  // 6. Fallback 5: Simplificado básico (solo calle y ciudad)
  const parts = cleanQ.split(",");
  if (parts.length > 2) {
    const streetOnly = parts[0].replace(/^Calle\s+/i, "").replace(/\b\d{3,5}\b/g, "").trim();
    const cityOnly = parts[parts.length - 1].trim();
    const basicQ = `${streetOnly}, ${cityOnly}`;
    try {
      const hit = await fetchNominatim(basicQ);
      if (hit) return hit;
    } catch {}
  }

  return null;
}
