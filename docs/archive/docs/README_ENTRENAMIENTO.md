# Sistema de Entrenamiento y Reconocimiento

## ¿Cómo funciona?

El sistema funciona en **2 pasos**:

### 1. **ENTRENAMIENTO** (Registro de fotos)
Cuando ejecutas `registrar_fotos.py`, el sistema:
- ✅ Lee todas las fotos de `database_fotos/`
- ✅ YOLO detecta la persona en cada foto
- ✅ Extrae **embeddings** (características únicas) de cada persona
- ✅ Guarda los embeddings en disco

**Esto es como "enseñarle" al sistema quién es cada trabajador.**

### 2. **RECONOCIMIENTO** (Uso en tiempo real)
Cuando usas la aplicación:
- ✅ YOLO detecta personas en la cámara
- ✅ Extrae el embedding de la persona detectada
- ✅ Compara ese embedding con todos los embeddings registrados
- ✅ Si encuentra un match (similitud >= 60%), muestra la información

## Comandos

### Paso 1: Entrenar/Registrar fotos
```powershell
cd app_loginTrabajadores_desktop_pyqt
python registrar_fotos.py
```

Esto debe mostrar:
```
📸 Encontradas 5 fotos para registrar
✅ Registrado: photo_1.jpg -> embedding_idx=0, employee_id=1
✅ Registrado: photo_2.jpg -> embedding_idx=1, employee_id=2
...
✅ 5 fotos registradas exitosamente
```

### Paso 2: Usar la aplicación
```powershell
python main.py
```

## Verificación

Para verificar que el entrenamiento funcionó, revisa:
1. **Consola al iniciar**: Debe decir `✅ X embedding(s) de hoy cargados`
2. **Al mostrar foto**: Debe aparecer información de debug con similitudes
3. **En la UI**: Debe mostrar nombre, zona, sucursal, puesto cuando detecta

## Solución de problemas

### Si no detecta:
1. **Verifica que las fotos estén registradas:**
   - Ejecuta `python registrar_fotos.py` de nuevo
   - Debe mostrar "✅ X fotos registradas"

2. **Revisa la consola cuando muestras la foto:**
   - Busca `[DEBUG] Similitud con trabajador X: 0.XXX`
   - Si todas las similitudes son < 0.3, el sistema no está reconociendo

3. **Asegúrate de usar la misma foto:**
   - Si registraste `photo_1.jpg`, muestra esa misma foto frente a la cámara
   - O muestra tu rostro si eres la persona de esa foto

### Mejorar precisión:
- Instala `torchreid` para usar OSNet (más preciso que histogramas):
  ```powershell
  pip install torchreid
  ```
- Registra múltiples fotos del mismo trabajador desde diferentes ángulos
- Asegúrate de buena iluminación al registrar y al reconocer

