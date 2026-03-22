# SafeLink Dashboard

Panel de control de asistencias en tiempo real con reconocimiento facial IA, construido con Next.js 16 + Supabase.

## Stack

- **Framework:** Next.js 16.2 (Turbopack, App Router)
- **Base de datos:** Supabase (PostgreSQL + Realtime)
- **Auth:** Supabase Auth (login + registro con confirmación por email)
- **UI:** Tailwind CSS v4 · Recharts · Lucide React
- **Tipografía:** Poppins (headings) + Open Sans (body)
- **Deploy:** Vercel

## Desarrollo local

```bash
cd dashboard_nextjs
npm install
npm run dev
```

Copia las variables de entorno:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

Abre [http://localhost:3000](http://localhost:3000).

## CI/CD — Flujo de trabajo

```
develop  ──►  Staging (Preview)  ──►  PR a main  ──►  main  ──►  Production
```

### Ramas

| Rama | Propósito | Deploy automático |
|------|-----------|-------------------|
| `develop` | Desarrollo y pruebas | Vercel Preview |
| `main` | Producción estable | Vercel Production |

### Workflows de GitHub Actions

| Workflow | Trigger | Qué hace |
|----------|---------|----------|
| `Vercel — Staging` | Push a `develop` · PR a `main` | TypeScript check + build + deploy Preview |
| `Vercel — Production` | Push a `main` (merge) | TypeScript check + build + deploy Production |

Cada workflow bloquea el deploy si el build o TypeScript fallan. En PRs, el bot comenta automáticamente la URL del preview.

### Secrets requeridos en GitHub

Configura en **Settings → Secrets and variables → Actions**:

| Secret | Descripción |
|--------|-------------|
| `VERCEL_TOKEN` | Token de API de Vercel |
| `VERCEL_ORG_ID` | ID de organización (`orgId` en `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | ID del proyecto (`projectId` en `.vercel/project.json`) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública de Supabase |

### Setup inicial (una sola vez)

```bash
# 1. Instalar Vercel CLI y linkear el proyecto
npm i -g vercel
cd dashboard_nextjs
vercel link

# 2. Crear rama develop
git checkout -b develop
git push -u origin develop
```

A partir de ahí el pipeline corre solo.

## Estructura del proyecto

```
dashboard_nextjs/
├── app/
│   ├── globals.css        # Variables CSS (tema dark/light)
│   ├── layout.tsx         # Providers: AuthProvider + ThemeProvider
│   ├── page.tsx           # Dashboard principal
│   └── login/page.tsx     # Login + Registro con tabs
├── components/
│   ├── Header.tsx         # Barra superior con filtros y presets de fecha
│   ├── KpiCard.tsx        # Tarjetas de métricas con delta
│   ├── AttendanceTable.tsx # Tabla paginada con búsqueda y ordenamiento
│   ├── DonutChart.tsx     # Gráfica de dona con leyenda y total
│   ├── TrendChart.tsx     # Líneas de tendencia 7 días
│   ├── SucursalChart.tsx  # Barras por sucursal
│   ├── HeatmapChart.tsx   # Mapa de calor hora/día
│   ├── SplashScreen.tsx   # Pantalla de carga animada
│   └── Toast.tsx          # Notificaciones
└── lib/
    ├── supabase.ts        # Cliente de Supabase
    ├── auth-context.tsx   # Context de autenticación
    ├── theme-context.tsx  # Context de tema dark/light
    ├── queries.ts         # Todas las queries a Supabase
    ├── types.ts           # Tipos TypeScript
    └── useDebounce.ts     # Hook de debounce
```

## Características

- Tiempo real con Supabase Realtime — nuevos registros aparecen sin recargar
- Modo oscuro / claro persistido en `localStorage`
- Exportación a CSV de todos los registros filtrados
- Filtros por fecha (con presets), sucursal y tipo de registro
- Búsqueda de empleados con debounce de 350ms
- Paginación de 25 registros por página
- Splash screen animado en el primer acceso
- Registro de usuarios con strength meter de contraseña
