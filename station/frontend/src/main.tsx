import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Registrar globals mínimos antes del render para que Python no quede esperando
const noop = () => {};
const w = window as any;
if (!w.setStatus)       w.setStatus       = noop;
if (!w.setStationInfo)  w.setStationInfo  = noop;
if (!w.setConnectivity) w.setConnectivity = noop;
if (!w.setConnected)    w.setConnected    = noop;
if (!w.setConfidence)   w.setConfidence   = noop;
if (!w.setEmployee)     w.setEmployee     = noop;
if (!w.renderStats)     w.renderStats     = noop;
if (!w.setEmployees)    w.setEmployees    = noop;
if (!w.addRecentRecord) w.addRecentRecord = noop;

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  console.error('Safe Link: #root no encontrado en el DOM')
}
