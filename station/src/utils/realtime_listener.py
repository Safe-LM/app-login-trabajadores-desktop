"""
RealtimeListener — escucha INSERT en comandos_estacion vía Supabase Realtime.

Usa AsyncRealtimeClient corriendo en su propio asyncio event loop dentro de un
thread daemon. Si la conexión se cae, reintenta automáticamente. Si no se puede
conectar, el polling cada 30s actúa como fallback (configurado en dashboard).
"""

import asyncio
import logging
import os
import threading
from typing import Callable, Optional

logger = logging.getLogger(__name__)


def _build_realtime_url() -> Optional[str]:
    """Construye la URL ws:// a partir de SUPABASE_URL y SUPABASE_KEY del entorno."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    # https://xxx.supabase.co → wss://xxx.supabase.co/realtime/v1
    base = url.rstrip("/").replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/realtime/v1"


class RealtimeCommandListener:
    """
    Escucha comandos en tiempo real para un dispositivo específico.

    Uso:
        listener = RealtimeCommandListener(dispositivo_id, on_command_received)
        listener.start()
        ...
        listener.stop()
    """

    def __init__(self, dispositivo_id: str, on_command: Callable[[dict], None]):
        self._dispositivo_id = str(dispositivo_id)
        self._on_command = on_command
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._client = None
        self._channel = None
        self._connected = False
        self._stop_flag = False

    # ── API pública (thread-safe) ────────────────────────────────────────────

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_flag = False
        self._thread = threading.Thread(target=self._run_thread, daemon=True, name="RT-Cmds")
        self._thread.start()

    def stop(self):
        self._stop_flag = True
        if self._loop and self._loop.is_running():
            try:
                asyncio.run_coroutine_threadsafe(self._async_close(), self._loop)
            except Exception:
                pass

    @property
    def is_connected(self) -> bool:
        return self._connected

    # ── Internals (corren en el thread/loop propio) ──────────────────────────

    def _run_thread(self):
        """Punto de entrada del thread: crea event loop y corre el async listener."""
        try:
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._loop.run_until_complete(self._async_main())
        except Exception as e:
            logger.warning(f"RealtimeListener thread error: {e}")
        finally:
            self._connected = False
            try:
                if self._loop:
                    self._loop.close()
            except Exception:
                pass

    async def _async_main(self):
        """Conecta, se suscribe y mantiene la conexión viva."""
        try:
            from realtime import AsyncRealtimeClient
        except ImportError:
            logger.warning("Librería 'realtime' no disponible — cae a polling")
            return

        rt_url = _build_realtime_url()
        api_key = os.getenv("SUPABASE_KEY")
        if not rt_url or not api_key:
            logger.warning("RealtimeListener: faltan SUPABASE_URL o SUPABASE_KEY")
            return

        self._client = AsyncRealtimeClient(rt_url, api_key, auto_reconnect=True)

        try:
            await self._client.connect()
        except Exception as e:
            logger.warning(f"RealtimeListener: no se pudo conectar — {e}")
            return

        channel_name = f"comandos:{self._dispositivo_id}"
        self._channel = self._client.channel(channel_name)

        def _on_postgres_change(payload):
            """Llamado por realtime cuando hay un INSERT en comandos_estacion."""
            try:
                # payload puede ser dict o objeto con .data; normalizamos
                if hasattr(payload, "data"):
                    data = payload.data
                else:
                    data = payload

                # Estructura típica: { "data": { "record": {...}, "type": "INSERT" } } o directamente el record
                record = None
                if isinstance(data, dict):
                    inner = data.get("data", data)
                    record = inner.get("record") or inner.get("new") or inner

                if not record:
                    return

                # Filtros adicionales en el cliente (defensa en profundidad)
                if str(record.get("dispositivo_id")) != self._dispositivo_id:
                    return
                if record.get("ejecutado_en") is not None:
                    return

                logger.info(f"Comando recibido por Realtime: {record.get('tipo')} ({str(record.get('id'))[:8]})")
                self._on_command(record)
            except Exception as e:
                logger.error(f"RealtimeListener on_change error: {e}")

        # Configurar suscripción a INSERT con filtro server-side
        self._channel = self._channel.on_postgres_changes(
            event="INSERT",
            schema="public",
            table="comandos_estacion",
            callback=_on_postgres_change,
            filter=f"dispositivo_id=eq.{self._dispositivo_id}",
        )

        try:
            await self._channel.subscribe()
            self._connected = True
            logger.info(f"✓ Realtime conectado: {channel_name}")
        except Exception as e:
            logger.warning(f"RealtimeListener subscribe falló: {e}")
            return

        # Mantener vivo el loop hasta stop()
        while not self._stop_flag:
            await asyncio.sleep(0.5)

    async def _async_close(self):
        try:
            if self._channel:
                await self._channel.unsubscribe()
        except Exception:
            pass
        try:
            if self._client:
                await self._client.close()
        except Exception:
            pass
        self._connected = False
