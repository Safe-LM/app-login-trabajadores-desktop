"""
ActivationWindow — pantalla de activación zero-touch con QR.

UI: QWidget frameless con QWebEngineView mostrando HTML/CSS/JS embebido.
Estética alineada con el panel web (dark, minimalista, acentos azules).

Flujo:
  1. Muestra spinner "Generando código de activación..."
  2. ProvisioningService.start() → token_ready
  3. Muestra QR + código grande + URL
  4. Realtime/polling detecta activación → cierra y emite signal
"""

import logging
from io import BytesIO

from PyQt5.QtCore import Qt, QUrl, pyqtSignal
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtWebEngineWidgets import QWebEngineSettings, QWebEngineView
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget

from utils.provisioning_service import ProvisioningService

logger = logging.getLogger(__name__)


_HTML = r"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Safe Link — Activar Estación</title>
<style>
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg-primary:    #050810;
  --bg-elevated:   #0d1220;
  --bg-card:       #0a0f1c;
  --border:        rgba(148, 163, 184, 0.08);
  --border-strong: rgba(148, 163, 184, 0.16);
  --text-primary:  #f1f5f9;
  --text-muted:    #94a3b8;
  --text-faint:    #64748b;
  --accent:        #3b82f6;
  --accent-glow:   rgba(59, 130, 246, 0.35);
  --green:         #22c55e;
  --red:           #ef4444;
}
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: var(--bg-primary);
  font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}
body {
  display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(ellipse 60% 50% at 50% 30%, rgba(59,130,246,0.06) 0%, transparent 65%),
    radial-gradient(ellipse 30% 30% at 80% 80%, rgba(34,197,94,0.03) 0%, transparent 55%),
    var(--bg-primary);
}
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 28px 28px;
}

/* ── Card principal ───────────────────────────────────────────── */
.shell {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center;
  width: min(560px, 92vw);
  padding: 40px 36px 32px;
  background: linear-gradient(180deg,
    rgba(13, 18, 32, 0.85) 0%,
    rgba(10, 15, 28, 0.95) 100%);
  border: 1px solid var(--border);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  box-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.04) inset,
    0 24px 64px -16px rgba(0, 0, 0, 0.5);
  animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: none; }
}

/* ── Logo ─────────────────────────────────────────────────────── */
.brand {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 32px;
}
.brand-icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 20px rgba(59,130,246,0.3);
}
.brand-text {
  font-size: 14px; font-weight: 800; letter-spacing: 0.12em;
}
.brand-text em { color: var(--accent); font-style: normal; }

/* ── Status / título ──────────────────────────────────────────── */
.status-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(245, 158, 11, 0.08);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 6px; padding: 4px 10px;
  margin-bottom: 14px;
}
.status-pill .dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #fbbf24;
  animation: pulseDot 1.4s infinite;
}
@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.3); }
}
.status-pill.success {
  background: rgba(34, 197, 94, 0.08);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.2);
}
.status-pill.success .dot { background: #4ade80; }
.status-pill.error {
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.2);
}
.status-pill.error .dot { background: #f87171; animation: none; }

h1 {
  font-size: 24px; font-weight: 700; letter-spacing: -0.02em;
  margin-bottom: 4px; text-align: center;
}
.subtitle {
  font-size: 13px; color: var(--text-muted);
  text-align: center; max-width: 340px;
  line-height: 1.5; margin-bottom: 28px;
}

/* ── QR + código ──────────────────────────────────────────────── */
.qr-wrap {
  background: #fff; padding: 16px;
  border-radius: 16px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 12px 36px -8px rgba(59, 130, 246, 0.3),
    0 0 60px rgba(59, 130, 246, 0.05);
  margin-bottom: 24px;
}
.qr-wrap img { display: block; width: 200px; height: 200px; border-radius: 6px; }
.qr-wrap.placeholder {
  width: 232px; height: 232px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(15, 23, 42, 0.6);
  border: 1px dashed rgba(148, 163, 184, 0.2);
  box-shadow: none;
}

/* ── Código corto ─────────────────────────────────────────────── */
.code-section {
  width: 100%; margin-bottom: 24px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.code-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.12em;
  color: var(--text-faint); text-transform: uppercase;
}
.code-value {
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 32px; font-weight: 700; letter-spacing: 0.08em;
  color: var(--text-primary);
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.1) 0%,
    rgba(59, 130, 246, 0.04) 100%);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 12px;
  padding: 12px 24px;
  font-variant-numeric: tabular-nums;
  user-select: all;
  cursor: copy;
  transition: all 0.2s;
}
.code-value:hover {
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 0 24px rgba(59, 130, 246, 0.15);
}
.code-value:active { transform: scale(0.98); }

/* ── URL info ─────────────────────────────────────────────────── */
.url-info {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-muted);
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 20px;
  width: 100%; justify-content: center;
}
.url-info svg { flex-shrink: 0; opacity: 0.6; }
.url-info code {
  font-family: 'SF Mono', monospace; font-size: 11px;
  color: var(--accent);
}

/* ── Footer ───────────────────────────────────────────────────── */
.footer {
  display: flex; justify-content: space-between; align-items: center;
  width: 100%; padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 10px; color: var(--text-faint);
}
.footer-item { display: flex; align-items: center; gap: 5px; }
.footer-item svg { width: 11px; height: 11px; opacity: 0.5; }

/* ── Loading state ────────────────────────────────────────────── */
.loader {
  width: 36px; height: 36px;
  border: 2px solid rgba(59, 130, 246, 0.15);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 24px 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Success state ────────────────────────────────────────────── */
.success-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  display: flex; align-items: center; justify-content: center;
  margin: 16px 0 24px;
  box-shadow: 0 0 36px rgba(34, 197, 94, 0.4);
  animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes pop {
  0%   { transform: scale(0); }
  100% { transform: scale(1); }
}

/* hidden helper */
.hidden { display: none !important; }
</style>
</head>
<body>

<div class="shell" id="shell">

  <div class="brand">
    <div class="brand-icon">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </div>
    <div class="brand-text">SAFE<em>LINK</em></div>
  </div>

  <!-- Estado: cargando -->
  <div id="loading-state">
    <div class="status-pill">
      <span class="dot"></span>
      Generando código...
    </div>
    <h1>Conectando con el servidor</h1>
    <p class="subtitle">Esto solo toma un momento.</p>
    <div class="loader"></div>
  </div>

  <!-- Estado: esperando activación -->
  <div id="waiting-state" class="hidden">
    <div class="status-pill">
      <span class="dot"></span>
      Esperando activación
    </div>
    <h1>Activa esta estación</h1>
    <p class="subtitle">
      Escanea el código con tu celular o ingresa el código en el panel
      web para vincular esta estación a tu empresa.
    </p>

    <div class="qr-wrap" id="qr-box">
      <div class="qr-wrap placeholder" id="qr-placeholder">
        <div class="loader" style="border-color: rgba(15,23,42,0.3); border-top-color: #1e293b;"></div>
      </div>
    </div>

    <div class="code-section">
      <span class="code-label">Código de activación</span>
      <div class="code-value" id="code">———</div>
    </div>

    <div class="url-info">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span>Visita</span>
      <code id="url">panel.safelink.app/activar</code>
    </div>
  </div>

  <!-- Estado: activado -->
  <div id="success-state" class="hidden">
    <div class="status-pill success">
      <span class="dot"></span>
      Activada
    </div>
    <div class="success-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <h1 id="success-title">Listo</h1>
    <p class="subtitle" id="success-subtitle">Iniciando dashboard...</p>
  </div>

  <!-- Estado: error -->
  <div id="error-state" class="hidden">
    <div class="status-pill error">
      <span class="dot"></span>
      Error
    </div>
    <h1>No pudimos activar</h1>
    <p class="subtitle" id="error-message">Intenta de nuevo en unos momentos.</p>
  </div>

  <div class="footer">
    <div class="footer-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 9h-4"/>
      </svg>
      <span id="hwid-short">HWID: ————</span>
    </div>
    <div class="footer-item">
      <span>Safe Link Station v5.0</span>
    </div>
  </div>

</div>

<script>
window.showWaiting = function (token, qrDataUrl, url, hwidShort) {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('waiting-state').classList.remove('hidden');
  document.getElementById('code').textContent = token;
  document.getElementById('url').textContent = url.replace(/^https?:\/\//, '');
  if (hwidShort) document.getElementById('hwid-short').textContent = 'HWID: ' + hwidShort;
  if (qrDataUrl) {
    document.getElementById('qr-box').innerHTML =
      '<img src="' + qrDataUrl + '" alt="Código QR de activación">';
  }
};

window.showSuccess = function (nombre, sucursal) {
  ['loading-state','waiting-state','error-state'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
  document.getElementById('success-state').classList.remove('hidden');
  if (nombre) {
    document.getElementById('success-title').textContent = nombre;
    if (sucursal) {
      document.getElementById('success-subtitle').textContent =
        'Sucursal ' + sucursal + ' • Cargando dashboard...';
    }
  }
};

window.showError = function (msg) {
  ['loading-state','waiting-state','success-state'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
  document.getElementById('error-state').classList.remove('hidden');
  document.getElementById('error-message').textContent = msg || 'Error desconocido';
};

window.setStatusReady = function () {
  // No-op para compatibilidad con runJavaScript desde Python
};

console.log('[Activation] UI lista');
</script>

</body>
</html>
"""


class ActivationWindow(QMainWindow):
    """Ventana de activación zero-touch."""

    activated = pyqtSignal(dict)

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Safe Link — Activar Estación")
        self.setMinimumSize(720, 720)
        self.setStyleSheet("QMainWindow{background:#050810}")

        self._view = QWebEngineView()
        s = self._view.settings()
        s.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        s.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
        s.setAttribute(QWebEngineSettings.LocalContentCanAccessFileUrls, True)
        s.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)

        self._view.setHtml(_HTML, QUrl("qrc:///"))

        container = QWidget()
        lay = QVBoxLayout(container)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(self._view)
        self.setCentralWidget(container)

        # Servicio de provisioning
        self._svc = ProvisioningService(self)
        self._svc.token_ready.connect(self._on_token_ready)
        self._svc.activated.connect(self._on_activated)
        self._svc.error.connect(self._on_error)
        self._svc.expired.connect(self._on_expired)

        # Esperar a que la página cargue antes de arrancar el servicio
        self._view.page().loadFinished.connect(self._on_loaded)

    def _on_loaded(self, ok: bool):
        # Mostrar HWID corto en footer
        try:
            from utils.hwid import get_hwid_short
            self._js(f"document.getElementById('hwid-short').textContent = 'HWID: {get_hwid_short()}';")
        except Exception:
            pass
        # Iniciar provisioning
        self._svc.start()

    def _js(self, code: str):
        self._view.page().runJavaScript(code)

    # ── Slots de ProvisioningService ─────────────────────────────────────────

    def _on_token_ready(self, token: str, activate_url: str):
        try:
            qr_data_url = _generate_qr_data_url(activate_url)
        except Exception as e:
            logger.warning(f"QR no disponible: {e}")
            qr_data_url = ""

        from utils.hwid import get_hwid_short
        import json as _json
        self._js(
            f"window.showWaiting("
            f"{_json.dumps(token)},"
            f"{_json.dumps(qr_data_url)},"
            f"{_json.dumps(activate_url)},"
            f"{_json.dumps(get_hwid_short())});"
        )

    def _on_activated(self, config: dict):
        import json as _json
        nombre = config.get("nombre", "Estación")
        self._js(f"window.showSuccess({_json.dumps(nombre)}, null);")
        # Emite señal para que main.py reinicie a dashboard
        from PyQt5.QtCore import QTimer
        QTimer.singleShot(2000, lambda: self.activated.emit(config))

    def _on_error(self, msg: str):
        import json as _json
        self._js(f"window.showError({_json.dumps(msg)});")

    def _on_expired(self):
        # Token expiró sin activarse → reiniciar el ciclo
        logger.info("Token expirado, generando uno nuevo")
        self._svc.stop()
        self._svc = ProvisioningService(self)
        self._svc.token_ready.connect(self._on_token_ready)
        self._svc.activated.connect(self._on_activated)
        self._svc.error.connect(self._on_error)
        self._svc.expired.connect(self._on_expired)
        self._svc.start()

    def closeEvent(self, event):
        try:
            self._svc.stop()
        except Exception:
            pass
        super().closeEvent(event)


def _generate_qr_data_url(text: str) -> str:
    """Genera QR como data URL (base64). Requiere 'qrcode' instalado."""
    import base64
    try:
        import qrcode
    except ImportError:
        logger.warning("Librería 'qrcode' no instalada — pip install qrcode[pil]")
        return ""

    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0a0f1c", back_color="#ffffff")
    buf = BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
