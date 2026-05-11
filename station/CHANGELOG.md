# Changelog

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
