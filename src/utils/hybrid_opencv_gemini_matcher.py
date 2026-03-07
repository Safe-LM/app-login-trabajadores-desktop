"""
Sistema Híbrido de Reconocimiento Facial: OpenCV + Gemini Vision API
- OpenCV detecta rostros rápidamente (sin bloqueos)
- Gemini hace matching preciso (cuando detecta rostro)
- Fallback a OpenCV si no hay internet
"""
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict
import logging
import os

logger = logging.getLogger(__name__)

# Importaciones opcionales
_requests_available = None
_requests = None
_gemini_available = None
_gemini_matcher = None

def _check_requests():
    """Verificar si requests está disponible."""
    global _requests_available, _requests
    if _requests_available is None:
        try:
            import requests
            _requests = requests
            _requests_available = True
        except ImportError:
            _requests_available = False
    return _requests_available

def _check_gemini():
    """Verificar si Gemini está configurado y disponible."""
    global _gemini_available, _gemini_matcher
    if _gemini_available is None:
        if not _check_requests():
            _gemini_available = False
            return False
        
        # Intentar obtener API key de variable de entorno primero
        api_key = os.getenv('GEMINI_API_KEY')
        
        if not api_key:
            try:
                from config_gemini import get_gemini_api_key
                api_key = get_gemini_api_key()
            except Exception as e:
                logger.debug(f"No se pudo cargar config_gemini: {e}")
        
        if not api_key:
            _gemini_available = False
            logger.debug("GEMINI_API_KEY no configurada - usando OpenCV")
            return False
        
        try:
            from src.utils.gemini_vision_matcher import GeminiVisionMatcher
            PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
            database_dir = PROJECT_ROOT / "data" / "photos"
            matcher = GeminiVisionMatcher(api_key=api_key, database_dir=database_dir)
            if matcher._disabled:
                _gemini_available = False
                logger.info("Gemini API key inválida o sin conexión - usando solo OpenCV")
                return False
            _gemini_matcher = matcher
            _gemini_available = True
            logger.info("Gemini Vision disponible")
            return True
        except Exception as e:
            _gemini_available = False
            logger.info(f"Gemini no disponible: {e} - usando solo OpenCV")
            return False
    
    return _gemini_available


class HybridOpenCVGeminiMatcher:
    """
    Sistema híbrido de reconocimiento:
    1. OpenCV detecta rostros (rápido, sin bloqueos)
    2. Gemini hace matching (preciso, cuando hay rostro)
    3. Fallback a OpenCV si no hay internet/Gemini
    """
    
    def __init__(self, database_dir: Optional[Path] = None):
        """Inicializar matcher híbrido. OpenCV es el motor principal."""
        if database_dir is None:
            PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
            database_dir = PROJECT_ROOT / "data" / "photos"
        self.database_dir = Path(database_dir)
        self.json_path = self.database_dir / "json" / "employees_db.json"
        
        try:
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
        except Exception as e:
            logger.warning(f"Error cargando Haar Cascade: {e}")
            self.face_cascade = None
        
        self.gemini_available = False
        self.gemini_matcher = None
        
        # Cargar OpenCV de inmediato (es el motor principal)
        self.opencv_matcher = None
        self._opencv_available = None
        self._check_opencv_lazy()
        
        logger.info("HybridMatcher inicializado (OpenCV como motor principal)")
    
    def _detect_face_fast(self, frame: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        Detectar rostro rápidamente usando OpenCV.
        
        Returns:
            (x, y, w, h) del rostro detectado, o None
        """
        if self.face_cascade is None or frame is None or frame.size == 0:
            return None
        
        try:
            # Convertir a escala de grises
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detectar rostros (configuración rápida)
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(80, 80),  # Tamaño mínimo más pequeño para detectar más fácil
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            if len(faces) == 0:
                return None
            
            # Retornar el rostro más grande
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            return tuple(largest_face)
        
        except Exception as e:
            logger.debug(f"Error detectando rostro: {e}")
            return None
    
    def _check_gemini_lazy(self):
        """Verificar Gemini de forma lazy (solo cuando se necesita)."""
        if not self.gemini_available:
            self.gemini_available = _check_gemini()
            if self.gemini_available:
                self.gemini_matcher = _gemini_matcher
        return self.gemini_available
    
    def _check_opencv_lazy(self):
        """Verificar y cargar OpenCV matcher de forma lazy (solo cuando se necesita)."""
        if self._opencv_available is None:
            try:
                from src.utils.face_recognition_opencv import get_opencv_recognizer
                self.opencv_matcher = get_opencv_recognizer(self.database_dir)
                self._opencv_available = self.opencv_matcher is not None
                if self._opencv_available:
                    logger.info("OpenCV matcher cargado")
                else:
                    logger.warning("OpenCV matcher no disponible")
            except Exception as e:
                logger.warning(f"Error cargando OpenCV matcher: {e}")
                self._opencv_available = False
                self.opencv_matcher = None
        return self._opencv_available
    
    def match_photo(
        self,
        frame: np.ndarray,
        min_confidence: float = 0.80,
        prefer_gemini: bool = True
    ) -> Tuple[bool, float, Optional[Dict], str]:
        """
        Hacer match usando sistema híbrido.
        OpenCV es el motor principal. Gemini es un boost opcional.
        
        Returns:
            (matched, confidence, employee_info, method_used)
        """
        if frame is None or frame.size == 0:
            return False, 0.0, None, "None"
        
        face_rect = self._detect_face_fast(frame)
        if face_rect is None:
            return False, 0.0, None, "NoFace"
        
        x, y, w, h = face_rect
        face_roi = frame[y:y+h, x:x+w]
        
        # Motor principal: OpenCV (siempre disponible, rápido, sin dependencias externas)
        if self._check_opencv_lazy() and self.opencv_matcher:
            try:
                matched, confidence, employee_info = self.opencv_matcher.recognize(frame)
                if matched and employee_info and confidence >= min_confidence:
                    logger.info(f"Match OpenCV: {employee_info.get('nombre', 'Unknown')} ({confidence:.1%})")
                    return True, confidence, employee_info, "OpenCV"
            except Exception as e:
                logger.debug(f"Error con OpenCV: {e}")
        
        # Boost opcional: Gemini (solo si está configurado y OpenCV no encontró match)
        if prefer_gemini and self._check_gemini_lazy() and self.gemini_matcher:
            try:
                matched, confidence, employee_info = self.gemini_matcher.match_photo(
                    frame, min_confidence=min_confidence
                )
                if matched and employee_info:
                    logger.info(f"Match Gemini: {employee_info.get('nombre', 'Unknown')} ({confidence:.1%})")
                    return True, confidence, employee_info, "Gemini"
            except Exception as e:
                logger.debug(f"Error con Gemini: {e}")
        
        return False, 0.0, None, "NoMatch"


import threading

_global_matcher = None
_matcher_lock = threading.Lock()

def get_hybrid_matcher(database_dir: Optional[Path] = None) -> Optional[HybridOpenCVGeminiMatcher]:
    """
    Obtener instancia global del matcher híbrido.
    Inicialización completamente lazy - no bloquea al importar.
    Thread-safe gracias a threading.Lock.
    """
    global _global_matcher

    if _global_matcher is not None:
        return _global_matcher

    acquired = _matcher_lock.acquire(blocking=False)
    if not acquired:
        return None

    try:
        if _global_matcher is None:
            _global_matcher = HybridOpenCVGeminiMatcher(database_dir)
        return _global_matcher
    except Exception as e:
        logger.error(f"Error inicializando matcher híbrido: {e}")
        return None
    finally:
        _matcher_lock.release()

def match_photo_hybrid(
    frame: np.ndarray,
    min_confidence: float = 0.80,
    prefer_gemini: bool = True,
    database_dir: Optional[Path] = None
) -> Tuple[bool, float, Optional[Dict], str]:
    """
    Función de conveniencia para matching híbrido.
    
    Returns:
        (matched, confidence, employee_info, method_used)
    """
    matcher = get_hybrid_matcher(database_dir)
    if matcher is None:
        return False, 0.0, None, "NotReady"
    return matcher.match_photo(frame, min_confidence, prefer_gemini)

