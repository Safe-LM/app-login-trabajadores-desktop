# ⚡ Guía Rápida de Entrenamiento

## 🎯 ¿Qué hace?

Entrena un modelo `.pt` que reconoce directamente a tus empleados con su información (zona, sucursal, puesto).

## 📝 Pasos Rápidos

### 1. Asegúrate de tener las fotos
```
database_fotos/
├── photo_1.jpg  (Empleado 1)
├── photo_2.jpg  (Empleado 2)
├── photo_3.jpg  (Empleado 3)
└── ...
```

### 2. Ejecuta el entrenamiento
```powershell
cd app_loginTrabajadores_desktop_pyqt
.\venv\Scripts\activate
python train_face_model.py
```

### 3. Espera a que termine
El proceso:
- ✅ Analiza cada foto
- ✅ Muestra información de cada empleado
- ✅ Entrena el modelo (50 épocas, ~5-10 minutos)
- ✅ Guarda el modelo en `models/face_recognition_model.pt`

### 4. ¡Listo!
El modelo está guardado y listo para usar.

## 📊 Lo que verás

```
📋 Cargando datos de empleados...
📁 Organizando fotos por empleado...
✅ Encontrados 5 empleados con fotos

👤 Empleado 1: Juan Pérez
   Zona: CDMX
   Sucursal: Odara Lindavista
   Puesto: GERENTE
   Fotos: 1
  ✅ Procesada: photo_1.jpg

...

🚀 INICIANDO ENTRENAMIENTO DEL MODELO
📊 Datos de entrenamiento: 4
📊 Datos de validación: 1
🖥️  Usando dispositivo: cpu

Epoch [1/50] - Train Loss: 1.2345, Train Acc: 50.00% - Val Loss: 1.1234, Val Acc: 100.00%
  ✅ Nuevo mejor modelo guardado (Val Acc: 100.00%)
...

✅ Entrenamiento completado. Mejor precisión de validación: 95.00%
💾 Modelo guardado: models/face_recognition_model.pt
💾 Metadatos guardados: models/employee_metadata.json
```

## 🎉 Resultado

Después tendrás:
- `models/face_recognition_model.pt` - El modelo entrenado
- `models/employee_metadata.json` - Información de empleados
- `models/model_info.txt` - Resumen del entrenamiento

## 💡 Tips

- **Más fotos = Mejor precisión**: Usa 3-5 fotos por empleado si es posible
- **Fotos de calidad**: Buena iluminación, rostro completo visible
- **Paciencia**: El entrenamiento toma tiempo (5-10 minutos)

## ❓ Problemas?

- **"No se encontraron fotos"**: Verifica que las fotos estén en `database_fotos/`
- **"Se necesitan al menos 2 empleados"**: Necesitas mínimo 2 empleados diferentes
- **Baja precisión**: Agrega más fotos por empleado y re-entrena

