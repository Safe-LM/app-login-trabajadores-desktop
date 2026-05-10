"""
SetupWindow — Registro inicial de estacion fisica.
Aparece solo cuando no existe STATION_API_KEY en .env.
Autentica al admin con Supabase, crea el dispositivo
y escribe STATION_API_KEY en .env automaticamente.
"""

import os
import json
from dotenv import load_dotenv, set_key

from PyQt5.QtCore import Qt, QTimer, QUrl, QThread, pyqtSignal, QObject
from PyQt5.QtWidgets import QMainWindow, QVBoxLayout, QWidget, QApplication
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings
from PyQt5.QtWebChannel import QWebChannel

load_dotenv()

# Ruta del .env escribible (APPDATA en build instalado, station/.env
# en dev local). Antes era _BASE_DIR/.env hardcoded, lo que rompia en
# Program Files (read-only).
from utils.paths import env_path as _env_path
_ENV_PATH = _env_path()


# ─────────────────────────────────────────────────────────────────────
#  Workers (sin cambios — lógica correcta)
# ─────────────────────────────────────────────────────────────────────
class _SetupWorker(QObject):
    done  = pyqtSignal(str, str)
    error = pyqtSignal(str)
    step  = pyqtSignal(str)

    def __init__(self, email, password, empresa_id, sucursal_id, nombre):
        super().__init__()
        self.email       = email
        self.password    = password
        self.empresa_id  = empresa_id
        self.sucursal_id = sucursal_id
        self.nombre      = nombre

    def run(self):
        try:
            from utils.station_manager import get_hwid
            from utils.supabase_client import get_supabase_client
            sb = get_supabase_client()
            if not sb:
                self.error.emit("No se pudo conectar a Supabase. Verifica SUPABASE_URL y SUPABASE_KEY en .env")
                return

            self.step.emit("Autenticando administrador...")
            auth_res = sb.auth.sign_in_with_password({
                "email": self.email, "password": self.password,
            })
            if not auth_res.user:
                self.error.emit("Credenciales incorrectas. Verifica email y contraseña.")
                return

            self.step.emit("Registrando estación en la nube...")
            rpc_res = sb.rpc("crear_dispositivo", {
                "p_user_id":     auth_res.user.id,
                "p_nombre":      self.nombre,
                "p_sucursal_id": self.sucursal_id,
                "p_hwid":        get_hwid(),
            }).execute()

            data = rpc_res.data
            if not data or not data.get("ok"):
                err = data.get("error", "error desconocido") if data else "sin respuesta"
                self.error.emit(f"No se pudo crear el dispositivo: {err}")
                return

            self.step.emit("Guardando configuración local...")
            # set_key() crea el archivo si no existe — no escribimos
            # .env vacio proactivamente porque si el proceso muere antes
            # de escribir las claves, quedaria un .env corrupto que
            # confunde al siguiente arranque.
            _ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
            env_str = str(_ENV_PATH)
            set_key(env_str, "STATION_API_KEY", data["api_key"])
            # Guardar también las claves de Supabase para que la estación
            # sea autónoma — sin depender del .env del directorio padre
            supabase_url = os.environ.get("SUPABASE_URL", "")
            supabase_key = os.environ.get("SUPABASE_KEY", "")
            if supabase_url:
                set_key(env_str, "SUPABASE_URL", supabase_url)
            if supabase_key:
                set_key(env_str, "SUPABASE_KEY", supabase_key)
            sb.auth.sign_out()
            self.done.emit(data["api_key"], data["id"])

        except Exception as e:
            self.error.emit(str(e))


class _LoadDataWorker(QObject):
    done  = pyqtSignal(list, list)
    error = pyqtSignal(str)

    def __init__(self, email, password):
        super().__init__()
        self.email    = email
        self.password = password

    def run(self):
        try:
            from utils.supabase_client import get_supabase_client
            sb = get_supabase_client()
            if not sb:
                self.error.emit("Sin conexión a Supabase — verifica SUPABASE_URL y SUPABASE_KEY en .env")
                return
            auth_res = sb.auth.sign_in_with_password({
                "email": self.email, "password": self.password,
            })
            if not auth_res.user:
                self.error.emit("Credenciales incorrectas")
                return
            emp_res = sb.table("empresas").select("id, nombre").eq("activa", True).execute()
            suc_res = sb.table("sucursales").select("id, nombre, empresa_id").eq("activa", True).execute()
            sb.auth.sign_out()
            self.done.emit(emp_res.data or [], suc_res.data or [])
        except Exception as e:
            self.error.emit(str(e))


class _PairingWorker(QObject):
    done  = pyqtSignal(str, str)
    error = pyqtSignal(str)

    def __init__(self, code):
        super().__init__()
        self.code     = code
        self._running = True

    def run(self):
        import time
        from utils.station_manager import get_hwid
        from utils.supabase_client import get_supabase_client
        sb   = get_supabase_client()
        hwid = get_hwid()
        t0   = time.time()
        while self._running and (time.time() - t0 < 300):
            try:
                res  = sb.rpc("verificar_vinculacion", {"p_codigo": self.code, "p_hwid": hwid}).execute()
                data = res.data
                if data and data.get("ok") and data.get("activado"):
                    env_str = str(_ENV_PATH)
                    if not _ENV_PATH.exists():
                        _ENV_PATH.write_text("")
                    set_key(env_str, "STATION_API_KEY", data["api_key"])
                    for k in ("SUPABASE_URL", "SUPABASE_KEY"):
                        v = os.environ.get(k, "")
                        if v:
                            set_key(env_str, k, v)
                    self.done.emit(data["api_key"], "ID-LINKED")
                    return
                if data and not data.get("ok"):
                    self.error.emit(data.get("error", "Error"))
                    return
            except Exception as e:
                self.error.emit(str(e))
                return
            time.sleep(3)
        if self._running:
            self.error.emit("Tiempo de espera agotado. El código expiró.")

    def stop(self):
        self._running = False


# ─────────────────────────────────────────────────────────────────────
#  Bridge Python ↔ JS
# ─────────────────────────────────────────────────────────────────────
class _SetupBridge(QObject):
    # Señales JS → Python
    verifyCredentials = pyqtSignal(str, str)          # email, password
    registerStation   = pyqtSignal(str, str, str, str) # empresa_id, sucursal_id, nombre, email_pw_json
    startPairing      = pyqtSignal(str)               # code
    launch            = pyqtSignal()

    # Señales Python → JS (llamadas vía runJavaScript)
    def __init__(self, parent=None):
        super().__init__(parent)

    from PyQt5.QtCore import pyqtSlot

    @pyqtSlot(str, str)
    def onVerify(self, email: str, password: str):
        self.verifyCredentials.emit(email, password)

    @pyqtSlot(str, str, str, str, str)
    def onRegister(self, email: str, password: str, empresa_id: str, sucursal_id: str, nombre: str):
        self.registerStation.emit(empresa_id, sucursal_id, nombre,
                                  json.dumps({"email": email, "password": password}))

    @pyqtSlot(str)
    def onPair(self, code: str):
        self.startPairing.emit(code)

    @pyqtSlot()
    def onLaunch(self):
        self.launch.emit()


# ─────────────────────────────────────────────────────────────────────
#  HTML completo — todas las pantallas en una sola página con JS
# ─────────────────────────────────────────────────────────────────────
_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Safe Link — Configuración inicial</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{
  width:100%;height:100%;overflow:hidden;
  background:#070710;
  font-family:-apple-system,'Segoe UI',system-ui,sans-serif;
  color:#f1f5f9;
  -webkit-font-smoothing:antialiased;
  display:flex;align-items:center;justify-content:center;
}

/* BG */
.bg{position:fixed;inset:0;
  background:
    radial-gradient(ellipse 70% 60% at 50% 40%,rgba(37,99,235,.08) 0%,transparent 65%),
    radial-gradient(ellipse 40% 30% at 85% 80%,rgba(34,197,94,.04) 0%,transparent 55%),
    #070710;
}
.bg::before{content:'';position:absolute;inset:0;
  background-image:radial-gradient(rgba(255,255,255,.035) 1px,transparent 1px);
  background-size:28px 28px;
}

/* CARD */
.card{
  position:relative;z-index:1;
  width:420px;
  background:linear-gradient(160deg,#101828 0%,#0c1220 100%);
  border:1px solid rgba(37,99,235,.22);
  border-radius:20px;
  box-shadow:0 0 60px rgba(37,99,235,.12),0 24px 48px rgba(0,0,0,.6);
  overflow:hidden;
  animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both;
}
.card-stripe{
  height:3px;
  background:linear-gradient(90deg,transparent,#2563eb 30%,#60a5fa 70%,transparent);
}
.card-body{padding:32px 32px 28px;}

@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}

/* LOGO */
.logo-wrap{display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.logo-icon{
  width:52px;height:52px;border-radius:14px;
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 28px rgba(37,99,235,.45),0 0 60px rgba(37,99,235,.12);
}

/* HEADINGS */
.title{font-size:22px;font-weight:800;color:#f1f5f9;text-align:center;letter-spacing:-.02em;margin-bottom:6px}
.subtitle{font-size:12px;color:#64748b;text-align:center;line-height:1.6;margin-bottom:24px}

/* FORM FIELDS */
.field{margin-bottom:14px}
.field-label{
  font-size:10px;font-weight:700;color:#475569;letter-spacing:.1em;
  text-transform:uppercase;margin-bottom:5px;
}
.input-wrap{position:relative;display:flex}
input{
  width:100%;height:44px;
  background:#0a1428;
  border:1px solid #1e293b;
  border-radius:10px;
  padding:0 14px;
  color:#f1f5f9;font-size:13px;font-family:inherit;
  outline:none;transition:border-color .15s,box-shadow .15s;
}
input::placeholder{color:#334155}
input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
input:hover:not(:focus){border-color:#334155}
input.pw-with-toggle{border-radius:10px 0 0 10px;border-right:none}

.pw-toggle{
  width:44px;height:44px;
  background:#0a1428;border:1px solid #1e293b;border-left:none;
  border-radius:0 10px 10px 0;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;flex-shrink:0;color:#475569;
  transition:background .15s,color .15s;
}
.pw-toggle:hover{background:#111827;color:#94a3b8}
.pw-toggle.active{color:#2563eb}

select{
  width:100%;height:44px;
  background:#0a1428;border:1px solid #1e293b;border-radius:10px;
  padding:0 14px;color:#f1f5f9;font-size:13px;font-family:inherit;
  outline:none;cursor:pointer;
  appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;
  transition:border-color .15s;
}
select:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
select option{background:#0f172a}

/* BUTTON */
.btn{
  width:100%;height:48px;
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  border:none;border-radius:11px;
  color:#fff;font-size:13px;font-weight:700;font-family:inherit;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
  box-shadow:0 4px 20px rgba(37,99,235,.35);
  transition:opacity .15s,transform .1s,box-shadow .15s;
  position:relative;overflow:hidden;
}
.btn:hover{opacity:.92;box-shadow:0 6px 28px rgba(37,99,235,.45)}
.btn:active{transform:scale(.985)}
.btn:disabled{opacity:.45;cursor:not-allowed;pointer-events:none}
.btn-ghost{
  width:100%;height:40px;
  background:transparent;border:1px solid #1e293b;border-radius:10px;
  color:#94a3b8;font-size:12px;font-weight:600;font-family:inherit;
  cursor:pointer;margin-top:10px;
  transition:border-color .15s,color .15s,background .15s;
}
.btn-ghost:hover{border-color:#334155;color:#f1f5f9;background:rgba(255,255,255,.03)}
.btn-success{
  background:linear-gradient(135deg,#22c55e,#16a34a);
  box-shadow:0 4px 20px rgba(34,197,94,.3);
}
.btn-success:hover{box-shadow:0 6px 28px rgba(34,197,94,.4)}

/* SPINNER inside button */
.spinner{
  width:16px;height:16px;border-radius:50%;
  border:2px solid rgba(255,255,255,.3);
  border-top-color:#fff;
  animation:spin .7s linear infinite;
  display:none;
}
.loading .spinner{display:block}
.loading .btn-label{display:none}
@keyframes spin{to{transform:rotate(360deg)}}

/* DIVIDER */
.divider{
  display:flex;align-items:center;gap:10px;
  margin:18px 0;color:#334155;font-size:11px;
}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:#1e293b}

/* PAIR INPUT — código grande */
.pair-input{
  height:64px;font-size:28px;font-weight:800;
  text-align:center;letter-spacing:.2em;
  text-transform:uppercase;
}

/* ALERT */
.alert{
  display:none;
  padding:11px 14px;border-radius:10px;
  font-size:12px;line-height:1.55;
  margin-bottom:16px;animation:fadeUp .25s ease both;
}
.alert.error{display:block;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);color:#fca5a5}
.alert.info{display:block;background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.22);color:#93c5fd}
.alert.success{display:block;background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.22);color:#86efac}

/* SCREENS */
.screen{display:none}
.screen.active{display:block}

/* BACK LINK */
.back-link{
  display:flex;align-items:center;gap:5px;justify-content:center;
  margin-top:14px;
  font-size:11px;color:#475569;cursor:pointer;
  transition:color .15s;
}
.back-link:hover{color:#94a3b8}

/* SUCCESS SCREEN */
.success-box{
  background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);
  border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;
}
.success-box .checkmark{
  width:48px;height:48px;border-radius:50%;
  background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 12px;
}
.success-box h3{font-size:15px;font-weight:700;color:#86efac;margin-bottom:6px}
.success-box p{font-size:12px;color:#4ade80;line-height:1.6}
.success-meta{
  font-size:11px;color:#334155;background:#0a1020;
  border-radius:8px;padding:10px 12px;margin-top:10px;
  font-family:monospace;text-align:left;line-height:1.8;
}

/* FOOTER */
.footer{
  padding:14px 32px;border-top:1px solid rgba(255,255,255,.04);
  font-size:10px;color:#1e293b;text-align:center;letter-spacing:.05em;
}
</style>
</head>
<body>
<div class="bg"></div>

<div class="card">
  <div class="card-stripe"></div>
  <div class="card-body">

    <div class="logo-wrap">
      <div class="logo-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
    </div>

    <h1 class="title">Configuración inicial</h1>
    <p class="subtitle">Esta estación aún no está registrada.<br>Ingresa tus credenciales de administrador para continuar.</p>

    <div class="alert" id="alert"></div>

    <!-- ── SCREEN 1: Credenciales ── -->
    <div class="screen active" id="screenCreds">
      <div class="field">
        <div class="field-label">Correo del administrador</div>
        <input type="email" id="email" placeholder="admin@empresa.com" autocomplete="off"/>
      </div>
      <div class="field">
        <div class="field-label">Contraseña</div>
        <div class="input-wrap">
          <input type="password" id="password" class="pw-with-toggle" placeholder="Tu contraseña del panel web"/>
          <div class="pw-toggle" id="pwToggle" onclick="togglePw()">
            <svg id="eyeIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <svg id="eyeOffIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:none">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </div>
        </div>
      </div>

      <button class="btn" id="btnVerify" onclick="doVerify()">
        <div class="spinner" id="spVerify"></div>
        <span class="btn-label">Verificar credenciales</span>
      </button>

      <div class="divider">o usa un código de vinculación</div>

      <button class="btn-ghost" onclick="showScreen('screenPair')">
        Vincular con Código de 6 dígitos
      </button>
    </div>

    <!-- ── SCREEN 2: Pairing ── -->
    <div class="screen" id="screenPair">
      <div class="field">
        <div class="field-label">Código de vinculación (6 dígitos)</div>
        <input type="text" id="pairCode" class="pair-input"
               placeholder="AB1234" maxlength="6" autocomplete="off"
               oninput="this.value=this.value.toUpperCase()"/>
      </div>

      <button class="btn" id="btnPair" onclick="doPair()">
        <div class="spinner" id="spPair"></div>
        <span class="btn-label">Vincular estación</span>
      </button>

      <div class="back-link" onclick="showScreen('screenCreds')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Usar credenciales de administrador
      </div>
    </div>

    <!-- ── SCREEN 3: Selección empresa/sucursal ── -->
    <div class="screen" id="screenSelect">
      <div class="field">
        <div class="field-label">Empresa</div>
        <select id="empSelect" onchange="onEmpChange()"></select>
      </div>
      <div class="field">
        <div class="field-label">Sucursal (opcional)</div>
        <select id="sucSelect"></select>
      </div>
      <div class="field">
        <div class="field-label">Nombre de esta estación</div>
        <input type="text" id="stName" placeholder="Ej: Entrada Principal, Recepción"/>
      </div>

      <button class="btn" id="btnRegister" onclick="doRegister()">
        <div class="spinner" id="spRegister"></div>
        <span class="btn-label">Registrar esta estación</span>
      </button>

      <div class="back-link" onclick="showScreen('screenCreds')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver
      </div>
    </div>

    <!-- ── SCREEN 4: Éxito ── -->
    <div class="screen" id="screenDone">
      <div class="success-box">
        <div class="checkmark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3>¡Estación registrada!</h3>
        <p>La API Key fue guardada automáticamente.<br>Ya puedes iniciar Safe Link Monitoring.</p>
        <div class="success-meta" id="successMeta"></div>
      </div>
      <button class="btn btn-success" onclick="doLaunch()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="10 8 16 12 10 16"/></svg>
        Iniciar Safe Link Monitoring
      </button>
    </div>

  </div>
  <div class="footer">Safe Link Monitoring &nbsp;—&nbsp; Configuración de estación física</div>
</div>

<script src="qrc:///qtwebchannel/qwebchannel.js"></script>
<script>
var bridge = null;
var _empresas = [];
var _sucursales = [];

new QWebChannel(qt.webChannelTransport, function(ch) {
  bridge = ch.objects.bridge;
});

// ── Navegación ────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  clearAlert();
}

function showAlert(msg, type) {
  var el = document.getElementById('alert');
  el.className = 'alert ' + type;
  el.textContent = msg;
}
function clearAlert() { document.getElementById('alert').className = 'alert'; }

// ── Toggle contraseña ─────────────────────────────────────────────────
function togglePw() {
  var inp  = document.getElementById('password');
  var tog  = document.getElementById('pwToggle');
  var eye  = document.getElementById('eyeIcon');
  var eyeO = document.getElementById('eyeOffIcon');
  var show = inp.type === 'password';
  inp.type  = show ? 'text' : 'password';
  eye.style.display  = show ? 'none' : 'block';
  eyeO.style.display = show ? 'block' : 'none';
  tog.classList.toggle('active', show);
}

// ── Spinner helpers ───────────────────────────────────────────────────
function setLoading(btnId, spId, loading) {
  var btn = document.getElementById(btnId);
  var sp  = document.getElementById(spId);
  btn.disabled = loading;
  sp.style.display = loading ? 'block' : 'none';
  btn.querySelector('.btn-label').style.display = loading ? 'none' : 'block';
}

// ── Paso 1: Verificar ─────────────────────────────────────────────────
function doVerify() {
  var email = document.getElementById('email').value.trim();
  var pw    = document.getElementById('password').value;
  if (!email || !pw) { showAlert('Ingresa correo y contraseña.', 'error'); return; }
  clearAlert();
  setLoading('btnVerify', 'spVerify', true);
  if (bridge) bridge.onVerify(email, pw);
}

// ── Paso 1b: Python devuelve empresas/sucursales ──────────────────────
function loadSelectScreen(empresasJson, sucursalesJson, hostname) {
  _empresas   = JSON.parse(empresasJson);
  _sucursales = JSON.parse(sucursalesJson);
  setLoading('btnVerify', 'spVerify', false);

  var emp = document.getElementById('empSelect');
  emp.innerHTML = '';
  _empresas.forEach(function(e, i) {
    var o = document.createElement('option');
    o.value = e.id; o.textContent = e.nombre;
    emp.appendChild(o);
  });
  document.getElementById('stName').value = hostname || '';
  onEmpChange();
  showScreen('screenSelect');
}

function onEmpChange() {
  var empId = document.getElementById('empSelect').value;
  var suc   = document.getElementById('sucSelect');
  suc.innerHTML = '<option value="">— Sin sucursal asignada —</option>';
  _sucursales.filter(function(s) { return s.empresa_id === empId; }).forEach(function(s) {
    var o = document.createElement('option');
    o.value = s.id; o.textContent = s.nombre;
    suc.appendChild(o);
  });
}

// ── Paso 2: Registrar ─────────────────────────────────────────────────
function doRegister() {
  var emp    = document.getElementById('empSelect').value;
  var suc    = document.getElementById('sucSelect').value;
  var nombre = document.getElementById('stName').value.trim();
  var email  = document.getElementById('email').value.trim();
  var pw     = document.getElementById('password').value;
  if (!nombre) { showAlert('Escribe un nombre para esta estación.', 'error'); return; }
  clearAlert();
  setLoading('btnRegister', 'spRegister', true);
  if (bridge) bridge.onRegister(email, pw, emp, suc, nombre);
}

// ── Pairing ───────────────────────────────────────────────────────────
function doPair() {
  var code = document.getElementById('pairCode').value.trim().toUpperCase();
  if (code.length < 6) { showAlert('El código debe tener 6 dígitos.', 'error'); return; }
  clearAlert();
  setLoading('btnPair', 'spPair', true);
  showAlert('Esperando activación desde el Panel Web...', 'info');
  if (bridge) bridge.onPair(code);
}

// ── Éxito ─────────────────────────────────────────────────────────────
function showSuccess(nombre, deviceId) {
  setLoading('btnRegister', 'spRegister', false);
  setLoading('btnPair', 'spPair', false);
  document.getElementById('successMeta').innerHTML =
    'Nombre: <b style="color:#86efac">' + nombre + '</b><br>' +
    'ID: <span style="color:#64748b">' + (deviceId||'').substring(0,22) + '...</span>';
  showScreen('screenDone');
}

// ── Errores desde Python ──────────────────────────────────────────────
function showError(msg) {
  setLoading('btnVerify', 'spVerify', false);
  setLoading('btnRegister', 'spRegister', false);
  setLoading('btnPair', 'spPair', false);
  showAlert(msg, 'error');
}

function showInfo(msg) {
  showAlert(msg, 'info');
}

// ── Launch ────────────────────────────────────────────────────────────
function doLaunch() {
  if (bridge) bridge.onLaunch();
}
</script>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────
#  SetupWindow — ventana principal
# ─────────────────────────────────────────────────────────────────────
class SetupWindow(QMainWindow):
    setup_complete = pyqtSignal()

    def __init__(self):
        super().__init__()
        self._thread      = None
        self._worker      = None
        self._pair_thread = None
        self._pair_worker = None
        self._empresas    = []
        self._suc_all     = []
        self._email       = ""
        self._password    = ""
        self._station_nombre = ""
        self._init_ui()

    def _init_ui(self):
        self.setWindowTitle("Safe Link Monitoring — Configuración inicial")
        self.resize(500, 680)
        self.setMinimumSize(480, 600)

        root = QWidget()
        self.setCentralWidget(root)
        lay = QVBoxLayout(root)
        lay.setContentsMargins(0, 0, 0, 0)

        self._view = QWebEngineView()
        s = self._view.settings()
        s.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        s.setAttribute(QWebEngineSettings.JavascriptCanOpenWindows, False)

        self._channel = QWebChannel()
        self._bridge  = _SetupBridge(self)
        self._channel.registerObject("bridge", self._bridge)
        self._view.page().setWebChannel(self._channel)

        self._view.setHtml(_HTML, baseUrl=QUrl("qrc:///"))

        self._bridge.verifyCredentials.connect(self._on_verify)
        self._bridge.registerStation.connect(self._on_register)
        self._bridge.startPairing.connect(self._on_pair_start)
        self._bridge.launch.connect(self._on_launch)

        lay.addWidget(self._view)
        self._center()

    def _center(self):
        screen = QApplication.primaryScreen().geometry()
        self.move(
            screen.center().x() - self.width() // 2,
            screen.center().y() - self.height() // 2,
        )

    def _js(self, code: str):
        self._view.page().runJavaScript(code)

    # ── Verificar credenciales ────────────────────────────────────────
    def _on_verify(self, email: str, password: str):
        self._email    = email
        self._password = password

        self._thread = QThread()
        self._worker = _LoadDataWorker(email, password)
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.done.connect(self._on_data_loaded)
        self._worker.error.connect(self._on_error)
        self._worker.done.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.start()

    def _on_data_loaded(self, empresas: list, sucursales: list):
        self._empresas = empresas
        self._suc_all  = sucursales
        from utils.station_manager import get_hostname
        hostname = get_hostname().upper()
        self._js(
            f"loadSelectScreen({json.dumps(json.dumps(empresas))},"
            f"{json.dumps(json.dumps(sucursales))},{json.dumps(hostname)});"
        )

    # ── Registrar estación ────────────────────────────────────────────
    def _on_register(self, empresa_id: str, sucursal_id: str, nombre: str, creds_json: str):
        self._station_nombre = nombre
        creds = json.loads(creds_json)
        suc_id = sucursal_id if sucursal_id else None

        self._thread = QThread()
        self._worker = _SetupWorker(
            creds["email"], creds["password"],
            empresa_id, suc_id, nombre,
        )
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.step.connect(lambda m: self._js(f"showInfo({json.dumps(m)});"))
        self._worker.done.connect(self._on_register_done)
        self._worker.error.connect(self._on_error)
        self._worker.done.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.start()

    def _on_register_done(self, api_key: str, device_id: str):
        load_dotenv(override=True)
        os.environ["STATION_API_KEY"] = api_key
        nombre = self._station_nombre or "Estación"
        self._js(f"showSuccess({json.dumps(nombre)},{json.dumps(device_id)});")

    # ── Pairing ───────────────────────────────────────────────────────
    def _on_pair_start(self, code: str):
        self._pair_thread = QThread()
        self._pair_worker = _PairingWorker(code)
        self._pair_worker.moveToThread(self._pair_thread)
        self._pair_thread.started.connect(self._pair_worker.run)
        self._pair_worker.done.connect(self._on_pair_done)
        self._pair_worker.error.connect(self._on_error)
        self._pair_worker.done.connect(self._pair_thread.quit)
        self._pair_worker.error.connect(self._pair_thread.quit)
        self._pair_thread.start()

    def _on_pair_done(self, api_key: str, device_id: str):
        load_dotenv(override=True)
        os.environ["STATION_API_KEY"] = api_key
        self._js(f"showSuccess('Vinculada por código',{json.dumps(device_id)});")

    # ── Error genérico ────────────────────────────────────────────────
    def _on_error(self, msg: str):
        self._js(f"showError({json.dumps(msg)});")

    # ── Lanzar app ────────────────────────────────────────────────────
    def _on_launch(self):
        self.hide()
        QTimer.singleShot(0, self.setup_complete.emit)

    def show(self):
        self.setWindowOpacity(0.0)
        super().show()
        # Fade in simple
        self._fade_step = 0.0
        self._fade_timer = QTimer(self)
        self._fade_timer.timeout.connect(self._do_fade)
        self._fade_timer.start(16)

    def _do_fade(self):
        self._fade_step = min(self._fade_step + 0.06, 1.0)
        self.setWindowOpacity(self._fade_step)
        if self._fade_step >= 1.0:
            self._fade_timer.stop()
