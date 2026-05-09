"""
InfoRow — Label + value row with colored accent strip.
"""
from PyQt5.QtWidgets import QFrame, QHBoxLayout, QVBoxLayout, QLabel
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont
from utils.design_tokens import SHARED, TOKENS


class InfoRow(QFrame):
    """A single info row with: accent strip | icon | label | value."""

    __slots__ = ("_value_label",)

    def __init__(self, label: str, value: str = "--",
                 accent_color: str = SHARED["accent"], parent=None):
        super().__init__(parent)
        self.setStyleSheet(f"""
            QFrame {{
                background: {SHARED['bg_surface']};
                border: none;
                border-radius: {TOKENS['radius_md']}px;
            }}
        """)

        lay = QHBoxLayout(self)
        lay.setContentsMargins(10, 6, 10, 6)
        lay.setSpacing(8)

        # Accent strip
        strip = QLabel()
        strip.setFixedSize(3, 24)
        strip.setStyleSheet(f"background: {accent_color}; border-radius: 2px;")
        lay.addWidget(strip)

        # Text column: label (small, muted) + value (bold, white)
        text_col = QVBoxLayout()
        text_col.setSpacing(0)

        lbl = QLabel(label.upper())
        lbl.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"] - 1, QFont.Bold))
        lbl.setStyleSheet(
            f"color: {SHARED['text_muted']}; background: transparent; letter-spacing: 1px;"
        )
        text_col.addWidget(lbl)

        self._value_label = QLabel(value)
        self._value_label.setFont(QFont(SHARED["font_ui"], TOKENS["font_md"], QFont.Bold))
        self._value_label.setStyleSheet(
            f"color: {SHARED['text_primary']}; background: transparent;"
        )
        self._value_label.setWordWrap(True)
        text_col.addWidget(self._value_label)

        lay.addLayout(text_col)
        lay.addStretch()

    def set_value(self, value: str) -> None:
        self._value_label.setText(value)
