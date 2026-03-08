"""
Sistema INTERACTIVO de entrenamiento de modelo facial.
Permite seleccionar fotos, recortar caras manualmente y entrenar el modelo.
"""

import sys
import cv2
import numpy as np
from pathlib import Path
import json
from typing import Dict, List, Tuple, Optional
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import torchvision.models as models
from sklearn.model_selection import train_test_split
from ultralytics import YOLO

# Agregar paths necesarios
root_path = Path(__file__).parent
sys.path.insert(0, str(root_path))

# Variables globales para selección interactiva
selected_rect = None
selecting = False
start_point = None
end_point = None
current_image = None
current_window = (
    "Selecciona la cara - Presiona ESPACIO para continuar, ESC para cancelar"
)


def mouse_callback(event, x, y, flags, param):
    """Callback para selección de rectángulo con el mouse."""
    global selected_rect, selecting, start_point, end_point, current_image

    if event == cv2.EVENT_LBUTTONDOWN:
        selecting = True
        start_point = (x, y)
        end_point = (x, y)

    elif event == cv2.EVENT_MOUSEMOVE:
        if selecting:
            end_point = (x, y)
            # Redibujar imagen con rectángulo
            img_copy = current_image.copy()
            cv2.rectangle(img_copy, start_point, end_point, (0, 255, 0), 2)
            cv2.putText(
                img_copy,
                "Arrastra para seleccionar la cara",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                2,
            )
            cv2.putText(
                img_copy,
                "ESPACIO: Continuar | ESC: Cancelar | R: Reiniciar",
                (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2,
            )
            cv2.imshow(current_window, img_copy)

    elif event == cv2.EVENT_LBUTTONUP:
        selecting = False
        if start_point and end_point:
            # Asegurar que el rectángulo sea válido
            x1 = min(start_point[0], end_point[0])
            y1 = min(start_point[1], end_point[1])
            x2 = max(start_point[0], end_point[0])
            y2 = max(start_point[1], end_point[1])

            if abs(x2 - x1) > 20 and abs(y2 - y1) > 20:  # Mínimo tamaño
                selected_rect = (x1, y1, x2, y2)
                # Dibujar rectángulo final
                img_copy = current_image.copy()
                cv2.rectangle(img_copy, (x1, y1), (x2, y2), (0, 255, 0), 3)
                cv2.putText(
                    img_copy,
                    "Cara seleccionada! Presiona ESPACIO",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    img_copy,
                    "ESPACIO: Continuar | ESC: Cancelar | R: Reiniciar",
                    (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2,
                )
                cv2.imshow(current_window, img_copy)


def select_face_interactive(
    img: np.ndarray, photo_name: str
) -> Optional[Tuple[int, int, int, int]]:
    """
    Selección interactiva de la cara en una imagen.

    Returns:
        (x1, y1, x2, y2) o None si se cancela
    """
    global selected_rect, selecting, start_point, end_point, current_image, current_window

    current_image = img.copy()
    selected_rect = None
    start_point = None
    end_point = None

    # Redimensionar imagen si es muy grande para la pantalla
    h, w = img.shape[:2]
    max_display_size = 1200
    if w > max_display_size or h > max_display_size:
        scale = min(max_display_size / w, max_display_size / h)
        new_w = int(w * scale)
        new_h = int(h * scale)
        display_img = cv2.resize(img, (new_w, new_h))
        scale_factor = w / new_w  # Para convertir coordenadas de vuelta
    else:
        display_img = img.copy()
        scale_factor = 1.0

    # Intentar detectar automáticamente con YOLO
    try:
        yolo_model = YOLO(str(Path(__file__).parent / "yolo11s.pt"))
        results = yolo_model(img, classes=[0], verbose=False)

        mejor_bbox = None
        mejor_conf = 0.0

        for r in results:
            boxes = r.boxes
            for box in boxes:
                conf = float(box.conf)
                if conf > mejor_conf:
                    mejor_conf = conf
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    mejor_bbox = (int(x1), int(y1), int(x2), int(y2))

        if mejor_bbox and mejor_conf > 0.3:
            # Dibujar detección automática
            x1, y1, x2, y2 = mejor_bbox
            cv2.rectangle(
                display_img,
                (int(x1 / scale_factor), int(y1 / scale_factor)),
                (int(x2 / scale_factor), int(y2 / scale_factor)),
                (255, 0, 0),
                2,
            )
            cv2.putText(
                display_img,
                f"Auto-detectado (conf: {mejor_conf:.2f})",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 0, 0),
                2,
            )
    except:
        pass

    # Mostrar instrucciones
    cv2.putText(
        display_img,
        f"Foto: {photo_name}",
        (10, display_img.shape[0] - 60),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2,
    )
    cv2.putText(
        display_img,
        "Arrastra para seleccionar la cara",
        (10, display_img.shape[0] - 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2,
    )
    cv2.putText(
        display_img,
        "ESPACIO: Usar seleccion | ESC: Cancelar | R: Reiniciar | A: Usar auto-detectado",
        (10, display_img.shape[0] - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (255, 255, 255),
        1,
    )

    cv2.namedWindow(current_window, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(current_window, mouse_callback)
    cv2.imshow(current_window, display_img)

    auto_bbox = mejor_bbox if mejor_bbox and mejor_conf > 0.3 else None

    while True:
        key = cv2.waitKey(1) & 0xFF

        if key == 27:  # ESC - Cancelar
            cv2.destroyWindow(current_window)
            return None

        elif key == 32:  # ESPACIO - Continuar con selección manual
            if selected_rect:
                cv2.destroyWindow(current_window)
                # Convertir coordenadas de vuelta si se redimensionó
                if scale_factor != 1.0:
                    x1, y1, x2, y2 = selected_rect
                    return (
                        int(x1 * scale_factor),
                        int(y1 * scale_factor),
                        int(x2 * scale_factor),
                        int(y2 * scale_factor),
                    )
                return selected_rect
            elif auto_bbox:
                # Usar auto-detección si no hay selección manual
                cv2.destroyWindow(current_window)
                return auto_bbox

        elif key == ord("a") or key == ord("A"):  # A - Usar auto-detección
            if auto_bbox:
                cv2.destroyWindow(current_window)
                return auto_bbox

        elif key == ord("r") or key == ord("R"):  # R - Reiniciar selección
            selected_rect = None
            start_point = None
            end_point = None
            cv2.imshow(current_window, display_img)


class EmployeeFaceDataset(Dataset):
    """Dataset para entrenamiento de reconocimiento facial."""

    def __init__(self, images: List[np.ndarray], labels: List[int], transform=None):
        self.images = images
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        image = self.images[idx]
        label = self.labels[idx]

        if isinstance(image, np.ndarray):
            if len(image.shape) == 3:
                image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
            else:
                image = Image.fromarray(image)

        if self.transform:
            image = self.transform(image)

        return image, label


class FaceRecognitionModel(nn.Module):
    """Modelo de reconocimiento facial basado en ResNet."""

    def __init__(self, num_classes: int):
        super(FaceRecognitionModel, self).__init__()
        try:
            self.backbone = models.resnet18(weights="IMAGENET1K_V1")
        except:
            self.backbone = models.resnet18(pretrained=True)
        num_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_features, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        return self.backbone(x)


def preprocess_image(img: np.ndarray, target_size=(224, 224)) -> np.ndarray:
    """Preprocesar imagen para el modelo."""
    if img is None or img.size == 0:
        return None

    h, w = img.shape[:2]
    target_w, target_h = target_size

    scale = min(target_w / w, target_h / h)
    new_w = int(w * scale)
    new_h = int(h * scale)

    img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    canvas = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    y_offset = (target_h - new_h) // 2
    x_offset = (target_w - new_w) // 2
    canvas[y_offset : y_offset + new_h, x_offset : x_offset + new_w] = img_resized

    lab = cv2.cvtColor(canvas, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    canvas = cv2.merge([l, a, b])
    canvas = cv2.cvtColor(canvas, cv2.COLOR_LAB2BGR)

    return canvas


def load_employee_data() -> Dict[int, Dict]:
    """Cargar datos de empleados desde CSV."""
    from utils.employee_mapper import load_employee_data as load_csv

    return load_csv()


def organize_photos_by_employee(database_fotos_dir: Path) -> Dict[int, List[Path]]:
    """Organizar fotos por empleado."""
    photos_by_employee = {}

    foto_files = (
        list(database_fotos_dir.glob("*.jpg"))
        + list(database_fotos_dir.glob("*.jpeg"))
        + list(database_fotos_dir.glob("*.png"))
    )

    for foto_file in sorted(foto_files):
        import re

        match = re.search(r"(\d+)", foto_file.stem)
        if match:
            employee_id = int(match.group(1))
            if employee_id not in photos_by_employee:
                photos_by_employee[employee_id] = []
            photos_by_employee[employee_id].append(foto_file)

    return photos_by_employee


def prepare_training_data_interactive(
    database_fotos_dir: Path,
) -> Tuple[List[np.ndarray], List[int], Dict[int, Dict]]:
    """Preparar datos de entrenamiento de forma interactiva."""
    print("📋 Cargando datos de empleados...")
    employee_data = load_employee_data()

    print("📁 Organizando fotos por empleado...")
    photos_by_employee = organize_photos_by_employee(database_fotos_dir)

    if not photos_by_employee:
        raise ValueError("❌ No se encontraron fotos organizadas por empleado")

    print(f"✅ Encontrados {len(photos_by_employee)} empleados con fotos")
    print("\n" + "=" * 60)
    print("🎯 MODO INTERACTIVO - Selecciona las caras manualmente")
    print("=" * 60)
    print("\nInstrucciones:")
    print("  - Arrastra el mouse para seleccionar la cara")
    print("  - ESPACIO: Continuar con la selección")
    print("  - A: Usar auto-detección (si está disponible)")
    print("  - R: Reiniciar selección")
    print("  - ESC: Cancelar esta foto")
    print("  - Puedes agregar múltiples recortes por persona")
    print("=" * 60 + "\n")

    images = []
    labels = []
    employee_info = {}

    for employee_id, photo_files in sorted(photos_by_employee.items()):
        label_idx = len(employee_info)

        info = employee_data.get(employee_id, {})
        employee_info[label_idx] = {
            "employee_id": employee_id,
            "nombre": info.get("nombre_completo", f"Empleado {employee_id}"),
            "zona": info.get("zona", "N/A"),
            "sucursal": info.get("sucursal", "N/A"),
            "puesto": info.get("puesto", "N/A"),
            "num_fotos": 0,
        }

        print(f"\n{'='*60}")
        print(f"👤 EMPLEADO {employee_id}: {employee_info[label_idx]['nombre']}")
        print(f"   Zona: {employee_info[label_idx]['zona']}")
        print(f"   Sucursal: {employee_info[label_idx]['sucursal']}")
        print(f"   Puesto: {employee_info[label_idx]['puesto']}")
        print(f"{'='*60}")

        for photo_file in photo_files:
            print(f"\n📷 Procesando: {photo_file.name}")

            img = cv2.imread(str(photo_file))
            if img is None:
                print(f"  ⚠️ No se pudo leer la imagen")
                continue

            # Permitir múltiples recortes por foto
            while True:
                bbox = select_face_interactive(img, photo_file.name)

                if bbox is None:
                    # Usuario canceló
                    respuesta = input("  ¿Deseas omitir esta foto? (s/n): ").lower()
                    if respuesta == "s":
                        break
                    continue

                # Recortar y preprocesar
                x1, y1, x2, y2 = bbox
                cropped = img[y1:y2, x1:x2]

                if cropped.size == 0:
                    print("  ⚠️ Recorte inválido, intenta de nuevo")
                    continue

                processed = preprocess_image(cropped)

                if processed is not None:
                    images.append(processed)
                    labels.append(label_idx)
                    employee_info[label_idx]["num_fotos"] += 1
                    print(
                        f"  ✅ Cara agregada (Total para este empleado: {employee_info[label_idx]['num_fotos']})"
                    )

                    # Preguntar si quiere agregar otra cara de la misma foto
                    respuesta = input(
                        "  ¿Agregar otra cara de esta misma foto? (s/n): "
                    ).lower()
                    if respuesta != "s":
                        break
                else:
                    print("  ⚠️ No se pudo preprocesar, intenta de nuevo")

        print(
            f"\n✅ Empleado {employee_id} completado: {employee_info[label_idx]['num_fotos']} caras agregadas"
        )

    print(f"\n📊 Total de imágenes procesadas: {len(images)}")
    print(f"📊 Total de clases (empleados): {len(employee_info)}")

    return images, labels, employee_info


def train_model(
    images: List[np.ndarray],
    labels: List[int],
    num_classes: int,
    epochs: int = 50,
    batch_size: int = 8,
    learning_rate: float = 0.001,
):
    """Entrenar el modelo de reconocimiento facial."""

    print("\n" + "=" * 60)
    print("🚀 INICIANDO ENTRENAMIENTO DEL MODELO")
    print("=" * 60)

    if len(images) < 2:
        raise ValueError("❌ Se necesitan al menos 2 imágenes para entrenar")

    X_train, X_val, y_train, y_val = train_test_split(
        images,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels if len(set(labels)) > 1 else None,
    )

    print(f"📊 Datos de entrenamiento: {len(X_train)}")
    print(f"📊 Datos de validación: {len(X_val)}")

    train_transform = transforms.Compose(
        [
            transforms.ToPILImage(),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(10),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    val_transform = transforms.Compose(
        [
            transforms.ToPILImage(),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    train_dataset = EmployeeFaceDataset(X_train, y_train, transform=train_transform)
    val_dataset = EmployeeFaceDataset(X_val, y_val, transform=val_transform)

    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True, num_workers=0
    )
    val_loader = DataLoader(
        val_dataset, batch_size=batch_size, shuffle=False, num_workers=0
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Usando dispositivo: {device}")

    model = FaceRecognitionModel(num_classes=num_classes).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=15, gamma=0.5)

    best_val_acc = 0.0
    best_model_state = None

    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0

        for images_batch, labels_batch in train_loader:
            images_batch = images_batch.to(device)
            labels_batch = labels_batch.to(device)

            optimizer.zero_grad()
            outputs = model(images_batch)
            loss = criterion(outputs, labels_batch)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            train_total += labels_batch.size(0)
            train_correct += (predicted == labels_batch).sum().item()

        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for images_batch, labels_batch in val_loader:
                images_batch = images_batch.to(device)
                labels_batch = labels_batch.to(device)

                outputs = model(images_batch)
                loss = criterion(outputs, labels_batch)

                val_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                val_total += labels_batch.size(0)
                val_correct += (predicted == labels_batch).sum().item()

        train_acc = 100 * train_correct / train_total
        val_acc = 100 * val_correct / val_total

        scheduler.step()

        print(
            f"Epoch [{epoch+1}/{epochs}] - "
            f"Train Loss: {train_loss/len(train_loader):.4f}, Train Acc: {train_acc:.2f}% - "
            f"Val Loss: {val_loss/len(val_loader):.4f}, Val Acc: {val_acc:.2f}%"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()
            print(f"  ✅ Nuevo mejor modelo guardado (Val Acc: {val_acc:.2f}%)")

    if best_model_state:
        model.load_state_dict(best_model_state)

    print(
        f"\n✅ Entrenamiento completado. Mejor precisión de validación: {best_val_acc:.2f}%"
    )

    return model


def save_model_and_metadata(model, employee_info: Dict, output_dir: Path):
    """Guardar modelo y metadatos."""
    output_dir.mkdir(exist_ok=True)

    model_path = output_dir / "face_recognition_model.pt"
    torch.save(model.state_dict(), model_path)
    print(f"💾 Modelo guardado: {model_path}")

    metadata_path = output_dir / "employee_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(employee_info, f, indent=2, ensure_ascii=False)
    print(f"💾 Metadatos guardados: {metadata_path}")

    info_path = output_dir / "model_info.txt"
    with open(info_path, "w", encoding="utf-8") as f:
        f.write("=" * 60 + "\n")
        f.write("MODELO DE RECONOCIMIENTO FACIAL (INTERACTIVO)\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Total de empleados: {len(employee_info)}\n\n")
        f.write("Empleados registrados:\n")
        f.write("-" * 60 + "\n")
        for label_idx, info in sorted(employee_info.items()):
            f.write(f"\nClase {label_idx}:\n")
            f.write(f"  Employee ID: {info['employee_id']}\n")
            f.write(f"  Nombre: {info['nombre']}\n")
            f.write(f"  Zona: {info['zona']}\n")
            f.write(f"  Sucursal: {info['sucursal']}\n")
            f.write(f"  Puesto: {info['puesto']}\n")
            f.write(f"  Caras agregadas: {info['num_fotos']}\n")

    print(f"💾 Información guardada: {info_path}")


def main():
    """Función principal."""
    print("=" * 60)
    print("🎓 ENTRENAMIENTO INTERACTIVO DE MODELO DE RECONOCIMIENTO FACIAL")
    print("=" * 60)
    print()

    base_dir = Path(__file__).parent
    database_fotos_dir = base_dir / "database_fotos"
    output_dir = base_dir / "models"

    if not database_fotos_dir.exists():
        print(f"❌ No se encontró la carpeta: {database_fotos_dir}")
        return

    try:
        images, labels, employee_info = prepare_training_data_interactive(
            database_fotos_dir
        )

        if len(images) == 0:
            print("❌ No se procesaron imágenes")
            return

        if len(set(labels)) < 2:
            print("❌ Se necesitan al menos 2 empleados diferentes para entrenar")
            return

        num_classes = len(employee_info)
        model = train_model(images, labels, num_classes, epochs=50, batch_size=8)

        save_model_and_metadata(model, employee_info, output_dir)

        print("\n" + "=" * 60)
        print("✅ ENTRENAMIENTO COMPLETADO EXITOSAMENTE")
        print("=" * 60)
        print(f"\n📁 Modelo guardado en: {output_dir}")
        print(f"📊 Empleados reconocibles: {num_classes}")
        print(f"\n💡 El modelo está listo para usar en reconocimiento facial")

    except KeyboardInterrupt:
        print("\n\n⚠️ Entrenamiento cancelado por el usuario")
    except Exception as e:
        print(f"\n❌ Error durante el entrenamiento: {e}")
        import traceback

        traceback.print_exc()
    finally:
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
