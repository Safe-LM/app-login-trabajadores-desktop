# Changelog

## [0.1.3](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/web-panel-v0.1.2...web-panel-v0.1.3) (2026-05-10)


### 🐛 Correcciones

* **web-panel:** test scope path scoping ([f8cf9a2](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/f8cf9a2e3ac4dd0b138438e90b4e19428cfa8230))

## [0.1.2](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/web-panel-v0.1.1...web-panel-v0.1.2) (2026-05-10)


### 🐛 Correcciones

* **web-panel:** test del flujo de release del panel ([25f86e2](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/25f86e204c492e28b8210235319f662740e03328))

## [0.1.1](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/web-panel-v0.1.0...web-panel-v0.1.1) (2026-05-10)


### ✨ Nuevas funcionalidades

* arquitectura SaaS completa — station PyQt5 + web-panel Next.js + migraciones Supabase ([ada94f8](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/ada94f85356e2effa46c310dceba6646478abd54))
* **notifications:** centro de notificaciones persistente + browser push + integracion estacion ([4c73988](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/4c739884a90c3c38a187cbd55c3dfe8b21719942))
* sync local workspace to main — station, web-panel, supabase, docs ([42a2257](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/42a2257bd3a7d31ad738605b206e7e11507ec8ab))
* **web-panel:** accesibilidad — aria-labels en iconos + role en modales ([72b3d11](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/72b3d11b77940aed2e478f420dc0fd04659df161))
* **web-panel:** asistencia rediseno con timeline agrupado por hora ([b98108f](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/b98108fc239df9d40b5ff2d90fc6e7925d9331d8))
* **web-panel:** configuracion sectioned con icons + PageHeader ([c446e05](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/c446e054f28571beaac612ff0bf3233673402eca))
* **web-panel:** dashboard rediseno premium con StatCards + stagger ([e7c803c](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/e7c803cb2199f4b77c9a0a8789340b7e0eaee566))
* **web-panel:** empleados — tabla refinada con hover accent + avatares premium ([5a17fbe](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/5a17fbef573010ca85bece8450f0bace32647c1d))
* **web-panel:** empty states ilustrados premium en 4 secciones ([74a1a9c](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/74a1a9cc1e290ba249fcc7f326d555fba1c5d917))
* **web-panel:** menu hamburguesa + sidebar drawer en movil ([0cb1749](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/0cb17495c56387c6e9c1bad98fe1ca22b3c4e8fe))
* **web-panel:** optimistic updates en empleados y dispositivos ([0729c29](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/0729c293f9302a4dc1e0bcef849d1d971ed41f7a))
* **web-panel:** PageHeader unificado en empleados/asistencia/sucursales/dispositivos ([840e105](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/840e105c95d6662f8abf3020d35b55b3962ffffd))
* **web-panel:** Realtime granular + revalidate ajustado a 5 min ([0c7f839](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/0c7f839c6326c81ad34349082210562f4cba74a2))
* **web-panel:** sistema Card + StatCard premium con stagger animation ([1e31ab9](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/1e31ab97e6b3ca3575954f92b21b59e6ae38d26a))
* **web-panel:** sucursales — cards premium con stats inline ([c2e3da7](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/c2e3da74405c512281183985c45be7965033dc62))
* **web-panel:** toasts de feedback en mutations (empleados + dispositivos) ([fa53189](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/fa53189b8850320fb9b6e737b1b33fcd09bcd02b))


### ⚡ Performance

* **web-panel:** extraer modales pesados de dispositivos a dynamic imports ([8534ea4](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/8534ea42f04af6b9dfd79ff5ea210be5a583a1bc))
* **web-panel:** prefetch agresivo + breakpoints tablet/movil ([a37cfbc](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/a37cfbc8dc56119baeb8e0f62673841aea26a773))
* **web-panel:** Realtime granular con debounce en dashboard ([53db2f9](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/53db2f9c494098686bcf326236212d9ed6e4e6b5))


### ♻️ Refactors

* **web-panel:** mapeo CSS vars -&gt; Tailwind + sidebar logout button POC ([4a21a4b](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/4a21a4b1a80b6702a1951bb8b94394a62ebee223))
* **web-panel:** remover campanita del sidebar — la seccion /notificaciones cubre el caso ([2cfdb7f](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/2cfdb7f2bd5fc62c32afaadd4401b53b60711f1c))
