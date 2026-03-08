"""
Entrenamiento de modelo de reconocimiento facial usando YOLO 11.
Entrena un modelo de clasificación de caras usando YOLO 11 directamente.
"""

import cv2
import numpy as np
from pathlib import Path
import json
from typing import Dict, List
import shutil


def load_employee_data(json_path: Path) -> Dict[int, Dict]:
    """Cargar datos de empleados desde JSON."""
    if not json_path.exists():
        print(f"❌ No se encontró el archivo JSON: {json_path}")
        return {}

    with open(json_path, "r", encoding="utf-8") as f:
        employees_list = json.load(f)

    employee_dict = {}
    for emp in employees_list:
        employee_id = emp.get("employee_id")
        if employee_id:
            employee_dict[employee_id] = {
                "nombre": emp.get("nombre", ""),
                "zona": emp.get("zona", ""),
                "sucursal": emp.get("sucursal", ""),
                "puesto": emp.get("puesto", ""),
                "photo_file": emp.get("photo_file", ""),
            }

    print(f"✅ Cargados {len(employee_dict)} empleados del JSON")
    return employee_dict


def prepare_yolo_dataset(database_fotos_dir: Path, output_dir: Path):
    """
    Preparar dataset para YOLO 11 en formato de clasificación.
    YOLO 11 puede hacer clasificación de imágenes directamente.
    """
    print("=" * 60)
    print("PREPARANDO DATASET PARA YOLO 11")
    print("=" * 60)
    print()

    # Cargar datos de empleados
    json_path = database_fotos_dir / "json" / "employees_db.json"
    employee_data = load_employee_data(json_path)

    if not employee_data:
        print("❌ No se encontraron datos de empleados")
        return False

    # Crear estructura de directorios para YOLO
    train_dir = output_dir / "train"
    val_dir = output_dir / "val"

    train_dir.mkdir(parents=True, exist_ok=True)
    val_dir.mkdir(parents=True, exist_ok=True)

    photos_dir = database_fotos_dir / "photos"

    if not photos_dir.exists():
        print(f"❌ No se encontró el directorio de fotos: {photos_dir}")
        return False

    # Organizar fotos por empleado
    photos_by_employee = {}
    for employee_id, emp_info in employee_data.items():
        photo_file = emp_info.get("photo_file", "")
        if photo_file:
            photo_name = Path(photo_file).name
            photo_path = photos_dir / photo_name

            if photo_path.exists():
                if employee_id not in photos_by_employee:
                    photos_by_employee[employee_id] = []
                photos_by_employee[employee_id].append(photo_path)

    print(f"📁 Encontradas fotos para {len(photos_by_employee)} empleados")
    print()

    # Crear directorios por clase (empleado)
    class_dirs_train = {}
    class_dirs_val = {}

    total_train = 0
    total_val = 0

    for employee_id, photo_files in sorted(photos_by_employee.items()):
        # Crear directorio para esta clase
        class_name = f"employee_{employee_id:04d}"
        class_train_dir = train_dir / class_name
        class_val_dir = val_dir / class_name

        class_train_dir.mkdir(exist_ok=True)
        class_val_dir.mkdir(exist_ok=True)

        class_dirs_train[employee_id] = class_train_dir
        class_dirs_val[employee_id] = class_val_dir

        # Dividir fotos: 80% train, 20% val
        # Si solo hay 1 foto, duplicarla para crear val (necesario para YOLO)
        if len(photo_files) == 1:
            # Para validación, duplicar la foto (YOLO necesita al menos algo en val)
            train_files = photo_files
            val_files = photo_files.copy()  # Duplicar para val
        else:
            split_idx = int(len(photo_files) * 0.8)
            train_files = photo_files[:split_idx] if split_idx > 0 else photo_files
            val_files = photo_files[split_idx:] if split_idx > 0 else []

        # Copiar fotos a directorios correspondientes
        for photo_file in train_files:
            dest = class_train_dir / photo_file.name
            shutil.copy2(photo_file, dest)
            total_train += 1

        for photo_file in val_files:
            # Si es la misma foto que train, usar nombre diferente para val
            if photo_file in train_files:
                val_name = f"val_{photo_file.name}"
            else:
                val_name = photo_file.name
            dest = class_val_dir / val_name
            shutil.copy2(photo_file, dest)
            total_val += 1

        emp_name = employee_data[employee_id].get("nombre", f"Empleado {employee_id}")
        print(f"✅ Empleado {employee_id:3d} ({class_name}): {emp_name}")
        print(f"   Train: {len(train_files)}, Val: {len(val_files)}")

    print()
    print("=" * 60)
    print(f"📊 Resumen:")
    print(f"   Total clases (empleados): {len(photos_by_employee)}")
    print(f"   Total imágenes train: {total_train}")
    print(f"   Total imágenes val: {total_val}")
    print("=" * 60)
    print()

    # YOLO 11 para clasificación NO usa archivo YAML, usa el directorio directamente
    # La estructura ya está lista: train/ y val/ con subdirectorios por clase
    print(f"✅ Dataset preparado en: {output_dir}")
    print(f"   Estructura: train/ y val/ con {len(photos_by_employee)} clases")
    print()

    # Guardar metadatos de empleados
    metadata_file = output_dir / "employee_metadata.json"
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(employee_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Metadatos guardados: {metadata_file}")
    print()

    return True


def train_yolo11_model(dataset_dir: Path, epochs: int = 100):
    """
    Entrenar modelo YOLO 11 para clasificación de caras.
    YOLO 11 para clasificación requiere un directorio directamente, no un archivo YAML.
    """
    print("=" * 60)
    print("ENTRENANDO MODELO YOLO 11")
    print("=" * 60)
    print()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics no está instalado")
        print("📦 Instálalo con: pip install ultralytics")
        return False

    # Verificar que el directorio existe
    train_dir = dataset_dir / "train"
    val_dir = dataset_dir / "val"

    if not train_dir.exists():
        print(f"❌ No se encontró el directorio de entrenamiento: {train_dir}")
        return False

    # Cargar modelo YOLO 11 para clasificación
    print("📦 Cargando modelo YOLO 11 (clasificación)...")
    try:
        # YOLO 11 para clasificación de imágenes
        model = YOLO("yolo11n-cls.pt")  # Modelo nano para clasificación (más ligero)
    except:
        try:
            # Si no está disponible, usar YOLOv8
            model = YOLO("yolov8n-cls.pt")
        except:
            print("❌ No se pudo cargar modelo YOLO para clasificación")
            print("📦 Descargando modelo...")
            model = YOLO("yolo11n-cls.pt")  # Intentar descargar automáticamente

    print(f"📝 Usando dataset: {dataset_dir}")
    print(f"   Train: {train_dir}")
    print(f"   Val: {val_dir}")
    print()

    # Entrenar modelo
    # YOLO 11 para clasificación usa el directorio directamente, no un archivo YAML
    print(f"🚀 Iniciando entrenamiento ({epochs} épocas)...")
    print()

    try:
        # Verificar si hay imágenes en val
        val_dir = dataset_dir / "val"
        val_images = (
            list(val_dir.glob("**/*.jpg"))
            + list(val_dir.glob("**/*.jpeg"))
            + list(val_dir.glob("**/*.png"))
        )

        # Si no hay imágenes en val, deshabilitar validación
        use_val = len(val_images) > 0

        if not use_val:
            print(
                "⚠️ No hay imágenes en validación. Deshabilitando validación durante entrenamiento."
            )
            print("   (Esto es normal si solo hay 1 foto por empleado)")
            print()

        results = model.train(
            data=str(
                dataset_dir
            ),  # Pasar el directorio directamente, no un archivo YAML
            epochs=epochs,
            imgsz=224,  # Tamaño de imagen para clasificación
            batch=16,
            device="cpu",  # Usar CPU para evitar problemas de GPU/DLL
            project="yolo_face_model",
            name="face_classifier",
            exist_ok=True,
            patience=20,  # Early stopping
            save=True,
            val=use_val,  # Solo validar si hay imágenes en val
            plots=True,
        )

        print()
        print("=" * 60)
        print("✅ ENTRENAMIENTO COMPLETADO")
        print("=" * 60)
        print()

        # El modelo se guarda automáticamente en runs/classify/yolo_face_model/face_classifier/weights/best.pt
        # Buscar en diferentes ubicaciones posibles
        possible_paths = [
            Path("runs/classify/yolo_face_model/face_classifier/weights/best.pt"),
            Path("yolo_face_model/face_classifier/weights/best.pt"),
            Path(__file__).parent
            / "runs"
            / "classify"
            / "yolo_face_model"
            / "face_classifier"
            / "weights"
            / "best.pt",
        ]

        best_model_path = None
        for path in possible_paths:
            if path.exists():
                best_model_path = path
                break

        if best_model_path and best_model_path.exists():
            # Copiar modelo a la carpeta models
            models_dir = Path(__file__).parent / "models"
            models_dir.mkdir(exist_ok=True)

            final_model_path = models_dir / "yolo11_face_classifier.pt"
            shutil.copy2(best_model_path, final_model_path)

            print(f"✅ Modelo encontrado en: {best_model_path}")
            print(f"✅ Modelo copiado a: {final_model_path}")
            print()

            # Copiar también los metadatos si existen
            metadata_source = dataset_dir / "employee_metadata.json"
            if metadata_source.exists():
                metadata_dest = models_dir / "yolo11_employee_metadata.json"
                shutil.copy2(metadata_source, metadata_dest)
                print(f"✅ Metadatos copiados a: {metadata_dest}")

            print()
            print("📝 Próximos pasos:")
            print("   1. El modelo está listo para usar")
            print("   2. Ejecuta: python main.py")
            print("   3. El sistema usará automáticamente el modelo YOLO 11")

            return True
        else:
            print("⚠️ No se encontró el modelo entrenado en las rutas esperadas")
            print("   Buscado en:")
            for path in possible_paths:
                print(f"     - {path}")
            print()
            print("   El modelo debería estar en:")
            print("   runs/classify/yolo_face_model/face_classifier/weights/best.pt")
            return False

    except Exception as e:
        print(f"❌ Error durante el entrenamiento: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """Función principal."""
    print("=" * 60)
    print("ENTRENAMIENTO DE MODELO DE RECONOCIMIENTO FACIAL CON YOLO 11")
    print("=" * 60)
    print()
    print("✅ Usa YOLO 11 directamente (sin PyTorch explícito)")
    print("✅ Genera modelo .pt compatible con YOLO")
    print("✅ Más ligero y fácil de usar")
    print()

    base_dir = Path(__file__).parent
    database_fotos_dir = base_dir / "database_fotos"
    dataset_dir = base_dir / "yolo_dataset"

    # Paso 1: Preparar dataset
    print("PASO 1: Preparando dataset...")
    print()
    if not prepare_yolo_dataset(database_fotos_dir, dataset_dir):
        print("❌ Error preparando dataset")
        return

    print()
    print("PASO 2: Entrenando modelo YOLO 11...")
    print()

    # Paso 2: Entrenar modelo
    if train_yolo11_model(dataset_dir, epochs=100):
        print()
        print("🎉 ¡Entrenamiento completado exitosamente!")
    else:
        print()
        print("❌ Error durante el entrenamiento")


if __name__ == "__main__":
    main()
