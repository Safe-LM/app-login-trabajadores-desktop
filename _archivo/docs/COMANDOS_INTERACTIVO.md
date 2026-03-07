# 🎯 Comandos para Entrenamiento

## 📋 Opción 1: Modo Automático (RÁPIDO - Recomendado)

```powershell
# 1. Navegar a la carpeta
cd C:\Users\Alfonso\Documents\Trabao_Seguridad\app_loginTrabajadores_desktop_pyqt

# 2. Activar entorno virtual
.\venv\Scripts\activate

# 3. Ejecutar entrenamiento automático (sin interacción)
python train_face_model_auto.py
```

**Ventajas:**
- ✅ Procesa todo automáticamente
- ✅ No necesitas presionar ESPACIO
- ✅ Más rápido
- ✅ Usa auto-detección de YOLO

## 📋 Opción 2: Modo Interactivo (Manual)

```powershell
# 1. Navegar a la carpeta
cd C:\Users\Alfonso\Documents\Trabao_Seguridad\app_loginTrabajadores_desktop_pyqt

# 2. Activar entorno virtual
.\venv\Scripts\activate

# 3. Ejecutar entrenamiento interactivo
python train_face_model_interactive.py
```

## ✅ Eso es todo!

Después de ejecutar el último comando:
- Se abrirá una ventana con cada foto
- Arrastra el mouse para seleccionar la cara
- Presiona **ESPACIO** para continuar
- Presiona **A** para usar auto-detección
- Presiona **R** para reiniciar selección
- Presiona **ESC** para cancelar esa foto

## 🎮 Controles en la Ventana

- **Arrastrar mouse**: Seleccionar área de la cara
- **ESPACIO**: Continuar con la selección
- **A**: Usar auto-detección (si está disponible)
- **R**: Reiniciar selección
- **ESC**: Cancelar esta foto

## 💡 Tips

- Puedes agregar **múltiples caras** de la misma foto
- Útil para diferentes ángulos, con/sin lentes, etc.
- El sistema te preguntará si quieres agregar otra cara

