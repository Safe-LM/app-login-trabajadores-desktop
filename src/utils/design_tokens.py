"""
Design tokens compartidos entre ventanas de Safe Link Monitoring.

Uso:
    from utils.design_tokens import SHARED
    color = SHARED["success"]
"""

SHARED = {
    # Backgrounds OLED
    "bg_oled": "#010409",
    "bg_dark": "#0a0f1a",
    # Semánticos
    "success": "#22c55e",
    "danger": "#ef4444",
    "warning": "#f59e0b",
    # Texto
    "text_primary": "#f0f6fc",
    "text_dim": "#8b949e",
    "text_muted": "#484f58",
    # Bordes (opacidad 0.18 mínimo para ser visibles en dark mode)
    "border": "rgba(240, 246, 252, 0.18)",
    "border_strong": "rgba(240, 246, 252, 0.28)",
    # Tipografía
    "font_ui": "Segoe UI",
    "font_mono": "Consolas",  # Para valores numéricos: confianza, hora, stats
}
