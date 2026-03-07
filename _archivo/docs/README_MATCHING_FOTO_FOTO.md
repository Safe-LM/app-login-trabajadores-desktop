# 📸 Sistema de Matching Foto a Foto - Guía de Uso

## 🎯 Descripción

Sistema robusto para reconocer trabajadores cuando muestran una foto enfrente de la cámara. El sistema hace match directo entre la foto mostrada y las fotos de la base de datos.

## ✨ Características

- ✅ **Matching directo foto a foto** - Compara directamente la foto mostrada con la BD
- ✅ **Múltiples métodos de detección** - Usa Haar Cascade y DNN Face Detector
- ✅ **Múltiples algoritmos de matching** - face_recognition + OpenCV HOG
- ✅ **Preprocesamiento avanzado** - Normalización, CLAHE, reducción de ruido
- ✅ **Sistema de consenso** - Combina resultados de múltiples métodos
- ✅ **Cache inteligente** - Almacena encodings para velocidad
- ✅ **Integración con Gemini Vision** (opcional) - Usa IA avanzada para matching

## 🚀 Uso Básico

### 1. Uso Automático (Integrado en Dashboard)

El sistema ya está integrado en `dashboard_window.py` y se ejecuta automáticamente como **PRIORIDAD 0** (más alta).

Solo necesitas:
1. Abrir la aplicación
2. Activar la cámara
3. Mostrar una foto enfrente de la cámara
4. El sistema detectará y hará match automáticamente

### 2. Uso Programático

```python
from utils.photo_to_photo_matcher import match_photo_from_frame
import cv2

# Capturar frame de la cámara
cap = cv2.VideoCapture(0)
ret, frame = cap.read()

# Hacer match
matched, confidence, employee_info = match_photo_from_frame(
    frame,
    min_confidence=0.75,  # Umbral de confianza
    database_dir=None  # Usa el directorio por defecto
)

if matched:
    print(f"✅ Match encontrado: {employee_info['nombre']}")
    print(f"   Confianza: {confidence*100:.1f}%")
    print(f"   Zona: {employee_info['zona']}")
    print(f"   Sucursal: {employee_info['sucursal']}")
    print(f"   Puesto: {employee_info['puesto']}")
else:
    print("❌ No se encontró match")
```

## 🔧 Configuración

### Umbral de Confianza

El umbral por defecto es `0.75` (75%). Puedes ajustarlo:

- **0.70-0.75**: Más permisivo (puede tener falsos positivos)
- **0.75-0.80**: Balanceado (recomendado)
- **0.80-0.85**: Más estricto (menos falsos positivos, puede perder algunos matches)

### Base de Datos

El sistema busca automáticamente en:
```
app_loginTrabajadores_desktop_pyqt/database_fotos/
├── json/
│   └── employees_db.json
└── photos/
    └── photo_*.jpeg
```

## 🌟 Integración con Gemini Vision (Opcional)

Para usar Gemini Vision API (más preciso pero requiere API key):

### 1. Obtener API Key

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una API key
3. Guarda la key

### 2. Configurar

**Opción A: Variable de entorno (recomendado)**
```bash
# Windows PowerShell
$env:GEMINI_API_KEY="tu-api-key-aqui"

# Linux/Mac
export GEMINI_API_KEY="tu-api-key-aqui"
```

**Opción B: En el código**
```python
from utils.gemini_vision_matcher import match_with_gemini

matched, confidence, employee_info = match_with_gemini(
    frame,
    api_key="tu-api-key-aqui",
    min_confidence=0.85
)
```

### 3. Usar en Dashboard

Para habilitar Gemini en el dashboard, agrega en `dashboard_window.py`:

```python
# En _do_recognition, después de matching foto-foto:
try:
    from utils.gemini_vision_matcher import match_with_gemini
    reconocido, confianza, info_empleado = match_with_gemini(frame)
    if reconocido and info_empleado:
        self.results_ready.emit(True, confianza, info_empleado, "Gemini Vision")
        return
except Exception:
    pass
```

## 📊 Métodos de Detección

### 1. Haar Cascade (Rápido)
- ✅ Muy rápido
- ✅ Funciona bien con buena iluminación
- ⚠️ Puede fallar con ángulos extremos

### 2. DNN Face Detector (Preciso)
- ✅ Más preciso
- ✅ Mejor con diferentes ángulos
- ⚠️ Requiere modelo DNN (se descarga automáticamente si está disponible)

## 🔍 Métodos de Matching

### 1. face_recognition (Recomendado)
- ✅ Muy preciso (128 dimensiones)
- ✅ Basado en deep learning
- ⚠️ Requiere instalar `face_recognition` (opcional)

**Instalación:**
```bash
pip install face-recognition
```

### 2. OpenCV HOG + Histogramas
- ✅ Siempre disponible (no requiere dependencias extra)
- ✅ Rápido
- ⚠️ Menos preciso que face_recognition

## 🛠️ Solución de Problemas

### "No se detectó rostro"
- ✅ Asegúrate de que la foto esté bien iluminada
- ✅ La foto debe mostrar claramente el rostro
- ✅ Intenta acercar/alejar la foto
- ✅ Verifica que la cámara esté funcionando

### "No se encontró match"
- ✅ Verifica que el empleado esté en la BD (`employees_db.json`)
- ✅ Verifica que la foto del empleado exista en `database_fotos/photos/`
- ✅ Intenta reducir el `min_confidence` (ej: 0.70)
- ✅ Asegúrate de que la foto mostrada sea de buena calidad

### "Error cargando BD de empleados"
- ✅ Verifica que `database_fotos/json/employees_db.json` exista
- ✅ Verifica que el JSON sea válido
- ✅ Verifica permisos de lectura

### "PyTorch no disponible"
- ⚠️ Esto es normal si no tienes PyTorch instalado
- ✅ El sistema funciona sin PyTorch (usa métodos alternativos)
- ✅ Para instalar: `pip install torch torchvision`

## 📈 Mejores Prácticas

1. **Iluminación**: Usa buena iluminación cuando muestres la foto
2. **Calidad de foto**: Usa fotos de buena calidad (alta resolución)
3. **Estabilidad**: Mantén la foto estable frente a la cámara
4. **Tamaño**: La foto debe ocupar al menos 1/4 del frame
5. **Ángulo**: Muestra la foto de frente, no en ángulo

## 🔄 Flujo del Sistema

```
Frame de Cámara
    ↓
Preprocesamiento (CLAHE, denoise)
    ↓
Detección de Rostro (Haar Cascade / DNN)
    ↓
Extracción de Características
    ├─ face_recognition (si disponible)
    └─ OpenCV HOG + Histogramas
    ↓
Comparación con BD
    ├─ Carga encoding de empleado (con cache)
    ├─ Comparación coseno
    └─ Cálculo de confianza
    ↓
Sistema de Consenso
    ├─ Promedio ponderado
    └─ Validación de umbral
    ↓
Resultado: (matched, confidence, employee_info)
```

## 📝 Notas Técnicas

- El sistema usa **cache** para almacenar encodings de empleados (más rápido en siguientes búsquedas)
- El **preprocesamiento** mejora significativamente la detección
- El **sistema de consenso** combina múltiples métodos para mayor robustez
- Los **umbrales** son ajustables según tus necesidades

## 🎯 Próximas Mejoras

- [ ] Segmentación de rostros más avanzada
- [ ] Soporte para múltiples rostros en una foto
- [ ] Validación de calidad de imagen antes de matching
- [ ] Sistema de aprendizaje continuo
- [ ] Integración con más APIs de visión (OpenAI, etc.)

