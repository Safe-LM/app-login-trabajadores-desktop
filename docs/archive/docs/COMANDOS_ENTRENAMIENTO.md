# 📋 Comandos para Entrenar el Modelo - Orden Exacto

## 🎯 Orden de Ejecución

### Paso 1: Abrir PowerShell y navegar a la carpeta
```powershell
cd C:\Users\Alfonso\Documents\Trabao_Seguridad\app_loginTrabajadores_desktop_pyqt
```

### Paso 2: Activar el entorno virtual
```powershell
.\venv\Scripts\activate
```

Deberías ver `(venv)` al inicio de la línea.

### Paso 3: Instalar dependencias (si no están instaladas)
```powershell
pip install torch torchvision scikit-learn
```

**Nota**: Si ya las tienes instaladas, puedes saltar este paso.

### Paso 4: Verificar que tienes las fotos
```powershell
dir database_fotos\*.jpg
```

Deberías ver tus fotos: `photo_1.jpg`, `photo_2.jpg`, etc.

### Paso 5: Entrenar el modelo

**OPCIÓN A: Entrenamiento Automático (rápido)**
```powershell
python train_face_model.py
```

**OPCIÓN B: Entrenamiento Interactivo (recomendado)**
```powershell
python train_face_model_interactive.py
```

**Ventajas del modo interactivo:**
- ✅ Seleccionas la cara manualmente en cada foto
- ✅ Puedes agregar múltiples caras por persona (diferentes ángulos, con/sin lentes, etc.)
- ✅ Más flexible para cambios de apariencia
- ✅ Mejor precisión

Este comando:
- ✅ Analiza todas las fotos
- ✅ Las organiza por empleado
- ✅ Muestra información de cada empleado
- ✅ Entrena el modelo (toma 5-10 minutos)
- ✅ Guarda el modelo en `models/face_recognition_model.pt`

### Paso 6: Verificar que el modelo se creó
```powershell
dir models\
```

Deberías ver:
- `face_recognition_model.pt`
- `employee_metadata.json`
- `model_info.txt`

## ✅ ¡Listo!

El modelo está entrenado y listo para usar.

---

## 🔄 Si algo sale mal

### Si dice "No se encontró el modelo YOLO":
```powershell
# Verificar que yolo11s.pt existe
dir yolo11s.pt
```

### Si dice "No se encontraron fotos":
```powershell
# Verificar que las fotos están en database_fotos
dir database_fotos\*.jpg
```

### Si dice "Se necesitan al menos 2 empleados":
- Necesitas mínimo 2 fotos de diferentes empleados
- Verifica que tengas `photo_1.jpg`, `photo_2.jpg`, etc.

### Si el entrenamiento es muy lento:
- Es normal, toma 5-10 minutos
- Si tienes GPU, se usará automáticamente
- Si no, usará CPU (más lento pero funciona)

---

## 📝 Resumen Rápido (Copy-Paste)

```powershell
# 1. Navegar
cd C:\Users\Alfonso\Documents\Trabao_Seguridad\app_loginTrabajadores_desktop_pyqt

# 2. Activar venv
.\venv\Scripts\activate

# 3. Instalar dependencias (solo la primera vez)
pip install torch torchvision scikit-learn

# 4. Entrenar
python train_face_model.py
```

