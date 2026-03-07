"""
Sistema AUTOMÁTICO de entrenamiento de modelo facial.
Procesa todas las fotos automáticamente sin interacción.
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
        
        # Convertir numpy array a PIL Image si es necesario
        if isinstance(image, np.ndarray):
            if len(image.shape) == 3:
                # BGR a RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                image = Image.fromarray(image_rgb)
            else:
                image = Image.fromarray(image)
        elif not isinstance(image, Image.Image):
            # Si no es numpy ni PIL, intentar convertir
            image = Image.fromarray(np.array(image))
        
        # Aplicar transformaciones
        if self.transform:
            image = self.transform(image)
        
        return image, label

class FaceRecognitionModel(nn.Module):
    """Modelo de reconocimiento facial basado en ResNet."""
    
    def __init__(self, num_classes: int):
        super(FaceRecognitionModel, self).__init__()
        try:
            # Usar ResNet34 en lugar de ResNet18 para mayor capacidad y precisión
            self.backbone = models.resnet34(weights='IMAGENET1K_V1')
        except:
            try:
                self.backbone = models.resnet34(pretrained=True)
            except:
                # Fallback a ResNet18 si ResNet34 no está disponible
                self.backbone = models.resnet18(pretrained=True)
        num_features = self.backbone.fc.in_features
        # Arquitectura mejorada con más capacidad para mejor precisión
        self.backbone.fc = nn.Sequential(
            nn.Dropout(0.4),  # Dropout reducido para menos regularización
            nn.Linear(num_features, 1024),  # Capa más grande
            nn.ReLU(),
            nn.BatchNorm1d(1024),  # BatchNorm para estabilidad
            nn.Dropout(0.3),
            nn.Linear(1024, 512),  # Capa intermedia
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(0.2),
            nn.Linear(512, num_classes)
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
    canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = img_resized
    
    lab = cv2.cvtColor(canvas, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    canvas = cv2.merge([l, a, b])
    canvas = cv2.cvtColor(canvas, cv2.COLOR_LAB2BGR)
    
    return canvas

def detect_and_crop_person_auto(img: np.ndarray, yolo_model) -> Tuple[np.ndarray, float]:
    """Detectar y recortar persona automáticamente con YOLO."""
    # Detectar personas (clase 0) con YOLO - confianza mínima más baja para mejor detección
    results = yolo_model(img, classes=[0], verbose=False, conf=0.25)
    
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
        return img, 0.0
    
    x1, y1, x2, y2 = mejor_bbox
    h, w = img.shape[:2]
    
    # Calcular dimensiones de la bounding box
    bbox_w = x2 - x1
    bbox_h = y2 - y1
    
    # Márgenes inteligentes para capturar mejor el rostro
    # Más margen arriba (para capturar cabeza completa)
    margin_top = int(bbox_h * 0.3)  # 30% arriba
    margin_bottom = int(bbox_h * 0.1)  # 10% abajo
    margin_sides = int(bbox_w * 0.15)  # 15% a los lados
    
    x1 = max(0, x1 - margin_sides)
    y1 = max(0, y1 - margin_top)
    x2 = min(w, x2 + margin_sides)
    y2 = min(h, y2 + margin_bottom)
    
    cropped = img[y1:y2, x1:x2]
    
    if cropped.size > 0:
        # Asegurar que la imagen recortada tenga un tamaño mínimo
        min_size = 50
        if cropped.shape[0] < min_size or cropped.shape[1] < min_size:
            # Si es muy pequeña, usar imagen completa
            return img, mejor_conf * 0.5
        
        return cropped, mejor_conf
    
    return img, 0.0

def load_employee_data_from_json(json_path: Path) -> Dict[int, Dict]:
    """Cargar datos de empleados desde JSON."""
    if not json_path.exists():
        print(f"[WARNING] JSON no encontrado: {json_path}")
        return {}
    
    with open(json_path, 'r', encoding='utf-8') as f:
        employees_list = json.load(f)
    
    # Convertir lista a diccionario por employee_id
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
    """Cargar datos de empleados (prioriza JSON, fallback a CSV)."""
    base_dir = Path(__file__).parent
    json_path = base_dir / "database_fotos" / "json" / "employees_db.json"
    
    # Intentar cargar desde JSON primero
    if json_path.exists():
        print(f"[OK] Cargando datos desde JSON: {json_path.name}")
        return load_employee_data_from_json(json_path)
    
    # Fallback a CSV
    print("[INFO] JSON no encontrado, usando CSV...")
    from utils.employee_mapper import load_employee_data as load_csv
    return load_csv()

def organize_photos_by_employee(database_fotos_dir: Path, employee_data: Dict[int, Dict]) -> Dict[int, List[Path]]:
    """Organizar fotos por empleado usando el JSON (versión mejorada y robusta)."""
    photos_by_employee = {}
    photos_dir = database_fotos_dir / "photos"
    
    if not photos_dir.exists():
        print(f"[WARNING] Carpeta de fotos no encontrada: {photos_dir}")
        # Fallback: buscar en database_fotos directamente
        photos_dir = database_fotos_dir
    
    print(f"[INFO] Buscando fotos en: {photos_dir}")
    print(f"[INFO] Total empleados en JSON: {len(employee_data)}")
    print()
    
    # Crear índice de todas las fotos disponibles para búsqueda rápida
    all_photo_files = {}
    for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
        for photo_file in photos_dir.glob(ext):
            all_photo_files[photo_file.name.lower()] = photo_file
            # También indexar sin extensión para búsqueda flexible
            all_photo_files[photo_file.stem.lower()] = photo_file
    
    print(f"[INFO] Total fotos encontradas: {len(all_photo_files)}")
    print()
    
    # Mapear fotos usando el JSON (método principal)
    matched_count = 0
    for employee_id, emp_info in sorted(employee_data.items()):
        photo_file = emp_info.get('photo_file', '')
        if not photo_file:
            print(f"  [WARNING] Empleado {employee_id} ({emp_info.get('nombre', 'N/A')}): Sin photo_file en JSON")
            continue
        
        # Normalizar el nombre del archivo
        photo_name = Path(photo_file).name
        photo_name_lower = photo_name.lower()
        
        # Intentar múltiples variaciones del nombre
        possible_names = [
            photo_name_lower,
            photo_name,  # Original
            photo_name_lower.replace('photos/', '').replace('\\', '/'),
            photo_name.replace('photos/', '').replace('\\', '/'),
        ]
        
        found = False
        for possible_name in possible_names:
            if possible_name in all_photo_files:
                photo_path = all_photo_files[possible_name]
                if employee_id not in photos_by_employee:
                    photos_by_employee[employee_id] = []
                photos_by_employee[employee_id].append(photo_path)
                print(f"  [OK] Empleado {employee_id} ({emp_info.get('nombre', 'N/A')}): {photo_path.name}")
                matched_count += 1
                found = True
                break
        
        if not found:
            print(f"  [WARNING] Empleado {employee_id} ({emp_info.get('nombre', 'N/A')}): Foto no encontrada ({photo_name})")
    
    print()
    print(f"[OK] Fotos emparejadas con JSON: {matched_count}/{len(employee_data)}")
    
    # Si faltan fotos, intentar método alternativo por nombre
    if matched_count < len(employee_data):
        print("[INFO] Intentando emparejar fotos restantes por nombre...")
        import re
        
        # Obtener todos los archivos de foto
        foto_files = []
        for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
            foto_files.extend(photos_dir.glob(ext))
        
        # Buscar fotos no emparejadas
        matched_files = set()
        for photos_list in photos_by_employee.values():
            matched_files.update(photos_list)
        
        unmatched_files = [f for f in foto_files if f not in matched_files]
        
        for foto_file in sorted(unmatched_files):
            # Buscar número en el nombre: photo_0001_p1.jpeg -> employee_id = 1
            match = re.search(r'photo_(\d+)', foto_file.stem)
            if match:
                employee_id = int(match.group(1))
                if employee_id in employee_data and employee_id not in photos_by_employee:
                    photos_by_employee[employee_id] = [foto_file]
                    print(f"  [OK] Empleado {employee_id} emparejado por nombre: {foto_file.name}")
                    matched_count += 1
    
    print()
    print(f"[OK] Total fotos emparejadas: {matched_count}/{len(employee_data)}")
    
    if not photos_by_employee:
        raise ValueError("[ERROR] No se encontraron fotos para ningún empleado. Verifica que las fotos existan y que el JSON tenga los campos 'photo_file' correctos.")
    
    return photos_by_employee

def prepare_training_data_auto(database_fotos_dir: Path, yolo_model) -> Tuple[List[np.ndarray], List[int], Dict[int, Dict]]:
    """Preparar datos de entrenamiento automáticamente."""
    print("Cargando datos de empleados...")
    employee_data = load_employee_data()
    
    print("Organizando fotos por empleado...")
    photos_by_employee = organize_photos_by_employee(database_fotos_dir, employee_data)
    
    if not photos_by_employee:
        raise ValueError("[ERROR] No se encontraron fotos organizadas por empleado")
    
    print(f"[OK] Encontrados {len(photos_by_employee)} empleados con fotos")
    print("\n" + "="*60)
    print("MODO AUTOMATICO - Procesando todas las fotos")
    print("="*60)
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
        print(f"  Zona: {employee_info[label_idx]['zona']} | Sucursal: {employee_info[label_idx]['sucursal']} | Puesto: {employee_info[label_idx]['puesto']}")
        
        # Procesar cada foto del empleado automáticamente
        for photo_file in photo_files:
            try:
                # Leer imagen
                img = cv2.imread(str(photo_file))
                if img is None:
                    print(f"  [SKIP] No se pudo leer: {photo_file.name}")
                    continue
                
                # Detectar y recortar persona automáticamente con YOLO
                cropped, conf = detect_and_crop_person_auto(img, yolo_model)
                
                if conf < 0.25:
                    print(f"  [WARNING] {photo_file.name}: Confianza YOLO baja ({conf:.2f}), usando imagen completa")
                elif conf < 0.5:
                    print(f"  [INFO] {photo_file.name}: Confianza YOLO media ({conf:.2f})")
                
                # Preprocesar imagen (mejora contraste, normaliza, etc.)
                processed = preprocess_image(cropped)
                
                if processed is not None:
                    images.append(processed)
                    labels.append(label_idx)
                    employee_info[label_idx]['num_fotos'] += 1
                    print(f"  [OK] {photo_file.name} procesada (confianza YOLO: {conf:.2f})")
                else:
                    print(f"  [SKIP] {photo_file.name}: No se pudo preprocesar")
                    
            except Exception as e:
                print(f"  [ERROR] Error procesando {photo_file.name}: {e}")
                continue
        
        print(f"  Total caras agregadas para este empleado: {employee_info[label_idx]['num_fotos']}\n")
    
    print(f"[OK] Total de imagenes procesadas: {len(images)}")
    print(f"[OK] Total de clases (empleados): {len(employee_info)}")
    
    return images, labels, employee_info

def train_model(images: List[np.ndarray], labels: List[int], num_classes: int, 
                epochs: int = 80, batch_size: int = 16, learning_rate: float = 0.0005):
    """Entrenar el modelo de reconocimiento facial (versión mejorada y robusta)."""
    
    print("\n" + "="*60)
    print("INICIANDO ENTRENAMIENTO DEL MODELO (VERSIÓN ROBUSTA)")
    print("="*60)
    
    if len(images) < 2:
        raise ValueError("[ERROR] Se necesitan al menos 2 imagenes para entrenar")
    
    # Verificar distribución de clases
    from collections import Counter
    label_counts = Counter(labels)
    min_samples_per_class = min(label_counts.values())
    max_samples_per_class = max(label_counts.values())
    
    print(f"[INFO] Distribución de clases:")
    print(f"  Mínimo muestras por clase: {min_samples_per_class}")
    print(f"  Máximo muestras por clase: {max_samples_per_class}")
    print(f"  Clases con 1 muestra: {sum(1 for count in label_counts.values() if count == 1)}")
    
    # Manejar caso especial: todas las clases tienen solo 1 muestra
    if min_samples_per_class == 1 and max_samples_per_class == 1:
        print(f"[INFO] Todas las clases tienen solo 1 muestra. Duplicando imágenes para crear conjunto de validación.")
        # Duplicar imágenes para crear conjunto de validación
        # Usar las mismas imágenes pero con transformaciones diferentes
        X_train = images.copy()
        y_train = labels.copy()
        X_val = images.copy()  # Usaremos las mismas imágenes pero con transformaciones de validación
        y_val = labels.copy()
        print(f"[INFO] Usando todas las {len(images)} imágenes para entrenamiento y validación (duplicadas)")
    else:
        # Ajustar test_size dinámicamente según el número de muestras
        # Si hay clases con 1 muestra, usar test_size más pequeño
        if min_samples_per_class == 1:
            test_size = 0.1  # 10% para validación
            print(f"[INFO] Usando test_size=0.1 (algunas clases tienen solo 1 muestra)")
        elif min_samples_per_class == 2:
            test_size = 0.15  # 15% para validación
            print(f"[INFO] Usando test_size=0.15 (algunas clases tienen solo 2 muestras)")
        else:
            test_size = 0.2  # 20% para validación (estándar)
        
        # Solo usar stratify si todas las clases tienen al menos 2 muestras
        use_stratify = min_samples_per_class >= 2 and len(set(labels)) > 1
        
        if not use_stratify:
            print(f"[WARNING] Usando split sin estratificación (algunas clases tienen solo 1 muestra)")
        
        # Asegurar que el test_size sea válido (< 1.0)
        # Si el test_size calculado es >= 1.0, usar un valor más pequeño
        if test_size >= 1.0:
            test_size = 0.1  # Usar 10% como mínimo seguro
            print(f"[INFO] Ajustando test_size a 0.1 (valor calculado era >= 1.0)")
        
        # Asegurar que haya suficientes muestras para validación
        min_val_samples = max(1, int(num_classes * 0.1))  # Al menos 10% de las clases o 1 muestra
        if test_size * len(images) < min_val_samples:
            test_size = max(0.05, min_val_samples / len(images))
            # Asegurar que test_size nunca sea >= 1.0
            if test_size >= 1.0:
                test_size = 0.1  # Forzar a 10% si aún es >= 1.0
            print(f"[INFO] Ajustando test_size a {test_size:.2f} para asegurar al menos {min_val_samples} muestras en validación")
        
        X_train, X_val, y_train, y_val = train_test_split(
            images, labels, test_size=test_size, random_state=42, stratify=labels if use_stratify else None
        )
        
        # Verificar que ambas particiones tengan al menos 1 muestra
        if len(X_train) == 0 or len(X_val) == 0:
            # Si la validación está vacía, duplicar imágenes para validación
            print("[WARNING] Validación vacía después del split, duplicando imágenes para validación")
            X_train = images.copy()
            y_train = labels.copy()
            X_val = images.copy()
            y_val = labels.copy()
    
    print(f"Datos de entrenamiento: {len(X_train)}")
    print(f"Datos de validacion: {len(X_val)}")
    
    # Data augmentation más robusta y variada
    train_transform = transforms.Compose([
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),  # Rotación para mejor generalización
        transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.3, hue=0.1),  # Más variación de color
        transforms.RandomAffine(degrees=0, translate=(0.15, 0.15), scale=(0.9, 1.1)),  # Desplazamientos y escala
        transforms.RandomPerspective(distortion_scale=0.2, p=0.3),  # Perspectiva aleatoria
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.2, scale=(0.02, 0.1))  # Random erasing para robustez
    ])
    
    val_transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    train_dataset = EmployeeFaceDataset(X_train, y_train, transform=train_transform)
    val_dataset = EmployeeFaceDataset(X_val, y_val, transform=val_transform)
    
    # DataLoaders con pin_memory para mejor rendimiento en GPU
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=True if torch.cuda.is_available() else False)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=True if torch.cuda.is_available() else False) if len(X_val) > 0 else None
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Usando dispositivo: {device}")
    
    model = FaceRecognitionModel(num_classes=num_classes).to(device)
    # Label smoothing más suave para mejor precisión (menos regularización)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)  # Reducido de 0.1 a 0.05 para más precisión
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.005)  # Weight decay reducido
    # Scheduler con cosine annealing mejorado
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=learning_rate * 0.001)
    
    best_val_acc = 0.0
    best_model_state = None
    patience = 30  # Early stopping: esperar 30 epochs sin mejora (más paciencia para 100 epochs)
    patience_counter = 0
    
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
        
        # Validación (solo si hay datos de validación)
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        
        if val_loader is not None and len(X_val) > 0:
            model.eval()
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
        val_acc = 100 * val_correct / val_total if val_total > 0 else 0.0
        
        scheduler.step()
        
        if val_loader is not None and len(X_val) > 0:
            print(f"Epoch [{epoch+1}/{epochs}] - "
                  f"Train Loss: {train_loss/len(train_loader):.4f}, Train Acc: {train_acc:.2f}% - "
                  f"Val Loss: {val_loss/len(val_loader):.4f}, Val Acc: {val_acc:.2f}%")
            
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                best_model_state = model.state_dict().copy()
                patience_counter = 0  # Resetear contador de paciencia
                print(f"  [OK] Nuevo mejor modelo guardado (Val Acc: {val_acc:.2f}%)")
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"  [INFO] Early stopping: sin mejora por {patience} epochs. Mejor Val Acc: {best_val_acc:.2f}%")
                    break
        else:
            print(f"Epoch [{epoch+1}/{epochs}] - "
                  f"Train Loss: {train_loss/len(train_loader):.4f}, Train Acc: {train_acc:.2f}%")
            
            # Si no hay validación, guardar el mejor modelo basado en train_acc
            if train_acc > best_val_acc:
                best_val_acc = train_acc
                best_model_state = model.state_dict().copy()
                patience_counter = 0
                print(f"  [OK] Nuevo mejor modelo guardado (Train Acc: {train_acc:.2f}%)")
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"  [INFO] Early stopping: sin mejora por {patience} epochs. Mejor Train Acc: {best_val_acc:.2f}%")
                    break
    
    if best_model_state:
        model.load_state_dict(best_model_state)
    
    print(f"\n[OK] Entrenamiento completado. Mejor precision de validacion: {best_val_acc:.2f}%")
    
    return model

def save_model_and_metadata(model, employee_info: Dict, output_dir: Path):
    """Guardar modelo y metadatos."""
    output_dir.mkdir(exist_ok=True)
    
    model_path = output_dir / "face_recognition_model.pt"
    torch.save(model.state_dict(), model_path)
    print(f"[OK] Modelo guardado: {model_path}")
    
    metadata_path = output_dir / "employee_metadata.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(employee_info, f, indent=2, ensure_ascii=False)
    print(f"[OK] Metadatos guardados: {metadata_path}")
    
    info_path = output_dir / "model_info.txt"
    with open(info_path, 'w', encoding='utf-8') as f:
        f.write("="*60 + "\n")
        f.write("MODELO DE RECONOCIMIENTO FACIAL (AUTOMATICO)\n")
        f.write("="*60 + "\n\n")
        f.write(f"Total de empleados: {len(employee_info)}\n\n")
        f.write("Empleados registrados:\n")
        f.write("-"*60 + "\n")
        for label_idx, info in sorted(employee_info.items()):
            f.write(f"\nClase {label_idx}:\n")
            f.write(f"  Employee ID: {info['employee_id']}\n")
            f.write(f"  Nombre: {info['nombre']}\n")
            f.write(f"  Zona: {info['zona']}\n")
            f.write(f"  Sucursal: {info['sucursal']}\n")
            f.write(f"  Puesto: {info['puesto']}\n")
            f.write(f"  Caras agregadas: {info['num_fotos']}\n")
    
    print(f"[OK] Informacion guardada: {info_path}")

def main():
    """Función principal."""
    print("="*60)
    print("ENTRENAMIENTO AUTOMATICO DE MODELO DE RECONOCIMIENTO FACIAL")
    print("="*60)
    print()
    print("Este modo procesa todas las fotos automaticamente")
    print("sin necesidad de interaccion manual.")
    print()
    
    base_dir = Path(__file__).parent
    database_fotos_dir = base_dir / "database_fotos"
    output_dir = base_dir / "models"
    yolo_model_path = base_dir / "yolo11s.pt"
    
    # Verificar que exista el JSON
    json_path = database_fotos_dir / "json" / "employees_db.json"
    if json_path.exists():
        print(f"[OK] JSON encontrado: {json_path.name}")
    else:
        print(f"[WARNING] JSON no encontrado en: {json_path}")
        print("  El script intentará usar CSV como fallback")
    
    if not database_fotos_dir.exists():
        print(f"[ERROR] No se encontro la carpeta: {database_fotos_dir}")
        return
    
    if not yolo_model_path.exists():
        print(f"[ERROR] No se encontro el modelo YOLO: {yolo_model_path}")
        return
    
    # Cargar YOLO
    print("Cargando modelo YOLO...")
    yolo_model = YOLO(str(yolo_model_path))
    
    try:
        # Preparar datos automáticamente
        images, labels, employee_info = prepare_training_data_auto(database_fotos_dir, yolo_model)
        
        if len(images) == 0:
            print("[ERROR] No se procesaron imagenes")
            return
        
        if len(set(labels)) < 2:
            print("[ERROR] Se necesitan al menos 2 empleados diferentes para entrenar")
            return
        
        # Entrenar modelo con más epochs para mejor precisión
        num_classes = len(employee_info)
        model = train_model(images, labels, num_classes, epochs=100, batch_size=8, learning_rate=0.0003)
        
        # Guardar modelo y metadatos
        save_model_and_metadata(model, employee_info, output_dir)
        
        print("\n" + "="*60)
        print("[OK] ENTRENAMIENTO COMPLETADO EXITOSAMENTE")
        print("="*60)
        print(f"\nModelo guardado en: {output_dir}")
        print(f"Empleados reconocibles: {num_classes}")
        print(f"\nEl modelo esta listo para usar en reconocimiento facial")
        
    except KeyboardInterrupt:
        print("\n\n[WARNING] Entrenamiento cancelado por el usuario")
    except Exception as e:
        print(f"\n[ERROR] Error durante el entrenamiento: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

