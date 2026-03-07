"""
Generador de logo oficial de Safe Link Monitoring.
Carga el logo desde archivo o lo genera dinámicamente.
"""
from PyQt5.QtGui import (
    QPixmap, QPainter, QColor, QFont, QLinearGradient, QBrush, QPen, QPolygon
)
from PyQt5.QtCore import Qt, QRect, QPoint
from pathlib import Path

def load_logo_from_file(size=200):
    """Cargar logo desde archivo."""
    # Buscar el logo en diferentes ubicaciones (prioridad: más específico primero)
    logo_paths = [
        Path(__file__).parent.parent / "logo_empresa.png",  # Raíz del proyecto
        Path(__file__).parent.parent / "assets" / "logo_empresa.png",  # Carpeta assets
        Path(__file__).parent.parent.parent / "app_loginTrabajadores_desktop_pyqt" / "logo_empresa.png",  # Ruta alternativa
    ]
    
    for logo_path in logo_paths:
        if logo_path.exists():
            pixmap = QPixmap(str(logo_path))
            if not pixmap.isNull():
                # Escalar al tamaño solicitado manteniendo aspecto
                scaled_pixmap = pixmap.scaled(
                    size, size,
                    Qt.KeepAspectRatio,
                    Qt.SmoothTransformation
                )
                return scaled_pixmap
    
    return None

def create_safelink_logo(size=200):
    """Crear logo oficial de Safe Link Monitoring."""
    # Intentar cargar desde archivo primero
    logo_from_file = load_logo_from_file(size)
    if logo_from_file:
        return logo_from_file
    
    # Si no existe el archivo, generar dinámicamente
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.transparent)
    
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.Antialiasing)
    
    center_x, center_y = size // 2, size // 2
    radius = size // 2 - 10
    
    # Círculo exterior blanco
    painter.setPen(QPen(QColor(255, 255, 255), 3))
    painter.setBrush(Qt.NoBrush)
    painter.drawEllipse(center_x - radius, center_y - radius, radius * 2, radius * 2)
    
    # Mapa de México (simplificado) - fondo gris oscuro
    painter.setPen(Qt.NoPen)
    painter.setBrush(QColor(60, 60, 60))  # Gris oscuro para el mapa
    
    # Forma simplificada de México
    mexico_points = [
        QPoint(int(center_x - radius * 0.6), int(center_y - radius * 0.3)),
        QPoint(int(center_x - radius * 0.4), int(center_y - radius * 0.5)),
        QPoint(int(center_x - radius * 0.2), int(center_y - radius * 0.4)),
        QPoint(int(center_x), int(center_y - radius * 0.3)),
        QPoint(int(center_x + radius * 0.3), int(center_y - radius * 0.2)),
        QPoint(int(center_x + radius * 0.5), int(center_y)),
        QPoint(int(center_x + radius * 0.4), int(center_y + radius * 0.3)),
        QPoint(int(center_x + radius * 0.2), int(center_y + radius * 0.5)),
        QPoint(int(center_x - radius * 0.1), int(center_y + radius * 0.4)),
        QPoint(int(center_x - radius * 0.3), int(center_y + radius * 0.3)),
        QPoint(int(center_x - radius * 0.5), int(center_y + radius * 0.1)),
    ]
    mexico_polygon = QPolygon(mexico_points)
    painter.drawPolygon(mexico_polygon)
    
    # Línea horizontal azul con gradiente
    line_y = center_y
    line_width = int(radius * 1.4)
    line_height = 4
    
    gradient = QLinearGradient(center_x - line_width // 2, line_y, center_x + line_width // 2, line_y)
    gradient.setColorAt(0, QColor(30, 144, 255))  # Azul oscuro
    gradient.setColorAt(0.5, QColor(100, 200, 255))  # Azul brillante
    gradient.setColorAt(1, QColor(30, 144, 255))  # Azul oscuro
    
    painter.setPen(Qt.NoPen)
    painter.setBrush(QBrush(gradient))
    painter.drawRoundedRect(
        center_x - line_width // 2,
        line_y - line_height // 2,
        line_width,
        line_height,
        2, 2
    )
    
    # Nodos/cuadrados en la línea azul
    painter.setBrush(QColor(200, 230, 255))  # Azul claro para nodos
    node_size = 6
    node_positions = [
        center_x - line_width * 0.4,
        center_x - line_width * 0.2,
        center_x,
        center_x + line_width * 0.2,
        center_x + line_width * 0.4,
    ]
    for pos in node_positions:
        painter.drawRect(
            int(pos - node_size // 2),
            int(line_y - node_size // 2),
            node_size,
            node_size
        )
    
    # Escudo azul brillante en el centro
    shield_size = int(radius * 0.4)
    shield_x = center_x - shield_size // 2
    shield_y = center_y - shield_size // 2
    
    # Gradiente para el escudo
    shield_gradient = QLinearGradient(shield_x, shield_y, shield_x + shield_size, shield_y + shield_size)
    shield_gradient.setColorAt(0, QColor(100, 200, 255))  # Azul claro
    shield_gradient.setColorAt(1, QColor(30, 144, 255))  # Azul oscuro
    
    painter.setBrush(QBrush(shield_gradient))
    painter.setPen(QPen(QColor(200, 230, 255), 2))
    
    # Forma de escudo
    shield_points = [
        QPoint(int(center_x), int(shield_y)),  # Top
        QPoint(int(shield_x), int(shield_y + shield_size * 0.2)),  # Top left
        QPoint(int(shield_x), int(shield_y + shield_size * 0.7)),  # Bottom left
        QPoint(int(center_x), int(shield_y + shield_size)),  # Bottom
        QPoint(int(shield_x + shield_size), int(shield_y + shield_size * 0.7)),  # Bottom right
        QPoint(int(shield_x + shield_size), int(shield_y + shield_size * 0.2)),  # Top right
    ]
    shield_polygon = QPolygon(shield_points)
    painter.drawPolygon(shield_polygon)
    
    # Candado blanco dentro del escudo
    lock_size = int(shield_size * 0.3)
    lock_x = center_x - lock_size // 2
    lock_y = center_y - lock_size * 0.1
    
    painter.setPen(QPen(QColor(255, 255, 255), 3))
    painter.setBrush(QColor(255, 255, 255))
    
    # Cuerpo del candado
    painter.drawRoundedRect(
        lock_x,
        int(lock_y + lock_size * 0.2),
        lock_size,
        int(lock_size * 0.6),
        2, 2
    )
    
    # Arco del candado
    painter.setBrush(Qt.NoBrush)
    painter.drawArc(
        int(lock_x - lock_size * 0.1),
        int(lock_y),
        int(lock_size * 1.2),
        int(lock_size * 0.6),
        0, 180 * 16
    )
    
    # Líneas de circuito alrededor del escudo
    painter.setPen(QPen(QColor(255, 255, 255), 1.5))
    painter.setBrush(Qt.NoBrush)
    
    circuit_lines = [
        # Líneas superiores
        (center_x - shield_size * 0.6, center_y - shield_size * 0.5, center_x - shield_size * 0.3, center_y - shield_size * 0.5),
        (center_x + shield_size * 0.3, center_y - shield_size * 0.5, center_x + shield_size * 0.6, center_y - shield_size * 0.5),
        # Líneas laterales
        (center_x - shield_size * 0.6, center_y - shield_size * 0.3, center_x - shield_size * 0.6, center_y + shield_size * 0.3),
        (center_x + shield_size * 0.6, center_y - shield_size * 0.3, center_x + shield_size * 0.6, center_y + shield_size * 0.3),
        # Líneas inferiores
        (center_x - shield_size * 0.6, center_y + shield_size * 0.5, center_x - shield_size * 0.3, center_y + shield_size * 0.5),
        (center_x + shield_size * 0.3, center_y + shield_size * 0.5, center_x + shield_size * 0.6, center_y + shield_size * 0.5),
    ]
    
    for x1, y1, x2, y2 in circuit_lines:
        painter.drawLine(int(x1), int(y1), int(x2), int(y2))
    
    # Puntos de conexión del circuito
    painter.setBrush(QColor(255, 255, 255))
    circuit_points = [
        (center_x - shield_size * 0.6, center_y - shield_size * 0.5),
        (center_x - shield_size * 0.3, center_y - shield_size * 0.5),
        (center_x + shield_size * 0.3, center_y - shield_size * 0.5),
        (center_x + shield_size * 0.6, center_y - shield_size * 0.5),
        (center_x - shield_size * 0.6, center_y),
        (center_x + shield_size * 0.6, center_y),
        (center_x - shield_size * 0.6, center_y + shield_size * 0.5),
        (center_x - shield_size * 0.3, center_y + shield_size * 0.5),
        (center_x + shield_size * 0.3, center_y + shield_size * 0.5),
        (center_x + shield_size * 0.6, center_y + shield_size * 0.5),
    ]
    
    for x, y in circuit_points:
        painter.drawEllipse(int(x - 2), int(y - 2), 4, 4)
    
    # Texto "SAFELINK" en la parte superior del círculo
    font = QFont()
    font.setPointSize(int(size * 0.08))
    font.setBold(True)
    painter.setFont(font)
    painter.setPen(QColor(255, 255, 255))
    
    text_rect = QRect(0, int(center_y - radius * 0.7), size, int(size * 0.2))
    painter.drawText(text_rect, Qt.AlignCenter, "SAFELINK")
    
    # Texto "MONITORING" en la parte inferior del círculo
    text_rect2 = QRect(0, int(center_y + radius * 0.5), size, int(size * 0.2))
    painter.drawText(text_rect2, Qt.AlignCenter, "MONITORING")
    
    painter.end()
    return pixmap

def create_logo(size=200):
    """Crear logo (compatibilidad con código existente)."""
    return create_safelink_logo(size)

def create_banner_logo(width=400, height=100):
    """Crear banner horizontal con logo y texto."""
    pixmap = QPixmap(width, height)
    pixmap.fill(Qt.transparent)
    
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.Antialiasing)
    
    # Logo pequeño a la izquierda
    logo = create_safelink_logo(80)
    painter.drawPixmap(10, 10, logo)
    
    # Texto "SAFE LINK"
    font = QFont()
    font.setPointSize(24)
    font.setBold(True)
    painter.setFont(font)
    painter.setPen(QColor(99, 102, 241))
    painter.drawText(QRect(100, 10, width - 110, 50), Qt.AlignLeft | Qt.AlignVCenter, "SAFE LINK")
    
    # Texto "SECURITY"
    font.setPointSize(14)
    font.setBold(False)
    painter.setFont(font)
    painter.setPen(QColor(148, 163, 184))
    painter.drawText(QRect(100, 50, width - 110, 40), Qt.AlignLeft | Qt.AlignVCenter, "SECURITY")
    
    painter.end()
    return pixmap
