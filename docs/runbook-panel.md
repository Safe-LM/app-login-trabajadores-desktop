# Runbook: Levantar el panel web Safe Link

Guía para que cualquier dev del equipo pueda correr el panel localmente
y desplegarlo a producción.

---

## Pre-requisitos

| Requisito | Versión | Cómo verificar |
|---|---|---|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Git | cualquiera | `git --version` |
| Cuenta Supabase | gratuita OK | https://supabase.com |
| Cuenta Vercel | opcional, para deploy | https://vercel.com |

---

## 🔧 Setup local (desarrollo)

### 1. Clonar el repositorio

```bash
git clone https://github.com/safelink/safelink-monorepo.git
cd safelink-monorepo
```

### 2. Setup automático

Desde la raíz del repo:

**Windows (PowerShell):**
```powershell
.\scripts\setup-dev.ps1
```

**macOS / Linux:**
```bash
bash scripts/setup-dev.sh
```

Este script:
- Instala dependencias del panel
- Verifica que tengas Node.js 20+
- Pide URL y keys de Supabase
- Crea `.env.local` automáticamente
- Aplica migraciones de Supabase (si tienes la CLI)

### 3. Setup manual (si el script falla)

#### 3.1 Instalar dependencias del panel

```bash
cd web-panel
npm install
```

#### 3.2 Crear archivo de variables

Copia `.env.example` a `.env.local` y completa:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # solo backend, NUNCA cliente
```

Las URLs vienen de tu proyecto Supabase: **Settings → API**.

#### 3.3 Aplicar migraciones a Supabase

Necesitas la CLI de Supabase:

```bash
# Windows con Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# macOS con Homebrew
brew install supabase/tap/supabase

# Cualquier sistema con npm
npm install -g supabase
```

Luego:

```bash
cd supabase
supabase link --project-ref xxxxx     # xxxxx viene de la URL del proyecto
supabase db push                       # aplica todas las migraciones pendientes
supabase functions deploy generate-embedding
```

### 4. Crear primer superadmin

En **Supabase Dashboard → SQL Editor**:

```sql
-- Asume que ya tienes una cuenta creada con magic link/email
INSERT INTO usuarios (email, rol, activo)
VALUES ('tu@email.com', 'superadmin', true)
ON CONFLICT (email) DO UPDATE SET rol = 'superadmin', activo = true;
```

### 5. Correr el panel en local

```bash
cd web-panel
npm run dev
```

Abre http://localhost:3000 → login con tu email.

---

## 🚀 Deploy a producción (Vercel)

### Primera vez

1. Push tu repo a GitHub
2. https://vercel.com/new → Import Project
3. Selecciona el repo
4. **Root Directory:** `web-panel`
5. **Framework Preset:** Next.js (autodetectado)
6. **Environment Variables:** copia las 3 de `.env.local`
7. Click **Deploy**

### Dominio personalizado

1. Vercel → tu proyecto → **Settings → Domains**
2. Agrega `panel.safelink.app`
3. Configura DNS según las instrucciones que te dé Vercel

### Deploys automáticos

Cualquier push a `main` deploya automáticamente. Para staging usa una rama
`staging` y configura un dominio separado en Vercel.

---

## 👥 Onboardear un cliente nuevo (empresa)

Como superadmin:

1. Login en el panel con tu cuenta del equipo Safe Link
2. **Empresas → ⊕ Nueva empresa**
3. Completa: nombre, email del admin, plan
4. Click **Crear** → genera link de invitación
5. Copia el link y mándaselo al admin del cliente

El admin del cliente:
1. Abre el link → se registra
2. Ya puede crear sucursales, empleados y estaciones
3. **No ve** otras empresas (RLS lo aísla automáticamente)

---

## 🔍 Comandos útiles

```bash
npm run dev          # desarrollo (hot reload)
npm run build        # build producción
npm run start        # corre el build localmente
npm run lint         # linter
npm run type-check   # validación TypeScript

# Generar tipos TypeScript desde Supabase
supabase gen types typescript --project-id xxxxx > web-panel/src/types/database.ts
```

---

## 🐛 Troubleshooting

| Síntoma | Solución |
|---|---|
| `npm install` falla con peer deps | Usa `npm install --legacy-peer-deps` |
| Login redirige y vuelve a login | Verifica que `usuarios.activo = true` en SQL |
| RLS error: "permission denied" | Falta política RLS o usuario sin empresa asignada |
| Realtime no funciona | Verifica que las tablas estén en `supabase_realtime` publication |
| Tipos TypeScript desactualizados | Regenera con `supabase gen types typescript` |
| Build de Vercel falla | Suele ser variables de entorno faltantes |

---

## 📚 Estructura del código

```
web-panel/
├── src/
│   ├── app/
│   │   ├── (dashboard)/        # rutas protegidas (requieren login)
│   │   │   ├── empleados/
│   │   │   ├── asistencia/
│   │   │   ├── dispositivos/
│   │   │   └── sucursales/
│   │   ├── api/                # API routes server-side
│   │   ├── activar/            # página pública para activar estaciones
│   │   ├── login/
│   │   └── layout.tsx
│   ├── components/             # componentes reutilizables
│   ├── lib/
│   │   ├── supabase/           # clients (server, browser, middleware)
│   │   └── utils/
│   └── types/
│       └── database.ts         # tipos generados desde Supabase
└── public/
```

---

## 🔐 Seguridad

- **Nunca** comites `.env.local` (ya está en `.gitignore`)
- `SUPABASE_SERVICE_ROLE_KEY` solo en backend (API routes / Edge Functions)
- Para variables públicas usa el prefijo `NEXT_PUBLIC_`
- RLS está activo en TODAS las tablas — no lo desactives en producción

---

## Soporte

- Slack: `#safelink-dev`
- Email: `dev@safelink.app`
- Docs internos: https://safelink.notion.site
