"""
Integración con Google Gemini Vision API para matching robusto de fotos.
Opcional: requiere API key de Google Gemini.
"""
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict
import base64
import json
import logging
import os

logger = logging.getLogger(__name__)

# Intentar importar requests
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    logger.warning("⚠️ requests no disponible - Gemini Vision deshabilitado")


class GeminiVisionMatcher:
    """Matcher usando Google Gemini Vision API."""
    
    def __init__(self, api_key: Optional[str] = None, database_dir: Optional[Path] = None):
        """
        Inicializar matcher con Gemini Vision.
        
        Args:
            api_key: API key de Google Gemini (o usar variable de entorno GEMINI_API_KEY)
            database_dir: Directorio de la base de datos
        """
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests no está disponible")
        
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("Se requiere GEMINI_API_KEY (variable de entorno o parámetro)")
        
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.api_key}"
        
        if database_dir is None:
            PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
            database_dir = PROJECT_ROOT / "database_fotos"
        self.database_dir = Path(database_dir)
        self.json_path = self.database_dir / "json" / "employees_db.json"
        
        self.employees_db = self._load_employees_db()
        
        self._error_count = 0
        self._max_errors = 3
        self._disabled = False
        self._last_gemini_error = None
        
        self._validate_api_key()
        
        # logger.info(f"GeminiVisionMatcher inicializado con {len(self.employees_db)} empleados")
    
    def _validate_api_key(self):
        """Validar API key desactivada."""
        self._disabled = True
    
    def _load_employees_db(self) -> list:
        """Cargar base de datos de empleados."""
        try:
            if self.json_path.exists():
                with open(self.json_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []
        except Exception as e:
            logger.error(f"Error cargando BD: {e}")
            return []
    
    def _image_to_base64(self, image: np.ndarray) -> str:
        """Convertir imagen a base64."""
        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 95])
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        return image_base64
    
    def _load_employee_photo(self, employee_id: int) -> Optional[np.ndarray]:
        """Cargar foto de un empleado."""
        employee = next((e for e in self.employees_db if e.get('employee_id') == employee_id), None)
        if not employee:
            return None
        
        photo_file = employee.get('photo_file', '')
        if not photo_file:
            return None
        
        photo_path = self.database_dir / photo_file
        if not photo_path.exists():
            return None
        
        img = cv2.imread(str(photo_path))
        return img
    
    def _compare_with_gemini(
        self,
        query_image: np.ndarray,
        reference_image: np.ndarray,
        employee_name: str
    ) -> Tuple[bool, float]:
        """
        Comparar dos imágenes usando Gemini Vision.
        
        Args:
            query_image: Imagen de la cámara
            reference_image: Imagen de referencia de la BD
            employee_name: Nombre del empleado
        
        Returns:
            (is_match, confidence)
        """
        try:
            # Convertir imágenes a base64
            query_b64 = self._image_to_base64(query_image)
            ref_b64 = self._image_to_base64(reference_image)
            
            # Crear prompt
            prompt = f"""Compara estas dos imágenes de rostros humanos.

Imagen 1: Foto mostrada en cámara
Imagen 2: Foto de referencia de {employee_name}

¿Son la misma persona? Responde SOLO con un JSON en este formato exacto:
{{
    "is_same_person": true/false,
    "confidence": 0.0-1.0,
    "reasoning": "breve explicación"
}}

Sé muy estricto. Solo marca is_same_person como true si estás muy seguro (confidence > 0.85)."""
            
            # Preparar request (formato correcto para Gemini API)
            # Nota: Gemini puede recibir múltiples imágenes, pero el formato debe ser correcto
            payload = {
                "contents": [{
                    "parts": [
                        {
                            "text": prompt
                        },
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": query_b64
                            }
                        },
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": ref_b64
                            }
                        }
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 200,
                    "response_mime_type": "application/json"  # Forzar respuesta JSON
                }
            }
            
            # Hacer request con headers correctos
            headers = {
                "Content-Type": "application/json"
            }
            response = requests.post(self.api_url, json=payload, headers=headers, timeout=15)
            
            # Verificar respuesta
            if response.status_code != 200:
                error_detail = response.text[:200] if response.text else "Sin detalles"
                # Intentar parsear el error de Gemini
                try:
                    error_json = response.json()
                    error_msg = error_json.get('error', {}).get('message', error_detail)
                    logger.debug(f"Error Gemini API {response.status_code}: {error_msg}")
                except Exception:
                    logger.debug(f"Error Gemini API {response.status_code}: {error_detail}")
                raise requests.exceptions.HTTPError(f"{response.status_code}: {error_detail}")
            
            response.raise_for_status()
            
            # Si llegamos aquí, resetear contador de errores (éxito)
            self._error_count = 0
            
            result = response.json()
            
            # Extraer respuesta
            text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            
            # Parsear JSON de la respuesta
            try:
                # Buscar JSON en la respuesta
                import re
                json_match = re.search(r'\{[^}]+\}', text)
                if json_match:
                    parsed = json.loads(json_match.group())
                    is_match = parsed.get('is_same_person', False)
                    confidence = float(parsed.get('confidence', 0.0))
                    return is_match, confidence
            except Exception:
                # Si no se puede parsear, buscar palabras clave
                if "true" in text.lower() and "same" in text.lower():
                    return True, 0.8
                elif "false" in text.lower() or "different" in text.lower():
                    return False, 0.2
            
            return False, 0.0
            
        except requests.exceptions.HTTPError as e:
            self._error_count += 1
            # Solo loggear una vez cada tipo de error para no saturar
            if self._last_gemini_error != str(e)[:50]:
                logger.warning(f"⚠️ Error HTTP Gemini ({self._error_count}/{self._max_errors}): {str(e)[:100]}")
                self._last_gemini_error = str(e)[:50]
            
            # Deshabilitar si hay muchos errores
            if self._error_count >= self._max_errors:
                self._disabled = True
                logger.warning(f"⚠️ Gemini deshabilitado después de {self._max_errors} errores. Usando solo OpenCV.")
            return False, 0.0
        except Exception as e:
            self._error_count += 1
            # Solo loggear errores únicos
            if self._last_gemini_error != str(e)[:50]:
                logger.warning(f"⚠️ Error comparando con Gemini ({self._error_count}/{self._max_errors}): {str(e)[:100]}")
                self._last_gemini_error = str(e)[:50]
            
            # Deshabilitar si hay muchos errores
            if self._error_count >= self._max_errors:
                self._disabled = True
                logger.warning(f"⚠️ Gemini deshabilitado después de {self._max_errors} errores. Usando solo OpenCV.")
            return False, 0.0
    
    def match_photo(
        self,
        frame: np.ndarray,
        min_confidence: float = 0.85
    ) -> Tuple[bool, float, Optional[Dict]]:
        """
        Hacer match usando Gemini Vision.
        
        Args:
            frame: Frame de la cámara
            min_confidence: Confianza mínima
        
        Returns:
            (matched, confidence, employee_info)
        """
        # Si está deshabilitado por errores, retornar inmediatamente
        if self._disabled:
            return False, 0.0, None
        
        try:
            # Detectar rostro en el frame
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(100, 100))
            
            if len(faces) == 0:
                return False, 0.0, None
            
            # Tomar el rostro más grande
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = largest_face
            query_face = frame[y:y+h, x:x+w]
            
            # Comparar con cada empleado
            best_match = None
            best_confidence = 0.0
            best_employee = None
            
            for employee in self.employees_db:
                employee_id = employee.get('employee_id')
                employee_name = employee.get('nombre', '')
                
                # Cargar foto de referencia
                ref_image = self._load_employee_photo(employee_id)
                if ref_image is None:
                    continue
                
                # Comparar con Gemini (solo si no está deshabilitado)
                if not self._disabled:
                    is_match, confidence = self._compare_with_gemini(
                        query_face,
                        ref_image,
                        employee_name
                    )
                    
                    if is_match and confidence > best_confidence:
                        best_confidence = confidence
                        best_match = employee_id
                        best_employee = employee.copy()
                
                # Si Gemini está deshabilitado, salir del loop
                if self._disabled:
                    break
            
            # Verificar umbral
            if best_confidence >= min_confidence and best_employee:
                logger.info(f"✅ Match Gemini: {best_employee.get('nombre')} (confianza: {best_confidence:.3f})")
                return True, best_confidence, best_employee
            else:
                return False, best_confidence, None
                
        except Exception as e:
            logger.error(f"Error en match_photo Gemini: {e}")
            return False, 0.0, None


def match_with_gemini(
    frame: np.ndarray,
    api_key: Optional[str] = None,
    min_confidence: float = 0.85,
    database_dir: Optional[Path] = None
) -> Tuple[bool, float, Optional[Dict]]:
    """
    Función de conveniencia para matching con Gemini.
    
    Args:
        frame: Frame de la cámara
        api_key: API key (opcional, usa GEMINI_API_KEY env var)
        min_confidence: Confianza mínima
        database_dir: Directorio de BD
    
    Returns:
        (matched, confidence, employee_info)
    """
    try:
        matcher = GeminiVisionMatcher(api_key, database_dir)
        return matcher.match_photo(frame, min_confidence)
    except Exception as e:
        logger.error(f"Error inicializando Gemini matcher: {e}")
        return False, 0.0, None


