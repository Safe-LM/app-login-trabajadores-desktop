# Edge Function: generate-embedding

Genera embeddings faciales (128D) para empleados usando OpenCV DNN (YuNet + SFace).

## Flujo

```
Admin sube foto → Web Panel API → Supabase Storage
                                     ↓
                              Edge Function
                              (descarga foto, genera embedding)
                                     ↓
                              pgvector (embeddings_faciales)
                                     ↓
                              Station descarga embedding
```

## Deployment

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Login a Supabase

```bash
supabase login
```

### 3. Link al proyecto

```bash
cd supabase
supabase link --project-ref <tu-project-ref>
```

### 4. Deployar la Edge Function

```bash
supabase functions deploy generate-embedding
```

### 5. Configurar secrets (si es necesario)

```bash
supabase secrets set SUPABASE_URL=https://tu-proyecto.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

## Variables de entorno (automáticas)

Supabase provee automáticamente:
- `SUPABASE_URL` - URL del proyecto
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (para escribir en tablas)
- `SUPABASE_JWT_SECRET` - Para verificar JWTs

## Testing local

```bash
supabase functions serve generate-embedding --env-file .env.local
```

Luego en otra terminal:

```bash
curl -X POST http://localhost:54321/functions/v1/generate-embedding \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-anon-key>" \
  -d '{
    "foto_url": "https://tu-bucket.supabase.co/storage/v1/object/public/fotos-empleados/empresa-id/empleado-id.jpg",
    "empleado_id": "uuid-del-empleado",
    "empresa_id": "uuid-de-la-empresa"
  }'
```

## Formato del embedding

- Dimensión: 128
- Formato: Vector para pgvector `[0.123,0.456,...]`
- Modelo: SFace (face_recognition_sface_2021dec.onnx)

## Tablas involucradas

1. `empleados` - Se actualiza `enrollado = true` después de generar embedding
2. `embeddings_faciales` - Se inserta el nuevo embedding

## Notas

- La Edge Function descarga los modelos ONNX bajo demanda (la primera vez puede tardar ~30 segundos)
- Los modelos se cachean en `/tmp/safelnk_models`
- Timeout: 60 segundos máximo por invocación
- Costo estimado: ~$0.01 USD por invocación