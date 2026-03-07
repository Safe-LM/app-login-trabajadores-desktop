# 🚀 Sistema de Reconocimiento Facial Ligero

## ✨ Ventajas

- ✅ **No requiere PyTorch** - Evita problemas de DLL
- ✅ **Más ligero** - Menor uso de memoria
- ✅ **Más rápido** - Inicio más rápido
- ✅ **Más fácil de entrenar** - Un solo comando
- ✅ **Más estable** - Menos dependencias

## 📦 Instalación

```powershell
cd app_loginTrabajadores_desktop_pyqt
.\venv\Scripts\activate
pip install face-recognition
```

**Nota**: `face-recognition` requiere `dlib`, que puede tardar un poco en compilar. Si tienes problemas, instala una versión precompilada:

```powershell
pip install dlib
pip install face-recognition
```

## 🎯 Entrenamiento

### Paso 1: Entrenar el modelo

```powershell
python train_face_recognition_light.py
```

Este script:
- ✅ Lee las fotos de `database_fotos/photos/`
- ✅ Extrae encodings faciales usando `face_recognition`
- ✅ Asocia cada encoding con el `employee_id` del JSON
- ✅ Guarda todo en `database_fotos/face_encodings.pkl`

### Paso 2: Ejecutar la aplicación

```powershell
python main.py
```

El sistema automáticamente:
1. **Primero** intenta usar el sistema ligero (face_recognition)
2. Si no está disponible, usa el modelo entrenado (.pt)
3. Si tampoco está disponible, usa el sistema de embeddings

## 📊 Comparación de Sistemas

| Característica | Sistema Ligero | Modelo .pt | Embeddings |
|---------------|----------------|------------|------------|
| Requiere PyTorch | ❌ No | ✅ Sí | ⚠️ Opcional |
| Velocidad | ⚡⚡⚡ Muy rápido | ⚡⚡ Rápido | ⚡ Normal |
| Precisión | ⭐⭐⭐⭐ Alta | ⭐⭐⭐⭐⭐ Muy alta | ⭐⭐⭐ Media |
| Facilidad de entrenar | ⭐⭐⭐⭐⭐ Muy fácil | ⭐⭐ Media | ⭐⭐⭐ Fácil |
| Tamaño | 📦 Pequeño | 📦📦 Mediano | 📦 Pequeño |

## 🔧 Solución de Problemas

### Error: "face_recognition library no está instalada"

```powershell
pip install face-recognition
```

### Error al instalar dlib

En Windows, intenta:

```powershell
pip install cmake
pip install dlib
pip install face-recognition
```

O descarga una versión precompilada de dlib desde:
https://github.com/z-mahmud22/Dlib_Windows_Python3.x

### No detecta caras en las fotos

- Asegúrate de que las fotos tengan buena calidad
- Las fotos deben mostrar claramente el rostro
- Evita fotos muy oscuras o borrosas

## 💡 Recomendación

**Usa el sistema ligero** si:
- ✅ Quieres evitar problemas con PyTorch
- ✅ Necesitas algo rápido y fácil
- ✅ Tienes fotos de buena calidad

**Usa el modelo .pt** si:
- ✅ Necesitas máxima precisión
- ✅ Tienes PyTorch funcionando correctamente
- ✅ Tienes muchas fotos de entrenamiento

