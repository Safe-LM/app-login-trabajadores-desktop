"""
Custom QWidgets for Safe Link Monitoring Station.

Export:
    ConfidenceRing   — Animated circular confidence indicator
    GlassCard        — Glassmorphism container
    StatusBadge      — Dot + label status indicator
    InfoRow          — Label + value row with accent dot
    HealthBar        — Gradient progress bar for system health
    ActivityList     — Scrollable recent attendance list
    NotificationOverlay  — Temporary full-screen message
    NumPad           — PIN keypad for supervisor panel
    AvatarCircle     — Circular photo with status ring
"""

from ui.widgets.confidence_ring import ConfidenceRing
from ui.widgets.glass_card import GlassCard
from ui.widgets.status_badge import StatusBadge
from ui.widgets.info_row import InfoRow
from ui.widgets.health_bar import HealthBar
from ui.widgets.activity_list import ActivityList
from ui.widgets.notification_overlay import NotificationOverlay
from ui.widgets.avatar_circle import AvatarCircle
from ui.widgets.numpad import Numpad

__all__ = [
    "ConfidenceRing",
    "GlassCard",
    "StatusBadge",
    "InfoRow",
    "HealthBar",
    "ActivityList",
    "NotificationOverlay",
    "AvatarCircle",
    "Numpad",
]
