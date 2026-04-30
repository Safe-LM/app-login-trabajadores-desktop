"""
DashboardWindow — Safe Link Monitoring Station v3.0
UI: QWebEngineView con HTML/CSS/JS embebido.
"""

import base64
import logging
import socket
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict

import cv2
import numpy as np
from PyQt5.QtCore import (
    QEasingCurve, QObject, QPropertyAnimation, QThread, QTimer,
    Qt, pyqtSignal, pyqtSlot,
)
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtWebEngineWidgets import QWebEngineSettings, QWebEngineView
from PyQt5.QtWidgets import QMainWindow, QVBoxLayout, QWidget

from utils.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

FACE_RECOGNITION_AVAILABLE = False
reconocer_desde_frame = None
inicializar_sistema_facial = None


def _lazy_load_face_recognition():
    global FACE_RECOGNITION_AVAILABLE, reconocer_desde_frame, inicializar_sistema_facial
    if reconocer_desde_frame is not None:
        return
    try:
        from utils.face_recognition import (
            FACE_RECOGNITION_AVAILABLE as _av,
            inicializar_sistema_facial as _ini,
            reconocer_desde_frame as _rec,
        )
        reconocer_desde_frame = _rec
        inicializar_sistema_facial = _ini
        FACE_RECOGNITION_AVAILABLE = _av
    except ImportError:
        FACE_RECOGNITION_AVAILABLE = False
        reconocer_desde_frame = lambda *a, **k: (False, 0.0, None)
        inicializar_sistema_facial = lambda: False


# ─────────────────────────────────────────────────────────────────────────────
_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Safe Link</title>
<script src="qrc:///qtwebchannel/qwebchannel.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:       #050810;
  --surface:  #0A0F1E;
  --card:     #0D1424;
  --border:   rgba(255,255,255,.07);
  --accent:   #3B82F6;
  --green:    #22C55E;
  --yellow:   #EAB308;
  --red:      #EF4444;
  --text:     #F1F5F9;
  --text2:    #94A3B8;
  --muted:    #334155;
}
html,body{
  width:100%;height:100%;overflow:hidden;
  background:var(--bg);
  font-family:-apple-system,'Segoe UI',sans-serif;
  color:var(--text);font-size:13px;
  -webkit-font-smoothing:antialiased;
}

/* ── shell ── */
.app{display:flex;flex-direction:column;height:100vh}

/* ── topbar ── */
.topbar{
  height:48px;flex-shrink:0;
  background:var(--surface);
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;
  padding:0 20px;gap:12px;
}
.logo{display:flex;align-items:center;gap:8px}
.logo-mark{
  width:26px;height:26px;border-radius:6px;
  background:var(--accent);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 14px rgba(59,130,246,.4);
}
.logo-text{font-size:13px;font-weight:700;letter-spacing:.04em}
.logo-text em{color:var(--accent);font-style:normal}
.topbar-sep{width:1px;height:16px;background:var(--border)}
.topbar-sub{font-size:11px;color:var(--text2)}
.spacer{flex:1}
.online-badge{
  display:flex;align-items:center;gap:5px;
  font-size:10px;font-weight:600;color:var(--green);
  letter-spacing:.05em;
}
.pulse{
  width:6px;height:6px;border-radius:50%;background:var(--green);
  box-shadow:0 0 0 0 rgba(34,197,94,.5);
  animation:pulse 2s ease infinite;
}
@keyframes pulse{
  0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}
  70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}
  100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}
}
.user-chip{
  display:flex;align-items:center;gap:7px;
  background:rgba(255,255,255,.04);
  border:1px solid var(--border);
  border-radius:20px;padding:3px 10px 3px 4px;
}
.user-av{
  width:22px;height:22px;border-radius:50%;
  background:var(--accent);
  display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;color:#fff;
}
.user-name{font-size:11px;color:var(--text2)}
.clock{
  font-size:12px;font-weight:500;
  color:var(--text2);
  font-variant-numeric:tabular-nums;
  letter-spacing:.04em;
}

/* ── main ── */
.main{display:flex;flex:1;gap:0;min-height:0}

/* ── camera section ── */
.cam-section{
  flex:1;display:flex;flex-direction:column;
  border-right:1px solid var(--border);
  min-width:0;
}
.cam-toolbar{
  height:44px;flex-shrink:0;
  display:flex;align-items:center;gap:10px;
  padding:0 16px;
  border-bottom:1px solid var(--border);
  background:var(--surface);
}
.cam-label{font-size:11px;font-weight:600;color:var(--text2);letter-spacing:.06em;text-transform:uppercase}
.tag{
  font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  padding:2px 8px;border-radius:4px;
  background:rgba(148,163,184,.1);color:var(--text2);
  border:1px solid var(--border);
}
.tag.live{background:rgba(34,197,94,.1);color:var(--green);border-color:rgba(34,197,94,.2)}
.tag.warn{background:rgba(234,179,8,.1);color:var(--yellow);border-color:rgba(234,179,8,.2)}
.tag.err{background:rgba(239,68,68,.1);color:var(--red);border-color:rgba(239,68,68,.2)}
.rec-dot{
  width:6px;height:6px;border-radius:50%;background:var(--green);
  display:none;animation:pulse 1.2s infinite;
}
.rec-dot.on{display:block}
.ml-auto{margin-left:auto}

/* video area */
.video-area{
  flex:1;position:relative;background:#000;
  display:flex;align-items:center;justify-content:center;
  min-height:0;overflow:hidden;
}
#vid{width:100%;height:100%;object-fit:cover;display:none}
#vid.on{display:block}
.idle-state{
  display:flex;flex-direction:column;align-items:center;gap:16px;
  pointer-events:none;user-select:none;
}
.idle-icon{
  width:64px;height:64px;border-radius:16px;
  background:rgba(255,255,255,.03);
  border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
}
.idle-title{font-size:14px;font-weight:600;color:var(--text2)}
.idle-hint{font-size:11px;color:var(--muted)}

/* HUD */
.hud{position:absolute;inset:0;pointer-events:none}
.c{position:absolute;width:18px;height:18px;border-color:var(--accent);border-style:solid;border-width:0;opacity:.6}
.c.tl{top:14px;left:14px;border-top-width:2px;border-left-width:2px}
.c.tr{top:14px;right:14px;border-top-width:2px;border-right-width:2px}
.c.bl{bottom:14px;left:14px;border-bottom-width:2px;border-left-width:2px}
.c.br{bottom:14px;right:14px;border-bottom-width:2px;border-right-width:2px}
.scan{
  position:absolute;left:14px;right:14px;height:1px;top:14px;
  background:linear-gradient(90deg,transparent,rgba(59,130,246,.6) 50%,transparent);
  display:none;
  animation:sweep 2.8s ease-in-out infinite;
}
.scan.on{display:block}
@keyframes sweep{
  0%{top:14px;opacity:0} 8%{opacity:.7}
  92%{opacity:.7} 100%{top:calc(100% - 14px);opacity:0}
}

/* action bar */
.action-bar{
  height:60px;flex-shrink:0;
  display:flex;align-items:center;gap:10px;
  padding:0 16px;
  background:var(--surface);
  border-top:1px solid var(--border);
}
.btn{
  height:36px;border:none;border-radius:8px;
  font-size:11px;font-weight:700;letter-spacing:.05em;
  cursor:pointer;transition:all .15s;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  white-space:nowrap;
}
.btn-blue{
  background:var(--accent);color:#fff;
  padding:0 18px;
  box-shadow:0 0 16px rgba(59,130,246,.25);
}
.btn-blue:hover{background:#2563EB;box-shadow:0 0 22px rgba(59,130,246,.4)}
.btn-outline-red{
  background:transparent;color:var(--red);
  border:1px solid rgba(239,68,68,.25);
  padding:0 14px;
}
.btn-outline-red:hover{background:rgba(239,68,68,.08)}

.btn-register{
  flex:1;height:36px;border:none;border-radius:8px;
  background:var(--green);color:#fff;
  font-size:11px;font-weight:700;letter-spacing:.05em;
  cursor:pointer;transition:all .15s;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  box-shadow:0 0 16px rgba(34,197,94,.2);
}
.btn-register:hover:not([disabled]){background:#16A34A;box-shadow:0 0 22px rgba(34,197,94,.35)}
.btn-register[disabled]{
  background:rgba(255,255,255,.04);color:var(--muted);
  box-shadow:none;cursor:default;border:1px solid var(--border);
}

/* ── sidebar ── */
.sidebar{
  width:280px;flex-shrink:0;
  display:flex;flex-direction:column;
  background:var(--surface);
  overflow:hidden;
}

/* confidence block */
.conf-block{
  padding:20px 16px 16px;
  border-bottom:1px solid var(--border);
  display:flex;flex-direction:column;align-items:center;gap:10px;
  transition:background .3s;
}
.conf-block.ok{background:rgba(34,197,94,.04)}
.conf-block.warn{background:rgba(234,179,8,.04)}
.conf-block.bad{background:rgba(239,68,68,.04)}

.conf-label{font-size:9px;font-weight:700;letter-spacing:.12em;color:var(--text2);text-transform:uppercase}
.conf-block.ok  .conf-label{color:var(--green)}
.conf-block.warn .conf-label{color:var(--yellow)}
.conf-block.bad  .conf-label{color:var(--red)}

/* SVG arc */
.arc-ring{position:relative;width:88px;height:88px}
.arc-ring svg{width:88px;height:88px;position:absolute;inset:0}
.arc-num{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:20px;font-weight:700;color:var(--text2);
  font-variant-numeric:tabular-nums;
}

.conf-status{font-size:10px;color:var(--muted);letter-spacing:.04em}

/* employee block */
.emp-block{
  padding:14px 16px;
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:12px;
}
.emp-photo{
  width:44px;height:44px;border-radius:10px;flex-shrink:0;
  background:var(--card);border:1px solid var(--border);
  overflow:hidden;display:flex;align-items:center;justify-content:center;
  transition:border-color .3s;
}
.emp-photo.found{border-color:var(--green);box-shadow:0 0 0 2px rgba(34,197,94,.15)}
#empPhoto{width:100%;height:100%;object-fit:cover;display:none}
#empPhoto.on{display:block}
.emp-info{min-width:0;flex:1}
.emp-name{font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.emp-title{font-size:10px;color:var(--text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* data rows */
.data-rows{flex:1;overflow-y:auto;padding:6px 8px}
.data-row{
  display:flex;align-items:center;gap:10px;
  padding:8px;border-radius:6px;
  transition:background .12s;
}
.data-row:hover{background:rgba(255,255,255,.03)}
.data-row-key{font-size:10px;color:var(--muted);width:56px;flex-shrink:0;font-weight:500}
.data-row-val{font-size:11px;color:var(--text2);font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* last reg */
.last-block{
  padding:10px 16px;
  border-top:1px solid var(--border);
  display:flex;align-items:center;gap:10px;
}
.last-icon{color:var(--muted)}
.last-texts{}
.last-key{font-size:9px;font-weight:700;letter-spacing:.1em;color:var(--muted);text-transform:uppercase}
.last-val{font-size:11px;color:var(--text2);font-weight:600;margin-top:1px;font-variant-numeric:tabular-nums}

/* logout */
.logout-block{padding:10px 12px;border-top:1px solid var(--border)}
.btn-logout{
  width:100%;height:34px;border:none;border-radius:7px;
  background:transparent;color:var(--red);
  border:1px solid rgba(239,68,68,.18);
  font-size:11px;font-weight:600;letter-spacing:.04em;
  cursor:pointer;transition:all .15s;
  display:flex;align-items:center;justify-content:center;gap:6px;
}
.btn-logout:hover{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3)}

/* ── dialog ── */
.overlay{
  position:fixed;inset:0;
  background:rgba(5,8,16,.85);
  backdrop-filter:blur(8px);
  display:none;align-items:center;justify-content:center;
  z-index:999;
}
.overlay.on{display:flex}
.dlg{
  width:320px;background:var(--card);
  border:1px solid var(--border);
  border-radius:16px;
  padding:28px 22px 20px;
  box-shadow:0 24px 60px rgba(0,0,0,.7);
  animation:rise .3s cubic-bezier(.16,1,.3,1) both;
}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.dlg-ico{
  width:48px;height:48px;border-radius:50%;
  margin:0 auto 14px;
  display:flex;align-items:center;justify-content:center;
}
.dlg-ico.in{background:rgba(34,197,94,.15)}
.dlg-ico.out{background:rgba(59,130,246,.15)}
.dlg-title{font-size:16px;font-weight:700;text-align:center;margin-bottom:16px}
.dlg-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);
}
.dlg-row:last-of-type{border:none}
.dlg-k{font-size:11px;color:var(--text2)}
.dlg-v{font-size:11px;font-weight:700}
.dlg-cd{
  margin-top:14px;text-align:center;
  font-size:10px;font-weight:600;color:var(--muted);
  font-variant-numeric:tabular-nums;
}
</style>
</head>
<body>
<div class="app">

  <!-- topbar -->
  <div class="topbar">
    <div class="logo">
      <div class="logo-mark">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <span class="logo-text">SAFE<em>LINK</em></span>
    </div>
    <div class="topbar-sep"></div>
    <span class="topbar-sub">Estación de Asistencia</span>
    <div class="spacer"></div>
    <div class="online-badge">
      <div class="pulse"></div>
      EN LÍNEA
    </div>
    <div class="user-chip">
      <div class="user-av" id="uAv">A</div>
      <span class="user-name" id="uName">—</span>
    </div>
    <span class="clock" id="clock">00:00:00</span>
  </div>

  <!-- main -->
  <div class="main">

    <!-- camera section -->
    <div class="cam-section">

      <div class="cam-toolbar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text2)">
          <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
          <rect x="3" y="6" width="12" height="12" rx="2"/>
        </svg>
        <span class="cam-label">Cámara</span>
        <div class="rec-dot" id="recDot"></div>
        <span class="tag ml-auto" id="camTag">OFFLINE</span>
      </div>

      <div class="video-area">
        <img id="vid" alt=""/>
        <div class="idle-state" id="idleState">
          <div class="idle-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5">
              <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
              <rect x="3" y="6" width="12" height="12" rx="2"/>
            </svg>
          </div>
          <span class="idle-title">Cámara desactivada</span>
          <span class="idle-hint">Presiona Activar para comenzar</span>
        </div>
        <div class="hud">
          <div class="c tl"></div><div class="c tr"></div>
          <div class="c bl"></div><div class="c br"></div>
          <div class="scan" id="scan"></div>
        </div>
      </div>

      <div class="action-bar">
        <button class="btn btn-blue" id="btnOn" onclick="startCam()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          Activar
        </button>
        <button class="btn btn-outline-red" id="btnOff" style="display:none" onclick="stopCam()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          Detener
        </button>
        <button class="btn-register" id="btnReg" disabled onclick="doReg()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Registrar Asistencia
        </button>
      </div>
    </div>

    <!-- sidebar -->
    <div class="sidebar">

      <!-- confidence -->
      <div class="conf-block" id="confBlock">
        <span class="conf-label" id="confLabel">RECONOCIMIENTO</span>
        <div class="arc-ring">
          <svg viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="34" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="5.5"/>
            <circle id="arc" cx="44" cy="44" r="34"
              fill="none" stroke="var(--text2)" stroke-width="5.5"
              stroke-linecap="round"
              stroke-dasharray="213.6" stroke-dashoffset="213.6"
              transform="rotate(-90 44 44)"
              style="transition:stroke-dashoffset .5s,stroke .5s"/>
          </svg>
          <div class="arc-num" id="arcNum">--</div>
        </div>
        <span class="conf-status" id="confStatus">Sin detección</span>
      </div>

      <!-- employee -->
      <div class="emp-block">
        <div class="emp-photo" id="empBox">
          <img id="empPhoto" alt=""/>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" id="empPhIcon">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div class="emp-info">
          <div class="emp-name" id="empName">Esperando...</div>
          <div class="emp-title" id="empRole">—</div>
        </div>
      </div>

      <!-- data -->
      <div class="data-rows">
        <div class="data-row">
          <span class="data-row-key">Apellidos</span>
          <span class="data-row-val" id="dApe">—</span>
        </div>
        <div class="data-row">
          <span class="data-row-key">Zona</span>
          <span class="data-row-val" id="dZona">—</span>
        </div>
        <div class="data-row">
          <span class="data-row-key">Sucursal</span>
          <span class="data-row-val" id="dSuc">—</span>
        </div>
      </div>

      <!-- last reg -->
      <div class="last-block">
        <svg class="last-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <div class="last-texts">
          <div class="last-key">Último registro</div>
          <div class="last-val" id="lastVal">Sin registros hoy</div>
        </div>
      </div>

      <!-- logout -->
      <div class="logout-block">
        <button class="btn-logout" onclick="doLogout()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Cerrar Sesión
        </button>
      </div>

    </div><!-- /sidebar -->
  </div><!-- /main -->
</div><!-- /app -->

<!-- overlay dialog -->
<div class="overlay" id="ov">
  <div class="dlg">
    <div class="dlg-ico" id="dIco">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" id="dIcoSvg">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="dlg-title" id="dTitle">Entrada Registrada</div>
    <div class="dlg-row"><span class="dlg-k">Empleado</span><span class="dlg-v" id="dNom">—</span></div>
    <div class="dlg-row"><span class="dlg-k">Confianza</span><span class="dlg-v" id="dConf">—</span></div>
    <div class="dlg-row"><span class="dlg-k">Hora</span><span class="dlg-v" id="dHora">—</span></div>
    <div class="dlg-cd" id="dCd">Cerrando en 5s</div>
  </div>
</div>

<script>
var bridge=null;
new QWebChannel(qt.webChannelTransport,function(ch){bridge=ch.objects.bridge;});

// clock
(function t(){
  var n=new Date(),p=function(x){return('0'+x).slice(-2)};
  document.getElementById('clock').textContent=p(n.getHours())+':'+p(n.getMinutes())+':'+p(n.getSeconds());
  setTimeout(t,1000);
})();

function startCam(){if(bridge)bridge.startCamera();}
function stopCam() {if(bridge)bridge.stopCamera();}
function doReg()   {if(bridge)bridge.registerAttendance();}
function doLogout(){if(bridge)bridge.logout();}

function setUser(name){
  document.getElementById('uName').textContent=name;
  document.getElementById('uAv').textContent=name?name.charAt(0).toUpperCase():'?';
}

function updateFrame(b64){
  var v=document.getElementById('vid'),ph=document.getElementById('idleState');
  v.src='data:image/jpeg;base64,'+b64;
  if(!v.classList.contains('on')){v.classList.add('on');ph.style.display='none';}
}

function setCamState(s){
  var dot=document.getElementById('recDot'),tag=document.getElementById('camTag'),
      scan=document.getElementById('scan'),
      on=document.getElementById('btnOn'),off=document.getElementById('btnOff'),
      reg=document.getElementById('btnReg');
  dot.className='rec-dot'; tag.className='tag';
  if(s==='live'){
    dot.classList.add('on');
    tag.classList.add('live');tag.textContent='EN VIVO';
    scan.classList.add('on');
    on.style.display='none';off.style.display='';reg.disabled=false;
  } else if(s==='connecting'||s==='preparing'){
    tag.classList.add('warn');tag.textContent=s==='connecting'?'CONECTANDO':'ESPERA';
    on.style.display='none';off.style.display='';reg.disabled=true;
  } else {
    tag.textContent=s==='error'?'ERROR':'OFFLINE';
    if(s==='error')tag.classList.add('err');
    scan.classList.remove('on');
    on.style.display='';off.style.display='none';reg.disabled=true;
    var v=document.getElementById('vid'),ph=document.getElementById('idleState');
    v.src='';v.classList.remove('on');ph.style.display='';
  }
}
function setBadgeText(t){document.getElementById('camTag').textContent=t;}

function setStatus(text,level){
  var b=document.getElementById('confBlock'),l=document.getElementById('confLabel');
  b.className='conf-block'+(level?' '+level:'');
  l.textContent=text.toUpperCase();
}

function setConfidence(pct){
  var arc=document.getElementById('arc'),num=document.getElementById('arcNum'),
      status=document.getElementById('confStatus');
  var C=213.6;
  if(pct<0){
    arc.style.strokeDashoffset=C;arc.style.stroke='var(--text2)';
    num.textContent='--';num.style.color='var(--text2)';
    status.textContent='Sin detección';
  } else {
    arc.style.strokeDashoffset=C*(1-pct/100);
    var col=pct>=80?'var(--green)':pct>=60?'var(--yellow)':'var(--red)';
    arc.style.stroke=col;
    num.textContent=Math.round(pct)+'%';num.style.color=col;
    status.textContent=pct>=80?'Identificado':'Verificando...';
  }
}

function setEmployeeInfo(nom,ape,zona,suc,puesto){
  document.getElementById('empName').textContent=nom||'Esperando...';
  document.getElementById('empRole').textContent=puesto||'—';
  document.getElementById('dApe').textContent=ape||'—';
  document.getElementById('dZona').textContent=zona||'—';
  document.getElementById('dSuc').textContent=suc||'—';
}

function setAvatar(b64){
  var img=document.getElementById('empPhoto'),
      ico=document.getElementById('empPhIcon'),
      box=document.getElementById('empBox');
  if(b64){
    img.src='data:image/jpeg;base64,'+b64;
    img.classList.add('on');ico.style.display='none';
    box.classList.add('found');
  } else {
    img.src='';img.classList.remove('on');
    ico.style.display='';box.classList.remove('found');
  }
}

function setLastReg(text,color){
  var el=document.getElementById('lastVal');
  el.textContent=text;if(color)el.style.color=color;
}

function resetEmployee(){
  setEmployeeInfo('Esperando...','—','—','—','—');
  setConfidence(-1);setAvatar(null);
}

var _dt=null,_ds=0;
function showAttendanceDialog(tipo,nom,conf,hora){
  var isE=tipo==='entrada';
  var ico=document.getElementById('dIco'),svg=document.getElementById('dIcoSvg');
  ico.className='dlg-ico '+(isE?'in':'out');
  svg.setAttribute('stroke',isE?'var(--green)':'var(--accent)');
  svg.innerHTML=isE?'<polyline points="20 6 9 17 4 12"/>':
    '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>';
  document.getElementById('dTitle').textContent=(isE?'Entrada':'Salida')+' Registrada';
  document.getElementById('dNom').textContent=nom;
  document.getElementById('dConf').textContent=conf+'%';
  document.getElementById('dHora').textContent=hora;
  document.getElementById('ov').classList.add('on');
  _ds=5;document.getElementById('dCd').textContent='Cerrando en '+_ds+'s';
  if(_dt)clearInterval(_dt);
  _dt=setInterval(function(){
    _ds--;
    if(_ds>0)document.getElementById('dCd').textContent='Cerrando en '+_ds+'s';
    else{clearInterval(_dt);document.getElementById('ov').classList.remove('on');}
  },1000);
}
</script>
</body>
</html>"""


# ═════════════════════════════════════════════════════════════════════════════
#  Camera Thread
# ═════════════════════════════════════════════════════════════════════════════
class _CameraThread(QThread):
    frame_ready    = pyqtSignal(np.ndarray)
    camera_started = pyqtSignal(bool)

    def __init__(self, index=0):
        super().__init__()
        self._running = False
        self._index   = index
        self._cap     = None

    def start_camera(self):
        self._running = True
        self.start()

    def run(self):
        try:
            self._cap = cv2.VideoCapture(self._index)
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE,   1)
            self.msleep(120)
            if not self._cap.isOpened():
                self.camera_started.emit(False)
                return
            ok, _ = self._cap.read()
            if not ok:
                self.msleep(200)
                ok, _ = self._cap.read()
                if not ok:
                    self.camera_started.emit(False)
                    return
            self.camera_started.emit(True)
            skip = 0
            while self._running and self._cap:
                ok, frame = self._cap.read()
                if ok:
                    frame = cv2.flip(frame, 1)
                    if skip % 2 == 0:
                        try:
                            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
                            l, a, b = cv2.split(lab)
                            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4,4))
                            l = clahe.apply(l)
                            frame = cv2.cvtColor(cv2.merge([l,a,b]), cv2.COLOR_LAB2BGR)
                        except Exception:
                            pass
                    skip += 1
                    self.frame_ready.emit(frame)
                else:
                    self.msleep(100)
                self.msleep(33)
        except Exception as e:
            logger.error(f"CameraThread: {e}")
            self.camera_started.emit(False)
        finally:
            if self._cap:
                try: self._cap.release()
                except Exception: pass

    def stop(self):
        self._running = False
        if self._cap:
            try: self._cap.release()
            except Exception: pass
        self.wait(2000)


# ═════════════════════════════════════════════════════════════════════════════
#  Recognition Thread
# ═════════════════════════════════════════════════════════════════════════════
class _RecognitionThread(QThread):
    results_ready = pyqtSignal(bool, float, object, str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.running          = False
        self.current_frame    = None
        self.processing       = False
        self._frame_lock      = threading.Lock()
        self._last_proc       = 0.0
        self._interval        = 2.5
        self._disabled: set   = set()
        self._errors: dict    = {}
        self._MAX_ERR         = 3

    def set_frame(self, frame):
        if self.processing:
            return
        if self._frame_lock.acquire(blocking=False):
            try:
                self.current_frame = frame.copy() if frame is not None else None
            finally:
                self._frame_lock.release()

    def stop(self):
        self.running = False
        self.processing = False
        self.wait(2000)

    def run(self):
        import time
        self.running = True
        while self.running:
            if self.current_frame is not None and not self.processing:
                t = time.time()
                if t - self._last_proc >= self._interval:
                    self._last_proc = t
                    self.processing = True
                    try:
                        with self._frame_lock:
                            f = self.current_frame.copy() if self.current_frame is not None else None
                        if f is not None:
                            self._process(f)
                    except Exception as e:
                        msg = str(e)
                        if "1114" in msg or "DLL" in msg:
                            self._interval = min(self._interval + 0.5, 5.0)
                        else:
                            logger.error(f"RecognitionThread: {msg[:120]}")
                    finally:
                        self.processing = False
            self.msleep(300)

    def _record_error(self, method, error):
        count = self._errors.get(method, 0) + 1
        self._errors[method] = count
        msg = str(error)
        if any(s in msg for s in ("1114", "DLL", "WinError")) or count >= self._MAX_ERR:
            self._disabled.add(method)
            logger.warning(f"'{method}' deshabilitado: {type(error).__name__}")

    def _process(self, frame):
        h, w = frame.shape[:2]
        mx = 480
        if h > mx or w > mx:
            s = min(mx/h, mx/w)
            frame = cv2.resize(frame, (int(w*s), int(h*s)), interpolation=cv2.INTER_AREA)

        if "hybrid" not in self._disabled:
            try:
                from utils.hybrid_opencv_gemini_matcher import match_photo_hybrid
                ok, conf, info, method = match_photo_hybrid(frame, min_confidence=0.80)
                if ok and info and conf >= 0.80:
                    self._errors.pop("hybrid", None)
                    self.results_ready.emit(True, conf, info, method)
                    return
            except Exception as e:
                self._record_error("hybrid", e)

        if "photo_matcher" not in self._disabled:
            try:
                from utils.photo_to_photo_matcher import match_photo_from_frame
                ok, conf, info = match_photo_from_frame(frame, min_confidence=0.80)
                if ok and info and conf >= 0.80:
                    self._errors.pop("photo_matcher", None)
                    self.results_ready.emit(True, conf, info, "Foto")
                    return
            except Exception as e:
                self._record_error("photo_matcher", e)

        if "opencv" not in self._disabled:
            try:
                from utils.face_recognition_opencv import recognize_opencv
                ok, conf, info = recognize_opencv(frame)
                if ok and info:
                    self._errors.pop("opencv", None)
                    self.results_ready.emit(True, conf, info, "OpenCV")
                    return
            except Exception as e:
                self._record_error("opencv", e)


# ═════════════════════════════════════════════════════════════════════════════
#  Bridge Python ↔ JS
# ═════════════════════════════════════════════════════════════════════════════
class _Bridge(QObject):
    start_camera_requested  = pyqtSignal()
    stop_camera_requested   = pyqtSignal()
    register_requested      = pyqtSignal()
    logout_requested        = pyqtSignal()

    @pyqtSlot()
    def startCamera(self):
        self.start_camera_requested.emit()

    @pyqtSlot()
    def stopCamera(self):
        self.stop_camera_requested.emit()

    @pyqtSlot()
    def registerAttendance(self):
        self.register_requested.emit()

    @pyqtSlot()
    def logout(self):
        self.logout_requested.emit()


# ═════════════════════════════════════════════════════════════════════════════
#  DashboardWindow
# ═════════════════════════════════════════════════════════════════════════════
class DashboardWindow(QMainWindow):

    def __init__(self, trabajador):
        super().__init__()
        self.trabajador       = trabajador
        self._cam_thread      = None
        self._rec_thread      = None
        self._current_frame   = None
        self._attendance_done = False
        self._active_dialog   = False
        self._last_rec_ts     = 0.0
        self._prep_count      = 0
        self._prep_timer      = None
        self._last_frame_ts   = 0.0

        self._init_ui()
        QTimer.singleShot(800, self._page_ready)

    def _init_ui(self):
        self.setWindowTitle(
            f"Safe Link Monitoring — {self.trabajador.nombre} {self.trabajador.apellido}"
        )
        self.setMinimumSize(1080, 640)
        self.resize(1280, 760)
        self.setStyleSheet("QMainWindow{background:#050810}")

        self._view = QWebEngineView()
        s = self._view.settings()
        s.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        s.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)

        self._channel = QWebChannel()
        self._bridge  = _Bridge()
        self._channel.registerObject("bridge", self._bridge)
        self._view.page().setWebChannel(self._channel)

        self._bridge.start_camera_requested.connect(self._start_camera)
        self._bridge.stop_camera_requested.connect(self._stop_camera)
        self._bridge.register_requested.connect(self._register_attendance)
        self._bridge.logout_requested.connect(self._logout)

        from PyQt5.QtCore import QUrl
        self._view.setHtml(_HTML, baseUrl=QUrl("qrc:///"))
        self._view.page().loadFinished.connect(self._on_load)

        container = QWidget()
        lay = QVBoxLayout(container)
        lay.setContentsMargins(0,0,0,0)
        lay.setSpacing(0)
        lay.addWidget(self._view)
        self.setCentralWidget(container)

    def _js(self, code: str):
        self._view.page().runJavaScript(code)

    def _on_load(self, ok):
        if ok:
            QTimer.singleShot(200, self._page_ready)

    def _page_ready(self):
        nombre = f"{self.trabajador.nombre} {self.trabajador.apellido}"
        self._js(f"setUser({nombre!r});")
        self._js("setStatus('Sistema listo', '');")
        self._load_last_registration()
        QTimer.singleShot(500, self._init_face_recognition)

    def _init_face_recognition(self):
        self._js("setStatus('Inicializando...', 'warn');")
        _lazy_load_face_recognition()
        self._rec_thread = _RecognitionThread(self)
        self._rec_thread.results_ready.connect(self._on_recognition)

        if FACE_RECOGNITION_AVAILABLE and inicializar_sistema_facial:
            try:
                try:
                    from utils.register_photos import register_photos_from_database
                    register_photos_from_database()
                except Exception:
                    pass
                inicializar_sistema_facial()
                self._js("setStatus('Sistema listo', 'ok');")
            except Exception as e:
                logger.error(f"init facial: {e}")
                self._js("setStatus('Reconocimiento parcial', 'warn');")
        else:
            self._js("setStatus('Reconocimiento no disponible', 'warn');")

    def _start_camera(self):
        if self._cam_thread:
            return
        self._js("setCamState('connecting');")
        self._js("setStatus('Conectando cámara...', 'warn');")
        self._cam_thread = _CameraThread(0)
        self._cam_thread.frame_ready.connect(self._on_frame)
        self._cam_thread.camera_started.connect(self._on_cam_started)
        QTimer.singleShot(50, self._cam_thread.start_camera)

    def _on_cam_started(self, ok):
        if not ok:
            self._cam_thread = None
            self._js("setCamState('error');")
            self._js("setStatus('Error: no se pudo acceder a la cámara', 'bad');")
            return
        self._prep_count = 5
        self._prep_timer = QTimer(self)
        self._prep_timer.setInterval(1000)
        self._prep_timer.timeout.connect(self._prep_tick)
        self._prep_timer.start()
        self._prep_tick()

    def _prep_tick(self):
        if self._prep_count > 0:
            self._js(f"setCamState('preparing'); setBadgeText('ESPERA {self._prep_count}S');")
            self._js(f"setStatus('Acomódate frente a la cámara... {self._prep_count}s', 'warn');")
            self._prep_count -= 1
        else:
            self._prep_timer.stop()
            self._js("setCamState('live');")
            self._js("setStatus('Buscando rostro...', 'warn');")
            if self._rec_thread and not self._rec_thread.isRunning():
                self._rec_thread.start()

    def _stop_camera(self):
        if self._cam_thread:
            self._cam_thread.stop()
            self._cam_thread = None
        self._js("setCamState('offline');")
        self._js("setStatus('Sistema listo', '');")
        self._current_frame = None

    def _on_frame(self, frame: np.ndarray):
        if frame is None or frame.size == 0:
            return
        self._current_frame = frame

        import time
        now = time.time()
        if now - self._last_frame_ts < 0.05:
            return
        self._last_frame_ts = now

        ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
        if ok:
            b64 = base64.b64encode(buf.tobytes()).decode('ascii')
            self._js(f"updateFrame('{b64}');")

        if self._rec_thread and self._rec_thread.isRunning() and not self._rec_thread.processing:
            import time as _t
            if _t.time() - self._last_rec_ts >= 0.5:
                self._last_rec_ts = _t.time()
                self._rec_thread.set_frame(frame)

    def _on_recognition(self, ok, conf, info, method):
        import time
        if ok and info:
            pct = conf * 100
            self._js(f"setConfidence({pct:.1f});")
            self._js(f"setStatus('Identificado — {method}', 'ok');")
            self._js(f"setEmployeeInfo({info.get('nombre','N/A')!r},{info.get('apellido','')!r},{info.get('zona','N/A')!r},{info.get('sucursal','N/A')!r},{info.get('puesto','N/A')!r});")

            try:
                from utils.employee_mapper import get_photo_path
                from PyQt5.QtCore import QByteArray, QBuffer
                from PyQt5.QtGui import QPixmap
                eid = info.get("employee_id", 0)
                photo_path = get_photo_path(eid)
                if photo_path and Path(photo_path).exists():
                    px = QPixmap(str(photo_path))
                    if not px.isNull():
                        ba = QByteArray(); buf2 = QBuffer(ba)
                        buf2.open(QBuffer.WriteOnly); px.save(buf2, "JPEG", 80)
                        self._js(f"setAvatar('{base64.b64encode(ba.data()).decode()}');")
            except Exception:
                pass

            if conf >= 0.85 and not self._attendance_done:
                self._auto_register(info, conf, method)
        else:
            if time.time() - self._last_rec_ts > 3.0:
                self._js("setConfidence(-1);")
                self._js("setStatus('Buscando rostro...', 'warn');")
                self._js("resetEmployee();")

    def _auto_register(self, info: Dict, conf: float, method: str):
        if self._attendance_done or self._active_dialog:
            return
        try:
            from utils.database import get_db_session
            from utils.models import RegistroAsistencia, Trabajador
            from sqlalchemy import func
            eid = info.get("employee_id", 0)
            db  = get_db_session()
            try:
                trab = db.query(Trabajador).filter(Trabajador.employee_id == eid).first()
                if not trab:
                    parts = info.get("nombre", "").split()
                    trab  = Trabajador(
                        usuario=f"emp_{eid}", password_hash="",
                        nombre=parts[0] if parts else "Empleado",
                        apellido=" ".join(parts[1:]) if len(parts)>1 else "",
                        sucursal=info.get("sucursal","N/A"), zona=info.get("zona","N/A"),
                        puesto=info.get("puesto","N/A"), employee_id=eid, activo=True,
                    )
                    db.add(trab); db.commit(); db.refresh(trab)
            finally:
                db.close()
            self._register_db(trab, conf, info, method)
        except Exception as e:
            logger.error(f"auto_register: {e}")

    def _register_attendance(self):
        if self._current_frame is None:
            self._js("setStatus('Sin imagen — activa la cámara primero', 'bad');")
            return
        if self._attendance_done:
            return
        _lazy_load_face_recognition()
        if not FACE_RECOGNITION_AVAILABLE or reconocer_desde_frame is None:
            self._js("setStatus('Reconocimiento no disponible', 'bad');")
            return
        ok, conf, idx = reconocer_desde_frame(
            self._current_frame,
            trabajador_id=self.trabajador.id,
            embedding_idx=getattr(self.trabajador, 'embedding_idx', None),
        )
        if not ok or conf < 0.85:
            self._js(f"setStatus('No reconocido — {conf*100:.0f}%', 'bad');")
            return
        self._register_db(self.trabajador, conf, None, "manual")

    def _register_db(self, trab, conf, info, method):
        try:
            from utils.database import get_db_session
            from utils.models import RegistroAsistencia
            from sqlalchemy import func
            db  = get_db_session()
            hoy = datetime.now().date()
            try:
                ultimo = (
                    db.query(RegistroAsistencia)
                    .filter(
                        RegistroAsistencia.trabajador_id == trab.id,
                        func.date(RegistroAsistencia.timestamp) == hoy,
                    )
                    .order_by(RegistroAsistencia.timestamp.desc()).first()
                )
                tipo = "salida" if ultimo and ultimo.tipo == "entrada" else "entrada"
                db.add(RegistroAsistencia(
                    trabajador_id=trab.id, timestamp=datetime.now(), tipo=tipo,
                    reconocimiento_facial=True, confianza=conf,
                    ubicacion=(info.get("sucursal","N/A") if info else getattr(trab,"sucursal","N/A")),
                ))
                db.commit()
                self._attendance_done = True
                self._update_last_reg(tipo, datetime.now())
            finally:
                db.close()

            nombre_display = info.get("nombre","Trabajador") if info else f"{trab.nombre} {trab.apellido}"
            hora = datetime.now().strftime("%H:%M:%S")
            self._active_dialog = True
            self._js(f"showAttendanceDialog({tipo!r},{nombre_display!r},{int(conf*100)!r},{hora!r});")

            ok_cloud = False
            try:
                sb = get_supabase_client()
                if sb:
                    emp_data = sb.table("empleados").select("id").eq("employee_id", trab.employee_id).execute()
                    if emp_data.data:
                        sb.table("asistencias").insert({
                            "empleado_id": emp_data.data[0]["id"],
                            "tipo": tipo, "confianza": float(conf),
                            "ubicacion": (info.get("sucursal","N/A") if info else getattr(trab,"sucursal","N/A")),
                            "reconocimiento_facial": True,
                            "metodo": method.lower().replace(" ","_") if method else "manual",
                            "dispositivo": socket.gethostname(),
                        }).execute()
                        ok_cloud = True
            except Exception as es:
                logger.error(f"Supabase sync: {es}")

            self._js(f"setStatus({'REGISTRO SAAS OK' if ok_cloud else 'REGISTRO LOCAL'!r}, 'ok');")
            QTimer.singleShot(5000, self._logout)
        except Exception as e:
            logger.error(f"_register_db: {e}")

    def _load_last_registration(self):
        try:
            from utils.database import get_db_session
            from utils.models import RegistroAsistencia
            from sqlalchemy import func
            db  = get_db_session()
            hoy = datetime.now().date()
            last = (
                db.query(RegistroAsistencia)
                .filter(
                    RegistroAsistencia.trabajador_id == self.trabajador.id,
                    func.date(RegistroAsistencia.timestamp) == hoy,
                )
                .order_by(RegistroAsistencia.timestamp.desc()).first()
            )
            db.close()
            if last:
                self._update_last_reg(last.tipo, last.timestamp)
        except Exception:
            pass

    def _update_last_reg(self, tipo, ts):
        hora  = ts.strftime("%H:%M:%S") if hasattr(ts, "strftime") else str(ts)
        color = "var(--green)" if tipo == "entrada" else "var(--accent)"
        self._js(f"setLastReg({(tipo.upper() + '  ' + hora)!r}, {color!r});")

    def _logout(self):
        self._stop_camera()
        if self._rec_thread and self._rec_thread.isRunning():
            self._rec_thread.stop()
        self.close()
        from windows.login_window import LoginWindow
        self._login = LoginWindow()
        self._login.show()

    def show(self):
        self.setWindowOpacity(0)
        super().show()
        self._fade = QPropertyAnimation(self, b"windowOpacity")
        self._fade.setDuration(350)
        self._fade.setStartValue(0.0)
        self._fade.setEndValue(1.0)
        self._fade.setEasingCurve(QEasingCurve.OutCubic)
        self._fade.start()

    def closeEvent(self, ev):
        self._stop_camera()
        if self._rec_thread and self._rec_thread.isRunning():
            self._rec_thread.stop()
        ev.accept()
