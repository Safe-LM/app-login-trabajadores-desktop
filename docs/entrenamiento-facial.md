# Entrenamiento facial — Cómo funciona

Este documento describe cómo se generan los embeddings faciales (vectores de 128
dimensiones) que el sistema usa para reconocer empleados.

Está basado en la versión **v3 SFace** del proyecto original (PDF de desarrollo),
que alcanzaba **100% de precisión** con augmentación de datos.

---

## Arquitectura

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   PANEL WEB     │      │    SUPABASE      │      │    ESTACIÓN     │
│                 │      │                  │      │                 │
│  Sube foto      │─────▶│  Storage         │      │                 │
│  empleado       │      │  fotos-empleados │      │                 │
│  enrollado=false│      │                  │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │
                                  │ Realtime push
                                  │ comando: sync_empleados
                                  ▼
                         ┌─────────────────┐
                         │   ESTACIÓN      │
                         │                 │
                         │ 1. Descarga     │
                         │    foto         │
                         │ 2. Aplica       │
                         │    YuNet (det.) │
                         │ 3. Genera 10    │
                         │    augmenta-    │
                         │    ciones       │
                         │ 4. SFace embed. │
                         │    por cada una │
                         │ 5. Sube los 10  │
                         │    a Supabase   │
                         │ 6. Marca        │
                         │    enrollado    │
                         │    = true       │
                         └─────────────────┘
                                  │
                                  │ Realtime push
                                  │ UPDATE empleados
                                  ▼
                         ┌─────────────────┐
                         │   PANEL WEB     │
                         │                 │
                         │ Badge cambia:   │
                         │ Entrenando…     │
                         │       ↓         │
                         │ ✓ Entrenado     │
                         └─────────────────┘
```

---

## Modelos usados

| Modelo | Tamaño | Función |
|---|---|---|
| **YuNet** (face_detection_yunet_2023mar.onnx) | 227 KB | Detector de rostros + 5 landmarks (ojos, nariz, boca) |
| **SFace** (face_recognition_sface_2021dec.onnx) | 37 MB | Genera embedding de 128 dimensiones por rostro |

Ambos del [OpenCV Zoo](https://github.com/opencv/opencv_zoo). Se descargan
automáticamente al primer arranque vía `model_downloader.py`.

---

## Data augmentation (10 variantes por foto)

Cada foto del empleado pasa por estas 10 transformaciones, generando 10 embeddings:

| # | Transformación | Propósito |
|---|---|---|
| 1 | Original | Foto base sin alteración |
| 2 | Flip horizontal | Robustez a orientación lateral |
| 3-6 | 4 brillo/contraste (α=0.85/1.15, β=±10/±25) | Tolerancia a iluminación variable |
| 7-8 | Rotaciones leves (±8°) | Robustez a inclinación de cabeza |
| 9 | Ruido gaussiano (σ=5) | Tolerancia a ruido de cámara |
| 10 | Desenfoque gaussiano (3×3) | Tolerancia a foco impreciso |

**Resultado**: con 1 foto original obtenemos un cluster de 10 embeddings que
representa la identidad del empleado bajo condiciones realistas.

**Mejora medida**: precisión sube de ~85% (1 embedding) a **~99%** (10 con augmentation).

---

## Pipeline de reconocimiento en tiempo real

Cuando alguien se acerca a la cámara:

1. **Detección** (YuNet): localiza el rostro y los 5 landmarks
2. **Alineación** (SFace.alignCrop): rota y escala el rostro usando los landmarks
3. **Embedding** (SFace.feature): genera el vector de 128-D del rostro en vivo
4. **Comparación**: similitud coseno contra los ~10 embeddings de cada empleado
5. **Voting**: agrupa por empleado, promedia los **top-5 mejores matches**
6. **Decisión**: si el mejor score > 0.40 con gap > 0.03 sobre el segundo → confirma

---

## Subida a Supabase

Los embeddings se suben en batch vía RPC `subir_embeddings_estacion_batch`:

```sql
subir_embeddings_estacion_batch(
  p_api_key,
  p_empleado_id,
  p_embeddings,    -- jsonb: ["[0.1,...]", "[0.2,...]", ...] (los 10)
  p_modelo_version -- "sface_v3"
)
```

El RPC:
1. Valida la `api_key` (autenticación de la estación)
2. Verifica que el empleado pertenece a la misma empresa
3. Borra embeddings viejos del empleado (atomic)
4. Inserta los 10 nuevos con `es_augmentado=true` (excepto el primero)
5. Marca `empleados.enrollado = true`

Esto dispara Realtime sobre `empleados` → el badge del panel se actualiza
de "Entrenando…" a "Entrenado" sin refresh.

---

## Flujo de re-entrenamiento

### Cuando se sube una foto nueva
- El panel marca `enrollado = false`
- Las estaciones reciben comando `sync_empleados` por Realtime
- La primera estación que tenga la foto regenera los embeddings y los sube
- Las demás estaciones descargan los nuevos embeddings en su próximo sync

### Cuando un empleado cambia su apariencia (corte de pelo, lentes, etc.)
- Admin sube nueva foto desde el panel → mismo flujo
- Los embeddings viejos se borran automáticamente al subir los nuevos

### Si quieres forzar re-entrenamiento
- Desde el panel, click "Sincronizar" en la estación → fuerza regenerar todo

---

## Por qué entrenamos en la estación y no en el servidor

**Edge Functions de Supabase** son Deno + JS — no soportan OpenCV ni modelos ONNX
nativos.

Alternativas evaluadas:
- ❌ Cloud Run / Lambda con Python: $0.05+ por inferencia, latencia 2-5s, complejidad
- ❌ Replicate / Modal: costo recurrente, dependencia externa
- ✅ **Estación**: ya tiene OpenCV cargado, embeddings en <2s, $0 costo

Las estaciones también son redundantes — si una está offline, otra hace el trabajo.

---

## Archivos involucrados

| Archivo | Rol |
|---|---|
| `station/src/utils/sync_manager.py` | `_regenerate_encodings`, `_augment_image`, `_upload_embeddings_to_supabase` |
| `station/src/utils/face_recognition_opencv.py` | Reconocimiento en tiempo real con voting |
| `station/src/utils/model_downloader.py` | Descarga automática YuNet + SFace |
| `supabase/migrations/20260508_embeddings_batch.sql` | RPC batch upload |
| `supabase/migrations/20260508_realtime_empleados.sql` | Realtime para badge en panel |
| `web-panel/src/app/(dashboard)/empleados/empleados-client.tsx` | Badge "Entrenando/Entrenado" |
