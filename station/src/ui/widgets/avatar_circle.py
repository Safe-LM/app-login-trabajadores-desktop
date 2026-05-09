"""
AvatarCircle — Circular photo with colored status border.
"""
from PyQt5.QtWidgets import QWidget, QLabel, QVBoxLayout
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPixmap, QFont
from utils.design_tokens import SHARED, TOKENS


class AvatarCircle(QWidget):
    """Circular employee photo with status ring and label."""

    __slots__ = ("_photo_label", "_name_label", "_badge", "size")

    def __init__(self, size: int = 120, parent=None):
        super().__init__(parent)
        self.size = size
        self.setFixedSize(size + 20, size + 60)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(TOKENS["spacing_xs"])
        lay.setAlignment(Qt.AlignCenter)

        # Photo frame
        self._photo_label = QLabel()
        self._photo_label.setFixedSize(size, size)
        self._photo_label.setAlignment(Qt.AlignCenter)
        self._photo_label.setStyleSheet(f"""
            QLabel {{
                background: rgba(30, 41, 59, 0.4);
                border-radius: {size // 2}px;
                border: 2px dashed {SHARED['border']};
            }}
        """)
        lay.addWidget(self._photo_label, 0, Qt.AlignCenter)

        # Name below
        self._name_label = QLabel("")
        self._name_label.setAlignment(Qt.AlignCenter)
        self._name_label.setFont(QFont(SHARED["font_ui"], TOKENS["font_sm"], QFont.Bold))
        self._name_label.setStyleSheet(f"color: {SHARED['text_primary']}; background: transparent;")
        self._name_label.setWordWrap(True)
        self._name_label.setMaximumWidth(size + 20)

    def set_photo(self, pixmap: QPixmap | None, name: str = "") -> None:
        if pixmap and not pixmap.isNull():
            scaled = pixmap.scaled(
                self.size - 8, self.size - 8,
                Qt.KeepAspectRatio, Qt.SmoothTransformation,
            )
            self._photo_label.setPixmap(scaled)
            self._photo_label.setStyleSheet(f"""
                QLabel {{
                    background: rgba(30, 41, 59, 0.6);
                    border-radius: {self.size // 2}px;
                    border: 2px solid {SHARED['border_success']};
                }}
            """)
        else:
            self._photo_label.clear()
            self._photo_label.setStyleSheet(f"""
                QLabel {{
                    background: rgba(30, 41, 59, 0.4);
                    border-radius: {self.size // 2}px;
                    border: 2px dashed {SHARED['border']};
                }}
            """)
        self._name_label.setText(name)

    def reset(self) -> None:
        self._photo_label.clear()
        self._photo_label.setStyleSheet(f"""
            QLabel {{
                background: rgba(30, 41, 59, 0.4);
                border-radius: {self.size // 2}px;
                border: 2px dashed {SHARED['border']};
            }}
        """)
        self._name_label.setText("Coloca tu\nrostro\naquí")
