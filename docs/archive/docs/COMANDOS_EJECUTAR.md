# 🚀 COMANDOS PARA EJECUTAR EL SISTEMA

## 📋 OPCIÓN 1: Usar Script Automático (RECOMENDADO)

### Windows PowerShell:
```powershell
cd app_loginTrabajadores_desktop_pyqt
.\iniciar.ps1
```

Este script:
- ✅ Verifica Python
- ✅ Crea/activa entorno virtual
- ✅ Instala dependencias
- ✅ Ejecuta la aplicación

---

## 📋 OPCIÓN 2: Comandos Manuales

### Paso 1: Navegar a la carpeta
```powershell
cd app_loginTrabajadores_desktop_pyqt
```

### Paso 2: Activar entorno virtual
```powershell
# Si ya existe venv
.\venv\Scripts\Activate.ps1

# Si NO existe venv, crearlo primero:
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Paso 3: Instalar dependencias básicas
```powershell
pip install -r requirements.txt
```

### Paso 4: Instalar dependencias opcionales (RECOMENDADO para mejor precisión)
```powershell
# face-recognition (mejora precisión del matching foto-foto)
pip install face-recognition

# requests (para Gemini Vision API - opcional)
pip install requests
```

### Paso 5: Ejecutar aplicación
```powershell
python main.py
```

---

## 🎯 COMANDOS RÁPIDOS (Todo en uno)

### Primera vez (instalar todo):
```powershell
cd app_loginTrabajadores_desktop_pyqt
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install face-recognition requests
python main.py
```

### Siguientes veces (solo ejecutar):
```powershell
cd app_loginTrabajadores_desktop_pyqt
.\venv\Scripts\Activate.ps1
python main.py
```

---

## ⚙️ CONFIGURACIÓN OPCIONAL: Gemini Vision API

Si quieres usar Gemini Vision para máxima precisión:

### 1. Obtener API Key
- Ve a: https://makersuite.google.com/app/apikey
- Crea una API key
- Cópiala

### 2. Configurar (PowerShell):
```powershell
$env:GEMINI_API_KEY="tu-api-key-aqui"
```

### 3. Ejecutar aplicación:
```powershell
python main.py
```

**Nota:** La API key se mantiene solo en esta sesión. Para hacerla permanente, agrega al archivo `.env` o configuración del sistema.

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Error: "No se puede ejecutar scripts"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Error: "Python no encontrado"
- Verifica que Python esté instalado: `python --version`
- Asegúrate de que Python esté en el PATH

### Error: "face-recognition no se instala"
```powershell
# Instalar dlib primero (requiere Visual Studio Build Tools)
pip install cmake
pip install dlib
pip install face-recognition
```

### Error: "Módulo no encontrado"
```powershell
# Reinstalar dependencias
pip install --upgrade -r requirements.txt
```

---

## 📊 VERIFICAR INSTALACIÓN

### Verificar que todo esté instalado:
```powershell
python -c "import cv2; print('OpenCV:', cv2.__version__)"
python -c "import torch; print('PyTorch:', torch.__version__)"
python -c "import face_recognition; print('face_recognition: OK')"
python -c "import requests; print('requests: OK')"
```

---

## 🎮 USO DE LA APLICACIÓN

1. **Iniciar aplicación**: Ejecuta `python main.py`
2. **Login**: Ingresa tus credenciales
3. **Activar cámara**: Click en "Activar Cámara"
4. **Mostrar foto**: Muestra una foto del trabajador enfrente de la cámara
5. **Match automático**: El sistema detectará y hará match automáticamente
6. **Ver información**: Se mostrará nombre, zona, sucursal, puesto del trabajador

---

## 📝 NOTAS IMPORTANTES

- ✅ El sistema funciona **sin** `face-recognition` (usa OpenCV)
- ✅ `face-recognition` **mejora la precisión** (recomendado)
- ✅ Gemini Vision es **opcional** (máxima precisión)
- ✅ El sistema tiene **fallback automático** si falta algo

---

## 🚀 COMANDO MÁS SIMPLE

**Solo ejecuta esto:**
```powershell
cd app_loginTrabajadores_desktop_pyqt
.\iniciar.ps1
```

¡Y listo! 🎉

