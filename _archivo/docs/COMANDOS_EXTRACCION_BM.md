# 📸 Extracción de Fotos del PDF "PERSONAL TIENDAS BM.pdf"

Este script extrae las fotos del PDF y las asocia automáticamente con la información de los empleados del CSV.

## 🚀 Pasos para Extraer Fotos

### Paso 1: Extraer Información de Empleados del PDF

Si aún no tienes el CSV con la información de empleados:

```powershell
cd C:\Users\Alfonso\Documents\Trabao_Seguridad\app_loginTrabajadores_desktop_pyqt
.\venv\Scripts\activate
python extract_employees_from_pdf.py
```

Esto creará `employees_from_pdf.csv` con toda la información de empleados.

### Paso 2: Extraer Fotos del PDF

Ejecuta el script mejorado que extrae las fotos y las asocia con los empleados:

```powershell
python extract_photos_from_pdf_bm.py
```

Este script:
1. ✅ Verifica que el PDF "PERSONAL TIENDAS BM.pdf" exista
2. ✅ Extrae la información de empleados si no existe el CSV
3. ✅ Extrae todas las imágenes del PDF usando PyMuPDF
4. ✅ Filtra las imágenes que contienen caras usando YOLO
5. ✅ Asocia cada foto con el `employee_id` correspondiente del CSV
6. ✅ Guarda las fotos en `database_fotos/` como `photo_1.jpg`, `photo_2.jpg`, etc.

### Paso 3: Verificar las Fotos

Las fotos se guardan en:
```
app_loginTrabajadores_desktop_pyqt/database_fotos/
```

Cada foto se nombra según el `employee_id` del CSV:
- `photo_1.jpg` → Primer empleado del CSV
- `photo_2.jpg` → Segundo empleado del CSV
- etc.

### Paso 4: Entrenar el Modelo

Una vez que las fotos estén extraídas y asociadas:

```powershell
python train_face_model_auto.py
```

## 📋 Estructura del CSV

El CSV `employees_from_pdf.csv` tiene esta estructura:

```csv
employee_id,nombre,zona,sucursal,puesto
1,ORTIZ ROCHA MARILU,CDMX,TIENDAS,SUPERVISOR
2,GARCIA VILLANUEVA GERSOM UZZIEL,CDMX,TIENDAS,GERENTE
3,HERNANDEZ CHAIRES MARITZA MONSERRAT,CDMX,MIRAMONTES,ENCARGADA
...
```

## ⚠️ Notas Importantes

1. **Orden de las fotos**: Las fotos se asocian con los empleados en el mismo orden que aparecen en el CSV
2. **Filtrado de caras**: El script usa YOLO para detectar si una imagen contiene una cara de persona
3. **Imágenes pequeñas**: Se filtran automáticamente imágenes muy pequeñas (probablemente iconos/logos)
4. **Sobrescritura**: Si una foto ya existe, se sobrescribe automáticamente

## 🔍 Solución de Problemas

### Error: "No se encontró el PDF"
- Verifica que el archivo `PERSONAL TIENDAS BM.pdf` esté en la carpeta del proyecto
- El script buscará automáticamente PDFs en la carpeta

### Error: "YOLO no disponible"
- El script intentará descargar el modelo YOLO automáticamente
- Si falla, guardará todas las imágenes sin filtrar

### Error: "No se pudieron extraer imágenes"
- Verifica que PyMuPDF esté instalado: `pip install PyMuPDF`
- Algunos PDFs pueden tener las imágenes encriptadas o en formato especial

### Las fotos no coinciden con los empleados
- Verifica que el orden de las fotos en el PDF coincida con el orden en el CSV
- Si no coincide, puedes renombrar manualmente las fotos o ajustar el CSV

## ✅ Verificación

Después de ejecutar el script, deberías ver:

```
[OK] EXTRACCION DE FOTOS COMPLETADA
Total fotos guardadas: XX
Total empleados en CSV: XX
```

Y en la carpeta `database_fotos/` deberías tener:
- `photo_1.jpg`
- `photo_2.jpg`
- `photo_3.jpg`
- etc.

