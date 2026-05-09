"""
ActivityList — Scrollable recent attendance records.
"""
from PyQt5.QtWidgets import (
    QFrame, QVBoxLayout, QHBoxLayout, QLabel, QScrollArea, QWidget,
    QSizePolicy,
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont
from utils.design_tokens import SHARED, TOKENS


class ActivityList(QFrame):
    """Scrollable list of recent attendance records."""

    __slots__ = ("_items_frame", "_items_lay", "_empty_label", "_scroll")

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet(f"""
            QFrame {{
                background: transparent;
                border: none;
            }}
        """)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(TOKENS["spacing_sm"])

        # Header
        header = QHBoxLayout()
        title = QLabel("ACTIVIDAD RECIENTE")
        title.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"] - 1, QFont.Bold))
        title.setStyleSheet(
            f"color: {SHARED['text_muted']}; background: transparent; "
            f"letter-spacing: 2px;"
        )
        header.addWidget(title)
        header.addStretch()
        badge = QLabel("HOY")
        badge.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"] - 2, QFont.Bold))
        badge.setStyleSheet(
            f"color: {SHARED['accent']}; background: rgba(0,210,255,0.08); "
            f"border: 1px solid rgba(0,210,255,0.20); "
            f"border-radius: {TOKENS['radius_sm']}px; padding: 1px 6px;"
        )
        header.addWidget(badge)
        lay.addLayout(header)

        # Scroll area for items
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self._scroll.setStyleSheet(f"""
            QScrollArea {{
                background: transparent;
                border: none;
            }}
            QScrollBar:vertical {{
                background: transparent;
                width: 4px;
            }}
            QScrollBar::handle:vertical {{
                background: {SHARED['border_strong']};
                border-radius: 2px;
                min-height: 16px;
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0;
            }}
        """)

        self._items_frame = QWidget()
        self._items_frame.setStyleSheet("background: transparent;")
        self._items_lay = QVBoxLayout(self._items_frame)
        self._items_lay.setContentsMargins(0, 0, 0, 0)
        self._items_lay.setSpacing(TOKENS["spacing_xs"])
        self._items_lay.addStretch()

        self._scroll.setWidget(self._items_frame)

        # Empty state
        self._empty_label = QLabel("Sin registros hoy")
        self._empty_label.setAlignment(Qt.AlignCenter)
        self._empty_label.setFont(QFont(SHARED["font_ui"], TOKENS["font_sm"]))
        self._empty_label.setStyleSheet(
            f"color: {SHARED['text_muted']}; background: transparent; padding: 12px;"
        )

        lay.addWidget(self._scroll)

    def set_records(self, records: list[dict]) -> None:
        # Clear existing items (keep stretch)
        while self._items_lay.count() > 1:
            item = self._items_lay.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        if not records:
            self._empty_label.setParent(self._items_frame)
            self._items_lay.insertWidget(0, self._empty_label)
            return

        self._empty_label.setParent(None)

        for rec in records:
            row = self._build_row(
                rec.get("nombre", "?"),
                rec.get("tipo", "?"),
                rec.get("hora", ""),
            )
            self._items_lay.insertWidget(self._items_lay.count() - 1, row)

    def add_record(self, nombre: str, tipo: str, hora: str) -> None:
        # Remove empty state if present
        self._empty_label.setParent(None)
        # Prepend new row
        row = self._build_row(nombre, tipo, hora)
        self._items_lay.insertWidget(0, row)

    def _build_row(self, nombre: str, tipo: str, hora: str) -> QFrame:
        row = QFrame()
        row.setStyleSheet(f"""
            QFrame {{
                background: {SHARED['bg_surface']};
                border: 1px solid {SHARED['border']};
                border-radius: {TOKENS['radius_md']}px;
            }}
        """)
        rl = QHBoxLayout(row)
        rl.setContentsMargins(8, 6, 10, 6)
        rl.setSpacing(8)

        is_entrada = tipo == "entrada"
        strip_color = SHARED["success"] if is_entrada else SHARED["accent"]
        strip = QLabel()
        strip.setFixedSize(2, 28)
        strip.setStyleSheet(f"background: {strip_color}; border-radius: 1px;")
        rl.addWidget(strip)

        info_col = QVBoxLayout()
        info_col.setSpacing(0)
        name_lbl = QLabel(nombre)
        name_lbl.setFont(QFont(SHARED["font_ui"], TOKENS["font_sm"], QFont.Bold))
        name_lbl.setStyleSheet(f"color: {SHARED['text_primary']}; background: transparent;")
        info_col.addWidget(name_lbl)
        tipo_lbl = QLabel(tipo.upper())
        tipo_lbl.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"], QFont.Bold))
        tipo_lbl.setStyleSheet(
            f"color: {strip_color}; background: transparent; letter-spacing: 1px;"
        )
        info_col.addWidget(tipo_lbl)
        rl.addLayout(info_col)
        rl.addStretch()

        hora_lbl = QLabel(hora)
        hora_lbl.setFont(QFont(SHARED["font_mono"], TOKENS["font_sm"], QFont.Bold))
        hora_lbl.setStyleSheet(f"color: {SHARED['text_dim']}; background: transparent;")
        rl.addWidget(hora_lbl)

        return row
