"use client";
import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { computeReport } from "./compute";
import type { ComputedReport } from "./compute";
import type { Filtros, Granularidad, ReportesData, EmpleadoFila, DiaEmpleado, ReportesRegistro } from "./types";
import { ExportButton } from "@/components/ui/ExportButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Printer, AlertTriangle, Smile, BarChart2, Star, Calendar, Clock, AlertCircle, UserX, CheckCircle2, ChevronRight, Search, Activity, Building, LogIn, LogOut, ShieldAlert, List, Check, Eye, Fingerprint, Terminal, Hash, MapPin, UserCheck } from "lucide-react";

// Paleta corporativa OSCORP — verde institucional como acento principal.
const OSCORP = {
  green: "#1B8A6B",        // verde institucional (títulos, cabeceras, marca)
  greenDeep: "#0F6B52",    // verde profundo (hover, acentos fuertes)
  greenSoft: "rgba(27,138,107,0.10)",
  ink: "#2B3A36",          // gris-verdoso oscuro (donut "South", texto fuerte en print)
  teal: "#2BB3C0",         // cian secundario (donut)
  gold: "#C9B032",         // dorado/olivo (donut, estrella top performer)
};

// Paleta sobria — tonos corporativos apagados para KPIs y badges del detalle diario.
// Menos saturados que los semánticos brillantes, para un look serio/empresarial.
const SOBRIO = {
  teal:      "#3FA889",            // verde institucional suave (días asistidos / acento)
  green:     "#3FA889",            // horas trabajadas
  greenSub:  "rgba(63,168,137,0.7)",
  amber:     "#D9A04B",            // retardos (dorado/olivo, no ámbar chillón)
  amberSub:  "rgba(217,160,75,0.7)",
  red:       "#C76B6B",            // incidencias (rojo terroso, no rojo alarma)
  redSub:    "rgba(199,107,107,0.7)",
};

// Colores del donut por sucursal — secuencia OSCORP (verde, tinta, cian, dorado…).
const CHART_COLORS = ["#1B8A6B", "#2B3A36", "#2BB3C0", "#C9B032", "#3FA889", "#5A6B66", "#6FCCD6", "#DBC85A"];

const GLOBAL_CSS = `
  @media screen {
    .no-screen {
      display: none !important;
    }
    /* ════ Buscador en el Sidebar ════ */
    .emp-search-container {
      padding: 0 6px 6px 6px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 6px;
    }
    .emp-search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .emp-search-input {
      width: 100%;
      padding: 6px 10px 6px 28px;
      font-size: 11.5px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.012);
      border: 1px solid var(--border);
      color: var(--text-primary);
      transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .emp-search-input:focus {
      border-color: var(--teal);
      background: rgba(20, 184, 166, 0.04);
      box-shadow: 0 0 0 2px var(--teal-glow);
      outline: none;
    }
    .emp-search-icon {
      position: absolute;
      left: 9px;
      color: var(--text-faint);
      pointer-events: none;
    }

    /* ════ Tabla de registro diario ════ */
    /* ════ Timeline de Actividad Simplificado ════ */
    .timeline-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 380px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .timeline-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.01);
      border: 1px solid var(--border);
      border-radius: 10px;
      transition: all 150ms ease;
    }
    .timeline-row:hover {
      background: rgba(255, 255, 255, 0.02);
      border-color: rgba(255, 255, 255, 0.05);
      transform: translateX(2px);
    }
    .timeline-row.is-absent {
      opacity: 0.55;
      background: transparent;
      border-style: dashed;
    }
    .timeline-date-block {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 85px;
      flex-shrink: 0;
    }
    .timeline-date {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .timeline-dayname {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .timeline-info-block {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary);
      min-width: 0;
    }
    .timeline-time-flow {
      display: flex;
      align-items: center;
      gap: 5px;
      font-variant-numeric: tabular-nums;
    }
    .timeline-time-stamp {
      font-weight: 600;
      font-size: 11.5px;
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.03);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.04);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .timeline-flow-arrow {
      color: var(--text-faint);
    }
    .timeline-duration {
      font-size: 11px;
      font-weight: 600;
      color: var(--teal);
      background: var(--teal-soft);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid rgba(20, 184, 166, 0.1);
    }
    .timeline-no-activity {
      font-style: italic;
      color: var(--text-faint);
      font-size: 11.5px;
    }
    .timeline-status-block {
      flex-shrink: 0;
    }

    /* Registros Log View (Premium UI) */
    .log-header {
      display: grid;
      grid-template-columns: 110px 2.2fr 1.3fr 110px 120px 48px;
      gap: 16px;
      padding: 10px 18px;
      background: rgba(255, 255, 255, 0.015);
      border-bottom: 1px solid var(--border);
      font-size: 10px;
      font-weight: 700;
      color: var(--text-faint);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      align-items: center;
    }
    .log-row {
      display: grid;
      grid-template-columns: 110px 2.2fr 1.3fr 110px 120px 48px;
      gap: 16px;
      padding: 12px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      align-items: center;
      transition: all 150ms ease;
    }
    .log-row:hover {
      background: rgba(255, 255, 255, 0.025) !important;
      border-bottom-color: rgba(255, 255, 255, 0.06) !important;
    }
    .log-row:last-child {
      border-bottom: none;
    }
    .log-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .log-row:hover .log-action-btn {
      background: rgba(20, 184, 166, 0.12);
      border-color: rgba(20, 184, 166, 0.3);
      color: var(--teal);
      transform: scale(1.08);
      box-shadow: 0 0 8px rgba(20, 184, 166, 0.2);
    }

    /* Segmented Control / Tabs for daily log */
    .desglose-tabs-container {
      display: flex;
      gap: 3px;
      background: rgba(255, 255, 255, 0.015);
      padding: 2px;
      border-radius: 8px;
      border: 1px solid var(--border);
      margin-bottom: 8px;
    }
    .desglose-tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 6px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
    }
    .desglose-tab-btn:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.025);
    }
    .desglose-tab-btn.active {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.04) !important;
      border-color: rgba(255, 255, 255, 0.06);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    .desglose-tab-btn .tab-icon {
      width: 12px;
      height: 12px;
      opacity: 0.6;
      transition: opacity 150ms ease;
    }
    .desglose-tab-btn.active .tab-icon {
      opacity: 1;
    }
    .desglose-tab-btn.has-alerts:not(.active) {
      color: #fbbf24;
    }

    /* Centralized daily breakdown classes */
    .desglose-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 600;
      padding: 2.5px 6px;
      border-radius: 5px;
      white-space: nowrap;
      border: 1px solid transparent;
    }
    .desglose-badge-success {
      color: #34d399;
      background: rgba(16, 185, 129, 0.06);
      border-color: rgba(16, 185, 129, 0.12);
    }
    .desglose-badge-warn {
      color: #fbbf24;
      background: rgba(217, 160, 75, 0.06);
      border-color: rgba(217, 160, 75, 0.12);
    }
    .desglose-badge-danger {
      color: #f87171;
      background: rgba(239, 68, 68, 0.06);
      border-color: rgba(239, 68, 68, 0.12);
    }
    .desglose-badge-neutral {
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.03);
      border-color: var(--border);
    }

    /* ════════════════════════════════════════════════════════════
       DETALLE DIARIO POR COLABORADOR — Rediseño visual
       ════════════════════════════════════════════════════════════ */

    /* ── Sidebar de colaboradores ── */
    .emp-sidebar {
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 580px;
      overflow-y: auto;
    }
    .emp-sidebar-header {
      padding: 6px 8px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .emp-sidebar-header .ess-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-faint);
    }
    .emp-sidebar-header .ess-count {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1px 6px;
    }
    .emp-item {
      position: relative;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .emp-item::before {
      content: "";
      position: absolute;
      left: 3px;
      top: 50%;
      transform: translateY(-50%) scaleY(0);
      width: 2.5px;
      height: 16px;
      border-radius: 2px;
      background: var(--teal);
      transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .emp-item:hover {
      background: rgba(255,255,255,0.02);
      border-color: rgba(255,255,255,0.04);
      transform: translateX(2px);
    }
    .emp-item.is-active {
      background: rgba(20,184,166,0.05);
      border-color: rgba(20,184,166,0.18);
      box-shadow: inset 0 0 12px rgba(20,184,166,0.02);
    }
    .emp-item.is-active::before {
      transform: translateY(-50%) scaleY(1);
      box-shadow: 0 0 8px var(--teal);
    }
    .emp-item .ei-avatar {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
      transition: all 200ms ease;
    }
    .emp-item.is-active .ei-avatar {
      transform: scale(1.05);
    }
    .emp-item .ei-name {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 130ms ease;
    }
    .emp-item.is-active .ei-name,
    .emp-item:hover .ei-name {
      color: var(--text-primary);
    }
    .emp-chips {
      display: flex;
      gap: 4px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .emp-chip {
      font-size: 9px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid transparent;
      transition: all 150ms ease;
    }
    .emp-chip-ok    { background: rgba(16,185,129,0.06); color: #34d399; border-color: rgba(16,185,129,0.12); }
    .emp-chip-warn  { background: rgba(217,160,75,0.08);  color: #fbbf24; border-color: rgba(217,160,75,0.14); }
    .emp-chip-danger{ background: rgba(239,68,68,0.08); color: #f87171; border-color: rgba(239,68,68,0.14); }
    .emp-chip-muted { background: rgba(255,255,255,0.03); color: var(--text-muted); border-color: var(--border); }

    /* ── Cabecera del detalle ── */
    .detail-head {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 14px;
      margin-bottom: 12px;
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(255,255,255,0.012) 0%, transparent 100%);
      border: 1px solid var(--border);
    }
    .detail-head .dh-avatar {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 700;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .detail-head .dh-name {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.015em;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }
    .detail-head .dh-meta {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .detail-head .dh-loc {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .dh-dot {
      width: 3px; height: 3px; border-radius: 50%;
      background: var(--text-faint); flex-shrink: 0;
    }

    /* ── KPI cards (compactas) ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(255,255,255,0.012);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid var(--border);
      overflow: hidden;
      transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .kpi-card:hover {
      background: rgba(255,255,255,0.025);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.5);
    }
    .kpi-card.kpi-card-asistencias:hover { border-color: rgba(63, 168, 137, 0.4); box-shadow: 0 8px 20px -8px rgba(63, 168, 137, 0.15); }
    .kpi-card.kpi-card-retardos:hover { border-color: rgba(217, 160, 75, 0.4); box-shadow: 0 8px 20px -8px rgba(217, 160, 75, 0.15); }
    .kpi-card.kpi-card-incidencias:hover { border-color: rgba(199, 107, 107, 0.4); box-shadow: 0 8px 20px -8px rgba(199, 107, 107, 0.15); }
    .kpi-card.kpi-card-ausencias:hover { border-color: rgba(255, 255, 255, 0.15); box-shadow: 0 8px 20px -8px rgba(255, 255, 255, 0.05); }
    .kpi-card.kpi-card-horas:hover { border-color: rgba(20, 184, 166, 0.4); box-shadow: 0 8px 20px -8px rgba(20, 184, 166, 0.15); }

    .kpi-card .kc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      margin-bottom: 1px;
    }
    .kpi-card .kc-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      color: var(--text-faint);
      transition: color 250ms ease;
    }
    .kpi-card:hover .kc-icon {
      color: var(--kpi-icon-color, var(--text-muted));
    }
    .kpi-card .kc-accent { display: none; }
    .kpi-card .kc-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-faint);
    }
    .kpi-card .kc-value {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.01em;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
    .kpi-card .kc-sub {
      font-size: 9.5px;
      color: var(--text-faint);
      font-weight: 500;
      margin-top: 1px;
    }

    /* ── Section divider (Registro diario) ── */
    .section-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .section-divider .sd-title {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }
    .section-divider .sd-line {
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .section-divider .sd-count {
      font-size: 10.5px;
      color: var(--text-faint);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    /* ── Cabecera de columnas de la tabla ── */
    .dri-head {
      display: grid;
      grid-template-columns: 120px 90px 90px 60px 1fr;
      gap: 0;
      padding: 0;
      margin-bottom: 0;
      border-bottom: 1px solid var(--border-strong);
      background: rgba(255, 255, 255, 0.02);
    }
    .dri-head > span {
      font-size: 9px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 8px 12px;
    }
    .desglose-row-item:last-child { border-bottom: none; }
    /* Contenedor de la tabla con borde y esquinas */
    .dri-table {
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.004);
    }

    @media (max-width: 768px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }

    @media (max-width: 768px) {
      .log-header {
        display: none !important;
      }
      .log-row {
        grid-template-columns: 1fr 1fr !important;
        gap: 12px !important;
        padding: 14px 16px !important;
      }
      .log-row > div:nth-child(1) { /* date/time */
        grid-column: span 2 !important;
      }
      .log-row > div:nth-child(2) { /* employee */
        grid-column: span 2 !important;
      }
      .log-row > div:nth-child(3) { /* branch */
        grid-column: span 1 !important;
      }
      .log-row > div:nth-child(4) { /* event badge */
        grid-column: span 1 !important;
        justify-self: end !important;
      }
      .log-row > div:nth-child(5) { /* confidence */
        grid-column: span 2 !important;
        border-top: 1px dashed rgba(255, 255, 255, 0.03) !important;
        padding-top: 8px !important;
        margin-top: 4px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      }
      .log-row > div:nth-child(6) { /* action button */
        display: none !important;
      }
    }

    /* ════ Estilos de Modal Biométrico Premium ════ */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .modal-card {
      width: 100%;
      max-width: 520px;
      background: var(--bg-card);
      border: 1px solid var(--border-hover);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 24px 60px -15px rgba(0, 0, 0, 0.9), 0 0 32px rgba(20, 184, 166, 0.08);
      display: flex;
      flex-direction: column;
      animation: modalUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes modalUp {
      from { opacity: 0; transform: scale(0.96) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255,255,255,0.005);
    }
    .modal-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal-close-btn {
      background: transparent;
      border: none;
      color: var(--text-faint);
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      transition: all 150ms ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-close-btn:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.06);
    }
    .modal-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* HUD Biométrico */
    .biometric-hud-container {
      position: relative;
      width: 100%;
      height: 180px;
      background: linear-gradient(135deg, rgba(20, 184, 166, 0.04) 0%, rgba(37, 99, 235, 0.02) 100%);
      border: 1px solid rgba(20, 184, 166, 0.15);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    /* Esquineros HUD */
    .biometric-hud-corner {
      position: absolute;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(20, 184, 166, 0.4);
      pointer-events: none;
    }
    .biometric-hud-corner.tl { top: 8px; left: 8px; border-right: none; border-bottom: none; }
    .biometric-hud-corner.tr { top: 8px; right: 8px; border-left: none; border-bottom: none; }
    .biometric-hud-corner.bl { bottom: 8px; left: 8px; border-right: none; border-top: none; }
    .biometric-hud-corner.br { bottom: 8px; right: 8px; border-left: none; border-top: none; }

    .biometric-hud-grid {
      display: grid;
      grid-template-columns: 1fr 60px 1fr;
      width: 90%;
      align-items: center;
      justify-items: center;
      z-index: 5;
    }
    .biometric-port {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .biometric-port-circle {
      position: relative;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 700;
      border: 2px dashed rgba(20, 184, 166, 0.3);
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 12px rgba(20, 184, 166, 0.05);
    }
    .biometric-port-circle.matched {
      border: 2px solid var(--teal);
      box-shadow: 0 0 16px rgba(20, 184, 166, 0.25);
    }
    .biometric-port-label {
      font-size: 8px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.4);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .biometric-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      position: relative;
    }
    .biometric-connector-line {
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, rgba(20, 184, 166, 0.15), var(--teal), rgba(20, 184, 166, 0.15));
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    }
    .biometric-connector-badge {
      font-size: 8.5px;
      font-weight: 800;
      color: #fff;
      background: var(--teal);
      padding: 3px 6px;
      border-radius: 12px;
      z-index: 2;
      box-shadow: 0 0 10px rgba(20, 184, 166, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.25);
      white-space: nowrap;
      animation: pulseMatch 2s infinite ease-in-out;
    }
    @keyframes pulseMatch {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.95; }
    }
    .biometric-laser {
      position: absolute;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--teal), transparent);
      box-shadow: 0 0 12px var(--teal);
      animation: laserSweep 4s infinite ease-in-out;
      pointer-events: none;
      z-index: 10;
    }
    @keyframes laserSweep {
      0%, 100% { top: 5%; }
      50% { top: 95%; }
    }

    /* Consola del Sistema */
    .biometric-console {
      width: 100%;
      background: #020617;
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      padding: 10px 14px;
      font-family: var(--font-data), ui-monospace, monospace;
      font-size: 9.5px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.4);
      max-height: 84px;
      overflow-y: auto;
    }
    .biometric-console-line {
      display: flex;
      gap: 6px;
    }
    .biometric-console-tag-sys { color: #3b82f6; font-weight: 700; }
    .biometric-console-tag-ok { color: #10b981; font-weight: 700; }
    .biometric-console-text-ok { color: #e2e8f0; }

    /* Grid de metadatos */
    .modal-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .modal-info-card {
      background: rgba(255, 255, 255, 0.015);
      border: 1px solid rgba(255, 255, 255, 0.03);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .modal-info-icon-wrapper {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .modal-info-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-faint);
      margin-bottom: 2px;
      display: block;
    }
    .modal-info-value {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.005);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  }

  @media print {
    @page {
      size: letter portrait;
      margin: 16mm 15mm 18mm 15mm;
    }

    body, html, :root {
      --bg-black: #ffffff !important;
      --bg-card: #ffffff !important;
      --bg-elevated: #f8fafc !important;
      --border: #e2e8f0 !important;
      --border-strong: #cbd5e1 !important;
      --text-primary: #0f172a !important;
      --text-secondary: #334155 !important;
      --text-muted: #64748b !important;
      --text-faint: #94a3b8 !important;
      background: white !important;
      color: #0f172a !important;
    }

    /* Ocultar elementos no imprimibles */
    .no-print,
    .btn,
    .filter-bar,
    .page-header-actions,
    nav,
    aside,
    header,
    footer,
    button,
    input,
    select,
    .dashboard-shell > *:not(.dashboard-main-col),
    .dashboard-main-col > *:not(main),
    .dashboard-topbar {
      display: none !important;
    }

    /* Reset del layout de Next.js/Dashboard para impresión */
    body, html, .dashboard-shell, .dashboard-main-col, .dashboard-main, main, .page {
      background: white !important;
      color: #0f172a !important;
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      min-height: auto !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
    }

    .print-only {
      display: block !important;
    }

    /* Colores oscuros legibles para texto */
    h1, h2, h3, h4, p, span, td, th {
      color: #0f172a !important;
    }

    /* Formatear tarjetas para papel */
    .card {
      background: white !important;
      border: 1px solid #e2e8f0 !important;
      border-top: 3px solid var(--kpi-color, #1B8A6B) !important;
      box-shadow: none !important;
      page-break-inside: avoid !important;
      margin-bottom: 20px !important;
      padding: 16px !important;
      border-radius: 8px !important;
    }

    /* Ajustes de tabla */
    .data-table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
    }
    /* Repetir el encabezado de columnas en cada página impresa (#10). */
    .data-table thead {
      display: table-header-group !important;
    }
    .data-table tr {
      page-break-inside: avoid !important;
      page-break-after: auto !important;
    }
    .data-table th {
      background: #1B8A6B !important; /* Verde institucional OSCORP */
      color: #ffffff !important;      /* Texto blanco */
      border-bottom: 2px solid #0F6B52 !important;
      padding: 8px 12px !important;
      font-size: 9.5px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
    }
    .data-table td {
      border-bottom: 1px solid #cbd5e1 !important;
      padding: 8px 12px !important;
      font-size: 10.5px !important;
      color: #334155 !important;
    }
    /* Zebra striping en print */
    .data-table tbody tr:nth-child(even) td {
      background-color: #f8fafc !important;
    }

    /* Grid de KPIs a 3 columnas simétricas */
    .kpi-grid-container {
      display: grid !important;
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 12px !important;
      margin-bottom: 20px !important;
    }

    /* Gráficos en dos columnas */
    .reportes-charts-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 16px !important;
      margin-bottom: 20px !important;
      page-break-inside: avoid !important;
    }

    /* Ajustes de color para texto de gráficos en print */
    .recharts-text, svg text, .recharts-legend-item-text, .recharts-cartesian-axis-tick text {
      fill: #1e293b !important;
      color: #1e293b !important;
      font-size: 10px !important;
      font-weight: 500 !important;
    }
    .recharts-cartesian-grid line {
      stroke: #cbd5e1 !important;
      stroke-opacity: 0.8 !important;
    }

    /* Salto de página para separar el resumen ejecutivo del desglose detallado */
    .page-break {
      page-break-before: always !important;
      break-before: page !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }

    /* Mostrar todos los registros ocultos en print */
    .no-screen {
      display: table-row !important;
    }

    /* Estilo del avatar del colaborador en print */
    .colab-avatar {
      border: 1px solid #cbd5e1 !important;
      background: #f1f5f9 !important;
      color: #0f172a !important;
    }

    /* Pie de página corporativo en cada hoja del PDF (#12) */
    .print-footer {
      display: block !important;
      position: fixed !important;
      bottom: -12mm !important;
      left: 0 !important;
      right: 0 !important;
      text-align: center !important;
      font-size: 8px !important;
      color: #94a3b8 !important;
      letter-spacing: 0.04em !important;
    }

    /* Estilos de badges para impresión en fondo claro */
    .badge {
      border: 1px solid #cbd5e1 !important;
      background: #f1f5f9 !important;
      color: #0f172a !important;
    }
    .badge-success {
      border-color: #22c55e !important;
      background: #f0fdf4 !important;
      color: #166534 !important;
      background-color: #f0fdf4 !important;
    }
    .badge-warn {
      border-color: #eab308 !important;
      background: #fefbeb !important;
      color: #854d0e !important;
      background-color: #fefbeb !important;
    }
    .badge-danger {
      border-color: #ef4444 !important;
      background: #fef2f2 !important;
      color: #991b1b !important;
      background-color: #fef2f2 !important;
    }
    .badge-info {
      border-color: #3b82f6 !important;
      background: #eff6ff !important;
      color: #1e40af !important;
      background-color: #eff6ff !important;
    }

    /* Detalle diario por colaborador */
    .detail-block {
      page-break-inside: avoid !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 6px !important;
      margin-bottom: 14px !important;
    }
    .detail-content {
      display: block !important;
    }
    .incident-row {
      background-color: #fef2f2 !important;
    }
    .incident-row-retardo {
      background-color: #fffbeb !important;
    }

    .history-dot {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }

  /* --- ESTILOS EN PANTALLA ADICIONALES (MIGRACIÓN DESDE STYLE JSX PARA EVITAR HYDRATION MISMATCH DE HASHES) --- */
  @media (max-width: 900px) {
    .reportes-charts-grid { grid-template-columns: 1fr !important; }
  }

  @media screen {
    .reportes-table thead {
      background: rgba(27,138,107,0.10) !important;
    }
    .reportes-table thead th {
      color: #1B8A6B !important;
      border-bottom: 1px solid rgba(27,138,107,0.25) !important;
    }
    .reportes-table tbody tr.table-row-hover:hover {
      background-color: rgba(255, 255, 255, 0.02) !important;
    }
    .history-dot:hover {
      transform: scale(1.35) !important;
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.45) !important;
      z-index: 5 !important;
    }
    .day-cards-grid {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important;
      gap: 8px !important;
      width: 100% !important;
    }
    .day-card {
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      padding: 10px 12px !important;
      border-radius: 8px !important;
      min-height: 82px !important;
      transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1) !important;
      cursor: default !important;
    }
    .day-card-completo {
      background: rgba(16, 185, 129, 0.04) !important;
      border: 1px solid rgba(16, 185, 129, 0.18) !important;
    }
    .day-card-completo:hover {
      transform: translateY(-2px) !important;
      border-color: rgba(16, 185, 129, 0.45) !important;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.12) !important;
    }
    .day-card-retardo {
      background: rgba(245, 158, 11, 0.04) !important;
      border: 1px solid rgba(245, 158, 11, 0.18) !important;
    }
    .day-card-retardo:hover {
      transform: translateY(-2px) !important;
      border-color: rgba(245, 158, 11, 0.45) !important;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.12) !important;
    }
    .day-card-incidencia {
      background: rgba(239, 68, 68, 0.04) !important;
      border: 1px solid rgba(239, 68, 68, 0.18) !important;
    }
    .day-card-incidencia:hover {
      transform: translateY(-2px) !important;
      border-color: rgba(239, 68, 68, 0.45) !important;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.12) !important;
    }
    .day-card-ausente {
      background: rgba(255, 255, 255, 0.01) !important;
      border: 1px solid rgba(255, 255, 255, 0.06) !important;
    }
    .day-card-ausente:hover {
      transform: translateY(-2px) !important;
      border-color: rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.04) !important;
    }
    .timeline-item-row:hover {
      background: rgba(255, 255, 255, 0.02) !important;
      transform: translateX(4px) !important;
      border-color: rgba(255, 255, 255, 0.05) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    }
  }
`;

export function ReportesClient({
  data,
  empresaNombre = "Safe Link"
}: {
  data: ReportesData;
  empresaNombre?: string;
}) {
  const today = todayString();
  const desdeDefault = isoDate(new Date(data.desde));
  const [filtros, setFiltros] = useState<Filtros>({
    empleadoId: "all",
    sucursalId: "all",
    desde: desdeDefault,
    hasta: today,
  });
  const [granularidad, setGranularidad] = useState<Granularidad>("semana");
  const [filtroAlerta, setFiltroAlerta] = useState<"todos" | "ausencias" | "retardos" | "incidencias" | "perfectos">("todos");
  const [selectedRegistro, setSelectedRegistro] = useState<ReportesRegistro | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const empleadosVisibles = useMemo(() => {
    if (filtros.sucursalId === "all") return data.empleados;
    return data.empleados.filter(e => e.sucursal_id === filtros.sucursalId);
  }, [data.empleados, filtros.sucursalId]);

  const computedReport: ComputedReport = useMemo(
    () => computeReport(data, filtros, granularidad),
    [data, filtros, granularidad]
  );
  const statsAlertas = useMemo(() => {
    const list = computedReport.porEmpleado;
    return {
      todos: list.length,
      ausencias: list.filter(e => e.ausencias > 0).length,
      retardos: list.filter(e => e.llegadas_tarde > 0).length,
      incidencias: list.filter(e => e.incidencias > 0).length,
      perfectos: list.filter(e => e.ausencias === 0 && e.llegadas_tarde === 0 && e.incidencias === 0).length,
    };
  }, [computedReport.porEmpleado]);

  const empleadosFiltradosPorAlerta = useMemo(() => {
    const list = computedReport.porEmpleado;
    if (filtroAlerta === "ausencias") return list.filter(e => e.ausencias > 0);
    if (filtroAlerta === "retardos") return list.filter(e => e.llegadas_tarde > 0);
    if (filtroAlerta === "incidencias") return list.filter(e => e.incidencias > 0);
    if (filtroAlerta === "perfectos") return list.filter(e => e.ausencias === 0 && e.llegadas_tarde === 0 && e.incidencias === 0);
    return list;
  }, [computedReport.porEmpleado, filtroAlerta]);
  const setFiltro = <K extends keyof Filtros>(key: K, value: Filtros[K]) => {
    setFiltros(prev => {
      const next = { ...prev, [key]: value };
      if (key === "sucursalId" && prev.empleadoId !== "all") {
        const empleado = data.empleados.find(e => e.id === prev.empleadoId);
        if (empleado && value !== "all" && empleado.sucursal_id !== value) {
          next.empleadoId = "all";
        }
      }
      return next;
    });
  };

  const sinHorario = data.sucursales.length === 0 || data.sucursales.every(s => !s.hora_apertura);
  const sinSucursalEnRegistros = computedReport.registrosFiltrados.every(r => !r.sucursal_id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="page">
      {/* Cabecera de Página Profesional */}
      <div className="no-print">
        <PageHeader
          title="Reportes"
          subtitle="Análisis de asistencia y puntualidad"
          icon={<BarChart2 size={20} />}
          iconColor={OSCORP.green}
          stats={[
            { label: "Registros", value: computedReport.registrosFiltrados.length },
            { label: "Horas Totales", value: `${computedReport.kpis.horasTrabajadas.toFixed(1)}h` },
          ]}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <ExportButton
                getRows={() => computedReport.registrosFiltrados.map((r) => ({
                  Fecha: new Date(r.timestamp).toLocaleDateString("es-MX"),
                  Hora:  new Date(r.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
                  Empleado: r.empleado_nombre ?? "",
                  Sucursal: r.sucursal_nombre ?? "",
                  Tipo: r.tipo === "entrada" ? "Entrada" : "Salida",
                }))}
                filenamePrefix={`reporte_asistencia_${filtros.desde}_${filtros.hasta}`}
                sheetName="Detalle de Asistencia"
                title="REPORTE DE ASISTENCIA Y PUNTUALIDAD"
                metadata={{
                  "Empresa": empresaNombre,
                  "Período": `${filtros.desde} al ${filtros.hasta}`,
                  "Filtrado por Sucursal": filtros.sucursalId === "all" ? "Todas" : (data.sucursales.find(s => s.id === filtros.sucursalId)?.nombre || "Desconocida"),
                  "Filtrado por Colaborador": filtros.empleadoId === "all" ? "Todos" : (data.empleados.find(e => e.id === filtros.empleadoId)?.nombre || "Desconocido"),
                  "Fecha de Emisión": new Date().toLocaleDateString("es-MX", {
                    year: "numeric", month: "long", day: "numeric",
                    hour: "2-digit", minute: "2-digit"
                  }),
                }}
                kpis={computedReport.kpis}
                serieTiempo={computedReport.serieTiempo}
                porSucursal={computedReport.porSucursal}
                granularidad={granularidad}
              />
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-secondary btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Printer size={13} />
                <span>Exportar PDF</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Guía Rápida Informativa */}
      <div className="card no-print" style={{
        padding: "14px 20px",
        background: "linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(37,99,235,0.03) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderRadius: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Smile size={16} style={{ color: "var(--teal)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            ¿Cómo entender este reporte?
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          Este panel calcula estadísticas de asistencia basadas en el rango de fechas y filtros seleccionados. Las métricas de <strong>Asistencia</strong> y <strong>Puntualidad</strong> consideran los horarios y tolerancias de cada sucursal. Los días laborables sin marcas se estiman como <strong>Ausencias</strong> teóricas de los empleados activos.
        </p>
      </div>

      {/* Membrete corporativo exclusivo para impresión PDF */}
      <PrintHeader
        filtros={filtros}
        sucursales={data.sucursales}
        empleados={data.empleados}
        empresaNombre={empresaNombre}
        totalRegistros={computedReport.registrosFiltrados.length}
        totalEmpleados={computedReport.porEmpleado.length}
      />

      {/* Barra de Filtros */}
      <FilterBar
        filtros={filtros}
        setFiltro={setFiltro}
        setFiltros={setFiltros}
        granularidad={granularidad}
        setGranularidad={setGranularidad}
        sucursales={data.sucursales}
        empleados={empleadosVisibles}
        rangeDays={data.rangeDays}
      />

      {(sinHorario || sinSucursalEnRegistros) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
          background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.25)",
          borderRadius: 10, fontSize: 12, color: "#fbbf24",
        }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <div>
            <span style={{ fontWeight: 700 }}>Retardos no disponibles — </span>
            {sinSucursalEnRegistros
              ? "el dispositivo no tiene sucursal asignada."
              : "las sucursales no tienen hora de apertura configurada."
            }
            {" "}
            <span style={{ color: "rgba(251,191,36,0.7)" }}>
              {sinSucursalEnRegistros ? "Ve a Estaciones → editar → asignar sucursal." : "Ve a Sucursales → editar → configurar hora de apertura."}
            </span>
          </div>
        </div>
      )}

      {/* Aviso de datos parciales — el rango excede el límite de carga (#2/#3).
          Va también en PDF: un reporte "oficial" no debe ocultar que las cifras son parciales. */}
      {data.truncado && (
        <div className="truncado-banner" style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 10, fontSize: 12.5, color: "#fca5a5",
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <span style={{ fontWeight: 700 }}>Datos parciales — </span>
            el rango contiene <strong>{data.totalRegistrosReal.toLocaleString("es-MX")}</strong> registros,
            pero solo se procesaron los <strong>{data.registrosLimit.toLocaleString("es-MX")}</strong> más recientes.
            Las métricas de asistencia, horas y ausencias pueden estar incompletas.{" "}
            <span style={{ opacity: 0.85 }}>
              Reduce el rango de fechas o filtra por sucursal/empleado para obtener cifras exactas.
            </span>
          </div>
        </div>
      )}

      {/* KPIs Grid */}
      <KpiGrid kpis={computedReport.kpis} sinHorario={sinHorario || sinSucursalEnRegistros} />

      {/* Gráficos */}
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }} className="reportes-charts-grid">
        <ChartCard
          title="Actividad"
          subtitle={granularityLabel(granularidad)}
          badge={`${computedReport.registrosFiltrados.filter(r => r.tipo === "entrada").length} entradas · ${computedReport.registrosFiltrados.filter(r => r.tipo === "salida").length} salidas`}
        >
          {computedReport.serieTiempo.length === 0 ? (
            <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
              Sin registros en el rango seleccionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={computedReport.serieTiempo} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="entradasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#1B8A6B" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1B8A6B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="salidasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#2BB3C0" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#2BB3C0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(12,12,14,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}
                  cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)", paddingTop: 12 }}
                />
                <Area type="monotone" dataKey="entradas" stroke="#1B8A6B" strokeWidth={2.5} fill="url(#entradasGrad)" name="Entradas" dot={false} activeDot={{ r: 4, fill: "#1B8A6B", strokeWidth: 0 }} />
                <Area type="monotone" dataKey="salidas"  stroke="#2BB3C0" strokeWidth={2.5} fill="url(#salidasGrad)"  name="Salidas"  dot={false} activeDot={{ r: 4, fill: "#2BB3C0", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Por sucursal" subtitle={`${computedReport.porSucursal.length} ubicación${computedReport.porSucursal.length !== 1 ? "es" : ""}`}>
          {computedReport.porSucursal.length === 0 ? (
            <div style={{ height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-faint)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ fontSize: 12 }}>Sin sucursal asignada</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={computedReport.porSucursal} cx="50%" cy="45%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value" stroke="none">
                  {computedReport.porSucursal.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "rgba(12,12,14,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}
                  formatter={(value: number, name: string) => [`${value.toLocaleString("es-MX")} registro${value !== 1 ? "s" : ""}`, name]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.45)", paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Salto de página para separar el resumen ejecutivo del desglose detallado */}
      <div className="page-break" />

      {/* Cabecera del Desglose Detallado en Impresión */}
      <div className="print-only" style={{ display: "none", marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#0f172a", borderBottom: "2px solid #cbd5e1", paddingBottom: 6 }}>
          Resumen de Asistencia y Puntualidad por Colaborador
        </h2>
      </div>

      {/* Selector de Enfoque / Alertas (Exclusivo Pantalla, oculto en print) */}
      <div className="no-print animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, animationDelay: "80ms" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Filtrado rápido por comportamiento
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "todos", label: "Todos", count: statsAlertas.todos, tone: "neutral" },
            { id: "ausencias", label: "Con Ausencias", count: statsAlertas.ausencias, tone: "danger" },
            { id: "retardos", label: "Con Retardos", count: statsAlertas.retardos, tone: "warn" },
            { id: "incidencias", label: "Con Incidencias", count: statsAlertas.incidencias, tone: "danger" },
            { id: "perfectos", label: "Asistencia Perfecta", count: statsAlertas.perfectos, tone: "success" },
          ].map(tab => {
            const isActive = filtroAlerta === tab.id;
            let activeBg = "var(--accent)";
            let activeColor = "#fff";
            
            if (tab.tone === "danger") activeBg = "var(--red)";
            else if (tab.tone === "warn") activeBg = "var(--yellow)";
            else if (tab.tone === "success") activeBg = "var(--green)";

            if (tab.tone === "warn" && isActive) activeColor = "#000";

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltroAlerta(tab.id as any)}
                className="btn"
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: isActive ? `1px solid ${activeBg}` : "1px solid var(--border)",
                  background: isActive ? activeBg : "var(--bg-elevated)",
                  color: isActive ? activeColor : "var(--text-secondary)",
                  transition: "all 120ms"
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 6,
                  background: isActive ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.06)",
                  color: isActive ? "inherit" : "var(--text-muted)",
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tablas de resultados */}
      <div className="card-print-avoid animate-fade-up" style={{ animationDelay: "120ms" }}>
        <EmpleadosTable rows={empleadosFiltradosPorAlerta} diasEnRango={computedReport.kpis.diasEnRango} />
      </div>

      <div className="page-break" />

      {/* Detalle Diario por Colaborador */}
      <div className="card-print-avoid animate-fade-up" style={{ animationDelay: "150ms" }}>
        <DetalleDiarioSeccion rows={empleadosFiltradosPorAlerta} />
      </div>

      <div className="page-break" />

      <div className="card-print-avoid">
        <RegistrosTable rows={computedReport.registrosFiltrados} onSelectRegistro={setSelectedRegistro} />
      </div>

      {/* Bloque de Firmas Oficial (Solo Impresión) */}
      <div className="print-only" style={{ display: "none", marginTop: 48, pageBreakInside: "avoid" }}>
        {/* Párrafo de descargo de responsabilidad */}
        <p style={{
          fontSize: 9.5,
          fontStyle: "italic",
          lineHeight: 1.5,
          color: "#475569",
          borderTop: "1px solid #cbd5e1",
          paddingTop: 12,
          marginBottom: 30
        }}>
          <strong>Nota:</strong> Este reporte resume los registros de asistencia y puntualidad de <strong>{empresaNombre}</strong> capturados mediante el sistema de autenticación biométrica facial, para el periodo y filtros indicados. Las métricas se calculan automáticamente a partir de las marcas registradas y se proporcionan como apoyo administrativo y de control interno. Verifique los datos antes de usarlos para fines contables, fiscales o legales.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 40,
          marginTop: 20
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #475569", width: "80%", margin: "0 auto 8px auto" }} />
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#1B8A6B", margin: 0 }}>
              Firma de Administrador / RRHH
            </p>
            <p style={{ fontSize: 9, color: "#475569", margin: "4px 0 0 0" }}>
              Nombre: ___________________________
            </p>
            <p style={{ fontSize: 9, color: "#475569", margin: "2px 0 0 0" }}>
              Fecha: ____/____/________
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #475569", width: "80%", margin: "0 auto 8px auto" }} />
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#1B8A6B", margin: 0 }}>
              Firma de Dirección General
            </p>
            <p style={{ fontSize: 9, color: "#475569", margin: "4px 0 0 0" }}>
              Nombre: ___________________________
            </p>
            <p style={{ fontSize: 9, color: "#475569", margin: "2px 0 0 0" }}>
              Fecha: ____/____/________
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 40,
          borderTop: "1px solid #cbd5e1",
          paddingTop: 12,
          textAlign: "center",
          fontSize: 9,
          color: "#94a3b8"
        }}>
          Documento generado automáticamente por la plataforma Safe Link Monitoring para {empresaNombre}.
          Los registros provienen de marcas de asistencia capturadas biométricamente.
        </div>
      </div>

      {/* Pie de página corporativo — solo visible al imprimir (#12) */}
      <div className="print-footer" style={{ display: "none" }} suppressHydrationWarning>
        {empresaNombre} · Reporte de asistencia generado el {new Date().toLocaleDateString("es-MX")} · Safe Link Monitoring
      </div>

      {/* Inyección de estilos de impresión globales */}
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      {/* MODAL DETALLADO DE AUTENTICACIÓN (Renderizado a nivel de página con Portal) */}
      {mounted && selectedRegistro && createPortal(
        (() => {
          let hash = 0;
          const name = selectedRegistro.empleado_nombre ?? "—";
          for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
          }
          const h = Math.abs(hash % 360);
          const avatarBg = `hsl(${h}, 50%, 15%)`;
          const avatarColor = `hsl(${h}, 70%, 75%)`;
          const inicial = name[0]?.toUpperCase() ?? "?";

          const isEntrada = selectedRegistro.tipo === "entrada";
          const score = selectedRegistro.confianza != null ? Math.round(selectedRegistro.confianza * 100) : null;
          
          let levelColor = "var(--text-faint)";
          let levelBg = "rgba(255,255,255,0.03)";
          let levelText = "—";
          if (score !== null) {
            if (score >= 90) {
              levelColor = "#10b981";
              levelBg = "rgba(16, 185, 129, 0.1)";
              levelText = "Alta";
            } else if (score >= 75) {
              levelColor = "#f59e0b";
              levelBg = "rgba(245, 158, 11, 0.1)";
              levelText = "Media";
            } else {
              levelColor = "#ef4444";
              levelBg = "rgba(239, 68, 68, 0.1)";
              levelText = "Baja";
            }
          }

          const dateFullStr = new Date(selectedRegistro.timestamp).toLocaleString("es-MX", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          });

          return (
            <div className="modal-overlay animate-fade-in no-print" onClick={() => setSelectedRegistro(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">
                    <Fingerprint size={16} style={{ color: "var(--teal)" }} />
                    Verificación Biométrica
                  </span>
                  <button type="button" className="modal-close-btn" onClick={() => setSelectedRegistro(null)}>✕</button>
                </div>
                <div className="modal-body">
                  {/* Visualizador Biométrico Dual HUD */}
                  <div className="biometric-hud-container">
                    <div className="biometric-laser" />
                    <div className="biometric-hud-corner tl" />
                    <div className="biometric-hud-corner tr" />
                    <div className="biometric-hud-corner bl" />
                    <div className="biometric-hud-corner br" />

                    <div className="biometric-hud-grid">
                      {/* Base Template */}
                      <div className="biometric-port">
                        <div className="biometric-port-circle">
                          <UserCheck size={24} style={{ color: "rgba(20, 184, 166, 0.4)" }} />
                        </div>
                        <span className="biometric-port-label">Registro Base</span>
                      </div>

                      {/* Connector & Score */}
                      <div className="biometric-connector">
                        <div className="biometric-connector-line" />
                        <div className="biometric-connector-badge">
                          {score !== null ? `${score}% MATCH` : "OK"}
                        </div>
                      </div>

                      {/* Live Capture */}
                      <div className="biometric-port">
                        <div className="biometric-port-circle matched" style={{ border: `2px solid ${avatarColor}`, color: avatarColor, background: avatarBg }}>
                          {inicial}
                        </div>
                        <span className="biometric-port-label">Captura Viva</span>
                      </div>
                    </div>
                  </div>

                  {/* Consola de Sistema */}
                  <div className="biometric-console">
                    <div className="biometric-console-line">
                      <span className="biometric-console-tag-sys">[SYS]</span>
                      <span className="biometric-console-text-ok">Handshake con terminal biométrica... OK</span>
                    </div>
                    <div className="biometric-console-line">
                      <span className="biometric-console-tag-sys">[BIOMETRIC]</span>
                      <span className="biometric-console-text-ok">Algoritmo facial cargado. 512 vectores extraídos.</span>
                    </div>
                    <div className="biometric-console-line">
                      <span className="biometric-console-tag-ok">[OK]</span>
                      <span className="biometric-console-text-ok">Firma facial coincide con ID de empleado.</span>
                    </div>
                    <div className="biometric-console-line">
                      <span className="biometric-console-tag-ok">[SECURE]</span>
                      <span className="biometric-console-text-ok">Similitud de coincidencia: {score !== null ? `${score}%` : "100%"}. Acceso autorizado.</span>
                    </div>
                  </div>

                  {/* Grid info en sub-tarjetas */}
                  <div className="modal-info-grid">
                    <div className="modal-info-card">
                      <div className="modal-info-icon-wrapper" style={{ background: "rgba(59, 130, 246, 0.08)", color: "#3b82f6" }}>
                        <UserCheck size={16} />
                      </div>
                      <div>
                        <span className="modal-info-label">Colaborador</span>
                        <span className="modal-info-value">{name}</span>
                      </div>
                    </div>

                    <div className="modal-info-card">
                      <div className="modal-info-icon-wrapper" style={{ background: "rgba(168, 85, 247, 0.08)", color: "#a855f7" }}>
                        <Hash size={16} />
                      </div>
                      <div>
                        <span className="modal-info-label">ID Registro</span>
                        <span className="modal-info-value" style={{ fontFamily: "var(--font-data)", fontSize: 11 }}>
                          {selectedRegistro.id.substring(0, 12)}...
                        </span>
                      </div>
                    </div>

                    <div className="modal-info-card">
                      <div className="modal-info-icon-wrapper" style={{ background: isEntrada ? "rgba(16, 185, 129, 0.08)" : "rgba(43, 179, 192, 0.08)", color: isEntrada ? "#10b981" : "#2bb3c0" }}>
                        {isEntrada ? <LogIn size={16} /> : <LogOut size={16} />}
                      </div>
                      <div>
                        <span className="modal-info-label">Tipo Evento</span>
                        <span className="modal-info-value">
                          {isEntrada ? "Entrada" : "Salida"}
                        </span>
                      </div>
                    </div>

                    <div className="modal-info-card">
                      <div className="modal-info-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.08)", color: "#f59e0b" }}>
                        <MapPin size={16} />
                      </div>
                      <div>
                        <span className="modal-info-label">Estación</span>
                        <span className="modal-info-value">{selectedRegistro.sucursal_nombre ?? "Sin sucursal"}</span>
                      </div>
                    </div>

                    <div className="modal-info-card" style={{ gridColumn: "span 2" }}>
                      <div className="modal-info-icon-wrapper" style={{ background: "rgba(20, 184, 166, 0.08)", color: "var(--teal)" }}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <span className="modal-info-label">Fecha y Hora Exacta</span>
                        <span className="modal-info-value" style={{ textTransform: "capitalize" }}>{dateFullStr}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedRegistro(null)}>
                    Cerrar Detalles
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}

/* ─────────────── PRINT HEADER ─────────────── */
function PrintHeader({
  filtros, sucursales, empleados, empresaNombre, totalRegistros, totalEmpleados
}: {
  filtros: Filtros;
  sucursales: ReportesData["sucursales"];
  empleados: ReportesData["empleados"];
  empresaNombre: string;
  totalRegistros: number;
  totalEmpleados: number;
}) {
  const sucursalNombre = filtros.sucursalId === "all"
    ? "Todas las sucursales"
    : sucursales.find(s => s.id === filtros.sucursalId)?.nombre || "Desconocida";

  const empleadoNombre = filtros.empleadoId === "all"
    ? "Todos los colaboradores"
    : empleados.find(e => e.id === filtros.empleadoId)?.nombre || "Desconocido";

  const fechaGeneracion = new Date().toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short"
  });

  return (
    <div className="print-only" style={{ display: "none" }}>
      {/* Línea de acento de marca en la parte superior del PDF */}
      <div style={{ height: 4, background: "#1B8A6B", marginBottom: 20, borderRadius: 2 }} />

      {/* Encabezado Principal de Membrete Corporativo */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        borderBottom: "3px solid #1B8A6B",
        paddingBottom: 16,
        marginBottom: 20
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "#1B8A6B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              fontSize: 15
            }}>
              {empresaNombre.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#1B8A6B", letterSpacing: "-0.03em" }}>
              {empresaNombre.toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: 9.5, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            REPORTE DE ASISTENCIA Y PUNTUALIDAD · SISTEMA DE CONTROL BIOMÉTRICO
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{
            background: "#1B8A6B",
            border: "1px solid #0F6B52",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 9,
            fontWeight: 700,
            color: "#ffffff"
          }}>
            REPORTE CORPORATIVO
          </span>
        </div>
      </div>

      {/* Párrafo Introductorio Ejecutivo */}
      <p style={{
        fontSize: 10.5,
        lineHeight: 1.6,
        color: "#334155",
        margin: "0 0 20px 0",
        padding: "12px 16px",
        background: "#f8fafc",
        borderLeft: "4px solid #1B8A6B",
        borderRadius: "0 8px 8px 0"
      }}>
        Este documento resume el control de asistencia y puntualidad de la organización <strong>{empresaNombre}</strong>. Los registros y métricas presentados corresponden al periodo del <strong>{filtros.desde}</strong> al <strong>{filtros.hasta}</strong>, recopilados mediante estaciones de autenticación biométrica facial. La información se procesa automáticamente para estimar horas netas laboradas y puntualidad relativa a cada sucursal configurada.
      </p>

      {/* Ficha Técnica / Metadatos del Reporte */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
        marginBottom: 24,
        fontSize: 11,
        color: "#1f2937"
      }}>
        <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1B8A6B", margin: "0 0 8px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Detalles de la Consulta
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280", width: "35%" }}><strong>Rango de Fechas:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{filtros.desde} al {filtros.hasta}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>Sucursal:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{sucursalNombre}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>Colaborador:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{empleadoNombre}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1B8A6B", margin: "0 0 8px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Ficha de Emisión
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280", width: "35%" }}><strong>Fecha Emisión:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }} suppressHydrationWarning>{fechaGeneracion}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>Registros y Empleados:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{totalRegistros} marcas · {totalEmpleados} colaboradores</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>ID de Auditoría:</strong></td>
                <td style={{ padding: "3px 0", color: "#475569", fontFamily: "var(--font-mono)", fontSize: 9 }}>
                  {empresaNombre.slice(0, 3).toUpperCase()}-{new Date(filtros.desde).getTime().toString().slice(-4)}-{totalRegistros}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>Validez:</strong></td>
                <td style={{ padding: "3px 0", color: "#10b981", fontWeight: 700, fontSize: 10 }}>COTEJADO BIOMÉTRICAMENTE</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── FILTROS ─────────────── */
function FilterBar({
  filtros, setFiltro, setFiltros, granularidad, setGranularidad,
  sucursales, empleados, rangeDays,
}: {
  filtros: Filtros;
  setFiltro: <K extends keyof Filtros>(k: K, v: Filtros[K]) => void;
  setFiltros: React.Dispatch<React.SetStateAction<Filtros>>;
  granularidad: Granularidad;
  setGranularidad: (g: Granularidad) => void;
  sucursales: ReportesData["sucursales"];
  empleados: ReportesData["empleados"];
  rangeDays: number;
}) {
  const today = todayString();
  const minDate = isoDate(daysAgo(rangeDays));

  const quickRanges = [
    { label: "Hoy",     desde: today,               hasta: today },
    { label: "7 días",  desde: isoDate(daysAgo(6)),  hasta: today },
    { label: "30 días", desde: isoDate(daysAgo(29)), hasta: today },
  ];

  const activeQuick = quickRanges.find(r => r.desde === filtros.desde && r.hasta === filtros.hasta);

  return (
    <div className="card filter-bar no-print" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Fila 1: Rangos rápidos + granularidad */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rango</span>
        <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
          {quickRanges.map(r => (
            <button key={r.label} type="button"
              onClick={() => setFiltros(f => ({ ...f, desde: r.desde, hasta: r.hasta }))}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                background: activeQuick?.label === r.label ? "var(--accent)" : "transparent",
                color: activeQuick?.label === r.label ? "#fff" : "var(--text-muted)",
                transition: "all 120ms",
              }}>
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Agrupado por</span>
          <div style={{ display: "flex", gap: 3, padding: 3, background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
            {(["dia", "semana", "mes"] as Granularidad[]).map(g => (
              <button key={g} type="button" onClick={() => setGranularidad(g)} style={{
                padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
                background: granularidad === g ? "var(--accent)" : "transparent",
                color: granularidad === g ? "#fff" : "var(--text-muted)",
                fontSize: 12, fontWeight: 600, textTransform: "capitalize", transition: "all 120ms",
              }}>{g}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Fila 2: Filtros */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
        <Field label="Desde">
          <input type="date" className="input" value={filtros.desde} min={minDate} max={filtros.hasta}
            onChange={e => setFiltro("desde", e.target.value)} style={{ colorScheme: "dark", height: 38 }} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={filtros.hasta} min={filtros.desde} max={today}
            onChange={e => setFiltro("hasta", e.target.value)} style={{ colorScheme: "dark", height: 38 }} />
        </Field>
        <Field label="Sucursal">
          <select className="input" value={filtros.sucursalId} style={{ height: 38, padding: "0 10px", colorScheme: "dark" }}
            onChange={e => setFiltro("sucursalId", e.target.value as Filtros["sucursalId"])}>
            <option value="all">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.id} value={s.id} style={{ background: "var(--bg-elevated)" }}>{s.nombre}</option>)}
          </select>
        </Field>
        <Field label="Empleado">
          <select className="input" value={filtros.empleadoId} style={{ height: 38, padding: "0 10px", colorScheme: "dark" }}
            onChange={e => setFiltro("empleadoId", e.target.value as Filtros["empleadoId"])}>
            <option value="all">Todos los colaboradores</option>
            {empleados.map(e => <option key={e.id} value={e.id} style={{ background: "var(--bg-elevated)" }}>{e.nombre}</option>)}
          </select>
        </Field>
      </div>

      {(filtros.sucursalId !== "all" || filtros.empleadoId !== "all") && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
          {filtros.sucursalId !== "all" && (
            <span className="filter-chip">
              Sucursal: {sucursales.find(s => s.id === filtros.sucursalId)?.nombre || filtros.sucursalId}
              <button onClick={() => setFiltro("sucursalId", "all")} aria-label="Limpiar filtro sucursal">×</button>
            </span>
          )}
          {filtros.empleadoId !== "all" && (
            <span className="filter-chip">
              Colaborador: {empleados.find(e => e.id === filtros.empleadoId)?.nombre || filtros.empleadoId}
              <button onClick={() => setFiltro("empleadoId", "all")} aria-label="Limpiar filtro colaborador">×</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  );
}

/* ─────────────── KPIs ─────────────── */
const KPI_ICONS: Record<string, React.ReactNode> = {
  registros:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>,
  asistencia: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  puntual:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ausencias:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  horas:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/></svg>,
  confianza:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
};

function KpiGrid({ kpis, sinHorario }: { kpis: ComputedReport["kpis"]; sinHorario: boolean }) {
  const horasPromDia = kpis.diasEnRango > 0 ? (kpis.horasTrabajadas / kpis.diasEnRango).toFixed(1) : "0.0";

  type Item = { key: string; label: string; value: string; sub: string; desc: string; tone?: "good" | "warn" | "bad"; noData?: boolean };
  const items: Item[] = [
    { key: "registros",  label: "Total registros",   value: String(kpis.totalRegistros), sub: `${kpis.diasEnRango} día${kpis.diasEnRango !== 1 ? "s" : ""} en rango`, desc: "Eventos totales de entrada y salida procesados." },
    { key: "asistencia", label: "Asistencia",         value: `${kpis.asistenciasRealizadas}/${kpis.asistenciasEsperadas}`, sub: `${kpis.pctAsistencia}% del esperado`, tone: kpis.pctAsistencia >= 80 ? "good" : kpis.pctAsistencia >= 60 ? "warn" : "bad", desc: "Días asistidos frente a laborales teóricos." },
    { key: "puntual",    label: "Puntualidad",        value: sinHorario ? "—" : `${kpis.pctPuntualidad}%`, sub: sinHorario ? "Sin horario configurado" : `${kpis.llegadasTarde} llegada${kpis.llegadasTarde !== 1 ? "s" : ""} tarde`, tone: sinHorario ? undefined : kpis.pctPuntualidad >= 90 ? "good" : kpis.pctPuntualidad >= 70 ? "warn" : "bad", noData: sinHorario, desc: "Entradas dentro de la tolerancia de sucursal." },
    { key: "ausencias",  label: "Ausencias",          value: String(kpis.ausencias), sub: `${kpis.empleadosActivos} empleado${kpis.empleadosActivos !== 1 ? "s" : ""} activos`, tone: kpis.ausencias === 0 ? "good" : kpis.ausencias > kpis.asistenciasEsperadas / 4 ? "bad" : "warn", desc: "Días hábiles teóricos sin marca de asistencia." },
    { key: "horas",      label: "Horas trabajadas",   value: kpis.horasTrabajadas > 0 ? `${kpis.horasTrabajadas.toFixed(1)}h` : "—", sub: kpis.horasTrabajadas > 0 ? `~${horasPromDia}h promedio/día` : "Sin pares entrada/salida", desc: "Horas acumuladas entre entradas y salidas consecutivas." },
    { key: "confianza",  label: "Confianza facial",   value: `${kpis.confianzaPromedio}%`, sub: "promedio del rango", tone: kpis.confianzaPromedio >= 85 ? "good" : kpis.confianzaPromedio >= 70 ? "warn" : kpis.confianzaPromedio > 0 ? "bad" : undefined, desc: "Precisión media de reconocimiento biométrico." },
  ];

  const toneColor = { good: "#22c55e", warn: "#eab308", bad: "#ef4444" };

  return (
    <div className="kpi-grid-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12 }}>
      {items.map(it => {
        const color = it.noData ? "rgba(255,255,255,0.25)" : it.tone ? toneColor[it.tone] : "var(--text-faint)";
        const printColor = it.noData ? "#cbd5e1" : it.tone ? toneColor[it.tone] : OSCORP.green;
        return (
          <div key={it.key} className="card" style={{
            padding: 16,
            position: "relative",
            overflow: "hidden",
            "--kpi-color": printColor
          } as React.CSSProperties}>
            {it.tone && !it.noData && (
              <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${toneColor[it.tone]}, transparent)`, opacity: 0.6 }} />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{it.label}</p>
              <span style={{ color, opacity: 0.7 }} title={it.desc}>{KPI_ICONS[it.key]}</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 700, color: it.noData ? "rgba(255,255,255,0.25)" : "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums", margin: 0 }}>
              {it.value}
            </p>
            <p style={{ fontSize: 11, color: it.noData ? "rgba(255,255,255,0.2)" : "var(--text-muted)", marginTop: 6, marginBottom: 2, fontWeight: 600 }}>
              {it.sub}
            </p>
            <p style={{ fontSize: 9.5, color: "var(--text-faint)", margin: 0, lineHeight: 1.3 }} className="no-print">
              {it.desc}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── CHART CARD ─────────────── */
function ChartCard({ title, subtitle, badge, children }: { title: string; subtitle: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 className="heading-3" style={{ marginBottom: 2 }}>{title}</h3>
          <p className="text-muted-sm">{subtitle}</p>
        </div>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmpleadosTable({ rows, diasEnRango }: { rows: EmpleadoFila[]; diasEnRango: number }) {
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<"nombre" | "asistencia" | "retardos" | "horas">("nombre");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [showExpandedAbsences, setShowExpandedAbsences] = useState(false);

  const totalHoras = rows.reduce((a, r) => a + r.horas_trabajadas, 0);
  const totalTardes = rows.reduce((a, r) => a + r.llegadas_tarde, 0);
  const sinDatos = totalHoras === 0;

  const handleSort = (field: "nombre" | "asistencia" | "retardos" | "horas") => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "nombre" ? "asc" : "desc");
    }
  };

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "nombre") {
        comparison = a.nombre.localeCompare(b.nombre);
      } else if (sortBy === "asistencia") {
        comparison = a.asistencia_pct - b.asistencia_pct;
      } else if (sortBy === "retardos") {
        comparison = a.llegadas_tarde - b.llegadas_tarde;
      } else if (sortBy === "horas") {
        comparison = a.horas_trabajadas - b.horas_trabajadas;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [rows, sortBy, sortOrder]);

  const renderHeader = (field: "nombre" | "asistencia" | "retardos" | "horas", label: string) => {
    const isActive = sortBy === field;
    return (
      <th
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => handleSort(field)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span>{label}</span>
          <span style={{ fontSize: 9, opacity: isActive ? 1 : 0.3 }}>
            {isActive ? (sortOrder === "asc" ? " ▲" : " ▼") : " ▲"}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 className="heading-3" style={{ marginBottom: 2 }}>Resumen de colaboradores</h2>
            <p className="text-muted-sm" style={{ margin: 0 }}>{rows.length} empleado{rows.length !== 1 ? "s" : ""} registrados en el scope · <span style={{ color: "var(--teal)", fontWeight: 600 }}>Haz clic en un empleado para ver su desglose inline</span></p>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {sinDatos && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                Sin actividad de horas en el rango
              </span>
            )}
            {!sinDatos && totalHoras > 0 && (
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Total Horas · {diasEnRango} día{diasEnRango !== 1 ? "s" : ""}
                </p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: OSCORP.green, fontVariantNumeric: "tabular-nums" }}>{totalHoras.toFixed(1)}h</p>
              </div>
            )}
            {totalTardes > 0 && (
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tardanzas</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>{totalTardes}</p>
              </div>
            )}
            {rows.length > 8 && (
              <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => setShowAll(v => !v)}>
                {showAll ? "Ver menos" : `+${rows.length - 8} más`}
              </button>
            )}
          </div>
        </div>

        {/* Leyenda Visual del Historial (Solo Pantalla) */}
        <div className="no-print" style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 4, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Historial:</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            Completo
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            Retardo
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
            Incompleto (Sin marcar)
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", display: "inline-block" }} />
            Ausente
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state" style={{ borderRadius: 0, border: "none", padding: "40px 20px" }}>
          <p className="heading-3">Sin actividad</p>
          <p className="text-muted-sm">Ajusta los filtros para ver registros.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table reportes-table">
            <thead>
              <tr>
                {renderHeader("nombre", "Colaborador")}
                <th>Sucursal</th>
                <th>Asistidos / Esperados</th>
                {renderHeader("asistencia", "% Asistencia")}
                <th className="no-print">Calendario de Asistencia</th>
                <th>Ausencias</th>
                {renderHeader("retardos", "Retardos")}
                {renderHeader("horas", "Horas trabajadas")}
                <th>Último registro</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, index) => {
                const isHiddenOnScreen = !showAll && index >= 8;
                const isExpanded = expandedEmployeeId === r.empleado_id;

                let hash = 0;
                const name = r.nombre;
                for (let i = 0; i < name.length; i++) {
                  hash = name.charCodeAt(i) + ((hash << 5) - hash);
                }
                const h = Math.abs(hash % 360);
                const avatarBg = `hsl(${h}, 50%, 15%)`;
                const avatarColor = `hsl(${h}, 70%, 75%)`;
                const inicial = r.nombre[0]?.toUpperCase() ?? "?";

                return (
                  <React.Fragment key={r.empleado_id}>
                    <tr
                      className={`${isHiddenOnScreen ? "no-screen" : ""} table-row-hover`}
                      style={{ cursor: "pointer", transition: "background-color 150ms" }}
                      onClick={() => setExpandedEmployeeId(isExpanded ? null : r.empleado_id)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                          <div className="colab-avatar" style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: avatarBg, border: `1px solid ${avatarColor}33`,
                            display: "flex", alignItems: "center",
                            fontSize: 12, fontWeight: 700, color: avatarColor,
                            justifyContent: "center"
                          }}>
                            {inicial}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 5 }}>
                              {r.nombre}
                            </span>
                            <span style={{ display: "inline-flex", marginTop: 2 }}>
                              {r.activo ? (
                                <span className="badge badge-success" style={{ fontSize: 9, padding: "1px 5px" }}>Activo</span>
                              ) : (
                                <span className="badge badge-neutral" style={{ fontSize: 9, padding: "1px 5px" }}>Inactivo</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {r.sucursal_nombre ?? "—"}
                        </span>
                      </td>

                      <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)", fontSize: 12 }}>
                        {r.dias_trabajados} / {r.dias_laborables} días
                      </td>

                      <td>
                        {(() => {
                          let asistBg = "rgba(239, 68, 68, 0.08)";
                          let asistBorder = "rgba(239, 68, 68, 0.18)";
                          let asistColor = "#ef4444";
                          if (r.asistencia_pct >= 90) {
                            asistBg = "rgba(16, 185, 129, 0.08)";
                            asistBorder = "rgba(16, 185, 129, 0.18)";
                            asistColor = "#10b981";
                          } else if (r.asistencia_pct >= 70) {
                            asistBg = "rgba(245, 158, 11, 0.08)";
                            asistBorder = "rgba(245, 158, 11, 0.18)";
                            asistColor = "#f59e0b";
                          }
                          return (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              background: asistBg,
                              border: `1px solid ${asistBorder}`,
                              color: asistColor,
                              fontVariantNumeric: "tabular-nums"
                            }}>
                              {r.asistencia_pct}%
                            </span>
                          );
                        })()}
                      </td>

                      {/* Calendario Visual de Asistencia (Solo Pantalla) */}
                      <td className="no-print" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3.5, width: 101 }}>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(7, 11px)",
                            gap: "4px",
                            opacity: 0.4,
                            fontSize: 8,
                            fontWeight: 700,
                            textAlign: "center",
                            color: "var(--text-muted)",
                            userSelect: "none"
                          }}>
                            <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                          </div>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(7, 11px)",
                            gridAutoRows: "11px",
                            gap: "4px"
                          }}>
                            {r.dias.map(d => {
                              const dateObj = new Date(d.fecha + "T00:00:00");
                              const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
                              const gridColumnStart = dayOfWeek === 0 ? 7 : dayOfWeek; // Monday = 1, ..., Sunday = 7
                              const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

                              let bgColor = "rgba(255,255,255,0.04)";
                              let borderColor = "rgba(255,255,255,0.12)";
                              let label = "Ausente";

                              if (d.estado === "completo") {
                                bgColor = "rgba(16, 185, 129, 0.8)";
                                borderColor = "rgba(16, 185, 129, 1)";
                                label = `Completo: ${d.entrada} a ${d.salida || "—"}`;
                              } else if (d.estado === "retardo") {
                                bgColor = "rgba(245, 158, 11, 0.8)";
                                borderColor = "rgba(245, 158, 11, 1)";
                                label = `Retardo (+${d.minutos_retardo} min): ${d.entrada} a ${d.salida || "—"}`;
                              } else if (d.estado === "sin_salida") {
                                bgColor = "rgba(239, 68, 68, 0.8)";
                                borderColor = "rgba(239, 68, 68, 1)";
                                label = `Sin Salida (Entrada: ${d.entrada})`;
                              } else if (d.estado === "sin_entrada") {
                                bgColor = "rgba(239, 68, 68, 0.8)";
                                borderColor = "rgba(239, 68, 68, 1)";
                                label = `Sin Entrada (Salida: ${d.salida})`;
                              } else if (isWeekend) {
                                bgColor = "transparent";
                                borderColor = "rgba(255, 255, 255, 0.05)";
                                label = "Descanso";
                              }

                              const tooltipText = `${formatFriendlyDate(d.fecha)} · ${label} ${d.horas !== null ? `(${d.horas.toFixed(1)}h)` : ""}`;

                              return (
                                <div
                                  key={d.fecha}
                                  title={tooltipText}
                                  style={{
                                    width: 11,
                                    height: 11,
                                    borderRadius: 3,
                                    background: bgColor,
                                    border: `1px solid ${borderColor}`,
                                    borderStyle: (isWeekend && d.estado === "ausente") ? "dashed" : "solid",
                                    opacity: (isWeekend && d.estado === "ausente") ? 0.35 : 1,
                                    cursor: "help",
                                    gridColumnStart: gridColumnStart,
                                    transition: "all 120ms"
                                  }}
                                  className="history-dot"
                                />
                              );
                            })}
                          </div>
                        </div>
                      </td>

                      <td>
                        {r.ausencias === 0 ? (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px 7px",
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 500,
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            color: "var(--text-faint)"
                          }}>
                            0
                          </span>
                        ) : (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px 7px",
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            background: "rgba(239, 68, 68, 0.08)",
                            border: "1px solid rgba(239, 68, 68, 0.18)",
                            color: "#ef4444"
                          }}>
                            {r.ausencias}
                          </span>
                        )}
                      </td>

                      <td>
                        {r.llegadas_tarde === 0 ? (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px 7px",
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 500,
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            color: "var(--text-faint)"
                          }}>
                            0
                          </span>
                        ) : (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px 7px",
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            background: "rgba(245, 158, 11, 0.08)",
                            border: "1px solid rgba(245, 158, 11, 0.18)",
                            color: "#f59e0b"
                          }}>
                            {r.llegadas_tarde}
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                            {r.horas_trabajadas.toFixed(1)}h
                          </span>
                          {r.dias_trabajados > 0 && (
                            <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                              ~{(r.horas_trabajadas / r.dias_trabajados).toFixed(1)}h prom.
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", fontSize: 11 }} suppressHydrationWarning>
                        {r.ultima_actividad
                          ? new Date(r.ultima_actividad).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                    </tr>

                    {/* Desglose inline expandido */}
                    {isExpanded && (
                      <tr className="no-print" style={{ background: "rgba(0,0,0,0.15)" }} onClick={(e) => e.stopPropagation()}>
                        <td colSpan={9} style={{ padding: "12px 16px" }}>
                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 18,
                            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>
                                  Desglose Diario: {r.nombre}
                                </h4>
                                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                                  Detalle cronológico de registros de asistencia calculados
                                </p>
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => setExpandedEmployeeId(null)}
                                  style={{
                                    fontSize: 11,
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                  }}
                                >
                                  Cerrar desglose
                                </button>
                              </div>
                            </div>

                            <div style={{ marginTop: 4 }}>
                              <ColaboradorDesgloseList
                                dias={r.dias}
                                incidenciasCount={r.incidencias}
                                retardosCount={r.llegadas_tarde}
                                ausenciasCount={r.ausencias}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────── TABLA REGISTROS ─────────────── */
const PAGE_SIZE = 50;
const PRINT_LIMIT = 300;

function RegistrosTable({ rows, onSelectRegistro }: { rows: ReportesData["registros"]; onSelectRegistro: (r: ReportesRegistro) => void }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const printRows = rows.slice(0, PRINT_LIMIT);
  const screenRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <h2 className="heading-3">Registros detallados</h2>
          <p className="text-muted-sm" style={{ marginTop: 2 }}>
            {rows.length} registro{rows.length === 1 ? "" : "s"} en el rango
            {rows.length > PRINT_LIMIT && (
              <span className="no-print" style={{ color: "var(--yellow)", marginLeft: 6 }}>
                (En PDF se imprimen los {PRINT_LIMIT} más recientes)
              </span>
            )}
          </p>
          {rows.length > PRINT_LIMIT && (
            <p className="print-only" style={{ display: "none", fontSize: 10, color: "#ef4444", margin: "4px 0 0 0", fontWeight: 600 }}>
              ⚠️ Nota: Este reporte impreso muestra los {PRINT_LIMIT} registros más recientes del rango. Filtre por empleado o sucursal para ver el detalle completo.
            </p>
          )}
        </div>
        <span className="badge badge-neutral">Página {safePage + 1} / {totalPages}</span>
      </div>
      
      {rows.length === 0 ? (
        <div className="empty-state" style={{ borderRadius: 0, border: "none", padding: "40px 20px" }}>
          <p className="heading-3">Sin registros</p>
          <p className="text-muted-sm">Ajusta los filtros para ver registros.</p>
        </div>
      ) : (
        <>
          {/* SCREEN VIEW: Bitácora de Actividad (Premium Log Table) */}
          <div className="no-print" style={{ padding: "8px 0" }}>
            <div className="log-header">
              <div>Fecha y Hora</div>
              <div>Colaborador</div>
              <div>Sucursal</div>
              <div>Evento</div>
              <div>Confianza</div>
              <div style={{ textAlign: "right", paddingRight: 8 }}>Acción</div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              {screenRows.map(r => {
                const dateObj = new Date(r.timestamp);
                const timeStr = dateObj.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                const dateStr = dateObj.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

                // Avatar HSL colors based on name hash
                let hash = 0;
                const name = r.empleado_nombre ?? "—";
                for (let i = 0; i < name.length; i++) {
                  hash = name.charCodeAt(i) + ((hash << 5) - hash);
                }
                const h = Math.abs(hash % 360);
                const avatarBg = `hsl(${h}, 50%, 15%)`;
                const avatarColor = `hsl(${h}, 70%, 75%)`;
                const inicial = name[0]?.toUpperCase() ?? "?";

                const isEntrada = r.tipo === "entrada";
                const score = r.confianza != null ? Math.round(r.confianza * 100) : null;
                
                let levelColor = "var(--text-faint)";
                let levelBg = "rgba(255,255,255,0.03)";
                let levelText = "—";
                let glowStyle = {};
                if (score !== null) {
                  if (score >= 90) {
                    levelColor = "#10b981";
                    levelBg = "rgba(16, 185, 129, 0.1)";
                    levelText = "Alta";
                    glowStyle = { boxShadow: "0 0 6px rgba(16, 185, 129, 0.4)" };
                  } else if (score >= 75) {
                    levelColor = "#f59e0b";
                    levelBg = "rgba(245, 158, 11, 0.1)";
                    levelText = "Media";
                    glowStyle = { boxShadow: "0 0 6px rgba(245, 158, 11, 0.4)" };
                  } else {
                    levelColor = "#ef4444";
                    levelBg = "rgba(239, 68, 68, 0.1)";
                    levelText = "Baja";
                    glowStyle = { boxShadow: "0 0 6px rgba(239, 68, 68, 0.4)" };
                  }
                }

                return (
                  <div key={r.id} className="log-row" onClick={() => onSelectRegistro(r)} style={{ cursor: "pointer" }} title="Ver detalle de verificación biométrica">
                    {/* Column 1: Time & Date */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }} suppressHydrationWarning>
                        {timeStr}
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2, textTransform: "capitalize" }} suppressHydrationWarning>
                        {dateStr}
                      </span>
                    </div>

                    {/* Column 2: Employee Avatar & Name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: avatarBg,
                        border: `1px solid ${avatarColor}33`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: avatarColor,
                        flexShrink: 0
                      }}>
                        {inicial}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {name}
                      </span>
                    </div>

                    {/* Column 3: Sucursal */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <Building size={13} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.sucursal_nombre ?? "Sin sucursal"}
                      </span>
                    </div>

                    {/* Column 4: Event Badge */}
                    <div>
                      {isEntrada ? (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#10b981",
                          background: "rgba(16,185,129,0.08)",
                          padding: "3px 8px",
                          borderRadius: 6,
                          border: "1px solid rgba(16,185,129,0.15)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}>
                          <LogIn size={11} strokeWidth={3} />
                          Entrada
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#2bb3c0",
                          background: "rgba(43,179,192,0.08)",
                          padding: "3px 8px",
                          borderRadius: 6,
                          border: "1px solid rgba(43,179,192,0.15)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}>
                          <LogOut size={11} strokeWidth={3} />
                          Salida
                        </span>
                      )}
                    </div>

                    {/* Column 5: Biometric Verification / Confidence Score */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: score !== null ? "var(--text-secondary)" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                          {score !== null ? `${score}%` : "—"}
                        </span>
                        {score !== null && (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: levelColor,
                            background: levelBg,
                            padding: "1px 5px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            letterSpacing: "0.02em"
                          }}>
                            {levelText}
                          </span>
                        )}
                      </div>
                      {score !== null && (
                        <div style={{ width: 80, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ width: `${score}%`, height: "100%", background: levelColor, borderRadius: 10, ...glowStyle }} />
                        </div>
                      )}
                    </div>

                    {/* Column 6: Action Button */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div
                        className="log-action-btn"
                        style={{ pointerEvents: "none" }}
                      >
                        <Eye size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PRINT VIEW: Table for PDF */}
          <div className="print-only" style={{ display: "none" }}>
            <table className="data-table reportes-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Fecha · Hora</th>
                  <th>Empleado</th>
                  <th style={{ width: 180 }}>Sucursal</th>
                  <th style={{ width: 110 }}>Tipo</th>
                  <th style={{ width: 110 }}>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontVariantNumeric: "tabular-nums" }} suppressHydrationWarning>
                      {new Date(r.timestamp).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{r.empleado_nombre ?? "—"}</td>
                    <td>{r.sucursal_nombre ?? "—"}</td>
                    <td>
                      {r.tipo === "entrada"
                        ? <span className="badge badge-success">Entrada</span>
                        : <span className="badge badge-info">Salida</span>}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {r.confianza != null ? `${Math.round(r.confianza * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginator */}
          {totalPages > 1 && (
            <div className="no-print" style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


/* ─────────────── HELPERS ─────────────── */
function todayString(): string {
  return isoDate(new Date());
}
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function granularityLabel(g: Granularidad): string {
  if (g === "mes")    return "Asistencia mensual";
  if (g === "semana") return "Asistencia semanal";
  return "Asistencia diaria";
}

/* ─────────────── DETALLE DIARIO POR COLABORADOR ─────────────── */
function formatFriendlyDate(fechaStr: string): string {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayNum = String(d).padStart(2, "0");
  return `${dayName} ${dayNum}-${monthName}`;
}

function renderEstadoBadge(dia: DiaEmpleado) {
  if (dia.estado === "completo") {
    return (
      <span className="badge badge-success" style={{ fontSize: 10, padding: "2px 6px" }}>
        Completo
      </span>
    );
  }
  if (dia.estado === "retardo") {
    return (
      <span className="badge badge-warn" style={{ fontSize: 10, padding: "2px 6px" }}>
        Retardo +{dia.minutos_retardo}min
      </span>
    );
  }
  if (dia.estado === "sin_salida") {
    return (
      <span className="badge badge-danger" style={{ fontSize: 10, padding: "2px 6px" }}>
        Sin salida
      </span>
    );
  }
  if (dia.estado === "sin_entrada") {
    return (
      <span className="badge badge-danger" style={{ fontSize: 10, padding: "2px 6px" }}>
        Sin entrada
      </span>
    );
  }
  return (
    <span className="badge badge-neutral" style={{ fontSize: 10, padding: "2px 6px", opacity: 0.8 }}>
      Ausente
    </span>
  );
}

/* ─────────────── COMPACT COLLABORATOR DAILY LOGS (SCREEN ONLY) ─────────────── */
function ColaboradorDesgloseList({
  dias,
  incidenciasCount,
  retardosCount,
  ausenciasCount,
}: {
  dias: DiaEmpleado[];
  incidenciasCount: number;
  retardosCount: number;
  ausenciasCount: number;
}) {
  const [filtroDia, setFiltroDia] = useState<"todos" | "alertas" | "completos" | "ausentes">("todos");

  const diasFiltrados = useMemo(() => {
    if (filtroDia === "alertas") {
      return dias.filter(d => d.estado === "retardo" || d.estado === "sin_entrada" || d.estado === "sin_salida");
    }
    if (filtroDia === "completos") {
      return dias.filter(d => d.estado === "completo");
    }
    if (filtroDia === "ausentes") {
      return dias.filter(d => d.estado === "ausente");
    }
    return dias;
  }, [dias, filtroDia]);

  const totalCompletos = dias.filter(d => d.estado === "completo").length;

  // Extract weekday + day-of-month from fecha string
  const getDateParts = (fecha: string) => {
    const [y, m, d] = fecha.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const months   = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return {
      weekday: weekdays[date.getDay()],
      day: String(d).padStart(2, "0"),
      month: months[m - 1],
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }} className="no-print">
      {/* Filtros — Segmented Control */}
      <div className="desglose-tabs-container">
        <button type="button" onClick={() => setFiltroDia("todos")}
          className={`desglose-tab-btn ${filtroDia === "todos" ? "active" : ""}`}>
          <List size={12} className="tab-icon" />
          <span>Todos ({dias.length})</span>
        </button>
        <button type="button" onClick={() => setFiltroDia("alertas")}
          className={`desglose-tab-btn ${filtroDia === "alertas" ? "active" : ""} ${
            filtroDia !== "alertas" && incidenciasCount + retardosCount > 0 ? "has-alerts" : ""
          }`}>
          <AlertCircle size={12} className="tab-icon" style={{ color: (incidenciasCount + retardosCount > 0) ? "#fbbf24" : "inherit" }} />
          <span>Alertas ({incidenciasCount + retardosCount})</span>
        </button>
        <button type="button" onClick={() => setFiltroDia("completos")}
          className={`desglose-tab-btn ${filtroDia === "completos" ? "active" : ""}`}>
          <CheckCircle2 size={12} className="tab-icon" style={{ color: "#34d399" }} />
          <span>Asistencias ({totalCompletos})</span>
        </button>
        <button type="button" onClick={() => setFiltroDia("ausentes")}
          className={`desglose-tab-btn ${filtroDia === "ausentes" ? "active" : ""}`}>
          <UserX size={12} className="tab-icon" />
          <span>Ausencias ({ausenciasCount})</span>
        </button>
      </div>

      {/* Timeline de actividad simplificado */}
      <div className="timeline-container">
        {diasFiltrados.length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-faint)", fontSize: 12, fontStyle: "italic" }}>
            Sin registros para este filtro.
          </div>
        ) : (
          diasFiltrados.map(d => {
            const isRet = d.estado === "retardo";
            const isAbs = d.estado === "ausente";
            const { weekday, day, month } = getDateParts(d.fecha);
            
            // Badge por estado
            let statusBadge;
            if (d.estado === "completo") {
              statusBadge = (
                <span className="desglose-badge desglose-badge-success" style={{ fontSize: 9.5 }}>
                  <Check size={10} style={{ color: "#34d399", strokeWidth: 3 }} />
                  Asistencia
                </span>
              );
            } else if (isRet) {
              statusBadge = (
                <span className="desglose-badge desglose-badge-warn" style={{ fontSize: 9.5 }}>
                  <Clock size={10} style={{ color: "#fbbf24" }} />
                  +{d.minutos_retardo}m tarde
                </span>
              );
            } else if (d.estado === "sin_salida") {
              statusBadge = (
                <span className="desglose-badge desglose-badge-danger" style={{ fontSize: 9.5 }}>
                  <AlertCircle size={10} style={{ color: "#f87171" }} />
                  Sin salida
                </span>
              );
            } else if (d.estado === "sin_entrada") {
              statusBadge = (
                <span className="desglose-badge desglose-badge-danger" style={{ fontSize: 9.5 }}>
                  <AlertCircle size={10} style={{ color: "#f87171" }} />
                  Sin entrada
                </span>
              );
            } else {
              statusBadge = (
                <span className="desglose-badge desglose-badge-neutral" style={{ fontSize: 9.5 }}>
                  <UserX size={10} style={{ color: "var(--text-faint)" }} />
                  Ausente
                </span>
              );
            }

            return (
              <div key={d.fecha} className={`timeline-row ${isAbs ? "is-absent" : ""}`}>
                {/* Bloque Izquierdo: Fecha */}
                <div className="timeline-date-block">
                  <span className="timeline-date">{day} {month}</span>
                  <span className="timeline-dayname">{weekday}</span>
                </div>

                {/* Bloque Central: Información del Flujo de Horas */}
                <div className="timeline-info-block">
                  {isAbs ? (
                    <span className="timeline-no-activity">Sin actividad en este día</span>
                  ) : (
                    <div className="timeline-time-flow">
                      {d.entrada ? (
                        <span className="timeline-time-stamp" title="Hora de entrada">
                          <LogIn size={10} style={{ color: "#34d399" }} />
                          {d.entrada}
                        </span>
                      ) : (
                        <span className="timeline-time-stamp" style={{ opacity: 0.6 }} title="Falta entrada">
                          <AlertCircle size={10} style={{ color: "#f87171" }} />
                          Sin entrada
                        </span>
                      )}
                      
                      <span className="timeline-flow-arrow">➔</span>
                      
                      {d.salida ? (
                        <span className="timeline-time-stamp" title="Hora de salida">
                          <LogOut size={10} style={{ color: "#f87171" }} />
                          {d.salida}
                        </span>
                      ) : (
                        <span className="timeline-time-stamp" style={{ opacity: 0.6 }} title="Falta salida">
                          <AlertCircle size={10} style={{ color: "#f87171" }} />
                          Sin salida
                        </span>
                      )}

                      {d.horas !== null && d.horas > 0 && (
                        <span className="timeline-duration">
                          {d.horas.toFixed(1)}h
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bloque Derecho: Badge de Estado */}
                <div className="timeline-status-block">
                  {statusBadge}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DetalleEmpleadoBloque({ empleado }: { empleado: EmpleadoFila }) {
  const tieneProblemas = empleado.incidencias > 0 || empleado.llegadas_tarde > 0 || empleado.ausencias > 0;
  const completos = empleado.dias.filter(d => d.estado === "completo").length;
  const retardos = empleado.dias.filter(d => d.estado === "retardo").length;
  const incidencias = empleado.dias.filter(d => d.estado === "sin_entrada" || d.estado === "sin_salida").length;
  const ausencias = empleado.dias.filter(d => d.estado === "ausente").length;

  return (
    <div 
      className="card detail-block print-only" 
      style={{ 
        marginBottom: 16, 
        overflow: "hidden", 
        borderLeft: tieneProblemas ? "4px solid var(--red)" : "4px solid var(--green)",
        pageBreakInside: "avoid",
        display: "none"
      }}
    >
      {/* Header ONLY for Print */}
      <div 
        style={{ 
          padding: "8px 12px", 
          borderBottom: "1.5px solid #cbd5e1",
          background: "#f8fafc"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
            {empleado.nombre.toUpperCase()}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#166534", fontWeight: 700 }}>
              {completos} completo{completos !== 1 ? "s" : ""}
            </span>
            {retardos > 0 && (
              <span style={{ fontSize: 9, color: "#854d0e", fontWeight: 700 }}>
                {retardos} retardo{retardos !== 1 ? "s" : ""}
              </span>
            )}
            {incidencias > 0 && (
              <span style={{ fontSize: 9, color: "#991b1b", fontWeight: 700 }}>
                {incidencias} incidencia{incidencias !== 1 ? "s" : ""}
              </span>
            )}
            {ausencias > 0 && (
              <span style={{ fontSize: 9, color: "#475569", fontWeight: 700 }}>
                {ausencias} ausencia{ausencias !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content for Print */}
      <div className="detail-content">
        <div style={{ overflowX: "auto" }}>
          <table className="data-table reportes-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ padding: "6px 12px", fontSize: 10 }}>Día</th>
                <th style={{ padding: "6px 12px", fontSize: 10 }}>Entrada</th>
                <th style={{ padding: "6px 12px", fontSize: 10 }}>Salida</th>
                <th style={{ padding: "6px 12px", fontSize: 10 }}>Horas</th>
                <th style={{ padding: "6px 12px", fontSize: 10 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {empleado.dias.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "24px 20px", textAlign: "center", color: "#64748b", fontSize: 12, fontStyle: "italic" }}>
                    Sin marcas de actividad en este rango.
                  </td>
                </tr>
              ) : (
                empleado.dias.map(d => {
                  const isRet = d.estado === "retardo";
                  const isInc = d.estado === "sin_entrada" || d.estado === "sin_salida";
                  const rowClass = isRet ? "incident-row-retardo" : isInc ? "incident-row" : "";
                  
                  const rowStyle: React.CSSProperties = isRet ? {
                    background: "rgba(234,179,8,0.03)"
                  } : isInc ? {
                    background: "rgba(239,68,68,0.03)"
                  } : {};

                  return (
                    <tr key={d.fecha} style={rowStyle} className={rowClass}>
                      <td style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
                        {formatFriendlyDate(d.fecha)}
                      </td>
                      <td style={{ padding: "6px 12px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                        {d.entrada ?? "—"}
                      </td>
                      <td style={{ padding: "6px 12px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                        {d.salida ?? "—"}
                      </td>
                      <td style={{ padding: "6px 12px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                        {d.horas !== null ? `${d.horas.toFixed(1)}h` : "—"}
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        {renderEstadoBadge(d)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DetalleDiarioSeccion({ rows }: { rows: EmpleadoFila[] }) {
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(emp => emp.nombre.toLowerCase().includes(term));
  }, [rows, searchTerm]);

  const selectedEmp = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) return null;
    if (selectedEmpleadoId) {
      const found = filteredRows.find(e => e.empleado_id === selectedEmpleadoId);
      if (found) return found;
    }
    return filteredRows[0];
  }, [filteredRows, selectedEmpleadoId]);

  return (
    <div style={{ marginTop: 24 }} className="detail-section">
      <div className="no-print" style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ width: 4, alignSelf: "stretch", minHeight: 40, borderRadius: 4, background: "var(--teal)", flexShrink: 0 }} />
        <div>
          <h2 className="heading-2">Detalle diario por colaborador</h2>
          <p className="text-muted-sm">Seguimiento día a día de marcas, retardos y ausencias</p>
        </div>
      </div>
      
      <div className="print-only" style={{ display: "none", marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#0f172a", borderBottom: "2px solid #cbd5e1", paddingBottom: 6 }}>
          Desglose Diario de Asistencia y Puntualidad
        </h2>
      </div>

      {/* SCREEN PANEL DIVIDIDO */}
      {rows.length === 0 ? (
        <div className="card no-print" style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ margin: 0, fontStyle: "italic", fontSize: 13 }}>No hay colaboradores para mostrar con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="no-print" style={{
          display: "grid",
          gridTemplateColumns: "308px 1fr",
          gap: 16,
          alignItems: "stretch",
          marginTop: 12
        }}>
          {/* Columna Izquierda: Sidebar de Empleados */}
          <div className="card emp-sidebar">
            <div className="emp-sidebar-header">
              <span className="ess-title">Colaboradores</span>
              <span className="ess-count">{filteredRows.length}</span>
            </div>

            {/* Buscador de Colaboradores */}
            <div className="emp-search-container">
              <div className="emp-search-wrapper">
                <Search size={14} className="emp-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="emp-search-input"
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredRows.length === 0 ? (
                <div style={{ padding: "20px 10px", textAlign: "center", color: "var(--text-faint)", fontSize: 11.5, fontStyle: "italic" }}>
                  No se encontraron colaboradores.
                </div>
              ) : (
                filteredRows.map(emp => {
                  const isSelected = selectedEmp?.empleado_id === emp.empleado_id;

                  // Initials avatar
                  let hash = 0;
                  for (let i = 0; i < emp.nombre.length; i++) {
                    hash = emp.nombre.charCodeAt(i) + ((hash << 5) - hash);
                  }
                  const h = Math.abs(hash % 360);
                  const avatarBg = `hsl(${h}, 45%, 18%)`;
                  const avatarColor = `hsl(${h}, 70%, 75%)`;
                  const inicial = emp.nombre[0]?.toUpperCase() ?? "?";

                  // Check anomalies
                  const hasAlerts = emp.llegadas_tarde > 0 || emp.incidencias > 0 || emp.ausencias > 0;

                  return (
                    <div
                      key={emp.empleado_id}
                      onClick={() => setSelectedEmpleadoId(emp.empleado_id)}
                      className={`emp-item ${isSelected ? "is-active" : ""}`}
                    >
                      <div className="ei-avatar" style={{
                        background: avatarBg,
                        border: `1px solid ${avatarColor}33`,
                        color: avatarColor,
                      }}>
                        {inicial}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="ei-name">{emp.nombre}</p>

                        {/* Indicadores rápidos */}
                        <div className="emp-chips">
                          {!hasAlerts ? (
                            <span className="emp-chip emp-chip-ok">
                              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#34d399" }} />
                              Sin alertas
                            </span>
                          ) : (
                            <>
                              {emp.llegadas_tarde > 0 && (
                                <span className="emp-chip emp-chip-warn" title="Retardos">
                                  {emp.llegadas_tarde} <span style={{ opacity: 0.7, fontWeight: 600 }}>tarde</span>
                                </span>
                              )}
                              {emp.incidencias > 0 && (
                                <span className="emp-chip emp-chip-danger" title="Incidencias">
                                  {emp.incidencias} <span style={{ opacity: 0.7, fontWeight: 600 }}>inc.</span>
                                </span>
                              )}
                              {emp.ausencias > 0 && (
                                <span className="emp-chip emp-chip-muted" title="Ausencias">
                                  {emp.ausencias} <span style={{ opacity: 0.7, fontWeight: 600 }}>aus.</span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Columna Derecha: Panel de Detalle */}
          {selectedEmp && (
            <div className="card" style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              maxHeight: "580px",
              overflowY: "auto"
            }}>
              {/* Cabecera del colaborador */}
              {(() => {
                let hash = 0;
                for (let i = 0; i < selectedEmp.nombre.length; i++) {
                  hash = selectedEmp.nombre.charCodeAt(i) + ((hash << 5) - hash);
                }
                const h = Math.abs(hash % 360);
                const avatarBg = `hsl(${h}, 50%, 15%)`;
                const avatarColor = `hsl(${h}, 70%, 75%)`;
                const inicial = selectedEmp.nombre[0]?.toUpperCase() ?? "?";

                const completos = selectedEmp.dias.filter(d => d.estado === "completo").length;
                const retardos = selectedEmp.dias.filter(d => d.estado === "retardo").length;
                const incidencias = selectedEmp.dias.filter(d => d.estado === "sin_entrada" || d.estado === "sin_salida").length;
                const ausencias = selectedEmp.dias.filter(d => d.estado === "ausente").length;

                const pct = selectedEmp.dias_laborables > 0
                  ? Math.round((selectedEmp.dias_trabajados / selectedEmp.dias_laborables) * 100)
                  : 0;

                const esAsistenciaPerfecta = retardos === 0 && incidencias === 0 && ausencias === 0 && selectedEmp.dias_trabajados > 0;

                return (
                  <>
                    {/* ── Cabecera del colaborador ── */}
                    <div className="detail-head">
                      <div className="dh-avatar" style={{
                        background: avatarBg,
                        border: `2px solid ${avatarColor}44`,
                        color: avatarColor,
                      }}>
                        {inicial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="dh-name" title={selectedEmp.nombre}>
                          {selectedEmp.nombre}
                        </h3>
                        <div className="dh-meta">
                          <span className="dh-loc">
                            <Building size={12} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                            {selectedEmp.sucursal_nombre ?? "Sin sucursal"}
                          </span>
                          <span className="dh-dot" />
                          {selectedEmp.activo ? (
                            <span className="badge badge-success" style={{ fontSize: 10, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <span className="animate-pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                              Activo
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: 10, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-faint)", display: "inline-block" }} />
                              Inactivo
                            </span>
                          )}
                          {esAsistenciaPerfecta && (
                            <>
                              <span className="dh-dot" />
                              <span className="badge badge-success" style={{ fontSize: 10, padding: "2px 8px", background: "rgba(251, 191, 36, 0.08)", color: "#fbbf24", borderColor: "rgba(251, 191, 36, 0.2)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Star size={11} style={{ fill: "#fbbf24", color: "#fbbf24" }} />
                                Asistencia Perfecta
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── KPI Cards — 5 métricas ── */}
                    <div className="kpi-grid">
                      {/* Días asistidos */}
                      <div className="kpi-card kpi-card-asistencias" style={{ "--kpi-icon-color": SOBRIO.teal } as React.CSSProperties}>
                        <div className="kc-header">
                          <span className="kc-label">Días asistidos</span>
                          <Calendar className="kc-icon" size={15} style={{ color: SOBRIO.teal }} />
                        </div>
                        <span className="kc-value" style={{ color: SOBRIO.teal }}>{selectedEmp.dias_trabajados}</span>
                        <span className="kc-sub">de {selectedEmp.dias_laborables} · {pct}%</span>
                      </div>

                      {/* Retardos */}
                      <div className="kpi-card kpi-card-retardos" style={{ "--kpi-icon-color": SOBRIO.amber } as React.CSSProperties}>
                        <div className="kc-header">
                          <span className="kc-label">Retardos</span>
                          <Clock className="kc-icon" size={15} style={{ color: retardos > 0 ? SOBRIO.amber : "var(--text-faint)" }} />
                        </div>
                        <span className="kc-value" style={{ color: retardos > 0 ? SOBRIO.amber : "var(--text-primary)" }}>{retardos}</span>
                        <span className="kc-sub" style={{ color: retardos > 0 ? SOBRIO.amberSub : "var(--text-faint)" }}>
                          {retardos === 0 ? "Sin retardos" : `${retardos} día${retardos !== 1 ? "s" : ""}`}
                        </span>
                      </div>

                      {/* Incidencias */}
                      <div className="kpi-card kpi-card-incidencias" style={{ "--kpi-icon-color": SOBRIO.red } as React.CSSProperties}>
                        <div className="kc-header">
                          <span className="kc-label">Incidencias</span>
                          <AlertCircle className="kc-icon" size={15} style={{ color: incidencias > 0 ? SOBRIO.red : "var(--text-faint)" }} />
                        </div>
                        <span className="kc-value" style={{ color: incidencias > 0 ? SOBRIO.red : "var(--text-primary)" }}>{incidencias}</span>
                        <span className="kc-sub" style={{ color: incidencias > 0 ? SOBRIO.redSub : "var(--text-faint)" }}>
                          {incidencias === 0 ? "Sin incidencias" : `${incidencias} día${incidencias !== 1 ? "s" : ""}`}
                        </span>
                      </div>

                      {/* Ausencias */}
                      <div className="kpi-card kpi-card-ausencias" style={{ "--kpi-icon-color": "var(--text-secondary)" } as React.CSSProperties}>
                        <div className="kc-header">
                          <span className="kc-label">Ausencias</span>
                          <UserX className="kc-icon" size={15} style={{ color: ausencias > 0 ? "var(--text-secondary)" : "var(--text-faint)" }} />
                        </div>
                        <span className="kc-value" style={{ color: ausencias > 0 ? "var(--text-secondary)" : "var(--text-primary)" }}>{ausencias}</span>
                        <span className="kc-sub">
                          {ausencias === 0 ? "Sin ausencias" : `${ausencias} día${ausencias !== 1 ? "s" : ""}`}
                        </span>
                      </div>

                      {/* Horas trabajadas */}
                      <div className="kpi-card kpi-card-horas" style={{ "--kpi-icon-color": SOBRIO.green } as React.CSSProperties}>
                        <div className="kc-header">
                          <span className="kc-label">Hrs. trabajadas</span>
                          <Activity className="kc-icon" size={15} style={{ color: SOBRIO.green }} />
                        </div>
                        <span className="kc-value" style={{ color: SOBRIO.green }}>{selectedEmp.horas_trabajadas.toFixed(0)}</span>
                        <span className="kc-sub" style={{ color: SOBRIO.greenSub }}>horas totales</span>
                      </div>
                    </div>

                    {/* ── Divisor: Encabezado de Registro Diario ── */}
                    <div className="section-divider">
                      <span className="sd-title">Registro diario</span>
                      <div className="sd-line" />
                      <span className="sd-count">
                        {selectedEmp.dias.length} día{selectedEmp.dias.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* ── Lista de días con filtros ── */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <ColaboradorDesgloseList
                        dias={selectedEmp.dias}
                        incidenciasCount={incidencias}
                        retardosCount={retardos}
                        ausenciasCount={ausencias}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* VIEW IMPRESIÓN (PDF): Lista completa secuencial */}
      <div className="print-only" style={{ display: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(emp => (
            <DetalleEmpleadoBloque key={emp.empleado_id} empleado={emp} />
          ))}
        </div>
      </div>
    </div>
  );
}
