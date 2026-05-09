"""
SplashScreen — Safe Link Monitoring Station v3.0
UI: QWidget frameless + QWebEngineView con HTML/CSS/JS embebido.
"""

from PyQt5.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, pyqtSignal
from PyQt5.QtWebEngineWidgets import QWebEngineSettings, QWebEngineView
from PyQt5.QtWidgets import QApplication, QVBoxLayout, QWidget


_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Safe Link</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{
  width:100%;height:100%;overflow:hidden;
  background:#050810;
  font-family:-apple-system,'Segoe UI',sans-serif;
  color:#F1F5F9;
  -webkit-font-smoothing:antialiased;
  display:flex;align-items:center;justify-content:center;
}

/* background */
.bg{
  position:fixed;inset:0;
  background:
    radial-gradient(ellipse 70% 55% at 50% 40%, rgba(59,130,246,.07) 0%, transparent 65%),
    radial-gradient(ellipse 40% 30% at 80% 80%, rgba(34,197,94,.04) 0%, transparent 55%),
    #050810;
}
.bg::before{
  content:'';position:absolute;inset:0;
  background-image:radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px);
  background-size:28px 28px;
}

/* card */
.card{
  position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;
  width:380px;
  animation:fadeUp .5s cubic-bezier(.16,1,.3,1) both;
}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

/* logo mark */
.logo-wrap{
  position:relative;
  width:80px;height:80px;
  display:flex;align-items:center;justify-content:center;
  margin-bottom:28px;
}
.logo-ring{
  position:absolute;inset:0;border-radius:50%;
  border:1px solid rgba(59,130,246,.2);
  animation:spin-ring 8s linear infinite;
}
.logo-ring::before{
  content:'';position:absolute;top:-3px;left:50%;
  width:6px;height:6px;border-radius:50%;
  background:var(--accent,#3B82F6);
  box-shadow:0 0 8px #3B82F6;
  transform:translateX(-50%);
}
@keyframes spin-ring{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.logo-ring2{
  position:absolute;inset:10px;border-radius:50%;
  border:1px solid rgba(59,130,246,.1);
  animation:spin-ring 12s linear infinite reverse;
}
.logo-icon{
  width:52px;height:52px;border-radius:14px;
  background:linear-gradient(135deg,#3B82F6,#1D4ED8);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 28px rgba(59,130,246,.4),0 0 60px rgba(59,130,246,.1);
  position:relative;z-index:1;
}

/* brand */
.brand{
  font-size:26px;font-weight:800;letter-spacing:.04em;
  margin-bottom:6px;
}
.brand em{color:#3B82F6;font-style:normal}
.tagline{
  font-size:12px;color:#64748B;
  letter-spacing:.04em;margin-bottom:40px;
}

/* progress */
.progress-wrap{width:100%;margin-bottom:12px}
.progress-track{
  width:100%;height:3px;border-radius:2px;
  background:rgba(255,255,255,.06);
  overflow:hidden;
}
.progress-bar{
  height:100%;border-radius:2px;width:0%;
  background:linear-gradient(90deg,#3B82F6,#22C55E);
  box-shadow:0 0 8px rgba(59,130,246,.5);
  transition:width .25s ease;
}
.progress-label{
  display:flex;justify-content:space-between;
  margin-bottom:8px;
}
.progress-msg{font-size:11px;color:#64748B;letter-spacing:.02em}
.progress-pct{
  font-size:11px;font-weight:600;color:#3B82F6;
  font-variant-numeric:tabular-nums;
}

/* dots loader */
.dots{display:flex;gap:5px;justify-content:center;margin-top:24px}
.dot{
  width:5px;height:5px;border-radius:50%;
  background:rgba(59,130,246,.3);
  animation:dot-pulse 1.4s ease infinite;
}
.dot:nth-child(2){animation-delay:.2s}
.dot:nth-child(3){animation-delay:.4s}
@keyframes dot-pulse{
  0%,80%,100%{transform:scale(.8);background:rgba(59,130,246,.2)}
  40%{transform:scale(1.2);background:#3B82F6;box-shadow:0 0 8px rgba(59,130,246,.6)}
}

/* version */
.version{
  position:fixed;bottom:20px;
  font-size:10px;color:#1E293B;letter-spacing:.06em;
}

/* error banner */
.error-banner{
  display:none;
  margin-top:20px;
  padding:12px 16px;
  background:rgba(239,68,68,.08);
  border:1px solid rgba(239,68,68,.25);
  border-radius:10px;
  width:100%;
  animation:fadeUp .3s ease both;
}
.error-banner.visible{display:block}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.error-title{
  font-size:12px;font-weight:700;color:#f87171;
  display:flex;align-items:center;gap:6px;margin-bottom:4px;
}
.error-msg{font-size:11px;color:#fca5a5;line-height:1.55}
</style>
</head>
<body>
<div class="bg"></div>

<div class="card">
  <div class="logo-wrap">
    <div class="logo-ring"></div>
    <div class="logo-ring2"></div>
    <div class="logo-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </div>
  </div>

  <div class="brand">SAFE<em>LINK</em></div>
  <div class="tagline">SISTEMA DE CONTROL DE ASISTENCIA</div>

  <div class="progress-wrap">
    <div class="progress-label">
      <span class="progress-msg" id="msg">Inicializando...</span>
      <span class="progress-pct" id="pct">0%</span>
    </div>
    <div class="progress-track">
      <div class="progress-bar" id="bar"></div>
    </div>
  </div>

  <div class="dots">
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>

  <!-- banner de error — solo visible cuando hay fallo -->
  <div class="error-banner" id="errBanner">
    <div class="error-title">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Error de inicio
    </div>
    <div class="error-msg" id="errMsg">Error desconocido</div>
  </div>
</div>

<div class="version">Safe Link Monitoring v3.0</div>

<script>
var _cur = 0, _target = 0, _raf = null;

function setProgress(pct, msg) {
  _target = pct;
  if (msg) document.getElementById('msg').textContent = msg;
  if (!_raf) animate();
}

function animate() {
  if (_cur < _target) {
    _cur = Math.min(_cur + 1.2, _target);
    document.getElementById('bar').style.width = _cur + '%';
    document.getElementById('pct').textContent = Math.round(_cur) + '%';
    _raf = requestAnimationFrame(animate);
  } else {
    _raf = null;
  }
}

function showError(msg) {
  // detener auto-avance
  clearInterval(_autoTimer);
  // barra en rojo
  var bar = document.getElementById('bar');
  bar.style.background = '#ef4444';
  bar.style.boxShadow = '0 0 8px rgba(239,68,68,.5)';
  // pct en rojo
  document.getElementById('pct').style.color = '#f87171';
  // dots paran
  var dots = document.querySelectorAll('.dot');
  dots.forEach(function(d){ d.style.animationPlayState='paused'; d.style.background='rgba(239,68,68,.3)'; });
  // banner
  document.getElementById('errMsg').textContent = msg;
  document.getElementById('errBanner').classList.add('visible');
  // mensaje
  document.getElementById('msg').textContent = 'No se pudo iniciar';
  document.getElementById('msg').style.color = '#f87171';
}

// auto-advance until Python takes over
var _auto = 0;
var _autoTimer = setInterval(function() {
  _auto += 0.8;
  if (_auto >= 75) { clearInterval(_autoTimer); return; }
  setProgress(_auto, null);
}, 40);
</script>
</body>
</html>"""


class SplashScreen(QWidget):

    def __init__(self):
        super().__init__()
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.SplashScreen
        )
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.resize(700, 460)
        self._center()

        self._view = QWebEngineView(self)
        s = self._view.settings()
        s.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        s.setAttribute(QWebEngineSettings.ScrollAnimatorEnabled, False)

        from PyQt5.QtCore import QUrl
        self._view.setHtml(_HTML, baseUrl=QUrl("qrc:///"))

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(self._view)

        self._progress = 0

    def _center(self):
        screen = QApplication.primaryScreen().geometry()
        self.move(
            screen.center().x() - self.width() // 2,
            screen.center().y() - self.height() // 2,
        )

    def _js(self, code: str):
        self._view.page().runJavaScript(code)

    def update_message(self, message: str):
        self._progress = min(self._progress + 10, 90)
        self._js(f"setProgress({self._progress}, {message!r});")
        QApplication.processEvents()

    def finish_loading(self):
        self._progress = 100
        self._js("setProgress(100, 'Listo');")
        QApplication.processEvents()

    def show_error(self, message: str):
        """Muestra banner de error rojo y detiene la animación de progreso."""
        import json
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"ERROR DE INICIO: {message}")

        # Intentar JS (si WebEngine cargó)
        self._js(f"showError({json.dumps(message)});")
        QApplication.processEvents()

        # Fallback: QLabel superpuesto (siempre visible, sin depender de WebEngine)
        if not hasattr(self, '_error_label'):
            from PyQt5.QtWidgets import QLabel
            from PyQt5.QtCore import Qt as QtCore
            self._error_label = QLabel(self)
            self._error_label.setStyleSheet("""
                QLabel {
                    background: rgba(127,29,29,0.95);
                    color: #fca5a5;
                    font-size: 13px;
                    padding: 18px 24px;
                    border: 1px solid rgba(239,68,68,0.4);
                    border-radius: 10px;
                }
            """)
            self._error_label.setWordWrap(True)
            self._error_label.setAlignment(QtCore.AlignCenter)
            self._error_label.setFixedWidth(420)
        self._error_label.setText(message)
        self._error_label.adjustSize()
        self._error_label.move(
            (self.width() - self._error_label.width()) // 2,
            self.height() - self._error_label.height() - 30,
        )
        self._error_label.show()
        self._error_label.raise_()

    def finish(self, main_window):
        """Compatible con QSplashScreen.finish() — fade out y cierra."""
        anim = QPropertyAnimation(self, b"windowOpacity")
        anim.setDuration(300)
        anim.setStartValue(1.0)
        anim.setEndValue(0.0)
        anim.setEasingCurve(QEasingCurve.InCubic)
        anim.finished.connect(self.close)
        anim.start()
        self._anim = anim  # prevent GC
