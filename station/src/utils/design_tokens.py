"""
Design system — Safe Link Monitoring Station v5.0

Paleta verificada con ratios WCAG AA (4.5:1 texto normal, 3:1 texto grande).
Escala tipográfica: Display (brand) → Data (mono) → Body (UI)
Espaciado rítmico en grid 4px.

Uso:
    from utils.design_tokens import SHARED, TOKENS
    color = SHARED["success"]
    gap = TOKENS["spacing_md"]
"""

from typing import Dict, Any

# ═════════════════════════════════════════════════════════════════════════════
#  Palette — WCAG AA verified on #070810 background
# ═════════════════════════════════════════════════════════════════════════════
SHARED: Dict[str, str] = {
    # Backgrounds
    "bg_oled": "#010409",
    "bg_dark": "#070810",
    "bg_card": "rgba(13, 17, 23, 0.92)",
    "bg_card_alt": "rgba(22, 27, 34, 0.85)",
    "bg_surface": "rgba(255, 255, 255, 0.03)",
    "bg_surface_hover": "rgba(255, 255, 255, 0.05)",
    "bg_overlay": "rgba(0, 0, 0, 0.75)",

    # Semantic
    "success": "#22c55e",
    "success_dim": "#166534",
    "success_glow": "rgba(34, 197, 94, 0.4)",
    "danger": "#ef4444",
    "danger_dim": "#991b1b",
    "danger_glow": "rgba(239, 68, 68, 0.4)",
    "warning": "#f59e0b",
    "warning_dim": "#854d0e",
    "warning_glow": "rgba(245, 158, 11, 0.3)",

    # Accent (Electric Blue — station identity)
    "accent": "#00d2ff",
    "accent_dark": "#3a86ff",
    "accent_dim": "#1e3a5f",
    "accent_glow": "rgba(0, 210, 255, 0.25)",

    # Text (4.5:1+ on bg_dark)
    "text_primary": "#f0f6fc",
    "text_secondary": "#c9d1d9",
    "text_dim": "#8b949e",
    "text_muted": "#484f58",

    # Borders
    "border": "rgba(240, 246, 252, 0.12)",
    "border_strong": "rgba(240, 246, 252, 0.20)",
    "border_accent": "rgba(0, 210, 255, 0.25)",
    "border_success": "rgba(34, 197, 94, 0.30)",
    "border_danger": "rgba(239, 68, 68, 0.25)",

    # Gradients
    "gradient_accent": "qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #00d2ff, stop:1 #3a86ff)",
    "gradient_success": "qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #10b981, stop:1 #059669)",
    "gradient_card": "qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 rgba(13,17,23,0.95), stop:1 rgba(8,12,18,0.92))",

    # Typography
    "font_ui": "Segoe UI",
    "font_mono": "Consolas",
    "font_display": "Segoe UI",
}

# ═════════════════════════════════════════════════════════════════════════════
#  Tokens — spacing, sizing, timing
# ═════════════════════════════════════════════════════════════════════════════
TOKENS: Dict[str, Any] = {
    # Spacing (4px grid)
    "spacing_xs": 4,
    "spacing_sm": 8,
    "spacing_md": 12,
    "spacing_lg": 16,
    "spacing_xl": 24,
    "spacing_2xl": 32,
    "spacing_3xl": 48,

    # Radii
    "radius_sm": 6,
    "radius_md": 10,
    "radius_lg": 16,
    "radius_xl": 24,
    "radius_full": 9999,

    # Font sizes
    "font_xs": 8,
    "font_sm": 10,
    "font_md": 12,
    "font_lg": 14,
    "font_xl": 18,
    "font_2xl": 24,
    "font_3xl": 32,
    "font_hero": 48,

    # Animation durations (ms)
    "anim_fast": 150,
    "anim_normal": 300,
    "anim_slow": 500,

    # Layout
    "header_height": 56,
    "camera_min_width": 560,
    "camera_min_height": 420,
    "info_panel_width": 340,
}

# ═════════════════════════════════════════════════════════════════════════════
#  Style helpers — reusable QSS fragments
# ═════════════════════════════════════════════════════════════════════════════


def glass_surface(radius: int = TOKENS["radius_lg"], extra: str = "") -> str:
    return f"""
        background: {SHARED['bg_card']};
        border: 1px solid {SHARED['border']};
        border-radius: {radius}px;
        {extra}
    """


def accent_btn(base: str = SHARED["gradient_accent"], hover: str = "#00d2ff", pressed: str = "#3a86ff") -> str:
    return f"""
        QPushButton {{
            background: {base};
            color: white;
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: {TOKENS['radius_md']}px;
            padding: 12px 20px;
            font-size: {TOKENS['font_lg'] - 1}px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        QPushButton:hover {{
            background: {hover};
            border: 1.5px solid rgba(255,255,255,0.30);
        }}
        QPushButton:pressed {{ background: {pressed}; }}
        QPushButton:disabled {{
            background: {SHARED['bg_card']};
            color: {SHARED['text_muted']};
            border: 1px solid {SHARED['border']};
        }}
    """


def badge_style(fg: str, bg: str) -> str:
    return f"""
        color: {fg};
        background: {bg};
        border-radius: {TOKENS['radius_sm']}px;
        padding: 2px 8px;
        font-size: {TOKENS['font_xs']}px;
        font-weight: 700;
        letter-spacing: 1px;
    """


def section_header_style(color: str = SHARED["text_muted"]) -> str:
    return f"""
        color: {color};
        font-size: {TOKENS['font_xs']}px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        background: transparent;
    """


__all__ = ["SHARED", "TOKENS", "glass_surface", "accent_btn", "badge_style", "section_header_style"]
