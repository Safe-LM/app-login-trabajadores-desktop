"""
ProvisioningService — orquesta el flujo zero-touch de activación.

Flujo:
  1. start() → pide token al backend con HWID
  2. Emite signal token_ready(token, activate_url) para que la UI muestre QR
  3. Se suscribe a Realtime sobre provisioning_tokens filtrado por token
  4. Cuando admin activa desde el panel, recibe los datos
  5. Guarda station_config.json y emite signal activated(config)
  6. La app principal reinicia/reload al dashboard
"""

import json
import logging
import threading
from pathlib import Path
from typing import Optional

from PyQt5.QtCore import QObject, QTimer, pyqtSignal

from utils.hwid import get_hwid
from utils.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "station_config.json"

PANEL_BASE_URL = "https://panel.safelink.app"


class ProvisioningService(QObject):

    token_ready = pyqtSignal(str, str)         # token, activate_url
    activated   = pyqtSignal(dict)             # config completa
    error       = pyqtSignal(str)
    expired     = pyqtSignal()                 # token caducó, hay que pedir otro

    def __init__(self, parent=None):
        super().__init__(parent)
        self._token: Optional[str] = None
        self._channel = None
        self._poll_timer: Optional[QTimer] = None
        self._stopped = False

    # ── API pública ──────────────────────────────────────────────────────────

    def start(self):
        """Arranca el flujo completo. Hace pedido de token en thread."""
        self._stopped = False
        threading.Thread(target=self._request_token, daemon=True).start()

    def stop(self):
        self._stopped = True
        if self._poll_timer:
            self._poll_timer.stop()
            self._poll_timer = None
        try:
            if self._channel:
                self._channel.unsubscribe()
        except Exception:
            pass

    # ── Implementación ───────────────────────────────────────────────────────

    def _request_token(self):
        """Pide un nuevo token al backend con el HWID de esta máquina."""
        try:
            sb = get_supabase_client()
            if not sb:
                QTimer.singleShot(0, lambda: self.error.emit("Sin conexión a Supabase"))
                return

            hwid = get_hwid()
            result = sb.rpc("crear_token_provisioning", {"p_hwid": hwid}).execute()
            data = result.data or {}

            if not data.get("ok"):
                err = data.get("error", "respuesta inválida")
                QTimer.singleShot(0, lambda e=err: self.error.emit(f"No se pudo generar token: {e}"))
                return

            self._token = data["token"]
            activate_url = data.get("activate_url") or f"{PANEL_BASE_URL}/activar?token={self._token}"
            logger.info(f"Token generado: {self._token}")

            QTimer.singleShot(0, lambda: self.token_ready.emit(self._token, activate_url))

            # Suscribirse a Realtime + arrancar polling fallback
            self._subscribe_realtime()
            QTimer.singleShot(0, self._start_polling)

        except Exception as e:
            logger.error(f"Error en _request_token: {e}")
            QTimer.singleShot(0, lambda e=e: self.error.emit(f"Error: {e}"))

    def _subscribe_realtime(self):
        """Suscripción a UPDATE en provisioning_tokens donde token=el nuestro."""
        try:
            sb = get_supabase_client()
            if not sb or not self._token:
                return

            channel_name = f"prov:{self._token}"
            self._channel = sb.channel(channel_name)

            def _on_update(payload):
                try:
                    new = payload.get("data", {}).get("record") or payload.get("new") or {}
                    if new.get("token") != self._token:
                        return
                    if new.get("estado") == "activado":
                        logger.info("Activación detectada por Realtime")
                        self._fetch_activation()
                except Exception as e:
                    logger.error(f"on_update error: {e}")

            self._channel.on_postgres_changes(
                event="UPDATE",
                schema="public",
                table="provisioning_tokens",
                filter=f"token=eq.{self._token}",
                callback=_on_update,
            ).subscribe()

            logger.info(f"Realtime conectado: {channel_name}")
        except Exception as e:
            logger.warning(f"Realtime no disponible para provisioning: {e}")

    def _start_polling(self):
        """Polling cada 4s como fallback a Realtime."""
        self._poll_timer = QTimer(self)
        self._poll_timer.setInterval(4000)
        self._poll_timer.timeout.connect(self._poll_activation)
        self._poll_timer.start()

    def _poll_activation(self):
        """Consulta el estado del token en background."""
        if self._stopped or not self._token:
            return
        threading.Thread(target=self._fetch_activation, daemon=True).start()

    def _fetch_activation(self):
        """Verifica si el token ya fue activado y descarga la config."""
        if self._stopped or not self._token:
            return

        try:
            sb = get_supabase_client()
            if not sb:
                return

            hwid = get_hwid()
            result = sb.rpc("obtener_activacion_provisioning", {
                "p_token": self._token,
                "p_hwid":  hwid,
            }).execute()
            data = result.data or {}

            if not data.get("ok"):
                if data.get("estado") == "expirado":
                    QTimer.singleShot(0, self.expired.emit)
                return

            # ¡Activado! Guardar config local
            config = {
                "api_key":         data["api_key"],
                "dispositivo_id":  data["dispositivo_id"],
                "empresa_id":      data["empresa_id"],
                "sucursal_id":     data["sucursal_id"],
                "nombre":          data.get("nombre", "Estación"),
                "activado_en":     data.get("activado_en"),
            }

            try:
                _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
                _CONFIG_PATH.write_text(
                    json.dumps(config, ensure_ascii=False, indent=2), "utf-8"
                )
                logger.info(f"Config guardada en {_CONFIG_PATH}")
            except Exception as e:
                logger.error(f"No se pudo guardar config: {e}")
                QTimer.singleShot(0, lambda e=e: self.error.emit(f"Error guardando config: {e}"))
                return

            self.stop()
            QTimer.singleShot(0, lambda: self.activated.emit(config))

        except Exception as e:
            logger.debug(f"_fetch_activation: {e}")
