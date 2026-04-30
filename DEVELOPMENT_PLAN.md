# 🚀 Plan de Desarrollo: Safe Link Attendance System

Este plan ha sido actualizado tras el análisis exhaustivo del código actual y la revisión del documento técnico `app_loginTrabajadores.pdf`. El objetivo es consolidar el sistema de escritorio (PyQt5 + SFace) y eliminar el "ruido" de archivos obsoletos.

## 📋 Estado Actual
- **Motor Principal:** OpenCV DNN (YuNet + SFace) con 100% de precisión teórica.
- **Base de Datos:** 56 empleados (JSON + fotos).
- **Problema Detectado:** Estructura de archivos desordenada, dependencias externas frágiles y código "basura" (NextJS, scripts antiguos).

---

## 🛠️ Fase 1: Limpieza Profunda y Consolidación (COMPLETADO ✅)
El objetivo era dejar el repositorio "limpio" para trabajar solo en lo que importa.

- [x] **Eliminación de Proyectos Web Obsoletos:**
  - Movidos a `backup_obsoleto/`.
- [x] **Limpieza de Scripts de Entrenamiento antiguos:**
  - Movidos a `backup_obsoleto/` y `tools/`.
- [x] **Purga de Archivos de Datos:**
  - Consolidado en `database_fotos/` y `data/`.

## 🏗️ Fase 2: Refactorización y Autonomía Técnica
Hacer que el proyecto sea autosuficiente y fácil de mantener.

- [ ] **Corrección de Importaciones:**
  - Refactorizar `src/utils/face_recognition.py` para eliminar dependencias de rutas externas (`../app_loginTrabajadores/backend`).
  - Asegurar que todos los módulos busquen recursos dentro de `src/` o `database_fotos/`.
- [ ] **Estandarización de Rutas:**
  - Implementar una clase `Config` o `Paths` en `src/utils/config.py` para centralizar la ubicación de modelos ONNX y base de datos.
- [ ] **Optimización del Hilo de Reconocimiento:**
  - Ajustar el `RecognitionThread` para manejar mejor los errores de cámara sin colapsar la UI.

## 💎 Fase 3: Mejoras Premium y UX
Basado en el documento `MEJORAS_PREMIUM.md` y los estándares de diseño de alta calidad.

- [ ] **Pulido Visual (PyQt5):**
  - Mejorar las animaciones de `QPainter` en el Splash y Login.
  - Implementar un "Modo Oscuro Premium" con gradientes más suaves.
- [ ] **Feedback de Reconocimiento:**
  - Agregar un overlay visual (bounding box) sobre el video que cambie de color según la confianza (Amarillo -> Detectado, Verde -> Reconocido).
- [ ] **Gestión de Sesión:**
  - Implementar persistencia de sesión opcional para el administrador.

## 📊 Fase 4: Reportes y Sincronización
Asegurar que la asistencia se registre y visualice correctamente.

- [ ] **Validación de Registro:**
  - Testear el flujo completo: Reconocimiento -> Registro en SQLite -> Sincronización con Supabase.
- [ ] **Visor de Asistencias:**
  - Crear una pestaña pequeña en el Dashboard o una ventana nueva para ver los últimos registros del día localmente.
- [ ] **Exportación:**
  - Funcionalidad para exportar el log de asistencia local a CSV/PDF.

---

## 🚦 Próximos Pasos Sugeridos
1. **Corregir las importaciones rotas** (Phase 2).
2. **Validar el entrenamiento final** con `train_face_recognition_opencv.py`.
3. **Comenzar con el pulido visual** de la interfaz (Phase 3).
