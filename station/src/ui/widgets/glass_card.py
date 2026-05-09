"""
GlassCard — Glassmorphism container frame.
"""
from PyQt5.QtWidgets import QFrame, QGraphicsDropShadowEffect, QVBoxLayout
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QColor
from utils.design_tokens import SHARED, TOKENS


class GlassCard(QFrame):
    """Glassmorphism card with optional shadow and custom layout."""

    __slots__ = ()

    def __init__(self, parent=None, radius: int = TOKENS["radius_xl"],
                 padding: int = TOKENS["spacing_lg"],
                 extra_style: str = "", child_layout=None):
        super().__init__(parent)
        self.setObjectName("glassCard")
        self.setStyleSheet(f"""
            QFrame#glassCard {{
                background: {SHARED['bg_card']};
                border: 1px solid {SHARED['border']};
                border-radius: {radius}px;
                {extra_style}
            }}
        """)

        if child_layout is None:
            lay = QVBoxLayout(self)
            lay.setContentsMargins(padding, padding, padding, padding)
            lay.setSpacing(TOKENS["spacing_md"])
        else:
            self.setLayout(child_layout)

    def add_shadow(self, blur: int = 30, offset: int = 4,
                   alpha: int = 80) -> QGraphicsDropShadowEffect:
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(blur)
        shadow.setColor(QColor(0, 0, 0, alpha))
        shadow.setOffset(0, offset)
        self.setGraphicsEffect(shadow)
        return shadow
