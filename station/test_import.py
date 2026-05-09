"""Test script to find where 'Cannot read image.png' error comes from."""
import traceback
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = BASE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

print("1. Testing cv2 import...")
try:
    import cv2
    print("   cv2 OK")
except Exception as e:
    traceback.print_exc()

print("2. Testing dashboard_window import...")
try:
    from windows.dashboard_window import DashboardWindow
    print("   DashboardWindow imported OK")
except Exception as e:
    traceback.print_exc()

print("3. Done")
