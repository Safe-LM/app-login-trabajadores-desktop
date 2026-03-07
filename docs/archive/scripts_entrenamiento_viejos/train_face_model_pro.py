"""
Entrenamiento PROFESIONAL de modelo de reconocimiento facial.
Usa técnicas avanzadas para crear un modelo robusto y preciso.
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
from collections import Counter
from ultralytics import YOLO
try:
    import albumentations as A
    from albumentations.pytorch import ToTensorV2
    ALBUMENTATIONS_AVAILABLE = True
except ImportError:
    ALBUMENTATIONS_AVAILABLE = False
    print("[WARNING] Albumentations no disponible, usando transformaciones básicas")
import random

# Agregar paths necesarios
root_path = Path(__file__).parent
sys.path.insert(0, str(root_path))

class ProfessionalFaceDataset(Dataset):
    """Dataset profesional con data augmentation avanzado."""
    
    def __init__(self, images: List[np.ndarray], labels: List[int], transform=None, is_training=True):
        self.images = images
        self.labels = labels
        self.is_training = is_training
        self.transform = transform
        
        # Data augmentation profesional con Albumentations
        if is_training and transform is None and ALBUMENTATIONS_AVAILABLE:
            self.aug_transform = A.Compose([
                A.Resize(256, 256),
                A.RandomCrop(224, 224),
                A.HorizontalFlip(p=0.5),
                A.Rotate(limit=15, p=0.5),
                A.ShiftScaleRotate(shift_limit=0.1, scale_limit=0.2, rotate_limit=15, p=0.5),
                A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.5),
                A.HueSaturationValue(hue_shift_limit=20, sat_shift_limit=30, val_shift_limit=20, p=0.5),
                A.GaussNoise(var_limit=(10.0, 50.0), p=0.3),
                A.GaussianBlur(blur_limit=3, p=0.3),
                A.CLAHE(clip_limit=2.0, tile_grid_size=(8, 8), p=0.5),
                A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
                ToTensorV2()
            ])
        elif not is_training and ALBUMENTATIONS_AVAILABLE:
            self.aug_transform = A.Compose([
                A.Resize(224, 224),
                A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
                ToTensorV2()
            ])
        else:
            self.aug_transform = None
            # Si no hay Albumentations, usar transformaciones básicas de torchvision
            if is_training and transform is None:
                from torchvision import transforms
                self.basic_transform = transforms.Compose([
                    transforms.Resize((256, 256)),
                    transforms.RandomCrop(224),
                    transforms.RandomHorizontalFlip(p=0.5),
                    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])
            elif not is_training:
                from torchvision import transforms
                self.basic_transform = transforms.Compose([
                    transforms.Resize((224, 224)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
                ])
            else:
                self.basic_transform = None
    
    def __len__(self):
        return len(self.images)
    
    def __getitem__(self, idx):
        image = self.images[idx]
        label = self.labels[idx]
        
        # Convertir numpy array a formato correcto
        if isinstance(image, np.ndarray):
            if len(image.shape) == 3:
                # BGR a RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            else:
                image_rgb = image
        else:
            image_rgb = np.array(image)
        
        # Aplicar transformaciones de Albumentations o básicas
        if self.aug_transform:
            augmented = self.aug_transform(image=image_rgb)
            image_tensor = augmented['image']
        elif hasattr(self, 'basic_transform') and self.basic_transform:
            # Usar transformaciones básicas si Albumentations no está disponible
            if isinstance(image_rgb, np.ndarray):
                image_pil = Image.fromarray(image_rgb)
            else:
                image_pil = image_rgb
            image_tensor = self.basic_transform(image_pil)
        elif self.transform:
            # Fallback a transformaciones estándar
            if isinstance(image_rgb, np.ndarray):
                image_pil = Image.fromarray(image_rgb)
            else:
                image_pil = image_rgb
            image_tensor = self.transform(image_pil)
        else:
            # Sin transformaciones
            image_tensor = torch.from_numpy(image_rgb).permute(2, 0, 1).float() / 255.0
        
        return image_tensor, label

class ProfessionalFaceModel(nn.Module):
    """Modelo profesional de reconocimiento facial basado en ResNet50."""
    
    def __init__(self, num_classes: int):
        super(ProfessionalFaceModel, self).__init__()
        try:
            # Usar ResNet50 para mejor precisión
            self.backbone = models.resnet50(weights='IMAGENET1K_V2')
        except:
            try:
                self.backbone = models.resnet50(weights='IMAGENET1K_V1')
            except:
                self.backbone = models.resnet50(pretrained=True)
        
        num_features = self.backbone.fc.in_features
        
        # Capas de clasificación mejoradas
        self.backbone.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_features, 1024),
            nn.BatchNorm1d(1024),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(1024, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, num_classes)
        )
    
    def forward(self, x):
        return self.backbone(x)

def detect_face_with_yolo(img: np.ndarray, yolo_model) -> Tuple[np.ndarray, float]:
    """
    Detectar y recortar cara usando YOLO con técnicas avanzadas.
    """
    if img is None or img.size == 0:
        return img, 0.0
    
    try:
        # Detectar personas con YOLO (confianza mínima más baja para mejor detección)
        results = yolo_model(img, classes=[0], verbose=False, conf=0.2)
        
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
        
        if mejor_bbox:
            x1, y1, x2, y2 = mejor_bbox
            h, w = img.shape[:2]
            
            # Calcular dimensiones
            bbox_w = x2 - x1
            bbox_h = y2 - y1
            
            # Márgenes inteligentes para capturar mejor el rostro
            margin_top = int(bbox_h * 0.4)  # 40% arriba (más espacio para cabeza)
            margin_bottom = int(bbox_h * 0.15)  # 15% abajo
            margin_sides = int(bbox_w * 0.2)  # 20% a los lados
            
            x1 = max(0, x1 - margin_sides)
            y1 = max(0, y1 - margin_top)
            x2 = min(w, x2 + margin_sides)
            y2 = min(h, y2 + margin_bottom)
            
            cropped = img[y1:y2, x1:x2]
            
            if cropped.size > 0:
                min_size = 64  # Tamaño mínimo más grande
                if cropped.shape[0] < min_size or cropped.shape[1] < min_size:
                    return img, mejor_conf * 0.5
                
                return cropped, mejor_conf
        
        return img, 0.0
        
    except Exception as e:
        print(f"  [WARNING] Error en detección YOLO: {e}")
        return img, 0.0

def enhance_image_professional(img: np.ndarray) -> np.ndarray:
    """Mejora profesional de imagen para reconocimiento facial."""
    if img is None or img.size == 0:
        return img
    
    # Convertir a LAB para mejor procesamiento
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # CLAHE para mejorar contraste
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    
    # Reducción de ruido
    l = cv2.bilateralFilter(l, 9, 75, 75)
    
    # Recombinar
    lab = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    
    return enhanced

def preprocess_image_pro(img: np.ndarray, target_size=(224, 224)) -> np.ndarray:
    """Preprocesamiento profesional de imagen."""
    if img is None or img.size == 0:
        return None
    
    # Mejorar imagen
    img = enhance_image_professional(img)
    
    h, w = img.shape[:2]
    target_w, target_h = target_size
    
    # Redimensionar manteniendo aspecto
    scale = min(target_w / w, target_h / h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    
    img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    
    # Crear canvas con padding
    canvas = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    y_offset = (target_h - new_h) // 2
    x_offset = (target_w - new_w) // 2
    canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = img_resized
    
    return canvas

def load_employee_data_from_json(json_path: Path) -> Dict[int, Dict]:
    """Cargar datos de empleados desde JSON."""
    if not json_path.exists():
        print(f"[WARNING] JSON no encontrado: {json_path}")
        return {}
    
    with open(json_path, 'r', encoding='utf-8') as f:
        employees_list = json.load(f)
    
    employee_data = {}
    for emp in employees_list:
        employee_id = emp.get('employee_id')
        if employee_id:
            employee_data[employee_id] = {
                'nombre': emp.get('nombre', ''),
                'zona': emp.get('zona', ''),
                'sucursal': emp.get('sucursal', ''),
                'puesto': emp.get('puesto', ''),
                'photo_file': emp.get('photo_file', '')
            }
    
    return employee_data

def load_employee_data() -> Dict[int, Dict]:
    """Cargar datos de empleados (prioriza JSON)."""
    base_dir = Path(__file__).parent
    json_path = base_dir / "database_fotos" / "json" / "employees_db.json"
    
    if json_path.exists():
        print(f"[OK] Cargando datos desde JSON: {json_path.name}")
        return load_employee_data_from_json(json_path)
    
    print("[INFO] JSON no encontrado, usando CSV...")
    from utils.employee_mapper import load_employee_data as load_csv
    return load_csv()

def organize_photos_by_employee(database_fotos_dir: Path, employee_data: Dict[int, Dict]) -> Dict[int, List[Path]]:
    """Organizar fotos por empleado."""
    photos_by_employee = {}
    photos_dir = database_fotos_dir / "photos"
    
    if not photos_dir.exists():
        photos_dir = database_fotos_dir
    
    for employee_id, emp_info in employee_data.items():
        photo_file = emp_info.get('photo_file', '')
        if photo_file:
            photo_name = Path(photo_file).name
            photo_path = photos_dir / photo_name
            
            if photo_path.exists():
                if employee_id not in photos_by_employee:
                    photos_by_employee[employee_id] = []
                photos_by_employee[employee_id].append(photo_path)
    
    return photos_by_employee

def prepare_training_data_pro(database_fotos_dir: Path, yolo_model) -> Tuple[List[np.ndarray], List[int], Dict[int, Dict]]:
    """Preparar datos de entrenamiento con técnicas profesionales."""
    print("="*60)
    print("PREPARACION PROFESIONAL DE DATOS")
    print("="*60)
    print()
    
    employee_data = load_employee_data()
    photos_by_employee = organize_photos_by_employee(database_fotos_dir, employee_data)
    
    if not photos_by_employee:
        raise ValueError("[ERROR] No se encontraron fotos organizadas")
    
    print(f"[OK] Encontrados {len(photos_by_employee)} empleados con fotos")
    print()
    
    images = []
    labels = []
    employee_info = {}
    
    for employee_id, photo_files in sorted(photos_by_employee.items()):
        label_idx = len(employee_info)
        
        info = employee_data.get(employee_id, {})
        employee_info[label_idx] = {
            'employee_id': employee_id,
            'nombre': info.get('nombre', f'Empleado {employee_id}'),
            'zona': info.get('zona', 'N/A'),
            'sucursal': info.get('sucursal', 'N/A'),
            'puesto': info.get('puesto', 'N/A'),
            'num_fotos': 0
        }
        
        print(f"Empleado {employee_id}: {employee_info[label_idx]['nombre']}")
        
        # Procesar cada foto con técnicas profesionales
        for photo_file in photo_files:
            try:
                img = cv2.imread(str(photo_file))
                if img is None:
                    continue
                
                # Detectar cara con YOLO
                cropped, conf = detect_face_with_yolo(img, yolo_model)
                
                if conf < 0.3:
                    print(f"  [WARNING] {photo_file.name}: Confianza baja ({conf:.2f})")
                
                # Preprocesamiento profesional
                processed = preprocess_image_pro(cropped)
                
                if processed is not None:
                    images.append(processed)
                    labels.append(label_idx)
                    employee_info[label_idx]['num_fotos'] += 1
                    
                    # Crear variaciones para aumentar dataset
                    # Flip horizontal
                    flipped = cv2.flip(processed, 1)
                    images.append(flipped)
                    labels.append(label_idx)
                    employee_info[label_idx]['num_fotos'] += 1
                    
                    # Rotación ligera
                    h, w = processed.shape[:2]
                    M = cv2.getRotationMatrix2D((w/2, h/2), random.uniform(-10, 10), 1.0)
                    rotated = cv2.warpAffine(processed, M, (w, h))
                    images.append(rotated)
                    labels.append(label_idx)
                    employee_info[label_idx]['num_fotos'] += 1
                    
                    print(f"  [OK] {photo_file.name} + 2 variaciones (confianza YOLO: {conf:.2f})")
                    
            except Exception as e:
                print(f"  [ERROR] Error procesando {photo_file.name}: {e}")
                continue
        
        print(f"  Total imágenes para este empleado: {employee_info[label_idx]['num_fotos']}\n")
    
    print(f"[OK] Total de imágenes procesadas: {len(images)}")
    print(f"[OK] Total de clases (empleados): {len(employee_info)}")
    print()
    
    return images, labels, employee_info

def train_model_professional(images: List[np.ndarray], labels: List[int], num_classes: int, 
                            epochs: int = 50, batch_size: int = 32, learning_rate: float = 0.0001):
    """Entrenamiento profesional del modelo."""
    
    print("="*60)
    print("ENTRENAMIENTO PROFESIONAL DEL MODELO")
    print("="*60)
    print()
    
    if len(images) < 2:
        raise ValueError("[ERROR] Se necesitan al menos 2 imágenes para entrenar")
    
    # Verificar estratificación y ajustar test_size según número de clases
    label_counts = Counter(labels)
    num_classes = len(set(labels))
    min_samples_per_class = min(label_counts.values())
    
    # Calcular test_size dinámicamente
    # Necesitamos al menos 1 muestra por clase en validación
    # Si hay muchas clases, usar un test_size más pequeño
    if num_classes > len(images) * 0.3:
        # Si hay muchas clases, usar test_size más pequeño
        test_size = max(0.1, num_classes / len(images))
        if test_size >= 0.5:
            # Si aún es muy grande, usar validación mínima
            test_size = 0.05
        print(f"[INFO] Ajustando test_size a {test_size:.2%} para {num_classes} clases")
    else:
        test_size = 0.2
    
    use_stratify = min_samples_per_class >= 2 and len(set(labels)) > 1
    
    if not use_stratify:
        print(f"[WARNING] Algunas clases tienen solo 1 muestra. Usando split sin estratificación.")
    
    try:
        X_train, X_val, y_train, y_val = train_test_split(
            images, labels, test_size=test_size, random_state=42, stratify=labels if use_stratify else None
        )
    except ValueError as e:
        # Si falla la estratificación, intentar sin ella
        print(f"[WARNING] Error en split estratificado: {e}")
        print(f"[INFO] Usando split sin estratificación")
        X_train, X_val, y_train, y_val = train_test_split(
            images, labels, test_size=test_size, random_state=42, stratify=None
        )
    
    print(f"Datos de entrenamiento: {len(X_train)}")
    print(f"Datos de validación: {len(X_val)}")
    print()
    
    # Crear datasets con data augmentation profesional
    train_dataset = ProfessionalFaceDataset(X_train, y_train, is_training=True)
    val_dataset = ProfessionalFaceDataset(X_val, y_val, is_training=False)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=False)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=False)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Usando dispositivo: {device}")
    print()
    
    # Modelo profesional
    model = ProfessionalFaceModel(num_classes=num_classes).to(device)
    
    # Optimizador avanzado
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    
    # Scheduler con warmup
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
    
    # Loss function con label smoothing
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    
    best_val_acc = 0.0
    best_model_state = None
    patience_counter = 0
    patience = 30  # Early stopping más paciente
    
    print("Iniciando entrenamiento...")
    print()
    
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
            
            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            
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
        current_lr = scheduler.get_last_lr()[0]
        
        print(f"Epoch [{epoch+1}/{epochs}] - LR: {current_lr:.6f}")
        print(f"  Train Loss: {train_loss/len(train_loader):.4f}, Train Acc: {train_acc:.2f}%")
        print(f"  Val Loss: {val_loss/len(val_loader):.4f}, Val Acc: {val_acc:.2f}%")
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()
            patience_counter = 0
            print(f"  [OK] Nuevo mejor modelo guardado (Val Acc: {val_acc:.2f}%)")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"  [STOP] Early stopping activado (sin mejora en {patience} épocas)")
                break
        
        print()
    
    if best_model_state:
        model.load_state_dict(best_model_state)
    
    print(f"[OK] Entrenamiento completado. Mejor precisión de validación: {best_val_acc:.2f}%")
    print()
    
    return model

def save_model_professional(model, employee_info: Dict, output_dir: Path):
    """Guardar modelo y metadatos de forma profesional."""
    output_dir.mkdir(exist_ok=True)
    
    model_path = output_dir / "face_recognition_model_pro.pt"
    torch.save(model.state_dict(), model_path)
    print(f"[OK] Modelo profesional guardado: {model_path}")
    
    metadata_path = output_dir / "employee_metadata_pro.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(employee_info, f, indent=2, ensure_ascii=False)
    print(f"[OK] Metadatos guardados: {metadata_path}")
    
    info_path = output_dir / "model_info_pro.txt"
    with open(info_path, 'w', encoding='utf-8') as f:
        f.write("="*60 + "\n")
        f.write("MODELO PROFESIONAL DE RECONOCIMIENTO FACIAL\n")
        f.write("="*60 + "\n\n")
        f.write(f"Total de empleados: {len(employee_info)}\n")
        f.write(f"Arquitectura: ResNet50\n")
        f.write(f"Técnicas: Data Augmentation Avanzado, Label Smoothing, Gradient Clipping\n\n")
        f.write("Empleados registrados:\n")
        f.write("-"*60 + "\n")
        for label_idx, info in sorted(employee_info.items()):
            f.write(f"\nClase {label_idx}:\n")
            f.write(f"  Employee ID: {info['employee_id']}\n")
            f.write(f"  Nombre: {info['nombre']}\n")
            f.write(f"  Zona: {info['zona']}\n")
            f.write(f"  Sucursal: {info['sucursal']}\n")
            f.write(f"  Puesto: {info['puesto']}\n")
            f.write(f"  Imágenes de entrenamiento: {info['num_fotos']}\n")
    
    print(f"[OK] Información guardada: {info_path}")

def main():
    """Función principal."""
    print("="*60)
    print("ENTRENAMIENTO PROFESIONAL DE MODELO DE RECONOCIMIENTO FACIAL")
    print("="*60)
    print()
    print("✅ Técnicas avanzadas:")
    print("   - ResNet50 (arquitectura más potente)")
    print("   - Data Augmentation profesional (Albumentations)")
    print("   - Label Smoothing")
    print("   - Gradient Clipping")
    print("   - Learning Rate Scheduling (Cosine Annealing)")
    print("   - Early Stopping mejorado")
    print("   - Variaciones automáticas de imágenes")
    print()
    
    base_dir = Path(__file__).parent
    database_fotos_dir = base_dir / "database_fotos"
    output_dir = base_dir / "models"
    yolo_model_path = base_dir / "yolo11s.pt"
    
    if not yolo_model_path.exists():
        print(f"[ERROR] No se encontró el modelo YOLO: {yolo_model_path}")
        return
    
    # Cargar YOLO
    print("Cargando modelo YOLO...")
    yolo_model = YOLO(str(yolo_model_path))
    print()
    
    try:
        # Preparar datos
        images, labels, employee_info = prepare_training_data_pro(database_fotos_dir, yolo_model)
        
        # Entrenar modelo
        model = train_model_professional(
            images, labels, len(employee_info),
            epochs=50,
            batch_size=32,
            learning_rate=0.0001
        )
        
        # Guardar modelo
        save_model_professional(model, employee_info, output_dir)
        
        print()
        print("="*60)
        print("✅ ENTRENAMIENTO PROFESIONAL COMPLETADO")
        print("="*60)
        print()
        print(f"Modelo guardado en: {output_dir}")
        print(f"Empleados reconocibles: {len(employee_info)}")
        print()
        print("El modelo está listo para usar en reconocimiento facial")
        
    except Exception as e:
        print(f"[ERROR] Error durante el entrenamiento: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

