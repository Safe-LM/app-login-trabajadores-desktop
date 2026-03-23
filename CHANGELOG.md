# Changelog

## 0.1.0 (2026-03-23)


### Features

* añadir automatización de validación de sincronización cloud (Supabase Sync Validator) ([9ba74a3](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/9ba74a378214e08350323b48e4f5fa8e5a236cb1))
* añadir base de datos, fotos de empleados y archivos pdf al repositorio ([fb617a9](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/fb617a9ad9563222e7203bdf89dab1cfd95ab9e0))
* dashboard web de asistencias para área de finanzas/management ([783039d](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/783039d51fc6f683099e742d4b4ff19bbe44a579))
* **dashboard:** Next.js dashboard completo con auth, temas y UI profesional ([3f8470b](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/3f8470babd2a6985cab07334d5e0c950d35ea8a6))
* **dashboard:** sucursales desde tabla directa + columna horario en … ([af7a1cd](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/af7a1cd86de88de0d48426cdb0301039a4785eb4))
* **dashboard:** sucursales desde tabla directa + columna horario en tabla ([f387f0d](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/f387f0d490e27c32dff45efc911e7a44b4894445))
* flujo Check&Go con espera de 5s para preparación y auto-logout de 3s ([e0d8bf8](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/e0d8bf87d7f459a665e66fc52668193026997df2))
* implementar automatizaciones avanzadas (Build EXE, Accuracy Guard y Changelog) ([b081118](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/b08111897d4c9d4e0da11abc3ff45534b4479efe))
* implementar Flujo Kiosco (Cámara automática + Auto-Logout 3s post-asistencia) ([6bd060c](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/6bd060cb05e2012f7fab6127ea3ebcdf1dee2c2d))
* integración Supabase y base de datos limpia (56 empleados) ([c32e985](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/c32e985cef43ecbab3cf1c97ce34bbbd10c186de))
* integración total con Supabase Cloud - 82 empleados migrados y asistencia en tiempo real ([fb7314d](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/fb7314db56e9d742be3cf7e50af20f1cf478b382))
* **login:** rediseño completo con glassmorphism full-dark y orbs animados ([657783a](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/657783a2e220766542eeba3f0f6dec38760aa810))
* **login:** upgrade tipografía con Poppins + Inter + Plus Jakarta Sans ([dcba48a](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/dcba48a25a0ee0bdf200943fe612f07e92400a01))
* mejoras visuales avanzadas en login y dashboard ([8f87fc2](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/8f87fc2ebaaf426e37dbbce53ea4e12dfc29cf20))
* nueva GitHub Action 'SaaS Premium' (Quality & Security Guard) ([c3aea43](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/c3aea43dc0d2a3dad7113e596dd5ae4d16f8cd81))
* rediseño dashboard - iconos, stats bar, foto grande, dialogo premium de asistencia ([dd7d094](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/dd7d09485c58f4338ce25e0be7774196cce49a70))
* rediseño de diálogo de asistencia sin botones y con auto-logout de 5s ([6b81680](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/6b816804ce703ef2ece0973d95100cacf89ae959))
* rediseño SaaS Premium, corrección de rutas IA y avatar Square-Round ([1a25c63](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/1a25c63c7b1c94b32e69eece8fdd826c6079ab57))
* restaurar codigo completo v2.0.4 (Safe Link Monitoring) ([2a20715](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/2a20715bfa4142911176127538c0a1f8be568c5c))
* **supabase:** rediseño de schema v2 + sync check robusto ([90b41ee](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/90b41ee661cf0690c513dfbaa618c4dbe7adcd99))
* **sync:** enviar campos completos a Supabase en cada registro de asistencia ([f197540](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/f1975406fe02072ca1d92c505cb1404db2ae5ce1))


### Bug Fixes

* actualizar base de datos con credenciales correctas ([278f442](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/278f4421a3d0a2f70c8cd0751d6a5ab6be954e6c))
* **build:** cambiar ?? por || para manejar strings vacios de secrets no configurados ([747cd0a](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/747cd0a1d738c4ca619cf73f5c574a74e10dab67))
* **build:** inyectar env vars de Supabase en next.config para evitar error en static gen ([5f03feb](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/5f03feb0987066322e0288718ad0b95d9a44b015))
* **build:** usar placeholder en supabase.ts para evitar error en pre-render de CI ([76bd099](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/76bd0996644259f361e6a2b2a6d4b0cd0d46e0ae))
* **ci:** agregar load_dotenv en supabase_sync_check para entorno local ([5ee609c](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/5ee609c49c4198043b580d7be17b72a39780a3d9))
* corregir formato de nombres y apellidos en la UI, Supabase y lógica de reconocimiento ([5d364d5](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/5d364d5bc0908dac1745f494250ae29bca1914f3))
* corregir imports 'from src.' a 'from utils.' - motor OpenCV no cargaba ([4debef0](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/4debef090592c0d6daef7480c1d468185c379ee4))
* corregir orden de nombre y apellido (formato Paterno Materno Nombres) ([8974162](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/89741625c9be14ef20b60615c529f1bc588c88ae))
* corregir permisos CI, rutas de modelos y excluir archivos &gt;100MB ([4589a20](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/4589a204b50ff9e120de29abc268141e3f511314))
* credenciales admin/admin123 y actualizar hint en login ([723a86c](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/723a86c70869860bee86844a8adf0221c5e6561a))
* remover declaraciones global innecesarias - corrige fallo en CI lint ([684063d](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/684063daaa7eb9759f50eab5bbcaa2f9e1157f0f))
* resolver alertas de linting B001 y B004 para aprobar CI ([077efbc](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/077efbc2d55376d03a5cec4e26493a0ce5540125))
* silenciar alertas de seguridad Bandit para pickle.load en archivos internos ([ffcf79d](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/ffcf79dab0c897f442f7a1b6a2ffc0290a6d5a39))
* **supabase:** cast FLOAT a NUMERIC en ROUND de v_resumen_diario ([de77ced](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/de77ced8fbb2aed6a7ae30c18cddd9a0ca3cd296))
* **supabase:** drop v_asistencias_con_nombre antes de recrear con tipo NUMERIC ([febf7b4](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/febf7b499f65dd7694c2e04e5fab7c282b724449))
* **supabase:** normalizar metodo a lowercase antes de insertar en asistencias ([1e93511](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/1e935118ceec9a41f3dff5cf52e813178a614bc0))


### Reverts

* restaurar database_fotos en raiz - no tocar base de entrenamiento ([52cd586](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/52cd5868ffa1a1cb8ba034d7711bd3a96906fcd4))


### Documentation

* actualizar README con flujo Check&Go y diseño SaaS 2.1.0 ([33ca988](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/33ca98866aca4eee2d3bd5a2e3d016b5c6275273))
* actualizar README con la nueva arquitectura profesional ([802478e](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/802478e2458008d064a840e87bcfd54670f89224))
* agregar manual de operacion y resumen de desarrollo al README ([1dcb1f3](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/1dcb1f3e20a336fe42052825bf5e7574010a91ba))
* agregar seccion de Contributing con flujo de branches, issues y PRs ([b357594](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/b357594d4ccc37d6e0786beb60c2f13baeac5849))
* **dashboard:** reescribir README con stack, CI/CD, estructura y setup ([60cd3c5](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/60cd3c591bdec0e5740075c0aea91d57354af058))
* **dashboard:** reescribir README con stack, CI/CD, estructura y setup ([2ddbc66](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/2ddbc66f40bc790bea06eb08766ba649b4d15008))
* mejorar documentación técnica de integración con Supabase Cloud ([20bfe18](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/20bfe183615e6b7c1e2ad0aab8282115519e84e0))
* mejorar README con diseño robusto y arquitectura profesional ([ab98395](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/ab983952130762181accb93f39e7fdb1b8035b7f))
* README profesional - corregir diagramas Mermaid para GitHub ([425eed6](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/425eed67157ac83bf1dfe9110984e58e62403725))
* restaurar README completo con Safe-LM ([8db6af2](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/8db6af223a7c6586f8c538c73cfc2ed622262fa8))
