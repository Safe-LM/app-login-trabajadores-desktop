"""
HTML fallback embebido para DashboardWindow cuando no hay React build (frontend/dist).

UI mínima que recibe eventos del bridge Python via QWebChannel y expone los
globals que dashboard_window invoca con runJavaScript: setStatus, setCamState,
setEmployeeInfo, etc. — todos noop-safe si la UI no los usa.

Si frontend/dist/index.html existe, ese se carga en su lugar y este HTML nunca
se utiliza.
"""

_FALLBACK_HTML = r"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Safe Link Monitoring — Estación</title>
<script src="qrc:///qtwebchannel/qwebchannel.js"></script>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:#070810;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}
  .layout{display:grid;grid-template-columns:1fr 360px;height:100vh}
  .stage{position:relative;background:#040611;display:flex;align-items:center;justify-content:center}
  #frame{max-width:100%;max-height:100%;border-radius:12px;box-shadow:0 0 80px rgba(37,99,235,0.25)}
  .placeholder{font-size:18px;color:#475569}
  .side{padding:24px;background:#0b0f1a;border-left:1px solid #1e293b;display:flex;flex-direction:column;gap:18px}
  .station{font-size:13px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase}
  #stationName{font-size:22px;font-weight:600;color:#f1f5f9}
  #stationBranch{font-size:13px;color:#64748b;margin-top:4px}
  .status{padding:12px 14px;border-radius:10px;background:#0f172a;border:1px solid #1e293b;font-size:13px;line-height:1.4}
  .status.ok{border-color:#22c55e;color:#86efac}
  .status.warn{border-color:#facc15;color:#fde68a}
  .status.bad{border-color:#ef4444;color:#fca5a5}
  .info{background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:14px}
  .info-name{font-size:18px;font-weight:600;color:#e2e8f0}
  .info-meta{font-size:12px;color:#94a3b8;margin-top:6px;line-height:1.6}
  .conf{font-size:32px;font-weight:700;color:#60a5fa;text-align:center;margin:6px 0}
  .conf.bad{color:#fca5a5}
  .conf.ok{color:#86efac}
  .last{font-size:12px;color:#94a3b8;text-align:center;padding-top:6px;border-top:1px dashed #1e293b}
  .recent{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px}
  .recent .item{padding:8px 10px;background:#0f172a;border-radius:8px;font-size:12px;display:flex;justify-content:space-between}
  .recent .item .t{color:#64748b}
  .overlay{position:fixed;inset:0;background:rgba(4,6,17,0.92);display:none;align-items:center;justify-content:center;z-index:99}
  .overlay.show{display:flex}
  .overlay .card{background:#0f172a;border:1px solid #22c55e;border-radius:16px;padding:32px;text-align:center;max-width:420px}
  .overlay .ok-icon{font-size:48px;color:#22c55e}
  .overlay h2{font-size:22px;color:#f1f5f9;margin:12px 0 6px}
  .overlay p{color:#94a3b8;font-size:14px}
</style>
</head>
<body>
<div class="layout">
  <div class="stage">
    <img id="frame" alt="" style="display:none"/>
    <div class="placeholder" id="ph">Esperando cámara…</div>
  </div>
  <aside class="side">
    <div>
      <div class="station">Estación</div>
      <div id="stationName">—</div>
      <div id="stationBranch">—</div>
    </div>
    <div id="status" class="status">Inicializando…</div>
    <div class="info">
      <div id="empName" class="info-name">Esperando reconocimiento</div>
      <div id="empMeta" class="info-meta">—</div>
      <div id="conf" class="conf">--%</div>
    </div>
    <div id="lastReg" class="last">Sin registros hoy</div>
    <div class="recent" id="recent"></div>
  </aside>
</div>

<div class="overlay" id="overlay">
  <div class="card">
    <div class="ok-icon">✔</div>
    <h2 id="ovTitle">Asistencia registrada</h2>
    <p id="ovMsg">—</p>
  </div>
</div>

<script>
  let bridge = null;
  new QWebChannel(qt.webChannelTransport, ch => { bridge = ch.objects.bridge; });

  window.updateFrame = (b64) => {
    const img = document.getElementById('frame');
    img.src = 'data:image/jpeg;base64,' + b64;
    img.style.display = 'block';
    document.getElementById('ph').style.display = 'none';
  };
  window.setStatus = (msg, level) => {
    const el = document.getElementById('status');
    el.className = 'status ' + (level || '');
    el.textContent = msg;
  };
  window.setUser = (_name) => {};
  window.setStationInfo = (name, branch) => {
    document.getElementById('stationName').textContent = name || '—';
    document.getElementById('stationBranch').textContent = branch || '—';
  };
  window.setConnectivity = (online, msg) => {
    window.setStatus(online ? 'En línea' : ('Sin conexión: ' + msg), online ? 'ok' : 'warn');
  };
  window.setHealth = (_score, _emp, _cam, _ver) => {};
  window.setCamState = (state) => {
    if (state === 'live') document.getElementById('ph').style.display = 'none';
    if (state === 'error') {
      document.getElementById('frame').style.display = 'none';
      document.getElementById('ph').style.display = 'block';
      document.getElementById('ph').textContent = 'Error de cámara';
    }
  };
  window.setBadgeText = (_txt) => {};
  window.setConfidence = (pct) => {
    const c = document.getElementById('conf');
    if (pct < 0) { c.textContent = '--%'; c.className = 'conf'; return; }
    c.textContent = pct.toFixed(1) + '%';
    c.className = 'conf ' + (pct >= 85 ? 'ok' : (pct >= 60 ? '' : 'bad'));
  };
  window.setEmployeeInfo = (nombre, apellido, zona, suc, puesto) => {
    document.getElementById('empName').textContent = (nombre + ' ' + (apellido||'')).trim();
    document.getElementById('empMeta').textContent =
      [puesto, suc, zona].filter(Boolean).join(' · ') || '—';
  };
  window.resetEmployee = () => {
    document.getElementById('empName').textContent = 'Esperando reconocimiento';
    document.getElementById('empMeta').textContent = '—';
    window.setConfidence(-1);
  };
  window.setAvatar = (_b64) => {};
  window.setLastReg = (txt, _color) => {
    document.getElementById('lastReg').textContent = 'Último: ' + txt;
  };
  window.addRecentRecord = (nombre, tipo, hora) => {
    const list = document.getElementById('recent');
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = '<span>' + nombre + ' — ' + tipo + '</span><span class="t">' + hora + '</span>';
    list.insertBefore(div, list.firstChild);
    while (list.children.length > 8) list.removeChild(list.lastChild);
  };
  window.showAttendanceConfirmed = (nombre, apellido, tipo, hora, _avatar) => {
    document.getElementById('ovTitle').textContent =
      tipo.toUpperCase() + ' — ' + (nombre + ' ' + (apellido||'')).trim();
    document.getElementById('ovMsg').textContent = 'Registrada a las ' + hora;
    const ov = document.getElementById('overlay');
    ov.classList.add('show');
    setTimeout(() => ov.classList.remove('show'), 4500);
  };
  window.showAlreadyRegistered = (tipo, hora) => {
    window.setStatus('Ya registraste ' + tipo + ' a las ' + hora, 'warn');
  };
  window.showNotRecognized = () => { window.setStatus('No reconocido', 'bad'); };
  window.renderStats = (_data) => {};
  window.setEmployees = (_list) => {};
</script>
</body>
</html>
"""

__all__ = ["_FALLBACK_HTML"]
