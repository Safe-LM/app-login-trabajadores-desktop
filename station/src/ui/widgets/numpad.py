"""
Numpad — PIN entry keypad for supervisor panel.
"""
from PyQt5.QtWidgets import QFrame, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QGridLayout
from PyQt5.QtCore import Qt, pyqtSignal, QTimer
from PyQt5.QtGui import QFont
from utils.design_tokens import SHARED, TOKENS


class Numpad(QFrame):
    """4-digit PIN entry keypad with dot indicators."""

    pin_entered = pyqtSignal(str)  # emitted with the 4-digit PIN
    cancelled = pyqtSignal()

    __slots__ = ("_pin", "_dots", "_dot_labels", "_status_label")

    _CORRECT_PIN = "1234"

    def __init__(self, correct_pin: str = "", parent=None):
        super().__init__(parent)
        self._pin = ""
        self.setStyleSheet(f"""
            QFrame {{
                background: transparent;
                border: none;
            }}
        """)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(TOKENS["spacing_xl"])
        lay.setAlignment(Qt.AlignCenter)

        # Info
        info_lay = QVBoxLayout()
        info_lay.setAlignment(Qt.AlignCenter)
        info_lay.setSpacing(TOKENS["spacing_sm"])

        lock_icon = QLabel("🔒")
        lock_icon.setAlignment(Qt.AlignCenter)
        lock_icon.setFont(QFont(SHARED["font_ui"], 28))
        lock_icon.setStyleSheet("background: transparent;")
        info_lay.addWidget(lock_icon)

        title = QLabel("Acceso Restringido")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(QFont(SHARED["font_ui"], TOKENS["font_lg"], QFont.Bold))
        title.setStyleSheet(f"color: {SHARED['text_primary']}; background: transparent;")
        info_lay.addWidget(title)

        sub = QLabel("Ingresa el PIN de supervisor")
        sub.setAlignment(Qt.AlignCenter)
        sub.setFont(QFont(SHARED["font_ui"], TOKENS["font_sm"]))
        sub.setStyleSheet(f"color: {SHARED['text_dim']}; background: transparent;")
        info_lay.addWidget(sub)
        lay.addLayout(info_lay)

        # PIN dots
        dots_lay = QHBoxLayout()
        dots_lay.setAlignment(Qt.AlignCenter)
        dots_lay.setSpacing(TOKENS["spacing_lg"])
        self._dot_labels = []
        for _ in range(4):
            dot = QLabel()
            dot.setFixedSize(18, 18)
            dot.setStyleSheet(
                f"background: transparent; border: 2px solid {SHARED['border_strong']}; border-radius: 9px;"
            )
            dots_lay.addWidget(dot)
            self._dot_labels.append(dot)
        lay.addLayout(dots_lay)

        # Status
        self._status_label = QLabel("")
        self._status_label.setAlignment(Qt.AlignCenter)
        self._status_label.setFont(QFont(SHARED["font_ui"], TOKENS["font_sm"], QFont.Bold))
        self._status_label.setStyleSheet("background: transparent;")
        self._status_label.setVisible(False)
        lay.addWidget(self._status_label)

        # Numpad grid
        grid = QGridLayout()
        grid.setSpacing(TOKENS["spacing_md"])

        keys = [
            ("1", 0, 0), ("2", 0, 1), ("3", 0, 2),
            ("4", 1, 0), ("5", 1, 1), ("6", 1, 2),
            ("7", 2, 0), ("8", 2, 1), ("9", 2, 2),
            ("", 3, 0),  ("0", 3, 1), ("⌫", 3, 2),
        ]

        for text, r, c in keys:
            btn = QPushButton(text)
            btn.setFixedSize(64, 52)
            btn.setFont(QFont(SHARED["font_ui"], TOKENS["font_lg"], QFont.Bold))
            if not text:
                btn.setEnabled(False)
                btn.setStyleSheet(
                    "background: transparent; border: none;"
                )
            else:
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background: {SHARED['bg_surface_hover']};
                        color: white;
                        border: 1px solid {SHARED['border']};
                        border-radius: {TOKENS['radius_lg']}px;
                    }}
                    QPushButton:hover {{
                        background: rgba(37, 99, 235, 0.15);
                        border: 1px solid rgba(37, 99, 235, 0.3);
                    }}
                    QPushButton:pressed {{
                        background: rgba(37, 99, 235, 0.25);
                    }}
                """)
                if text == "⌫":
                    btn.setStyleSheet(btn.styleSheet().replace(
                        "color: white;", f"color: {SHARED['text_dim']};"
                    ))
                btn.clicked.connect(lambda checked, t=text: self._on_key(t))
            grid.addWidget(btn, r, c)

        lay.addLayout(grid)

    def _on_key(self, key: str) -> None:
        self._status_label.setVisible(False)

        if key == "⌫":
            if self._pin:
                self._pin = self._pin[:-1]
        elif key.isdigit() and len(self._pin) < 4:
            self._pin += key

        # Update dots
        for i in range(4):
            if i < len(self._pin):
                self._dot_labels[i].setStyleSheet(
                    f"background: {SHARED['accent']}; border: 2px solid {SHARED['accent']}; border-radius: 9px;"
                )
            else:
                self._dot_labels[i].setStyleSheet(
                    f"background: transparent; border: 2px solid {SHARED['border_strong']}; border-radius: 9px;"
                )

        if len(self._pin) == 4:
            QTimer.singleShot(100, self._check_pin)

    def _check_pin(self) -> None:
        correct = self._CORRECT_PIN
        if self._pin == correct:
            self.pin_entered.emit(self._pin)
            self.reset()
        else:
            self._status_label.setText("PIN incorrecto")
            self._status_label.setStyleSheet(f"color: {SHARED['danger']}; background: transparent;")
            self._status_label.setVisible(True)
            self._pin = ""
            for dot in self._dot_labels:
                dot.setStyleSheet(
                    f"background: transparent; border: 2px solid {SHARED['border_danger']}; border-radius: 9px;"
                )
            QTimer.singleShot(800, lambda: [
                dot.setStyleSheet(
                    f"background: transparent; border: 2px solid {SHARED['border_strong']}; border-radius: 9px;"
                ) for dot in self._dot_labels
            ])

    def reset(self) -> None:
        self._pin = ""
        self._status_label.setVisible(False)
        for dot in self._dot_labels:
            dot.setStyleSheet(
                f"background: transparent; border: 2px solid {SHARED['border_strong']}; border-radius: 9px;"
            )
