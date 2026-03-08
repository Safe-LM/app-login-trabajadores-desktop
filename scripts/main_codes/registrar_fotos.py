"""
Script standalone para registrar fotos en el sistema de reconocimiento.
Ejecuta este script ANTES de usar la aplicación para registrar las fotos.
"""

import sys
from pathlib import Path

# Agregar el directorio actual al path
base_dir = Path(__file__).parent
sys.path.insert(0, str(base_dir))

from utils.register_photos import register_photos_from_database

if __name__ == "__main__":
    print("=" * 60)
    print("REGISTRO DE FOTOS EN SISTEMA DE RECONOCIMIENTO FACIAL")
    print("=" * 60)
    print()
    print("Este script registra las fotos de database_fotos/ como embeddings")
    print("para que el sistema pueda reconocer a los trabajadores.")
    print()

    success = register_photos_from_database()

    print()
    print("=" * 60)
    if success:
        print("✅ REGISTRO COMPLETADO EXITOSAMENTE")
        print()
        print("Ahora puedes ejecutar la aplicación y el sistema reconocerá")
        print("a los trabajadores registrados.")
    else:
        print("❌ REGISTRO COMPLETADO CON ERRORES")
        print()
        print("Revisa los mensajes de error arriba para más detalles.")
    print("=" * 60)
