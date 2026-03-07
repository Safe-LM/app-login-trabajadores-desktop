"""
Sistema de entrenamiento de modelo facial personalizado.
Entrena un modelo .pt que reconoce directamente a los empleados.
"""
import sys
import cv2
import numpy as np
from pathlib import Path
import json
from typing import Dict, List, Tuple
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
        
        # Convertir a PIL Image
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
        # Usar ResNet18 pre-entrenado como backbone
        try:
            self.backbone = models.resnet18(weights='IMAGENET1K_V1')
        except:
            # Fallback para versiones antiguas de torchvision
            self.backbone = models.resnet18(pretrained=True)
        # Reemplazar la capa final
        num_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_features, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes)
        )
    
    def forward(self, x):
        return self.backbone(x)

def preprocess_image(img: np.ndarray, target_size=(224, 224)) -> np.ndarray:
    """Preprocesar imagen para el modelo."""
    if img is None or img.size == 0:
        return None
    
    # Redimensionar manteniendo aspecto
    h, w = img.shape[:2]
    target_w, target_h = target_size
    
    scale = min(target_w / w, target_h / h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    
    img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    
    # Crear canvas con padding
    canvas = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    y_offset = (target_h - new_h) // 2
    x_offset = (target_w - new_w) // 2
    canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = img_resized
    
    # Mejorar contraste
    lab = cv2.cvtColor(canvas, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    canvas = cv2.merge([l, a, b])
    canvas = cv2.cvtColor(canvas, cv2.COLOR_LAB2BGR)
    
    return canvas

def detect_and_crop_person(img: np.ndarray, yolo_model) -> np.ndarray:
    """Detectar y recortar persona con YOLO."""
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
    
    if mejor_bbox is None:
        # Si no detecta, usar imagen completa
        return img
    
    x1, y1, x2, y2 = mejor_bbox
    # Agregar margen
    margin = 20
    h, w = img.shape[:2]
    x1 = max(0, x1 - margin)
    y1 = max(0, y1 - margin)
    x2 = min(w, x2 + margin)
    y2 = min(h, y2 + margin)
    
    cropped = img[y1:y2, x1:x2]
    return cropped if cropped.size > 0 else img

def load_employee_data() -> Dict[int, Dict]:
    """Cargar datos de empleados desde CSV."""
    from utils.employee_mapper import load_employee_data as load_csv
    return load_csv()

def organize_photos_by_employee(database_fotos_dir: Path, employee_data: Dict) -> Dict[int, List[Path]]:
    """
    Organizar fotos por empleado basándose en el nombre del archivo.
    photo_1.jpg -> employee_id=1
    photo_2.jpg -> employee_id=2
    etc.
    """
    photos_by_employee = {}
    
    # Buscar todas las fotos
    foto_files = list(database_fotos_dir.glob("*.jpg")) + \
                 list(database_fotos_dir.glob("*.jpeg")) + \
                 list(database_fotos_dir.glob("*.png"))
    
    for foto_file in sorted(foto_files):
        # Extraer employee_id del nombre (photo_1.jpg -> 1)
        import re
        match = re.search(r'(\d+)', foto_file.stem)
        if match:
            employee_id = int(match.group(1))
            
            if employee_id not in photos_by_employee:
                photos_by_employee[employee_id] = []
            
            photos_by_employee[employee_id].append(foto_file)
    
    return photos_by_employee

def prepare_training_data(database_fotos_dir: Path, yolo_model) -> Tuple[List[np.ndarray], List[int], Dict[int, Dict]]:
    """Preparar datos de entrenamiento."""
    print("📋 Cargando datos de empleados...")
    employee_data = load_employee_data()
    
    print("📁 Organizando fotos por empleado...")
    photos_by_employee = organize_photos_by_employee(database_fotos_dir, employee_data)
    
    if not photos_by_employee:
        raise ValueError("❌ No se encontraron fotos organizadas por empleado")
    
    print(f"✅ Encontrados {len(photos_by_employee)} empleados con fotos")
    
    images = []
    labels = []
    employee_info = {}  # Mapeo label_idx -> info del empleado
    
    label_to_employee = {}  # label_idx -> employee_id
    
    for employee_id, photo_files in photos_by_employee.items():
        label_idx = len(employee_info)  # Índice de clase (0, 1, 2, ...)
        
        # Guardar información del empleado
        info = employee_data.get(employee_id, {})
        employee_info[label_idx] = {
            'employee_id': employee_id,
            'nombre': info.get('nombre_completo', f'Empleado {employee_id}'),
            'zona': info.get('zona', 'N/A'),
            'sucursal': info.get('sucursal', 'N/A'),
            'puesto': info.get('puesto', 'N/A'),
            'num_fotos': len(photo_files)
        }
        label_to_employee[label_idx] = employee_id
        
        print(f"\n👤 Empleado {employee_id}: {employee_info[label_idx]['nombre']}")
        print(f"   Zona: {employee_info[label_idx]['zona']}")
        print(f"   Sucursal: {employee_info[label_idx]['sucursal']}")
        print(f"   Puesto: {employee_info[label_idx]['puesto']}")
        print(f"   Fotos: {len(photo_files)}")
        
        # Procesar cada foto del empleado
        for photo_file in photo_files:
            try:
                # Leer imagen
                img = cv2.imread(str(photo_file))
                if img is None:
                    print(f"  ⚠️ No se pudo leer: {photo_file.name}")
                    continue
                
                # Detectar y recortar persona
                cropped = detect_and_crop_person(img, yolo_model)
                
                # Preprocesar
                processed = preprocess_image(cropped)
                
                if processed is not None:
                    images.append(processed)
                    labels.append(label_idx)
                    print(f"  ✅ Procesada: {photo_file.name}")
                else:
                    print(f"  ⚠️ No se pudo preprocesar: {photo_file.name}")
                    
            except Exception as e:
                print(f"  ❌ Error procesando {photo_file.name}: {e}")
                continue
    
    print(f"\n📊 Total de imágenes procesadas: {len(images)}")
    print(f"📊 Total de clases (empleados): {len(employee_info)}")
    
    return images, labels, employee_info

def train_model(images: List[np.ndarray], labels: List[int], num_classes: int, 
                epochs: int = 50, batch_size: int = 8, learning_rate: float = 0.001):
    """Entrenar el modelo de reconocimiento facial."""
    
    print("\n" + "="*60)
    print("🚀 INICIANDO ENTRENAMIENTO DEL MODELO")
    print("="*60)
    
    # Dividir en train/val
    X_train, X_val, y_train, y_val = train_test_split(
        images, labels, test_size=0.2, random_state=42, stratify=labels
    )
    
    print(f"📊 Datos de entrenamiento: {len(X_train)}")
    print(f"📊 Datos de validación: {len(X_val)}")
    
    # Transformaciones
    train_transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # Crear datasets
    train_dataset = EmployeeFaceDataset(X_train, y_train, transform=train_transform)
    val_dataset = EmployeeFaceDataset(X_val, y_val, transform=val_transform)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    
    # Crear modelo
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"🖥️  Usando dispositivo: {device}")
    
    model = FaceRecognitionModel(num_classes=num_classes).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=15, gamma=0.5)
    
    best_val_acc = 0.0
    best_model_state = None
    
    for epoch in range(epochs):
        # Entrenamiento
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
        
        # Validación
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
        
        print(f"Epoch [{epoch+1}/{epochs}] - "
              f"Train Loss: {train_loss/len(train_loader):.4f}, Train Acc: {train_acc:.2f}% - "
              f"Val Loss: {val_loss/len(val_loader):.4f}, Val Acc: {val_acc:.2f}%")
        
        # Guardar mejor modelo
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()
            print(f"  ✅ Nuevo mejor modelo guardado (Val Acc: {val_acc:.2f}%)")
    
    # Cargar mejor modelo
    if best_model_state:
        model.load_state_dict(best_model_state)
    
    print(f"\n✅ Entrenamiento completado. Mejor precisión de validación: {best_val_acc:.2f}%")
    
    return model

def save_model_and_metadata(model, employee_info: Dict, output_dir: Path):
    """Guardar modelo y metadatos."""
    output_dir.mkdir(exist_ok=True)
    
    # Guardar modelo
    model_path = output_dir / "face_recognition_model.pt"
    torch.save(model.state_dict(), model_path)
    print(f"💾 Modelo guardado: {model_path}")
    
    # Guardar metadatos
    metadata_path = output_dir / "employee_metadata.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(employee_info, f, indent=2, ensure_ascii=False)
    print(f"💾 Metadatos guardados: {metadata_path}")
    
    # Guardar información adicional
    info_path = output_dir / "model_info.txt"
    with open(info_path, 'w', encoding='utf-8') as f:
        f.write("="*60 + "\n")
        f.write("MODELO DE RECONOCIMIENTO FACIAL\n")
        f.write("="*60 + "\n\n")
        f.write(f"Total de empleados: {len(employee_info)}\n")
        f.write(f"Fecha de entrenamiento: {Path(__file__).stat().st_mtime}\n\n")
        f.write("Empleados registrados:\n")
        f.write("-"*60 + "\n")
        for label_idx, info in sorted(employee_info.items()):
            f.write(f"\nClase {label_idx}:\n")
            f.write(f"  Employee ID: {info['employee_id']}\n")
            f.write(f"  Nombre: {info['nombre']}\n")
            f.write(f"  Zona: {info['zona']}\n")
            f.write(f"  Sucursal: {info['sucursal']}\n")
            f.write(f"  Puesto: {info['puesto']}\n")
            f.write(f"  Fotos usadas: {info['num_fotos']}\n")
    
    print(f"💾 Información guardada: {info_path}")

def main():
    """Función principal."""
    print("="*60)
    print("🎓 ENTRENAMIENTO DE MODELO DE RECONOCIMIENTO FACIAL")
    print("="*60)
    print()
    
    # Rutas
    base_dir = Path(__file__).parent
    database_fotos_dir = base_dir / "database_fotos"
    output_dir = base_dir / "models"
    yolo_model_path = base_dir / "yolo11s.pt"
    
    # Verificar directorios
    if not database_fotos_dir.exists():
        print(f"❌ No se encontró la carpeta: {database_fotos_dir}")
        return
    
    if not yolo_model_path.exists():
        print(f"❌ No se encontró el modelo YOLO: {yolo_model_path}")
        return
    
    # Cargar YOLO
    print("📦 Cargando modelo YOLO...")
    yolo_model = YOLO(str(yolo_model_path))
    
    try:
        # Preparar datos
        images, labels, employee_info = prepare_training_data(database_fotos_dir, yolo_model)
        
        if len(images) == 0:
            print("❌ No se pudieron procesar imágenes")
            return
        
        if len(set(labels)) < 2:
            print("❌ Se necesitan al menos 2 empleados diferentes para entrenar")
            return
        
        # Entrenar modelo
        num_classes = len(employee_info)
        model = train_model(images, labels, num_classes, epochs=50, batch_size=8)
        
        # Guardar modelo y metadatos
        save_model_and_metadata(model, employee_info, output_dir)
        
        print("\n" + "="*60)
        print("✅ ENTRENAMIENTO COMPLETADO EXITOSAMENTE")
        print("="*60)
        print(f"\n📁 Modelo guardado en: {output_dir}")
        print(f"📊 Empleados reconocibles: {num_classes}")
        print(f"\n💡 Ahora puedes usar este modelo para reconocimiento facial")
        
    except Exception as e:
        print(f"\n❌ Error durante el entrenamiento: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

