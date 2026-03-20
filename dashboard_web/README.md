# Safe Link — Dashboard Web de Asistencias

## Configuración (2 pasos)

### 1. Poner las credenciales en `index.html`

Abre `index.html` y busca estas dos líneas al inicio del script:

```js
const SUPABASE_URL  = 'TU_SUPABASE_URL';    // ej: https://xxxx.supabase.co
const SUPABASE_ANON = 'TU_SUPABASE_ANON_KEY';
```

- **SUPABASE_URL** → Supabase Dashboard → Settings → API → Project URL
- **SUPABASE_ANON** → Supabase Dashboard → Settings → API → `anon` `public` key

> Usa la `anon` key, NO la `service_role`. La anon key es segura para frontend.

### 2. Abrir en el navegador

Abre `index.html` directo en Chrome/Edge — no necesita servidor.

---

## Qué incluye

| Sección | Descripción |
|---|---|
| **KPI Cards** | Presentes hoy, total entradas, salidas, confianza promedio IA |
| **Tendencia 7 días** | Líneas de entradas y salidas por día |
| **Método IA** | Donut con distribución hybrid / opencv / photo_matcher / gemini |
| **Por Sucursal** | Barras horizontales con ranking de asistencias |
| **Puntualidad** | Donut: A tiempo / Retardo leve / moderado / grave |
| **Tabla detallada** | Todos los registros con búsqueda y paginación de 25 en 25 |
| **Exportar CSV** | Descarga todos los registros filtrados con BOM UTF-8 (Excel compatible) |

## Filtros disponibles

- Rango de fechas (Desde / Hasta)
- Sucursal específica
- Tipo: Entrada / Salida / Ambos
- Búsqueda por nombre, sucursal, puesto o método en la tabla

## Auto-refresh

Se actualiza automáticamente cada 60 segundos.
