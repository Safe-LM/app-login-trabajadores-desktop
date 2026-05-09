"""
LoginWindow — Safe Link Monitoring Station v3.0
UI: QWebEngineView con HTML/Tailwind/CSS embebido.
Cámara: OpenCV en QThread → frames → base64 → JS bridge → <img> en HTML.
"""

import os
import sys
from pathlib import Path

from PyQt5.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QApplication
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QObject, pyqtSlot, QPropertyAnimation, QEasingCurve
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtGui import QColor

from utils.auth import authenticate_user

_BASE_DIR = Path(__file__).resolve().parent.parent
_DEBUG    = os.getenv("DEBUG", "").lower() in ("1", "true", "yes")

# ── HTML de la UI ─────────────────────────────────────────────────────
_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Safe Link Monitoring</title>
<script src="qrc:///qtwebchannel/qwebchannel.js"></script>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#070A14;--card:#0D1117;--border:#1A2235;--border-hl:#263044;
    --accent:#2563EB;--accent-dk:#1D4ED8;--accent-lt:#60A5FA;
    --success:#22C55E;--error:#EF4444;
    --text:#F1F5F9;--text2:#CBD5E1;--dim:#94A3B8;--muted:#64748B;--faint:#334155;
  }
  html,body{
    width:100%;height:100%;overflow:hidden;
    background:var(--bg);
    font-family:'Inter',system-ui,-apple-system,sans-serif;
    color:var(--text);-webkit-font-smoothing:antialiased;
  }

  /* ── Fondo con partículas CSS ── */
  .bg{
    position:fixed;inset:0;
    background:
      radial-gradient(ellipse 80% 50% at 20% 40%,rgba(37,99,235,.1) 0%,transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 70%,rgba(96,165,250,.06) 0%,transparent 55%),
      #070A14;
  }
  .bg::before{
    content:'';position:absolute;inset:0;
    background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);
    background-size:32px 32px;
  }
  /* Líneas diagonales decorativas */
  .bg::after{
    content:'';position:absolute;inset:0;
    background:
      linear-gradient(135deg,transparent 40%,rgba(37,99,235,.03) 50%,transparent 60%),
      linear-gradient(225deg,transparent 40%,rgba(96,165,250,.03) 50%,transparent 60%);
  }

  /* ── Contenedor centrado ── */
  .center{
    position:relative;z-index:1;
    min-height:100vh;
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    padding:24px;
  }

  /* ── Logo top ── */
  .logo{
    display:flex;align-items:center;gap:10px;
    margin-bottom:32px;
  }
  .logo-icon{
    width:36px;height:36px;border-radius:10px;
    background:linear-gradient(135deg,var(--accent),var(--accent-dk));
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 20px rgba(37,99,235,.5);
  }
  .logo-name{font-size:16px;font-weight:800;letter-spacing:-.03em;color:var(--text)}
  .logo-sub{font-size:9px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--accent-lt);margin-top:1px}

  /* ── Card ── */
  .card{
    width:100%;max-width:400px;
    background:rgba(13,17,23,.95);
    border:1px solid rgba(37,99,235,.2);
    border-radius:20px;
    padding:36px 36px 28px;
    box-shadow:
      0 0 0 1px rgba(37,99,235,.06),
      0 24px 64px rgba(0,0,0,.6),
      0 0 80px rgba(37,99,235,.08);
    position:relative;overflow:hidden;
    animation:slideUp .45s cubic-bezier(.16,1,.3,1) both;
  }
  /* Stripe azul top */
  .card::before{
    content:'';position:absolute;top:0;left:10%;right:10%;height:2px;
    background:linear-gradient(90deg,transparent,rgba(37,99,235,.9) 30%,rgba(96,165,250,.8) 70%,transparent);
    border-radius:2px;
  }
  /* Glow interno */
  .card::after{
    content:'';position:absolute;top:-60px;left:50%;transform:translateX(-50%);
    width:200px;height:120px;
    background:radial-gradient(rgba(37,99,235,.12),transparent 70%);
    pointer-events:none;
  }
  @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

  /* Shield */
  .shield-wrap{display:flex;justify-content:center;margin-bottom:18px}
  .shield{
    width:56px;height:56px;border-radius:50%;
    background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.2);
    display:flex;align-items:center;justify-content:center;
    position:relative;
  }
  .shield::before{
    content:'';position:absolute;inset:-7px;border-radius:50%;
    border:1px solid rgba(37,99,235,.12);
    animation:ripple 2.2s ease-out infinite;
  }
  .shield::after{
    content:'';position:absolute;inset:-14px;border-radius:50%;
    border:1px solid rgba(37,99,235,.06);
    animation:ripple 2.2s ease-out .7s infinite;
  }
  @keyframes ripple{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.4)}}

  .card-title{font-size:23px;font-weight:800;text-align:center;letter-spacing:-.04em;margin-bottom:5px}
  .card-sub{font-size:12px;text-align:center;color:var(--dim);line-height:1.5;margin-bottom:24px}

  /* Msg */
  .msg{
    border-radius:10px;padding:10px 14px;font-size:11.5px;
    display:none;align-items:center;gap:8px;margin-bottom:16px;
    animation:fadeIn .2s ease;
  }
  .msg.visible{display:flex}
  .msg.error{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#FCA5A5}
  .msg.success{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);color:#86EFAC}
  @keyframes fadeIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}

  /* Fields */
  .field-label{
    display:block;font-size:10px;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase;
    color:var(--muted);margin-bottom:6px;
  }
  .field{position:relative;margin-bottom:16px}
  .field-icon{
    position:absolute;left:14px;top:50%;transform:translateY(-50%);
    color:var(--muted);pointer-events:none;transition:color .2s;
  }
  .field:focus-within .field-icon{color:var(--accent-lt)}

  input{
    width:100%;height:50px;
    background:rgba(10,14,26,.8);
    border:1px solid var(--border);border-radius:11px;
    padding:0 14px 0 44px;
    color:var(--text);font-family:inherit;font-size:13.5px;
    outline:none;
    transition:border-color .2s,box-shadow .2s,background .2s;
  }
  input::placeholder{color:var(--muted)}
  input:hover{border-color:var(--border-hl)}
  input:focus{
    border-color:var(--accent);
    background:rgba(13,17,23,.95);
    box-shadow:0 0 0 3px rgba(37,99,235,.14);
  }

  .pw-row{display:flex}
  .pw-row input{border-radius:11px 0 0 11px;flex:1}
  .eye-btn{
    width:50px;height:50px;
    background:rgba(10,14,26,.8);
    border:1px solid var(--border);border-left:none;
    border-radius:0 11px 11px 0;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;color:var(--muted);
    transition:background .2s,color .2s;
    flex-shrink:0;
  }
  .eye-btn:hover{background:rgba(15,20,35,.9);color:var(--accent-lt)}

  /* Botón */
  .btn{
    width:100%;height:52px;margin-top:4px;
    background:linear-gradient(135deg,var(--accent),var(--accent-dk));
    color:#fff;border:none;border-radius:11px;
    font-family:inherit;font-size:14px;font-weight:700;letter-spacing:.04em;
    cursor:pointer;
    display:flex;align-items:center;justify-content:center;gap:8px;
    box-shadow:0 4px 24px rgba(37,99,235,.4);
    transition:transform .15s,box-shadow .15s,background .2s;
    position:relative;overflow:hidden;
  }
  .btn::before{
    content:'';position:absolute;inset:0;
    background:linear-gradient(135deg,rgba(255,255,255,.1),transparent 55%);
    opacity:0;transition:opacity .2s;
  }
  .btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 32px rgba(37,99,235,.5)}
  .btn:hover::before{opacity:1}
  .btn:active:not(:disabled){transform:translateY(0)}
  .btn:disabled{background:var(--faint);color:var(--muted);cursor:default;box-shadow:none}
  .btn.success{background:linear-gradient(135deg,#22C55E,#16A34A);box-shadow:0 4px 24px rgba(34,197,94,.4)}

  .spinner{
    width:17px;height:17px;border-radius:50%;
    border:2.5px solid rgba(255,255,255,.2);border-top-color:#fff;
    animation:spin .65s linear infinite;display:none;
  }
  .btn.loading .spinner{display:block}
  .btn.loading .btn-icon,.btn.loading .btn-text{opacity:0;position:absolute}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* Divider */
  .divider{height:1px;background:rgba(255,255,255,.06);margin:18px 0 14px}

  /* Dev badge */
  .dev-row{display:flex;align-items:center;gap:8px}
  .badge{
    font-size:9px;font-weight:700;letter-spacing:.08em;
    color:var(--accent-lt);
    background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.2);
    border-radius:4px;padding:2px 7px;flex-shrink:0;
  }
  .dev-creds{font-size:11px;color:var(--text2);user-select:text}
  .footer-row{display:flex;justify-content:flex-end;margin-top:8px}
  .ver{font-size:10px;color:var(--faint)}

  /* Footer global */
  .page-footer{
    margin-top:20px;font-size:10px;color:var(--faint);text-align:center;
  }
</style>
</head>
<body>
<div class="bg"></div>
<div class="center">

  <!-- Logo -->
  <div class="logo">
    <div class="logo-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </div>
    <div>
      <div class="logo-name">Safe Link</div>
      <div class="logo-sub">Monitoring Station</div>
    </div>
  </div>

  <!-- Card -->
  <div class="card">

    <div class="shield-wrap">
      <div class="shield">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      </div>
    </div>

    <div class="card-title">Bienvenido</div>
    <div class="card-sub">Ingresa tus credenciales para registrar tu asistencia</div>

    <div class="msg" id="msgBox">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span id="msgText"></span>
    </div>

    <label class="field-label" for="userInput">Usuario</label>
    <div class="field">
      <svg class="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
      <input id="userInput" type="text" placeholder="Ingresa tu usuario" autocomplete="off" spellcheck="false"/>
    </div>

    <label class="field-label" for="pwInput">Contraseña</label>
    <div class="field">
      <svg class="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <div class="pw-row">
        <input id="pwInput" type="password" placeholder="Ingresa tu contraseña"/>
        <button class="eye-btn" id="eyeBtn" type="button">
          <svg id="eyeIcon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </div>

    <button class="btn" id="loginBtn" type="button">
      <svg class="btn-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
      </svg>
      <div class="spinner"></div>
      <span class="btn-text">INICIAR SESIÓN</span>
    </button>

    <div class="divider"></div>
    {dev_block}
    <div class="footer-row"><span class="ver">v3.0.0</span></div>
  </div>

  <div class="page-footer">© 2026 Safe Link Monitoring — Todos los derechos reservados</div>
</div>

<script>
var bridge = null;
new QWebChannel(qt.webChannelTransport, function(ch){ bridge = ch.objects.bridge; });

var userInput = document.getElementById('userInput');
var pwInput   = document.getElementById('pwInput');
var loginBtn  = document.getElementById('loginBtn');
var msgBox    = document.getElementById('msgBox');
var msgText   = document.getElementById('msgText');
var eyeBtn    = document.getElementById('eyeBtn');
var eyeIcon   = document.getElementById('eyeIcon');

// Eye toggle
var pwVisible = false;
eyeBtn.addEventListener('click', function(){
  pwVisible = !pwVisible;
  pwInput.type = pwVisible ? 'text' : 'password';
  eyeIcon.innerHTML = pwVisible
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
});

function showMsg(text, kind){
  msgBox.className = 'msg visible '+(kind||'error');
  msgText.textContent = text;
  if(!kind||kind==='error') setTimeout(function(){ msgBox.className='msg'; }, 5000);
}

function doLogin(){
  var user = userInput.value.trim();
  var pw   = pwInput.value;
  if(!user||!pw){ showMsg('Ingresa usuario y contraseña para continuar.'); return; }
  msgBox.className = 'msg';
  loginBtn.disabled = true;
  loginBtn.classList.add('loading');
  if(bridge) bridge.login(user, pw);
}

loginBtn.addEventListener('click', doLogin);
pwInput.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
userInput.addEventListener('keydown', function(e){ if(e.key==='Enter') pwInput.focus(); });

function onLoginSuccess(){
  loginBtn.classList.remove('loading');
  loginBtn.classList.add('success');
  loginBtn.querySelector('.btn-text').textContent = 'Acceso concedido';
  loginBtn.querySelector('.btn-icon').innerHTML = '<polyline points="20 6 9 17 4 12" stroke="white" stroke-width="2.5"/>';
  loginBtn.querySelector('.btn-icon').style.opacity = '1';
  loginBtn.querySelector('.btn-icon').style.position = 'static';
}

function onLoginError(msg){
  loginBtn.disabled = false;
  loginBtn.classList.remove('loading');
  loginBtn.querySelector('.btn-text').textContent = 'INICIAR SESIÓN';
  loginBtn.querySelector('.btn-text').style.opacity = '1';
  loginBtn.querySelector('.btn-text').style.position = 'static';
  showMsg(msg||'Usuario o contraseña incorrectos.');
  pwInput.value = ''; pwInput.focus();
}

function updateFrame(){}
function setStatus(){}
</script>
</body>
</html>
"""


# =====================================================================
#  Bridge Python ↔ JS
# =====================================================================
class _Bridge(QObject):
    """Expone métodos a JavaScript vía QWebChannel."""

    login_requested = pyqtSignal(str, str)   # (user, password)

    @pyqtSlot(str, str)
    def login(self, user: str, password: str):
        self.login_requested.emit(user, password)


# =====================================================================
#  LoginWindow
# =====================================================================
class LoginWindow(QMainWindow):

    def __init__(self):
        super().__init__()
        self.current_user = None
        self._busy = False
        self._init_ui()

    def _init_ui(self):
        self.setWindowTitle("Safe Link Monitoring — Estación de Acceso")
        self.setMinimumSize(1080, 660)
        self.resize(1240, 760)
        self.setStyleSheet("QMainWindow{background:#070A14}")

        # WebEngineView
        self._view = QWebEngineView()
        settings = self._view.settings()
        settings.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.ScrollAnimatorEnabled, False)

        # WebChannel bridge
        self._channel = QWebChannel()
        self._bridge  = _Bridge()
        self._channel.registerObject("bridge", self._bridge)
        self._view.page().setWebChannel(self._channel)
        self._bridge.login_requested.connect(self._on_login)

        dev_block = (
            '<div class="dev-row">'
            '<span class="badge">DEV</span>'
            '<span class="dev-creds">admin &nbsp;·&nbsp; admin123</span>'
            '</div>'
        ) if _DEBUG else ''
        html = _HTML.replace("{dev_block}", dev_block)
        self._view.setHtml(html, baseUrl=__import__('PyQt5.QtCore', fromlist=['QUrl']).QUrl("qrc:///"))
        self._view.page().loadFinished.connect(self._on_page_loaded)

        container = QWidget()
        lay = QVBoxLayout(container)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(self._view)
        self.setCentralWidget(container)

    def _on_page_loaded(self, ok):
        pass  # camera not used on login screen

    # ── Auth ──────────────────────────────────────────────────────────

    def _on_login(self, user: str, pw: str):
        if self._busy:
            return
        self._busy = True
        QTimer.singleShot(400, lambda: self._auth(user, pw))

    def _auth(self, user: str, pw: str):
        try:
            t = authenticate_user(user, pw)
        except Exception:
            t = None
        if t:
            self.current_user = t
            self._view.page().runJavaScript("onLoginSuccess();")
            QTimer.singleShot(800, lambda: self._go_dashboard(t))
        else:
            self._busy = False
            self._view.page().runJavaScript("onLoginError('Usuario o contraseña incorrectos. Intenta nuevamente.');")

    def _go_dashboard(self, t):
        from windows.dashboard_window import DashboardWindow
        self.dashboard = DashboardWindow(t)
        self.dashboard.show()
        self.hide()
        self._busy = False

    # ── Show con fade ─────────────────────────────────────────────────

    def show(self):
        self.setWindowOpacity(0)
        super().show()
        from PyQt5.QtCore import QPropertyAnimation, QEasingCurve
        self._fade = QPropertyAnimation(self, b"windowOpacity")
        self._fade.setDuration(400)
        self._fade.setStartValue(0.0)
        self._fade.setEndValue(1.0)
        self._fade.setEasingCurve(QEasingCurve.OutCubic)
        self._fade.start()

    def closeEvent(self, ev):
        ev.accept()
        sys.exit(0)
