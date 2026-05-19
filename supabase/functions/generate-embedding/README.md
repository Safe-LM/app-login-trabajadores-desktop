# Edge Function: generate-embedding

Marca empleados como pendientes de enrollment tras la subida de su foto.
El embedding facial real (128D) se genera **en la estación** durante el
sync periódico, no aquí.

> ⚠️ Históricamente esta Edge Function intentaba generar el embedding
> server-side (OpenCV en Deno via WASM). Ese enfoque resultó pesado e
> inestable en Deno runtime, así que se simplificó: ahora solo actualiza
> el flag `enrollado=false` para que la estación detecte el empleado
> nuevo en su próximo ciclo de sync y le genere los embeddings localmente.

## Flujo actual

```
Admin sube foto → Web Panel API (/api/empleados/create|update)
                       ├─▶ Sube foto a Supabase Storage
                       │   (fotos-empleados/<empresa>/<empleado>.jpg)
                       │
                       ├─▶ INSERT/UPDATE en `empleados` con foto_url
                       │
                       ├─▶ Invoca Edge Function generate-embedding ──┐
                       │                                              │
                       │                                              ▼
                       │              UPDATE empleados
                       │                SET foto_url = ?,
                       │                    enrollado = false
                       │                WHERE id = ? AND empresa_id = ?
                       │
                       └─▶ RPC notificar_sync_empleados(empresa_id)
                              │
                              ▼
                       Inserta comando 'sync_empleados' en
                       comandos_estacion para cada estación de
                       la empresa.

Estación recibe el comando (Realtime <500ms) → sync_manager:
   1. get_empleados_empresa(api_key)
   2. Descarga foto si no está en cache
   3. _regenerate_encodings():
        a. _crop_face_bbox() — recorta cara con padding 0.4
        b. _augment_image() — 10 variantes
        c. Para cada variante: YuNet detect + SFace embedding
   4. subir_embeddings_estacion_batch(api_key, empleado_id, embeddings)
   5. UPDATE empleados SET enrollado=true (via RPC)
```

## Deployment

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Login + link al proyecto

```bash
supabase login
cd supabase
supabase link --project-ref ctmpsokjdguygjqmxyob
```

### 3. Deploy

```bash
supabase functions deploy generate-embedding
```

## Request

```bash
curl -X POST https://<proyecto>.supabase.co/functions/v1/generate-embedding \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <service_role_key>" \
  -d '{
    "foto_url": "https://.../storage/v1/object/public/fotos-empleados/<emp>/<id>.jpg",
    "empleado_id": "<uuid-empleado>",
    "empresa_id": "<uuid-empresa>"
  }'
```

### Response

```json
{
  "ok": true,
  "mensaje": "Empleado registrado - la estación generará el embedding durante el sync",
  "empleado_id": "<uuid>"
}
```

## Variables de entorno

Supabase provee automáticamente:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No requiere secrets adicionales.

## Tablas afectadas

| Tabla | Acción |
|---|---|
| `empleados` | `UPDATE foto_url, enrollado=false WHERE id=? AND empresa_id=?` |

> El embedding **NO se inserta aquí** — eso lo hace la estación via
> `subir_embeddings_estacion_batch(api_key, empleado_id, embeddings)`.

## Por qué este enfoque

| | Server-side embedding | Cliente-side (actual) |
|---|---|---|
| Latencia init | ~30s descargando modelos a Deno | 0s (modelos ya en estación) |
| Robustez | OpenCV en WASM es frágil | OpenCV nativo en Python = sólido |
| Costo Supabase | Cada upload llama Edge Function pesada | Edge Function trivial (1 UPDATE) |
| Calidad embedding | 1 embedding por foto | 10 embeddings/empleado (data augmentation) |
| Offline | ❌ requiere Edge Function up | ✅ estación lo genera aunque Edge esté caído |

## Testing local

```bash
supabase functions serve generate-embedding --env-file .env.local
```

Otra terminal:

```bash
curl -X POST http://localhost:54321/functions/v1/generate-embedding \
  -H "Authorization: Bearer <anon_key>" \
  -d '{
    "foto_url": "https://.../empleado.jpg",
    "empleado_id": "uuid",
    "empresa_id": "uuid"
  }'
```

## Roadmap

- Validar que la `foto_url` apunte a un objeto en `storage/fotos-empleados/<empresa>/`
  (defensa contra inyección de URL externa) — actualmente trust del backend.
- Considerar batch updates si en el futuro se hace bulk import (~100 empleados a la vez).
