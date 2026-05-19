# Changelog

## [5.6.8](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.6.7...station-v5.6.8) (2026-05-19)


### 🐛 Correcciones

* **station:** mejorar fluidez y calidad visual del feed de camara ([6919cbc](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/6919cbcad3eb59c018bdad0053ef5be19e2ad430))

## [5.6.7](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.6.6...station-v5.6.7) (2026-05-18)


### 🐛 Correcciones

* **station:** telemetria remota del reconocimiento + fix race del status ([890fbdc](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/890fbdc2b3345a48b1e44df67052df5c7d94e23a))

## [5.6.6](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.6.5...station-v5.6.6) (2026-05-14)


### 🐛 Correcciones

* **station:** eliminar pre-filtro Haar y agregar telemetria al recognizer ([c561678](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/c5616784ce7e679a0ffa87da176489b6541cea53))

## [5.6.5](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.6.4...station-v5.6.5) (2026-05-13)


### 🐛 Correcciones

* **station:** garantizar arranque del thread de reconocimiento facial ([9b79490](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/9b79490f3214a74f3ba9399f7388d4ed5f93c02e))

## [5.6.4](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.6.3...station-v5.6.4) (2026-05-12)


### 🐛 Correcciones

* **station:** relajar quality gate del recognizer para webcams en kiosko ([99b2e47](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/99b2e47e03d224647a8c934a7932e16e5f33f7ec))

## [5.6.3](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.6.2...station-v5.6.3) (2026-05-12)


### 🐛 Correcciones

* **station,db:** RPC get_embeddings_empresa para bypassear RLS bloqueante ([5982739](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/59827393b98f13c02482dd5cf5f9d267e0810182))

## [5.6.2](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.6.1...station-v5.6.2) (2026-05-12)


### 🐛 Correcciones

* **station,db:** auto-healing + observabilidad del download de embeddings ([fd1502c](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/fd1502c450fa5532ead160905837631d6347db62))

## [5.6.1](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.6.0...station-v5.6.1) (2026-05-12)


### 🐛 Correcciones

* **station:** UI se ve diferente en .exe — frontend/dist no se encontraba ([28eda9b](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/28eda9bfa6d0345a4945019388f2ff6c05739b99))

## [5.6.0](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.5.0...station-v5.6.0) (2026-05-12)


### ✨ Nuevas funcionalidades

* **station,db:** Sprint A — 7 quick wins de robustez del pipeline facial ([5e9351d](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/5e9351d4f59288cf62a3d66b3d24dac0f420a7b9))

## [5.5.0](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.4.1...station-v5.5.0) (2026-05-11)


### ✨ Nuevas funcionalidades

* **web-panel,station:** comando forzar_reenroll por empleado (S2.2) ([d82c3c5](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/d82c3c5be9592dcb13262eac285d28c22c8e9ca7))

## [5.4.1](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.4.0...station-v5.4.1) (2026-05-11)


### ⚡ Performance

* **ci:** reducir consumo de GitHub Actions ~80% ([d29a877](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/d29a877070ef7928f550835098a8067adba1de66))

## [5.4.0](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.3.5...station-v5.4.0) (2026-05-11)


### ✨ Nuevas funcionalidades

* **web-panel:** audit log, sprints 2-4 + training debug visibility ([fe10b75](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/fe10b75ddf2b8adc132b9d3212c2016ab9d77f23))

## [5.3.5](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.3.4...station-v5.3.5) (2026-05-10)


### 🐛 Correcciones

* **station:** forzar bump a 5.3.5 con todos los fixes acumulados ([9914ee9](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/9914ee91bc6700fbe0d500daf4d875aa6d53dfcd))
* **station:** hardening del .exe instalado en Program Files ([66ba80e](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/66ba80eff09613ccaaac814006a65998aac1e5bf))

## [5.3.4](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.3.3...station-v5.3.4) (2026-05-10)


### 🐛 Correcciones

* **station:** heartbeat reportaba version hardcodeada 3.0.0 al panel ([74d2fb5](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/74d2fb56d3165bd06045f9eaffc7022c562e4cfc))

## [5.3.3](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.3.2...station-v5.3.3) (2026-05-10)


### 🐛 Correcciones

* **station:** HUD del video (esquinas + scan line) no se renderizaba ([bacf0fd](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/bacf0fdca0535ed9e2387c651b4bb54df169698c))

## [5.3.2](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.3.1...station-v5.3.2) (2026-05-10)


### 🐛 Correcciones

* **station:** permission denied al sincronizar en build instalado ([e1ed9e5](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/e1ed9e5bdc67590fe56c6390e4e65dfb91a12981))

## [5.3.1](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.3.0...station-v5.3.1) (2026-05-10)


### 🐛 Correcciones

* **station:** video se renderiza con bandas grises en build empaquetado ([24ea760](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/24ea760c961abd193ca0f145c14ceabeeedfc95b))

## [5.3.0](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.2.3...station-v5.3.0) (2026-05-10)


### ✨ Nuevas funcionalidades

* **station:** helper get_short_version() para mostrar version compacta ([206b8cd](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/206b8cd7a443289015c8f91fc335542badfb2018))

## [5.2.3](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.2.2...station-v5.2.3) (2026-05-10)


### 🐛 Correcciones

* **web-panel:** test scope path scoping ([f8cf9a2](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/f8cf9a2e3ac4dd0b138438e90b4e19428cfa8230))

## [5.2.2](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.2.1...station-v5.2.2) (2026-05-10)


### 🐛 Correcciones

* **web-panel:** test del flujo de release del panel ([25f86e2](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/25f86e204c492e28b8210235319f662740e03328))

## [5.2.1](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.2.0...station-v5.2.1) (2026-05-10)


### 🐛 Correcciones

* **installer:** compactar layout del wizard para que todos los campos quepan ([cf6caf4](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/cf6caf4253b5f9b78b3e26876df9b409cef2f3fd))

## [5.2.0](https://github.com/Safe-LM/app-login-trabajadores-desktop/compare/station-v5.1.0...station-v5.2.0) (2026-05-10)


### ✨ Nuevas funcionalidades

* **ci:** release-please en manifest mode con station + web-panel ([4cd0891](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/4cd0891cadf4487fad664bd6a6dc455426138ff7))
* **station:** build info embebido (version + commit + fecha) en .exe ([a1c19a3](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/a1c19a35bef74ba18b586801dded317af4fd71f8))


### 🐛 Correcciones

* **installer:** NSIS APP_VERSION ahora se puede sobrescribir desde CLI ([920367c](https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/920367c0d14f91cb26692c5903278e212876d45a))
