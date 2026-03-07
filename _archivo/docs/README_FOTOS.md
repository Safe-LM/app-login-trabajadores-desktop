# Base de Datos de Fotos

## Estructura

La aplicación utiliza una carpeta `database_fotos/` para almacenar las fotos de los trabajadores que se usan para el reconocimiento facial.

## Procesamiento Automático

1. **Al iniciar el dashboard:**
   - La aplicación busca fotos en la carpeta `photos/` (carpeta raíz del proyecto)
   - Convierte automáticamente archivos WMF a JPG
   - Los guarda en `database_fotos/`

2. **Formato de archivos:**
   - Las fotos se procesan de WMF a JPG automáticamente
   - Se mantienen los nombres originales (photo_1.wmf -> photo_1.jpg)

## Reconocimiento Automático

El sistema funciona de la siguiente manera:

1. **Activación de cámara:**
   - El trabajador activa la cámara
   - YOLO detecta personas en el frame
   - OSNet extrae embeddings y compara con la base de datos

2. **Reconocimiento exitoso:**
   - Si la confianza es >= 90%, se registra automáticamente
   - Se determina si es entrada o salida (basado en el último registro del día)
   - Se muestra mensaje de confirmación

3. **Cierre automático:**
   - Después de 3 segundos, la sesión se cierra automáticamente
   - El trabajador vuelve a la pantalla de login

## Procesar Fotos Manualmente

Si necesitas procesar las fotos manualmente:

```powershell
python setup_fotos.py
```

Esto procesará todas las fotos WMF de la carpeta `photos/` y las guardará en `database_fotos/`.

## Notas

- Las fotos deben estar en formato WMF, JPG o PNG
- El sistema usa YOLO para detectar personas y OSNet para reconocimiento
- La confianza mínima para registro automático es 90%
- El sistema evita múltiples registros con la bandera `attendance_registered`

