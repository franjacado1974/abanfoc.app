import { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, Bold, Italic, Underline, List, ListOrdered, Eraser,
  Pencil, Square, Circle, Minus, DoorOpen, Ruler, Type, Undo2, Redo2, ZoomIn, ZoomOut,
  Grid3X3, ChevronDown, ChevronUp, Check, MousePointer2, Flame, ShieldAlert, Radio, Droplets, Download,
  Monitor, BellRing, Volume2, AlertTriangle, Maximize2, X, CircleDot, Cylinder, Gauge, FlipHorizontal2, AlignJustify, Save,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, RotateCcw, RotateCw, ClipboardList
} from 'lucide-react';
import type { NotaSeccionItem, NotaPlanoElemento } from '../firebase';

function ExtintorIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 6.5V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3.5" />
      <path d="M9 18h8" />
      <path d="M18 3h-3" />
      <path d="M11 3a6 6 0 0 0-6 6v11" />
      <rect x="9" y="6.5" width="8" height="14.5" rx="3" />
      <path d="M11 11h4" />
    </svg>
  );
}

export interface CajetinPlanoMeta {
  empresaMantenedora?: string;
  clienteNombre?: string;
  centroNombre?: string;
  autor?: string;
  fecha?: string;
  seccionTitulo?: string;
}

interface NotaSeccionesEditorProps {
  secciones: NotaSeccionItem[];
  onChange: (secciones: NotaSeccionItem[]) => void;
  cajetinMeta?: CajetinPlanoMeta;
  onGuardarNota?: () => void;
  isSavingNota?: boolean;
  savedNotice?: boolean;
  onVerReporte?: () => void;
  onDescargarNotaPdf?: () => void;
  isExportingPdf?: boolean;
}

type DrawTool =
  | 'select'
  | 'pen'
  | 'line'
  | 'dashed-line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'polygon'
  | 'escalera'
  | 'door'
  | 'puerta-rf'
  | 'puerta-corredera'
  | 'detector'
  | 'extintor'
  | 'bie'
  | 'hidrante'
  | 'centralita'
  | 'pulsador'
  | 'sirena'
  | 'barrera'
  | 'deposito'
  | 'grupo-presion'
  | 'sprinkler'
  | 'measure'
  | 'text'
  | 'eraser';

type SymbolSizeMode = 'pequeno' | 'mediano' | 'grande';

const SYMBOL_SCALE_MAP: Record<SymbolSizeMode, number> = {
  pequeno: 0.48,
  mediano: 0.72,
  grande: 1
};

function isSimboloTipo(tipo: NotaPlanoElemento['tipo']): boolean {
  return (
    tipo === 'door' ||
    tipo === 'puerta-rf' ||
    tipo === 'puerta-corredera' ||
    tipo === 'detector' ||
    tipo === 'extintor' ||
    tipo === 'bie' ||
    tipo === 'hidrante' ||
    tipo === 'centralita' ||
    tipo === 'pulsador' ||
    tipo === 'sirena' ||
    tipo === 'barrera' ||
    tipo === 'barrera-espejo' ||
    tipo === 'deposito' ||
    tipo === 'grupo-presion' ||
    tipo === 'sprinkler'
  );
}

const CANVAS_W = 720;
const CANVAS_H = 380;
const CAJETIN_H = 74;

export function dibujarCajetinEnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  meta: CajetinPlanoMeta
) {
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x, y, w, h);

  const col1W = Math.round(w * 0.3);
  const col2W = Math.round(w * 0.44);
  const col3W = w - col1W - col2W;
  const halfH = Math.round(h / 2);

  // Divisiones verticales
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + col1W, y);
  ctx.lineTo(x + col1W, y + h);
  ctx.moveTo(x + col1W + col2W, y);
  ctx.lineTo(x + col1W + col2W, y + h);
  // Subdivisión en la mitad inferior de col2 para separar CENTRO y ZONA
  const col2MidX = x + col1W + Math.round(col2W * 0.54);
  ctx.moveTo(col2MidX, y + halfH);
  ctx.lineTo(col2MidX, y + h);
  // Divisiones horizontales en col2 y col3
  ctx.moveTo(x + col1W, y + halfH);
  ctx.lineTo(x + w, y + halfH);
  ctx.stroke();

  const drawCell = (
    cx: number,
    cy: number,
    cw: number,
    label: string,
    value: string,
    boldVal = true
  ) => {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, cx + 8, cy + 5);

    ctx.fillStyle = '#0f172a';
    ctx.font = `${boldVal ? 'bold' : 'normal'} 11px sans-serif`;
    let txt = value || '—';
    const maxTextW = cw - 16;
    while (txt.length > 3 && ctx.measureText(txt).width > maxTextW) {
      txt = txt.slice(0, -4) + '...';
    }
    ctx.fillText(txt, cx + 8, cy + 17);
  };

  // Columna 1: Empresa Mantenedora
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('EMPRESA MANTENEDORA', x + 10, y + 10);
  ctx.fillStyle = '#0f2342';
  ctx.font = 'bold 12px sans-serif';
  let empTxt = (meta.empresaMantenedora || 'ABANFOC S.L.').toUpperCase();
  while (empTxt.length > 3 && ctx.measureText(empTxt).width > col1W - 20) {
    empTxt = empTxt.slice(0, -4) + '...';
  }
  ctx.fillText(empTxt, x + 10, y + 27);
  ctx.fillStyle = '#475569';
  ctx.font = '9px sans-serif';
  ctx.fillText('PLANO DE INSTALACIÓN / REVISIÓN', x + 10, y + 48);

  // Columna 2: Cliente, Centro y Zona
  drawCell(x + col1W, y, col2W, 'CLIENTE', meta.clienteNombre || '—');
  drawCell(x + col1W, y + halfH, col2MidX - (x + col1W), 'CENTRO', meta.centroNombre || '—');
  drawCell(col2MidX, y + halfH, x + col1W + col2W - col2MidX, 'ZONA', meta.seccionTitulo || '—');

  // Columna 3: Autor y Fecha
  drawCell(x + col1W + col2W, y, col3W, 'REALIZADO POR', meta.autor || 'Usuario');
  drawCell(x + col1W + col2W, y + halfH, col3W, 'FECHA', meta.fecha || new Date().toLocaleDateString('es-ES'));

  ctx.restore();
}

export const LEYENDA_W = 152;

const LEYENDA_SIMBOLOS: { tipo: NotaPlanoElemento['tipo']; label: string }[] = [
  { tipo: 'extintor', label: 'Extintor' },
  { tipo: 'bie', label: 'BIE' },
  { tipo: 'hidrante', label: 'Hidrante' },
  { tipo: 'detector', label: 'Detector' },
  { tipo: 'pulsador', label: 'Pulsador' },
  { tipo: 'centralita', label: 'Centralita' },
  { tipo: 'sirena', label: 'Sirena' },
  { tipo: 'barrera', label: 'Barrera lineal' },
  { tipo: 'deposito', label: 'Depósito' },
  { tipo: 'grupo-presion', label: 'Grupo presión' },
  { tipo: 'sprinkler', label: 'Sprinkler' },
  { tipo: 'puerta-rf', label: 'Puerta RF' },
  { tipo: 'puerta-corredera', label: 'Puerta corredera RF' },
  { tipo: 'door', label: 'Puerta' }
];

export function getLeyendaSimbolosPresentes(elementos?: NotaPlanoElemento[]) {
  if (!elementos || elementos.length === 0) return [];
  const tiposPresentes = new Set(elementos.map((el) => el.tipo));
  return LEYENDA_SIMBOLOS.filter((item) => {
    if (item.tipo === 'barrera') {
      return tiposPresentes.has('barrera') || tiposPresentes.has('barrera-espejo');
    }
    return tiposPresentes.has(item.tipo);
  });
}

export function hasLeyendaSimbolos(elementos?: NotaPlanoElemento[]): boolean {
  return getLeyendaSimbolosPresentes(elementos).length > 0;
}

function drawLegendSymbolPreview(
  ctx: CanvasRenderingContext2D,
  tipo: NotaPlanoElemento['tipo'],
  ix: number,
  iy: number,
  iw: number,
  ih: number
) {
  const color = '#dc2626';
  const lw = 1.5;
  if (tipo === 'door') {
    const r = Math.min(iw - 4, ih - 4);
    drawDoorSymbol(ctx, ix + 2, iy + ih - 2, ix + 2 + r, iy + ih - 2, color, lw);
  } else if (tipo === 'puerta-rf') {
    const r = Math.min(iw - 4, ih - 4);
    drawPuertaRFSymbol(ctx, ix + 2, iy + ih - 2, ix + 2 + r, iy + ih - 2, color, lw);
  } else if (tipo === 'puerta-corredera') {
    drawPuertaCorrederaSymbol(ctx, ix + 1, iy + 3, ix + iw - 1, iy + ih - 3, color, 1.4);
  } else if (tipo === 'detector') {
    drawDetectorSymbol(ctx, ix + 3, iy + 2, ix + iw - 3, iy + ih - 2, color, lw);
  } else if (tipo === 'extintor') {
    const cx = ix + iw / 2;
    const cy = iy + ih / 2;
    const halfLen = Math.min(iw - 2, 18) / 2;
    const halfThick = Math.min(ih - 2, 11) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    drawExtintorSymbol(ctx, -halfThick, -halfLen, halfThick, halfLen, color, lw);
    ctx.restore();
  } else if (tipo === 'bie') {
    drawBieSymbol(ctx, ix + 1, iy + 3, ix + iw - 1, iy + ih - 3, color, lw);
  } else if (tipo === 'hidrante') {
    drawHidranteSymbol(ctx, ix + 2, iy + 2, ix + iw - 2, iy + ih - 2, color, lw);
  } else if (tipo === 'centralita') {
    drawCentralitaSymbol(ctx, ix + 1, iy + 3, ix + iw - 1, iy + ih - 3, color, lw);
  } else if (tipo === 'pulsador') {
    drawPulsadorSymbol(ctx, ix + 3, iy + 2, ix + iw - 3, iy + ih - 2, color, lw);
  } else if (tipo === 'sirena') {
    drawSirenaSymbol(ctx, ix + 2, iy + 2, ix + iw - 2, iy + ih - 2, color, lw);
  } else if (tipo === 'barrera' || tipo === 'barrera-espejo') {
    drawBarreraSymbol(ctx, ix + 1, iy + 3, ix + iw - 1, iy + ih - 3, color, lw);
  } else if (tipo === 'deposito') {
    drawDepositoSymbol(ctx, ix + 1, iy + 2, ix + iw - 1, iy + ih - 2, color, lw);
  } else if (tipo === 'grupo-presion') {
    drawGrupoPresionSymbol(ctx, ix + 1, iy + 2, ix + iw - 1, iy + ih - 2, color, lw);
  } else if (tipo === 'sprinkler') {
    drawSprinklerSymbol(ctx, ix + 2, iy + 2, ix + iw - 2, iy + ih - 2, color, lw);
  }
}

export function dibujarLeyendaEnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  elementos: NotaPlanoElemento[]
) {
  const items = getLeyendaSimbolosPresentes(elementos);
  if (items.length === 0) return;

  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x, y, w, h);

  const headerH = 24;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x + 1, y + 1, w - 2, headerH - 1);
  ctx.beginPath();
  ctx.moveTo(x, y + headerH);
  ctx.lineTo(x + w, y + headerH);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#0f2342';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEYENDA', x + w / 2, y + headerH / 2);

  const bodyY = y + headerH + 4;
  const availH = h - headerH - 8;
  const rowH = Math.min(28, Math.max(20, Math.floor(availH / items.length)));

  items.forEach((item, idx) => {
    const ry = bodyY + idx * rowH;
    const ix = x + 8;
    const iy = ry + 3;
    const iw = 22;
    const ih = rowH - 6;

    drawLegendSymbolPreview(ctx, item.tipo, ix, iy, iw, ih);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let label = item.label;
    const maxTextW = w - (ix - x + iw + 12);
    while (label.length > 3 && ctx.measureText(label).width > maxTextW) {
      label = label.slice(0, -4) + '...';
    }
    ctx.fillText(label, ix + iw + 7, ry + rowH / 2);
  });

  ctx.restore();
}

export function composarCanvasConCajetin(
  sourceCanvas: HTMLCanvasElement,
  meta: CajetinPlanoMeta,
  elementos?: NotaPlanoElemento[]
): string {
  const showLeyenda = hasLeyendaSimbolos(elementos);
  const out = document.createElement('canvas');
  out.width = sourceCanvas.width + (showLeyenda ? LEYENDA_W : 0);
  out.height = sourceCanvas.height + CAJETIN_H;
  const ctx = out.getContext('2d');
  if (!ctx) return sourceCanvas.toDataURL('image/png');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(sourceCanvas, 0, 0);
  if (showLeyenda && elementos) {
    dibujarLeyendaEnCanvas(ctx, sourceCanvas.width, 2, LEYENDA_W - 2, sourceCanvas.height - 4, elementos);
  }
  dibujarCajetinEnCanvas(ctx, 2, sourceCanvas.height, out.width - 4, CAJETIN_H - 2, meta);
  return out.toDataURL('image/png');
}

export function exportarDataUrlConCajetin(
  dataUrl: string,
  meta: CajetinPlanoMeta,
  elementos?: NotaPlanoElemento[]
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || CANVAS_W;
      c.height = img.naturalHeight || CANVAS_H;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(composarCanvasConCajetin(c, meta, elementos));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function renderPlanoConCajetinHiRes(
  elementos: NotaPlanoElemento[],
  meta: CajetinPlanoMeta,
  prevElementos: NotaPlanoElemento[] = [],
  scale: number = 2
): string {
  const showLeyenda = hasLeyendaSimbolos(elementos);
  const totalW = CANVAS_W + (showLeyenda ? LEYENDA_W : 0);
  const totalH = CANVAS_H + CAJETIN_H;
  const out = document.createElement('canvas');
  out.width = Math.round(totalW * scale);
  out.height = Math.round(totalH * scale);
  const ctx = out.getContext('2d');
  if (!ctx) return '';

  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalW, totalH);

  elementos.forEach((el) => renderElemento(ctx, el, elementos, prevElementos));

  if (showLeyenda) {
    dibujarLeyendaEnCanvas(ctx, CANVAS_W, 2, LEYENDA_W - 2, CANVAS_H - 4, elementos);
  }
  dibujarCajetinEnCanvas(ctx, 2, CANVAS_H, totalW - 4, CAJETIN_H - 2, meta);
  ctx.restore();

  return out.toDataURL('image/png');
}

const DRAW_COLORS = [
  { label: 'Negro', value: '#0f172a' },
  { label: 'Rojo', value: '#dc2626' },
  { label: 'Azul', value: '#2563eb' },
  { label: 'Verde', value: '#059669' },
  { label: 'Naranja', value: '#ea580c' }
];

const EXTINTOR_PRESETS = ['ABC 6', 'ABC 9', 'NC2', 'NC5'];
const BIE_PRESETS = ['BIE 25', 'BIE 45'];
const PUERTA_RF_PRESETS = ['RF 60', 'RF 90', 'RF 120'];
const ESTADOS_SENAL = ['Correcta', 'Falta señal', 'Deteriorada', 'Mal ubicada', 'No visible'];

const EQUIPO_LABELS: Partial<Record<NotaPlanoElemento['tipo'], string>> = {
  'puerta-rf': 'PUERTA RF',
  'puerta-corredera': 'PUERTA CORREDERA RF',
  detector: 'DETECTOR',
  extintor: 'EXTINTOR',
  bie: 'BIE',
  hidrante: 'HIDRANTE',
  centralita: 'CENTRALITA',
  pulsador: 'PULSADOR',
  sirena: 'SIRENA',
  barrera: 'BARRERA',
  deposito: 'DEPÓSITO',
  'grupo-presion': 'GRUPO PRESIÓN',
  sprinkler: 'SPRINKLER'
};

function isEquipoNumerado(tipo: NotaPlanoElemento['tipo']): boolean {
  return Boolean(EQUIPO_LABELS[tipo]);
}

function getEquipoGrupoKey(tipo: NotaPlanoElemento['tipo']): string {
  if (tipo === 'puerta-rf' || tipo === 'puerta-corredera') return 'puerta-rf';
  return tipo;
}

function getNumeroEquipo(
  el: NotaPlanoElemento,
  currentList: NotaPlanoElemento[],
  prevList: NotaPlanoElemento[] = []
): number {
  const groupKey = getEquipoGrupoKey(el.tipo);
  const prevCount = prevList.filter((x) => getEquipoGrupoKey(x.tipo) === groupKey).length;
  const sameType = currentList.filter((x) => getEquipoGrupoKey(x.tipo) === groupKey);
  const idx = sameType.findIndex((x) => x.id === el.id);
  return prevCount + (idx >= 0 ? idx + 1 : sameType.length + 1);
}

function formatCodigoEquipo(
  el: NotaPlanoElemento,
  currentList: NotaPlanoElemento[],
  prevList: NotaPlanoElemento[] = []
): string {
  const numStr = String(getNumeroEquipo(el, currentList, prevList)).padStart(2, '0');
  const label = EQUIPO_LABELS[el.tipo];
  return label ? `${label} #${numStr}` : `#${numStr}`;
}

export interface ReporteEquipoItem {
  codigo: string;
  tipoLabel: string;
  tipo: string;
  modelo: string;
  ff: string;
  ut: string;
  ph: string;
  estadoSenal: string;
}

export interface ReporteSeccionEquipos {
  seccionId: string;
  titulo: string;
  total: number;
  conteoPorTipo: Record<string, number>;
  equipos: ReporteEquipoItem[];
}

export interface ReporteTipoResumen {
  tipoLabel: string;
  total: number;
  porSeccion: { seccionTitulo: string; count: number }[];
}

export interface ReporteEquiposResult {
  totalGeneral: number;
  conteoGlobal: Record<string, number>;
  resumenPorTipo: ReporteTipoResumen[];
  incidenciasSenal: Record<string, number>;
  secciones: ReporteSeccionEquipos[];
}

export function buildReporteEquiposPorSecciones(secciones: NotaSeccionItem[]): ReporteEquiposResult {
  const conteoGlobal: Record<string, number> = {};
  const incidenciasSenal: Record<string, number> = {};
  let totalGeneral = 0;
  let runningPrev: NotaPlanoElemento[] = [];

  const seccionesRes: ReporteSeccionEquipos[] = (secciones || []).map((sec, idx) => {
    const all = sec.planoElementos || [];
    const eqs = all.filter((el) => isEquipoNumerado(el.tipo));
    const conteoPorTipo: Record<string, number> = {};
    const equipos: ReporteEquipoItem[] = eqs.map((el) => {
      const tipoLabel = EQUIPO_LABELS[el.tipo] || el.tipo;
      conteoPorTipo[tipoLabel] = (conteoPorTipo[tipoLabel] || 0) + 1;
      conteoGlobal[tipoLabel] = (conteoGlobal[tipoLabel] || 0) + 1;
      totalGeneral += 1;
      const senal = (el.estadoSenal || '').trim();
      if (senal && senal !== 'Correcta') {
        incidenciasSenal[senal] = (incidenciasSenal[senal] || 0) + 1;
      }
      return {
        codigo: formatCodigoEquipo(el, all, runningPrev),
        tipoLabel,
        tipo: el.tipo,
        modelo: (el.text || '').trim(),
        ff: formatMonthYear(el.ff),
        ut: formatMonthYear(el.ut),
        ph: formatMonthYear(el.ph),
        estadoSenal: senal
      };
    });

    runningPrev = [...runningPrev, ...all];

    return {
      seccionId: sec.id,
      titulo: (sec.titulo || '').trim() || `Zona ${idx + 1}`,
      total: equipos.length,
      conteoPorTipo,
      equipos
    };
  });

  const resumenPorTipo: ReporteTipoResumen[] = Object.entries(conteoGlobal).map(
    ([tipoLabel, total]) => ({
      tipoLabel,
      total,
      porSeccion: seccionesRes
        .map((s) => ({
          seccionTitulo: s.titulo,
          count: s.conteoPorTipo[tipoLabel] || 0
        }))
        .filter((x) => x.count > 0)
    })
  );

  return {
    totalGeneral,
    conteoGlobal,
    resumenPorTipo,
    incidenciasSenal,
    secciones: seccionesRes
  };
}

function formatMonthYear(val?: string): string {
  const s = (val || '').trim();
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) return `${m[2]}/${m[1]}`;
  return s;
}

function toMonthInputValue(val?: string): string {
  const s = (val || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = /^(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[2]}-${m[1]}`;
  return '';
}

function MonthYearSelect({
  value,
  onChange
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const formatted = formatMonthYear(value);
  return (
    <div className="relative inline-flex items-center">
      <div className="inline-flex items-center justify-between gap-1 min-w-[74px] px-2 py-0.5 bg-white border border-blue-200 rounded text-xs font-bold text-slate-800 pointer-events-none">
        <span className={formatted ? 'text-slate-900' : 'text-slate-400 font-semibold'}>
          {formatted || 'MM/AAAA'}
        </span>
      </div>
      <input
        type="month"
        value={toMonthInputValue(value)}
        onChange={(e) => onChange(formatMonthYear(e.target.value))}
        onClick={(e) => {
          try {
            (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
          } catch {
            // Ignorar si el navegador no soporta showPicker
          }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        title="Seleccionar mes y año"
      />
      {formatted && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="relative z-10 ml-1 text-slate-400 hover:text-red-600 text-[11px] font-black leading-none cursor-pointer"
          title="Borrar fecha"
        >
          ×
        </button>
      )}
    </div>
  );
}

function drawSymbolLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  label: string,
  color: string,
  fontSize = 10,
  align: CanvasTextAlign = 'center'
) {
  if (!label || !label.trim()) return;
  ctx.save();
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const w = ctx.measureText(label.trim()).width;
  const rectX =
    align === 'right' ? x - w - 2 : align === 'left' ? x - 2 : x - w / 2 - 2;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(rectX, yTop - 1, w + 4, fontSize + 2);
  ctx.fillStyle = color;
  ctx.fillText(label.trim(), x, yTop);
  ctx.restore();
}

function drawMultiLineSymbolFooter(
  ctx: CanvasRenderingContext2D,
  minX: number,
  minY: number,
  w: number,
  h: number,
  lines: string[],
  color: string,
  fontSize: number,
  labelPos: 'bottom' | 'top' | 'left' | 'right' = 'bottom'
) {
  if (lines.length === 0) return;
  const lineStep = fontSize + 2;
  const totalH = lines.length * lineStep - 2;
  if (labelPos === 'top') {
    lines.forEach((ln, idx) => {
      drawSymbolLabel(ctx, minX + w / 2, minY - totalH - 4 + idx * lineStep, ln, color, fontSize, 'center');
    });
  } else if (labelPos === 'left') {
    const startY = minY + h / 2 - totalH / 2;
    lines.forEach((ln, idx) => {
      drawSymbolLabel(ctx, minX - 6, startY + idx * lineStep, ln, color, fontSize, 'right');
    });
  } else if (labelPos === 'right') {
    const startY = minY + h / 2 - totalH / 2;
    lines.forEach((ln, idx) => {
      drawSymbolLabel(ctx, minX + w + 6, startY + idx * lineStep, ln, color, fontSize, 'left');
    });
  } else {
    lines.forEach((ln, idx) => {
      drawSymbolLabel(ctx, minX + w / 2, minY + h + 3 + idx * lineStep, ln, color, fontSize, 'center');
    });
  }
}

function SeccionRichTextEditor({
  seccionId,
  value,
  onChange
}: {
  seccionId: string;
  value: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string>('');

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (lastIdRef.current !== seccionId || (value !== el.innerHTML && document.activeElement !== el)) {
      el.innerHTML = value || '';
      lastIdRef.current = seccionId;
    }
  }, [seccionId, value]);

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('bold')}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Negrita"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('italic')}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Cursiva"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('underline')}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Subrayado"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-slate-200 mx-0.5" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertUnorderedList')}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Lista con viñetas"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertOrderedList')}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Lista numerada"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-4 bg-slate-200 mx-0.5" />
        <div className="flex items-center gap-1 px-1">
          {DRAW_COLORS.slice(0, 4).map((c) => (
            <button
              key={c.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec('foreColor', c.value)}
              className="w-4 h-4 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
              style={{ backgroundColor: c.value }}
              title={`Color ${c.label}`}
            />
          ))}
        </div>
        <span className="w-px h-4 bg-slate-200 mx-0.5" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('removeFormat')}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          title="Limpiar formato"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder="Escribe aquí las notas de esta zona..."
        className="min-h-[90px] max-h-[240px] overflow-y-auto px-3 py-2 text-xs text-slate-800 leading-relaxed focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
      />
    </div>
  );
}

function drawDoorSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const radius = Math.hypot(dx, dy);
  if (radius < 4) return;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  const leafAngle = angle - Math.PI / 2;
  const lx = x1 + Math.cos(leafAngle) * radius;
  const ly = y1 + Math.sin(leafAngle) * radius;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(lx, ly);
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = Math.max(1.2, lineWidth * 0.75);
  ctx.beginPath();
  ctx.arc(x1, y1, radius, leafAngle, angle, false);
  ctx.stroke();
  ctx.restore();

  const perpX = Math.cos(leafAngle) * 4;
  const perpY = Math.sin(leafAngle) * 4;
  ctx.beginPath();
  ctx.moveTo(x1 - perpX, y1 - perpY);
  ctx.lineTo(x1 + perpX, y1 + perpY);
  ctx.moveTo(x2 - perpX, y2 - perpY);
  ctx.lineTo(x2 + perpX, y2 + perpY);
  ctx.stroke();

  ctx.restore();
}

function drawPuertaRFSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  drawDoorSymbol(ctx, x1, y1, x2, y2, color, lineWidth);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const radius = Math.hypot(dx, dy);
  if (radius < 6) return;
  const angle = Math.atan2(dy, dx);
  const midAngle = angle - Math.PI / 4;
  const tx = x1 + Math.cos(midAngle) * (radius * 0.62);
  const ty = y1 + Math.sin(midAngle) * (radius * 0.62);

  ctx.save();
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(tx - 9, ty - 6, 18, 12);
  ctx.fillStyle = color;
  ctx.fillText('RF', tx, ty);
  ctx.restore();
}

function drawPuertaCorrederaSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 6) return;

  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const off = 5;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Topes / jambas en los extremos del hueco
  ctx.beginPath();
  ctx.moveTo(x1 - nx * 4, y1 - ny * 4);
  ctx.lineTo(x1 + nx * 4, y1 + ny * 4);
  ctx.moveTo(x2 - nx * 4, y2 - ny * 4);
  ctx.lineTo(x2 + nx * 4, y2 + ny * 4);
  ctx.stroke();

  // Guía discontinua de la puerta corredera
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x1 + nx * off, y1 + ny * off);
  ctx.lineTo(x2 + ux * (len * 0.45) + nx * off, y2 + uy * (len * 0.45) + ny * off);
  ctx.stroke();
  ctx.restore();

  // Hoja corredera desplazada y flecha de dirección de apertura
  const leafStartX = x1 + ux * (len * 0.25) + nx * (off + 3);
  const leafStartY = y1 + uy * (len * 0.25) + ny * (off + 3);
  const leafEndX = x2 + ux * (len * 0.35) + nx * (off + 3);
  const leafEndY = y2 + uy * (len * 0.35) + ny * (off + 3);
  ctx.lineWidth = lineWidth * 1.4;
  ctx.beginPath();
  ctx.moveTo(leafStartX, leafStartY);
  ctx.lineTo(leafEndX, leafEndY);
  ctx.stroke();

  // Punta de flecha de deslizamiento
  const head = Math.min(6, len * 0.22);
  const ang = Math.atan2(dy, dx);
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(leafEndX, leafEndY);
  ctx.lineTo(leafEndX - head * Math.cos(ang - 0.5), leafEndY - head * Math.sin(ang - 0.5));
  ctx.moveTo(leafEndX, leafEndY);
  ctx.lineTo(leafEndX - head * Math.cos(ang + 0.5), leafEndY - head * Math.sin(ang + 0.5));
  ctx.stroke();

  // Etiqueta RF centrada
  const mx = (x1 + x2) / 2 - nx * 7;
  const my = (y1 + y2) / 2 - ny * 7;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mx - 8, my - 5, 16, 10);
  ctx.fillStyle = color;
  ctx.fillText('RF', mx, my);
  ctx.restore();
}

function drawDetectorSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const r = Math.max(4, Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2 || 13);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, lineWidth * Math.min(1, r / 11));

  // Círculo exterior CAD del detector
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Cruz interior
  ctx.lineWidth = Math.max(1.2, lineWidth * 0.75);
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();

  // Punto central
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2, r * 0.22), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExtintorSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number,
  label?: string
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.max(6, Math.abs(x2 - x1));
  const h = Math.max(9, Math.abs(y2 - y1));
  const cx = minX + w / 2;
  const r = Math.min(w * 0.42, h * 0.24);
  const cy = minY + r;
  const esCO2 = /(^|\b)(NC|CO2)/i.test((label || '').trim());

  ctx.save();
  if (x2 < x1 || y2 < y1) {
    const tCx = minX + w / 2;
    const tCy = minY + h / 2;
    ctx.translate(tCx, tCy);
    ctx.scale(x2 < x1 ? -1 : 1, y2 < y1 ? -1 : 1);
    ctx.translate(-tCx, -tCy);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Círculo superior (relleno si es NC / CO2, hueco si es polvo ABC)
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (esCO2) {
    ctx.fill();
  }
  ctx.stroke();

  // Cuerpo trapezoidal inferior unido al círculo
  const topOffset = r * 0.36;
  const neckY = cy + Math.sqrt(Math.max(0, r * r - topOffset * topOffset));
  const botHalfW = Math.max(r * 1.12, w * 0.42);
  const botY = minY + h;

  ctx.beginPath();
  ctx.moveTo(cx - topOffset, neckY);
  ctx.lineTo(cx - botHalfW, botY);
  ctx.lineTo(cx + botHalfW, botY);
  ctx.lineTo(cx + topOffset, neckY);
  ctx.stroke();

  ctx.restore();
}

function drawBieSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const h = Math.max(8, Math.abs(y2 - y1));
  const w = Math.max(12, Math.abs(x2 - x1), Math.round(h * 1.45));

  ctx.save();
  if (x2 < x1 || y2 < y1) {
    const tCx = minX + w / 2;
    const tCy = minY + h / 2;
    ctx.translate(tCx, tCy);
    ctx.scale(x2 < x1 ? -1 : 1, y2 < y1 ? -1 : 1);
    ctx.translate(-tCx, -tCy);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Armario rectangular horizontal
  ctx.strokeRect(minX, minY, w, h);

  // Dos círculos concéntricos en la parte izquierda-central
  const cxReel = minX + w * 0.37;
  const cyReel = minY + h * 0.54;
  const rOuter = h * 0.33;
  const rInner = rOuter * 0.38;

  ctx.beginPath();
  ctx.arc(cxReel, cyReel, rOuter, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cxReel, cyReel, rInner, 0, Math.PI * 2);
  ctx.stroke();

  // Línea horizontal desde la parte superior del círculo exterior hacia la derecha
  ctx.beginPath();
  ctx.moveTo(cxReel, cyReel - rOuter);
  ctx.lineTo(minX + w * 0.88, cyReel - rOuter);
  ctx.stroke();

  ctx.restore();
}

function drawHidranteSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const r = Math.max(4, Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2 || 13);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, lineWidth * Math.min(1, r / 11));

  // Cuerpo circular
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  // Bocas de salida (izquierda, derecha y superior)
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.1, cy);
  ctx.lineTo(cx - r * 0.65, cy);
  ctx.moveTo(cx + r * 0.65, cy);
  ctx.lineTo(cx + r * 1.1, cy);
  ctx.moveTo(cx, cy - r * 0.65);
  ctx.lineTo(cx, cy - r * 1.1);
  ctx.stroke();

  ctx.font = `bold ${Math.max(8, Math.round(r * 0.72))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', cx, cy + 0.5);
  ctx.restore();
}

function drawCentralitaSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const h = Math.max(10, Math.abs(y2 - y1));
  const w = Math.max(16, Math.abs(x2 - x1), Math.round(h * 1.4));

  ctx.save();
  if (x2 < x1 || y2 < y1) {
    const tCx = minX + w / 2;
    const tCy = minY + h / 2;
    ctx.translate(tCx, tCy);
    ctx.scale(x2 < x1 ? -1 : 1, y2 < y1 ? -1 : 1);
    ctx.translate(-tCx, -tCy);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, lineWidth * 0.75);
  ctx.lineJoin = 'round';

  // Marco exterior e interior
  ctx.strokeRect(minX, minY, w, h);
  const pad = Math.max(2.5, h * 0.08);
  ctx.strokeRect(minX + pad, minY + pad, w - pad * 2, h - pad * 2);

  // Banda superior + pantalla LCD
  const lcdX = minX + w * 0.14;
  const lcdY = minY + h * 0.22;
  const lcdW = w * 0.48;
  const lcdH = h * 0.16;
  ctx.strokeRect(lcdX, lcdY, lcdW, lcdH);

  // Fila de pequeños LEDs debajo del LCD
  const ledY = minY + h * 0.48;
  const ledR = Math.max(1.1, h * 0.025);
  for (let i = 0; i < 7; i++) {
    const lx = lcdX + (lcdW / 6) * i;
    ctx.beginPath();
    ctx.arc(lx, ledY, ledR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Matriz 3x3 de indicadores arriba a la derecha
  const gridX0 = minX + w * 0.7;
  const gridY0 = minY + h * 0.2;
  const stepX = w * 0.075;
  const stepY = h * 0.1;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.arc(gridX0 + c * stepX, gridY0 + r * stepY, ledR * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 3 botones rectangulares con indicador a la derecha abajo
  for (let b = 0; b < 3; b++) {
    const by = minY + h * (0.54 + b * 0.12);
    ctx.strokeRect(gridX0, by, w * 0.1, h * 0.06);
    ctx.beginPath();
    ctx.arc(gridX0 + w * 0.15, by + h * 0.03, ledR * 1.15, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPulsadorSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const size = Math.max(9, Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)));
  const cx = minX + size / 2;
  const cy = minY + size / 2;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, lineWidth * Math.min(1, size / 22));
  ctx.lineJoin = 'round';

  // Cuadrado exterior
  ctx.strokeRect(minX, minY, size, size);

  // Rectángulo horizontal centrado
  const rw = size * 0.82;
  const rh = size * 0.28;
  ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);

  // Círculo pequeño en el centro
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2, size * 0.09), 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawSirenaSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const h = Math.max(8, Math.abs(y2 - y1));
  const w = Math.max(12, Math.abs(x2 - x1), Math.round(h * 1.45));

  ctx.save();
  if (x2 < x1 || y2 < y1) {
    const tCx = minX + w / 2;
    const tCy = minY + h / 2;
    ctx.translate(tCx, tCy);
    ctx.scale(x2 < x1 ? -1 : 1, y2 < y1 ? -1 : 1);
    ctx.translate(-tCx, -tCy);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Base rectangular vertical izquierda
  const baseW = w * 0.24;
  const baseY = minY + h * 0.22;
  const baseH = h * 0.56;
  ctx.strokeRect(minX, baseY, baseW, baseH);

  // Bocina trapezoidal oblicua hacia la derecha
  ctx.beginPath();
  ctx.moveTo(minX + baseW, minY + h * 0.27);
  ctx.lineTo(minX + w, minY + h * 0.05);
  ctx.lineTo(minX + w * 0.62, minY + h * 0.95);
  ctx.lineTo(minX + baseW, minY + h * 0.73);
  ctx.stroke();

  ctx.restore();
}

function drawBarreraSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number,
  letter: 'B' | 'E' = 'B'
) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const r = Math.max(4, Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2 || 13);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, lineWidth * Math.min(1, r / 11));

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `bold ${Math.max(10, Math.round(r * 1.1))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, cx, cy + 0.5);
  ctx.restore();
}

function drawDepositoSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const h = Math.max(10, Math.abs(y2 - y1));
  const w = Math.max(18, Math.abs(x2 - x1), Math.round(h * 1.65));

  ctx.save();
  if (x2 < x1 || y2 < y1) {
    const tCx = minX + w / 2;
    const tCy = minY + h / 2;
    ctx.translate(tCx, tCy);
    ctx.scale(x2 < x1 ? -1 : 1, y2 < y1 ? -1 : 1);
    ctx.translate(-tCx, -tCy);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.3, lineWidth * 0.8);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const bodyTop = minY + h * 0.24;
  const bodyBot = minY + h * 0.88;
  const bodyH = bodyBot - bodyTop;
  const r = bodyH / 2;
  const leftCx = minX + r;
  const rightCx = minX + w - r;

  // Cuerpo tipo cápsula horizontal
  ctx.beginPath();
  ctx.arc(leftCx, bodyTop + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.lineTo(rightCx, bodyTop);
  ctx.arc(rightCx, bodyTop + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.stroke();

  // Boca de hombre superior izquierda
  const hatchX = minX + w * 0.24;
  const hatchW = w * 0.16;
  ctx.strokeRect(hatchX + hatchW * 0.12, bodyTop - h * 0.1, hatchW * 0.76, h * 0.1);
  ctx.strokeRect(hatchX, bodyTop - h * 0.18, hatchW, h * 0.08);

  // Escalera vertical lado derecho
  const ladX1 = minX + w * 0.56;
  const ladX2 = minX + w * 0.68;
  const ladTop = bodyTop - h * 0.12;
  ctx.beginPath();
  ctx.moveTo(ladX1, bodyBot);
  ctx.lineTo(ladX1, ladTop);
  ctx.arc(ladX1 + (ladX2 - ladX1) * 0.16, ladTop, (ladX2 - ladX1) * 0.16, Math.PI, 0);
  ctx.lineTo(ladX1 + (ladX2 - ladX1) * 0.32, bodyTop);

  ctx.moveTo(ladX2, bodyBot);
  ctx.lineTo(ladX2, ladTop);
  ctx.arc(ladX2 - (ladX2 - ladX1) * 0.16, ladTop, (ladX2 - ladX1) * 0.16, 0, Math.PI, true);
  ctx.lineTo(ladX2 - (ladX2 - ladX1) * 0.32, bodyTop);
  ctx.stroke();

  // Peldaños de la escalera
  for (let i = 1; i <= 4; i++) {
    const ry = bodyTop + (bodyH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(ladX1, ry);
    ctx.lineTo(ladX2, ry);
    ctx.stroke();
  }

  // Base inferior
  ctx.strokeRect(minX + w * 0.22, bodyBot, w * 0.56, h * 0.12);

  ctx.restore();
}

function drawGrupoPresionSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const h = Math.max(10, Math.abs(y2 - y1));
  const w = Math.max(18, Math.abs(x2 - x1), Math.round(h * 1.6));

  ctx.save();
  if (x2 < x1 || y2 < y1) {
    const tCx = minX + w / 2;
    const tCy = minY + h / 2;
    ctx.translate(tCx, tCy);
    ctx.scale(x2 < x1 ? -1 : 1, y2 < y1 ? -1 : 1);
    ctx.translate(-tCx, -tCy);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.3, lineWidth * 0.8);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Cuerpo principal del motor (derecha)
  const motX = minX + w * 0.38;
  const motY = minY + h * 0.38;
  const motW = w * 0.44;
  const motH = h * 0.44;
  ctx.strokeRect(motX, motY, motW, motH);

  // Tapa trasera redondeada
  ctx.beginPath();
  ctx.moveTo(motX + motW, motY);
  ctx.quadraticCurveTo(minX + w * 0.96, motY + motH / 2, motX + motW, motY + motH);
  ctx.stroke();

  // Aletas horizontales de refrigeración
  for (let i = 1; i <= 3; i++) {
    const fy = motY + (motH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(motX + motW * 0.15, fy);
    ctx.lineTo(motX + motW * 0.85, fy);
    ctx.stroke();
  }

  // Tubo de aspiración izquierdo + brida
  const pipeY = motY + motH * 0.28;
  const pipeH = motH * 0.44;
  ctx.strokeRect(minX + w * 0.08, pipeY, w * 0.3, pipeH);
  ctx.strokeRect(minX + w * 0.02, pipeY - h * 0.06, w * 0.06, pipeH + h * 0.12);

  // Patas y base inferior
  const baseY = motY + motH;
  ctx.beginPath();
  ctx.moveTo(motX + motW * 0.1, baseY);
  ctx.lineTo(motX + motW * 0.05, minY + h * 0.96);
  ctx.moveTo(motX + motW * 0.85, baseY);
  ctx.lineTo(motX + motW * 0.9, minY + h * 0.96);
  ctx.moveTo(motX, minY + h * 0.96);
  ctx.lineTo(motX + motW * 0.95, minY + h * 0.96);
  ctx.stroke();

  // Presostato arriba izquierda
  ctx.strokeRect(minX + w * 0.28, minY + h * 0.14, w * 0.2, h * 0.14);
  ctx.beginPath();
  ctx.moveTo(minX + w * 0.38, minY + h * 0.28);
  ctx.lineTo(minX + w * 0.38, motY);
  ctx.stroke();

  // Manómetro circular arriba derecha con aguja
  const gCx = minX + w * 0.72;
  const gCy = minY + h * 0.18;
  const gR = Math.max(4.5, h * 0.16);
  ctx.beginPath();
  ctx.arc(gCx, gCy, gR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gCx, gCy + gR);
  ctx.lineTo(gCx, motY);
  ctx.stroke();
  // Aguja del manómetro
  ctx.beginPath();
  ctx.moveTo(gCx, gCy);
  ctx.lineTo(gCx + gR * 0.55, gCy - gR * 0.45);
  ctx.stroke();

  ctx.restore();
}

function drawArrowShape(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.min(14, Math.max(8, len * 0.25));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawEscaleraShape(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.max(18, Math.abs(x2 - x1));
  const h = Math.max(18, Math.abs(y2 - y1));
  const horizontal = w >= h;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.2, lineWidth * 0.85);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Contorno del tramo de escalera
  ctx.strokeRect(minX, minY, w, h);

  const stepSpacing = 8;
  if (horizontal) {
    const numSteps = Math.max(3, Math.floor(w / stepSpacing));
    for (let i = 1; i < numSteps; i++) {
      const sx = minX + (w * i) / numSteps;
      ctx.beginPath();
      ctx.moveTo(sx, minY);
      ctx.lineTo(sx, minY + h);
      ctx.stroke();
    }
    // Flecha central indicando dirección
    const midY = minY + h / 2;
    const startX = x2 >= x1 ? minX + w * 0.14 : minX + w * 0.86;
    const endX = x2 >= x1 ? minX + w * 0.86 : minX + w * 0.14;
    const dir = endX >= startX ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(startX, midY);
    ctx.lineTo(endX, midY);
    ctx.lineTo(endX - dir * 5, midY - 4);
    ctx.moveTo(endX, midY);
    ctx.lineTo(endX - dir * 5, midY + 4);
    ctx.stroke();
  } else {
    const numSteps = Math.max(3, Math.floor(h / stepSpacing));
    for (let i = 1; i < numSteps; i++) {
      const sy = minY + (h * i) / numSteps;
      ctx.beginPath();
      ctx.moveTo(minX, sy);
      ctx.lineTo(minX + w, sy);
      ctx.stroke();
    }
    // Flecha central indicando dirección vertical
    const midX = minX + w / 2;
    const startY = y2 >= y1 ? minY + h * 0.14 : minY + h * 0.86;
    const endY = y2 >= y1 ? minY + h * 0.86 : minY + h * 0.14;
    const dir = endY >= startY ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(midX, startY);
    ctx.lineTo(midX, endY);
    ctx.lineTo(midX - 4, endY - dir * 5);
    ctx.moveTo(midX, endY);
    ctx.lineTo(midX + 4, endY - dir * 5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSprinklerSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number
) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.max(10, Math.abs(x2 - x1));
  const h = Math.max(13, Math.abs(y2 - y1));
  const cx = minX + w / 2;

  ctx.save();
  if (x2 < x1 || y2 < y1) {
    const tCy = minY + h / 2;
    ctx.translate(cx, tCy);
    ctx.scale(x2 < x1 ? -1 : 1, y2 < y1 ? -1 : 1);
    ctx.translate(-cx, -tCy);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, lineWidth * Math.min(1, h / 24) * 0.85);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Rosca superior rectangular con líneas de roscado
  const threadW = w * 0.42;
  const threadH = h * 0.22;
  const threadX = cx - threadW / 2;
  const threadY = minY + h * 0.04;
  ctx.strokeRect(threadX, threadY, threadW, threadH);
  ctx.beginPath();
  ctx.moveTo(threadX, threadY + threadH * 0.36);
  ctx.lineTo(threadX + threadW, threadY + threadH * 0.36);
  ctx.moveTo(threadX, threadY + threadH * 0.68);
  ctx.lineTo(threadX + threadW, threadY + threadH * 0.68);
  ctx.stroke();

  // 2. Bastidor exterior con hombros y brazos convergentes
  const bodyTop = threadY + threadH;
  const bodyW = w * 0.78;
  const bodyLeft = cx - bodyW / 2;
  const bodyRight = cx + bodyW / 2;
  const shoulderY = bodyTop + h * 0.44;
  const defY = minY + h * 0.86;
  const neckW = w * 0.24;

  ctx.beginPath();
  ctx.moveTo(bodyLeft, bodyTop);
  ctx.lineTo(bodyRight, bodyTop);
  ctx.lineTo(bodyRight, shoulderY);
  ctx.lineTo(cx + neckW / 2, defY);
  ctx.lineTo(cx - neckW / 2, defY);
  ctx.lineTo(bodyLeft, shoulderY);
  ctx.closePath();
  ctx.stroke();

  // Ventana interior del bastidor
  const innerW = w * 0.48;
  const innerLeft = cx - innerW / 2;
  const innerRight = cx + innerW / 2;
  const innerTop = bodyTop + h * 0.1;
  const innerShoulderY = shoulderY - h * 0.04;
  ctx.beginPath();
  ctx.moveTo(innerLeft, innerTop);
  ctx.lineTo(innerRight, innerTop);
  ctx.lineTo(innerRight, innerShoulderY);
  ctx.lineTo(cx + neckW * 0.42, defY);
  ctx.lineTo(cx - neckW * 0.42, defY);
  ctx.lineTo(innerLeft, innerShoulderY);
  ctx.closePath();
  ctx.stroke();

  // 3. Ampolla vertical central rellena
  const bulbW = Math.max(2, w * 0.14);
  ctx.fillRect(cx - bulbW / 2, innerTop, bulbW, defY - innerTop);

  // 4. Deflector plano inferior con muescas verticales
  const defW = w * 0.88;
  const defH = Math.max(2.5, h * 0.09);
  const defLeft = cx - defW / 2;
  ctx.strokeRect(defLeft, defY, defW, defH);
  for (let i = 1; i <= 5; i++) {
    const tx = defLeft + (defW * i) / 6;
    ctx.beginPath();
    ctx.moveTo(tx, defY);
    ctx.lineTo(tx, defY + defH);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMeasureSymbol(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number,
  label?: string
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 4) return;

  const angle = Math.atan2(dy, dx);
  const tickLen = 7;
  const nx = -Math.sin(angle) * tickLen;
  const ny = Math.cos(angle) * tickLen;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, lineWidth * 0.85);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1 - nx, y1 - ny);
  ctx.lineTo(x1 + nx, y1 + ny);
  ctx.moveTo(x2 - nx, y2 - ny);
  ctx.lineTo(x2 + nx, y2 + ny);
  ctx.stroke();

  if (label && label.trim()) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(label).width;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - textW / 2 - 4, my - 9, textW + 8, 18);
    ctx.fillStyle = color;
    ctx.fillText(label, mx, my);
  }

  ctx.restore();
}

function drawSymbolWithNumber(
  ctx: CanvasRenderingContext2D,
  el: NotaPlanoElemento,
  allElementos: NotaPlanoElemento[],
  prevElementos: NotaPlanoElemento[],
  minX: number,
  minY: number,
  w: number,
  h: number,
  drawFn: () => void
) {
  const rotDeg = el.rotation ?? 0;
  ctx.save();
  if (rotDeg !== 0) {
    const rCx = minX + w / 2;
    const rCy = minY + h / 2;
    ctx.translate(rCx, rCy);
    ctx.rotate((rotDeg * Math.PI) / 180);
    ctx.translate(-rCx, -rCy);
  }
  drawFn();
  ctx.restore();
  const numStr = String(getNumeroEquipo(el, allElementos, prevElementos)).padStart(2, '0');
  const fontSize = Math.max(8, Math.min(11, Math.round(h * 0.42)));
  drawMultiLineSymbolFooter(ctx, minX, minY, w, h, [numStr], el.color, fontSize, el.labelPos || 'bottom');
}

function renderElemento(
  ctx: CanvasRenderingContext2D,
  el: NotaPlanoElemento,
  allElementos: NotaPlanoElemento[] = [],
  prevElementos: NotaPlanoElemento[] = []
) {
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const rotDeg = el.rotation ?? 0;
  const rotateNonFooter =
    rotDeg !== 0 &&
    el.tipo !== 'pen' &&
    el.tipo !== 'eraser' &&
    el.tipo !== 'polygon' &&
    el.tipo !== 'text' &&
    !isEquipoNumerado(el.tipo);
  if (rotateNonFooter) {
    const rCx = ((el.x1 ?? 0) + (el.x2 ?? 0)) / 2;
    const rCy = ((el.y1 ?? 0) + (el.y2 ?? 0)) / 2;
    ctx.translate(rCx, rCy);
    ctx.rotate((rotDeg * Math.PI) / 180);
    ctx.translate(-rCx, -rCy);
  }

  if (el.tipo === 'pen' || el.tipo === 'eraser') {
    const pts = el.points || [];
    if (pts.length > 0) {
      ctx.strokeStyle = el.tipo === 'eraser' ? '#ffffff' : el.color;
      ctx.lineWidth = el.tipo === 'eraser' ? Math.max(12, el.lineWidth * 4) : el.lineWidth;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }
  } else if (el.tipo === 'line') {
    ctx.beginPath();
    ctx.moveTo(el.x1 ?? 0, el.y1 ?? 0);
    ctx.lineTo(el.x2 ?? 0, el.y2 ?? 0);
    ctx.stroke();
  } else if (el.tipo === 'dashed-line') {
    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(el.x1 ?? 0, el.y1 ?? 0);
    ctx.lineTo(el.x2 ?? 0, el.y2 ?? 0);
    ctx.stroke();
    ctx.restore();
  } else if (el.tipo === 'arrow') {
    drawArrowShape(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth);
  } else if (el.tipo === 'rect') {
    const x1 = el.x1 ?? 0;
    const y1 = el.y1 ?? 0;
    const x2 = el.x2 ?? 0;
    const y2 = el.y2 ?? 0;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else if (el.tipo === 'circle') {
    const x1 = el.x1 ?? 0;
    const y1 = el.y1 ?? 0;
    const x2 = el.x2 ?? 0;
    const y2 = el.y2 ?? 0;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (el.tipo === 'polygon') {
    const pts = el.points || [];
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      if (el.closed !== false && pts.length >= 3) {
        ctx.closePath();
      }
      ctx.stroke();
    }
  } else if (el.tipo === 'escalera') {
    drawEscaleraShape(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth);
  } else if (el.tipo === 'door') {
    drawDoorSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth);
  } else if (el.tipo === 'puerta-rf') {
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    const w = Math.max(8, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const h = Math.max(8, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawPuertaRFSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'puerta-corredera') {
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    const w = Math.max(18, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const h = Math.max(12, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawPuertaCorrederaSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'detector') {
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    const w = Math.max(8, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const h = Math.max(8, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawDetectorSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'extintor') {
    const w = Math.max(6, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const h = Math.max(9, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawExtintorSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth, el.text)
    );
  } else if (el.tipo === 'bie') {
    const h = Math.max(8, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    const w = Math.max(12, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)), Math.round(h * 1.45));
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawBieSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'hidrante') {
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    const w = Math.max(12, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const h = Math.max(12, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawHidranteSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'centralita') {
    const h = Math.max(24, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    const w = Math.max(24, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawCentralitaSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'pulsador') {
    const size = Math.max(20, Math.max(Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)), Math.abs((el.y2 ?? 0) - (el.y1 ?? 0))));
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, size, size, () =>
      drawPulsadorSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'sirena') {
    const h = Math.max(18, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    const w = Math.max(18, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawSirenaSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'barrera' || el.tipo === 'barrera-espejo') {
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    const w = Math.max(14, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const h = Math.max(14, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    const letter = el.tipo === 'barrera-espejo' ? 'E' : 'B';
    if (el.tipo === 'barrera') {
      drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
        drawBarreraSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth, letter)
      );
    } else {
      drawBarreraSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth, 'E');
      if (typeof el.numero === 'number' && el.numero > 0) {
        const numStr = String(el.numero).padStart(2, '0');
        const fontSize = Math.max(8, Math.min(11, Math.round(h * 0.42)));
        drawMultiLineSymbolFooter(ctx, minX, minY, w, h, [numStr], el.color, fontSize, el.labelPos || 'bottom');
      }
    }
  } else if (el.tipo === 'deposito') {
    const h = Math.max(24, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    const w = Math.max(24, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawDepositoSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'grupo-presion') {
    const h = Math.max(24, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    const w = Math.max(24, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawGrupoPresionSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'sprinkler') {
    const h = Math.max(28, Math.abs((el.y2 ?? 0) - (el.y1 ?? 0)));
    const w = Math.max(24, Math.abs((el.x2 ?? 0) - (el.x1 ?? 0)));
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    drawSymbolWithNumber(ctx, el, allElementos, prevElementos, minX, minY, w, h, () =>
      drawSprinklerSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth)
    );
  } else if (el.tipo === 'measure') {
    drawMeasureSymbol(ctx, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0, el.color, el.lineWidth, el.text);
  } else if (el.tipo === 'text' && el.text) {
    ctx.font = 'bold 13px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.text, el.x ?? 0, el.y ?? 0);
  }

  ctx.restore();
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitTestElemento(
  el: NotaPlanoElemento,
  px: number,
  py: number,
  ctx: CanvasRenderingContext2D | null
): boolean {
  if (el.tipo === 'eraser') return false;

  if (el.tipo === 'text') {
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    let w = (el.text?.length || 4) * 8;
    if (ctx && el.text) {
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      w = ctx.measureText(el.text).width;
      ctx.restore();
    }
    return px >= x - 8 && px <= x + w + 8 && py >= y - 14 && py <= y + 14;
  }

  if (el.tipo === 'line' || el.tipo === 'dashed-line' || el.tipo === 'arrow' || el.tipo === 'measure' || el.tipo === 'puerta-corredera') {
    return distToSegment(px, py, el.x1 ?? 0, el.y1 ?? 0, el.x2 ?? 0, el.y2 ?? 0) <= 14;
  }

  if (el.tipo === 'door' || el.tipo === 'puerta-rf') {
    const x1 = el.x1 ?? 0;
    const y1 = el.y1 ?? 0;
    const x2 = el.x2 ?? 0;
    const y2 = el.y2 ?? 0;
    const radius = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    const lx = x1 + Math.cos(angle) * radius;
    const ly = y1 + Math.sin(angle) * radius;
    return (
      distToSegment(px, py, x1, y1, x2, y2) <= 14 ||
      distToSegment(px, py, x1, y1, lx, ly) <= 14 ||
      Math.hypot(px - x1, py - y1) <= radius + 8
    );
  }

  if (
    el.tipo === 'rect' ||
    el.tipo === 'circle' ||
    el.tipo === 'escalera' ||
    el.tipo === 'detector' ||
    el.tipo === 'extintor' ||
    el.tipo === 'bie' ||
    el.tipo === 'hidrante' ||
    el.tipo === 'centralita' ||
    el.tipo === 'pulsador' ||
    el.tipo === 'sirena' ||
    el.tipo === 'barrera' ||
    el.tipo === 'barrera-espejo' ||
    el.tipo === 'deposito' ||
    el.tipo === 'grupo-presion' ||
    el.tipo === 'sprinkler'
  ) {
    const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
    const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    let w = Math.abs((el.x2 ?? 0) - (el.x1 ?? 0));
    let h = Math.abs((el.y2 ?? 0) - (el.y1 ?? 0));
    if (el.tipo === 'bie') {
      h = Math.max(8, h);
      w = Math.max(12, w, Math.round(h * 1.45));
    } else if (el.tipo === 'centralita') {
      h = Math.max(10, h);
      w = Math.max(16, w, Math.round(h * 1.4));
    } else if (el.tipo === 'sirena') {
      h = Math.max(8, h);
      w = Math.max(14, w, Math.round(h * 1.45));
    } else if (el.tipo === 'deposito') {
      h = Math.max(10, h);
      w = Math.max(18, w, Math.round(h * 1.65));
    } else if (el.tipo === 'grupo-presion') {
      h = Math.max(10, h);
      w = Math.max(18, w, Math.round(h * 1.6));
    } else if (el.tipo === 'extintor') {
      w = Math.max(6, w);
      h = Math.max(9, h);
    } else if (el.tipo === 'pulsador') {
      const s = Math.max(9, w, h);
      w = s;
      h = s;
    }
    return px >= minX - 10 && px <= minX + w + 10 && py >= minY - 10 && py <= minY + h + 10;
  }

  if (el.tipo === 'pen' && el.points && el.points.length > 0) {
    for (let i = 0; i < el.points.length - 1; i++) {
      if (distToSegment(px, py, el.points[i].x, el.points[i].y, el.points[i + 1].x, el.points[i + 1].y) <= 10) {
        return true;
      }
    }
    return Math.hypot(px - el.points[0].x, py - el.points[0].y) <= 10;
  }

  if (el.tipo === 'polygon' && el.points && el.points.length > 0) {
    const pts = el.points;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= 12) {
        return true;
      }
    }
    if (el.closed !== false && pts.length >= 3) {
      if (distToSegment(px, py, pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y) <= 12) {
        return true;
      }
    }
    return Math.hypot(px - pts[0].x, py - pts[0].y) <= 10;
  }

  return false;
}

function getElementoBounds(el: NotaPlanoElemento, ctx: CanvasRenderingContext2D | null) {
  if (el.tipo === 'text') {
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    let w = (el.text?.length || 4) * 8;
    if (ctx && el.text) {
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      w = ctx.measureText(el.text).width;
      ctx.restore();
    }
    return { x: x - 6, y: y - 12, w: w + 12, h: 24 };
  }
  if ((el.tipo === 'pen' || el.tipo === 'polygon') && el.points?.length) {
    const xs = el.points.map((p) => p.x);
    const ys = el.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX - 6, y: minY - 6, w: maxX - minX + 12, h: maxY - minY + 12 };
  }
  const minX = Math.min(el.x1 ?? 0, el.x2 ?? 0);
  const maxX = Math.max(el.x1 ?? 0, el.x2 ?? 0);
  const minY = Math.min(el.y1 ?? 0, el.y2 ?? 0);
  const maxY = Math.max(el.y1 ?? 0, el.y2 ?? 0);
  return { x: minX - 6, y: minY - 6, w: maxX - minX + 12, h: maxY - minY + 12 };
}

function SeccionPlanoCanvas({
  seccionTitulo,
  cajetinMeta,
  initialElementos,
  prevSectionsElementos = [],
  initialDataUrl,
  initialSymbolSize,
  onChange,
  onGuardarNota,
  isSavingNota,
  savedNotice
}: {
  seccionTitulo?: string;
  cajetinMeta?: CajetinPlanoMeta;
  initialElementos?: NotaPlanoElemento[];
  prevSectionsElementos?: NotaPlanoElemento[];
  initialDataUrl?: string;
  initialSymbolSize?: SymbolSizeMode;
  onChange: (elementos: NotaPlanoElemento[], dataUrl: string, symbolSize: SymbolSizeMode) => void;
  onGuardarNota?: () => void;
  isSavingNota?: boolean;
  savedNotice?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const [elementos, setElementos] = useState<NotaPlanoElemento[]>(() => initialElementos || []);
  const [history, setHistory] = useState<NotaPlanoElemento[][]>(() => [initialElementos || []]);
  const [redoStack, setRedoStack] = useState<NotaPlanoElemento[][]>([]);
  const [zoom, setZoom] = useState<number>(1);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [toolMode, setToolMode] = useState<'create' | 'move'>('create');
  const [symbolSize, setSymbolSize] = useState<SymbolSizeMode>(() => initialSymbolSize || 'grande');
  const [color, setColor] = useState<string>('#0f172a');
  const [lineWidth, setLineWidth] = useState<number>(2);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editSelectedText, setEditSelectedText] = useState<string>('');
  const [editSelectedFf, setEditSelectedFf] = useState<string>('');
  const [editSelectedUt, setEditSelectedUt] = useState<string>('');
  const [editSelectedPh, setEditSelectedPh] = useState<string>('');
  const [editSelectedSenal, setEditSelectedSenal] = useState<string>('');
  const [openMenu, setOpenMenu] = useState<'pen' | 'formas' | 'simbolos' | null>(null);
  const [symbolLabel, setSymbolLabel] = useState<string>('');
  const [symbolLabelPos, setSymbolLabelPos] = useState<'bottom' | 'top' | 'left' | 'right'>('bottom');
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Interacción en curso
  const dragModeRef = useRef<'none' | 'draw' | 'move' | 'p1' | 'p2'>('none');
  const draftElRef = useRef<NotaPlanoElemento | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const workingListRef = useRef<NotaPlanoElemento[]>(elementos);

  // Prompts inline para nueva cota de medida y nuevo texto
  const [pendingMeasure, setPendingMeasure] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    text: string;
  } | null>(null);
  const [pendingText, setPendingText] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [polygonPts, setPolygonPts] = useState<{ x: number; y: number }[]>([]);
  const [polygonOrtho, setPolygonOrtho] = useState<boolean>(true);
  const polygonHoverRef = useRef<{ x: number; y: number } | null>(null);
  const [appliedFeedback, setAppliedFeedback] = useState<boolean>(false);
  const appliedTimerRef = useRef<number | null>(null);

  // Cargar imagen heredada solo si no hay elementos vectoriales previos
  useEffect(() => {
    if ((!initialElementos || initialElementos.length === 0) && initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        bgImageRef.current = img;
        redrawCanvas(elementos, selectedId);
      };
      img.src = initialDataUrl;
    } else {
      bgImageRef.current = null;
      redrawCanvas(elementos, selectedId);
    }
  }, []);

  const snapPolygonPoint = (raw: { x: number; y: number }, prev?: { x: number; y: number }) => {
    if (!prev || !polygonOrtho) return raw;
    const dx = Math.abs(raw.x - prev.x);
    const dy = Math.abs(raw.y - prev.y);
    return dx >= dy ? { x: raw.x, y: prev.y } : { x: prev.x, y: raw.y };
  };

  const drawScene = (
    ctx: CanvasRenderingContext2D,
    list: NotaPlanoElemento[],
    activeSelectedId: string | null,
    includeSelectionUI: boolean
  ) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, CANVAS_W, CANVAS_H);
    }

    if (includeSelectionUI && toolMode === 'move' && tool !== 'select') {
      // En modo Mover específico, dibujar primero el resto y por último el tipo activo en la capa superior
      list.filter((el) => el.tipo !== tool).forEach((el) => renderElemento(ctx, el, list, prevSectionsElementos));
      list.filter((el) => el.tipo === tool).forEach((el) => renderElemento(ctx, el, list, prevSectionsElementos));
    } else {
      list.forEach((el) => renderElemento(ctx, el, list, prevSectionsElementos));
    }

    if (includeSelectionUI && activeSelectedId) {
      const sel = list.find((e) => e.id === activeSelectedId);
      if (sel) {
        const b = getElementoBounds(sel, ctx);
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.setLineDash([]);

        if (sel.tipo !== 'text' && sel.tipo !== 'pen' && sel.tipo !== 'eraser' && sel.tipo !== 'polygon') {
          const pts = [
            { x: sel.x1 ?? 0, y: sel.y1 ?? 0 },
            { x: sel.x2 ?? 0, y: sel.y2 ?? 0 }
          ];
          pts.forEach((p) => {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
        ctx.restore();
      }
    }

    if (includeSelectionUI && polygonPts.length > 0) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(polygonPts[0].x, polygonPts[0].y);
      for (let i = 1; i < polygonPts.length; i++) {
        ctx.lineTo(polygonPts[i].x, polygonPts[i].y);
      }
      ctx.stroke();

      if (polygonHoverRef.current) {
        const lastPt = polygonPts[polygonPts.length - 1];
        const hoverPt = snapPolygonPoint(polygonHoverRef.current, lastPt);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = Math.max(1.5, lineWidth);
        ctx.beginPath();
        ctx.moveTo(lastPt.x, lastPt.y);
        ctx.lineTo(hoverPt.x, hoverPt.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      polygonPts.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, idx === 0 && polygonPts.length >= 3 ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 && polygonPts.length >= 3 ? '#10b981' : '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = idx === 0 && polygonPts.length >= 3 ? '#047857' : '#2563eb';
        ctx.stroke();
      });
      ctx.restore();
    }
  };

  const redrawCanvas = (list: NotaPlanoElemento[], activeSelectedId: string | null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, list, activeSelectedId, true);
  };

  useEffect(() => {
    workingListRef.current = elementos;
    redrawCanvas(elementos, selectedId);
    const sel = elementos.find((e) => e.id === selectedId);
    if (sel && sel.tipo !== 'pen' && sel.tipo !== 'eraser' && sel.tipo !== 'line' && sel.tipo !== 'rect' && sel.tipo !== 'circle' && sel.tipo !== 'polygon') {
      setEditSelectedText(sel.text || '');
      setEditSelectedFf(sel.ff || '');
      setEditSelectedUt(sel.ut || '');
      setEditSelectedPh(sel.ph || '');
      setEditSelectedSenal(sel.estadoSenal || '');
    } else {
      setEditSelectedText('');
      setEditSelectedFf('');
      setEditSelectedUt('');
      setEditSelectedPh('');
      setEditSelectedSenal('');
    }
  }, [elementos, selectedId, tool, toolMode, prevSectionsElementos, polygonPts, polygonOrtho]);

  const exportCleanDataUrl = (list: NotaPlanoElemento[]): string => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return '';
    if (list.length === 0 && !bgImageRef.current) return '';
    drawScene(ctx, list, null, false);
    const dataUrl = canvas.toDataURL('image/webp', 0.85);
    drawScene(ctx, list, selectedId, true);
    return dataUrl;
  };

  const commitElementos = (next: NotaPlanoElemento[], pushHist = true, nextSize: SymbolSizeMode = symbolSize) => {
    setElementos(next);
    if (pushHist) {
      setHistory((prev) => [...prev.slice(-24), next]);
      setRedoStack([]);
    }
    const dataUrl = exportCleanDataUrl(next);
    onChange(next, dataUrl, nextSize);
  };

  const commitPolygon = (ptsToCommit: { x: number; y: number }[], closed = true) => {
    if (ptsToCommit.length < 2) {
      setPolygonPts([]);
      polygonHoverRef.current = null;
      return;
    }
    const newEl: NotaPlanoElemento = {
      id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tipo: 'polygon',
      color,
      lineWidth,
      points: ptsToCommit,
      closed
    };
    setPolygonPts([]);
    polygonHoverRef.current = null;
    commitElementos([...elementos, newEl]);
  };

  const handleChangeSymbolSize = (nextSize: SymbolSizeMode) => {
    if (nextSize === symbolSize) return;
    const ratio = SYMBOL_SCALE_MAP[nextSize] / SYMBOL_SCALE_MAP[symbolSize];
    const scaled = elementos.map((el) => {
      if (!isSimboloTipo(el.tipo)) return el;
      const cx = ((el.x1 ?? 0) + (el.x2 ?? 0)) / 2;
      const cy = ((el.y1 ?? 0) + (el.y2 ?? 0)) / 2;
      return {
        ...el,
        x1: Math.round((cx + ((el.x1 ?? 0) - cx) * ratio) * 10) / 10,
        y1: Math.round((cy + ((el.y1 ?? 0) - cy) * ratio) * 10) / 10,
        x2: Math.round((cx + ((el.x2 ?? 0) - cx) * ratio) * 10) / 10,
        y2: Math.round((cy + ((el.y2 ?? 0) - cy) * ratio) * 10) / 10
      };
    });
    setSymbolSize(nextSize);
    commitElementos(scaled, true, nextSize);
  };

  const handleUndo = () => {
    if (history.length <= 1) {
      if (elementos.length > 0) {
        setRedoStack((prev) => [...prev.slice(-24), elementos]);
        setSelectedId(null);
        setHistory([[]]);
        commitElementos([], false);
      }
      return;
    }
    const nextHist = history.slice(0, -1);
    const prevList = nextHist[nextHist.length - 1];
    setRedoStack((prev) => [...prev.slice(-24), elementos]);
    setHistory(nextHist);
    setSelectedId(null);
    commitElementos(prevList, false);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextList = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistory((prev) => [...prev.slice(-24), nextList]);
    setSelectedId(null);
    commitElementos(nextList, false);
  };

  const handleClear = () => {
    bgImageRef.current = null;
    setSelectedId(null);
    setHistory([[]]);
    setRedoStack([]);
    commitElementos([], false);
  };

  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawScene(ctx, elementos, null, false);
    const pngUrl = composarCanvasConCajetin(
      canvas,
      {
        ...cajetinMeta,
        seccionTitulo: seccionTitulo || cajetinMeta?.seccionTitulo
      },
      elementos
    );
    drawScene(ctx, elementos, selectedId, true);
    const slug = (seccionTitulo || 'plano')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `plano-${slug || 'seccion'}.png`;
    link.click();
  };

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const rawY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return {
      x: Math.max(6, Math.min(CANVAS_W - 6, rawX)),
      y: Math.max(6, Math.min(CANVAS_H - 6, rawY))
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCoords(e);
    const ctx = canvasRef.current?.getContext('2d') || null;

    const isMovingMode = tool === 'select' || (toolMode === 'move' && tool !== 'pen' && tool !== 'eraser');

    if (isMovingMode) {
      // 1. Comprobar si pulsa un nodo de extremo del elemento seleccionado
      if (selectedId) {
        const sel = elementos.find((el) => el.id === selectedId);
        const selMatchesFilter = tool === 'select' || sel?.tipo === tool;
        if (sel && selMatchesFilter && sel.tipo !== 'text' && sel.tipo !== 'pen' && sel.tipo !== 'eraser' && sel.tipo !== 'polygon') {
          if (Math.hypot(pos.x - (sel.x1 ?? 0), pos.y - (sel.y1 ?? 0)) <= 10) {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragModeRef.current = 'p1';
            lastPointerRef.current = pos;
            workingListRef.current = elementos;
            return;
          }
          if (Math.hypot(pos.x - (sel.x2 ?? 0), pos.y - (sel.y2 ?? 0)) <= 10) {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragModeRef.current = 'p2';
            lastPointerRef.current = pos;
            workingListRef.current = elementos;
            return;
          }
        }
      }

      // 2. Buscar elemento bajo el cursor (filtrando por tipo si está en Crear/Mover específico, o priorizando símbolos/textos sobre rect/circle en Mover general)
      let hit: NotaPlanoElemento | null = null;
      if (tool !== 'select') {
        for (let i = elementos.length - 1; i >= 0; i--) {
          const el = elementos[i];
          const matchesTool = el.tipo === tool || (tool === 'barrera' && el.tipo === 'barrera-espejo');
          if (matchesTool && hitTestElemento(el, pos.x, pos.y, ctx)) {
            hit = el;
            break;
          }
        }
      } else {
        // Primero buscar símbolos, textos, medidas, líneas o trazos
        for (let i = elementos.length - 1; i >= 0; i--) {
          const el = elementos[i];
          if (el.tipo !== 'rect' && el.tipo !== 'circle' && hitTestElemento(el, pos.x, pos.y, ctx)) {
            hit = el;
            break;
          }
        }
        // Si no hay ninguno encima, buscar rectángulos o círculos
        if (!hit) {
          for (let i = elementos.length - 1; i >= 0; i--) {
            const el = elementos[i];
            if ((el.tipo === 'rect' || el.tipo === 'circle') && hitTestElemento(el, pos.x, pos.y, ctx)) {
              hit = el;
              break;
            }
          }
        }
      }

      if (hit) {
        setSelectedId(hit.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        dragModeRef.current = 'move';
        lastPointerRef.current = pos;
        workingListRef.current = elementos;
      } else {
        setSelectedId(null);
      }
      return;
    }

    setSelectedId(null);

    if (tool === 'text') {
      setPendingText({ x: pos.x, y: pos.y, text: '' });
      return;
    }

    if (tool === 'polygon') {
      if (polygonPts.length >= 3 && Math.hypot(pos.x - polygonPts[0].x, pos.y - polygonPts[0].y) <= 12) {
        commitPolygon(polygonPts, true);
        return;
      }
      const prevPt = polygonPts[polygonPts.length - 1];
      const nextPt = snapPolygonPoint(pos, prevPt);
      if (prevPt && Math.hypot(nextPt.x - prevPt.x, nextPt.y - prevPt.y) < 3) {
        return;
      }
      setPolygonPts((prev) => [...prev, nextPt]);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dragModeRef.current = 'draw';
    lastPointerRef.current = pos;

    const newId = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (tool === 'pen' || tool === 'eraser') {
      draftElRef.current = {
        id: newId,
        tipo: tool,
        color,
        lineWidth,
        points: [pos]
      };
    } else {
      const esSimbolo =
        tool === 'door' ||
        tool === 'puerta-rf' ||
        tool === 'puerta-corredera' ||
        tool === 'detector' ||
        tool === 'extintor' ||
        tool === 'bie' ||
        tool === 'hidrante' ||
        tool === 'centralita' ||
        tool === 'pulsador' ||
        tool === 'sirena' ||
        tool === 'barrera' ||
        tool === 'deposito' ||
        tool === 'grupo-presion' ||
        tool === 'sprinkler';
      const groupKey = getEquipoGrupoKey(tool as NotaPlanoElemento['tipo']);
      const prevCount = prevSectionsElementos.filter((x) => getEquipoGrupoKey(x.tipo) === groupKey).length;
      const currCount = elementos.filter((x) => getEquipoGrupoKey(x.tipo) === groupKey).length;
      const nextNumeroEquipo = isEquipoNumerado(tool as NotaPlanoElemento['tipo'])
        ? prevCount + currCount + 1
        : undefined;
      draftElRef.current = {
        id: newId,
        tipo: tool,
        color: esSimbolo ? '#dc2626' : color,
        lineWidth,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        ...(esSimbolo && symbolLabel.trim() ? { text: symbolLabel.trim() } : {}),
        ...(typeof nextNumeroEquipo === 'number' ? { numero: nextNumeroEquipo } : {}),
        ...(isEquipoNumerado(tool as NotaPlanoElemento['tipo']) ? { labelPos: symbolLabelPos } : {})
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const mode = dragModeRef.current;
    if (mode === 'none') {
      if (tool === 'polygon' && toolMode === 'create' && polygonPts.length > 0) {
        polygonHoverRef.current = getCoords(e);
        redrawCanvas(elementos, selectedId);
      }
      return;
    }

    const pos = getCoords(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (mode === 'draw' && draftElRef.current) {
      const draft = draftElRef.current;
      if (draft.tipo === 'pen' || draft.tipo === 'eraser') {
        draft.points = [...(draft.points || []), pos];
      } else {
        draft.x2 = pos.x;
        draft.y2 = pos.y;
      }
      drawScene(ctx, [...elementos, draft], null, false);
    } else if ((mode === 'move' || mode === 'p1' || mode === 'p2') && selectedId) {
      const dx = pos.x - lastPointerRef.current.x;
      const dy = pos.y - lastPointerRef.current.y;
      lastPointerRef.current = pos;

      const updated = workingListRef.current.map((el) => {
        if (el.id !== selectedId) return el;
        if (mode === 'move') {
          if (el.tipo === 'text') {
            return { ...el, x: (el.x ?? 0) + dx, y: (el.y ?? 0) + dy };
          }
          if ((el.tipo === 'pen' || el.tipo === 'polygon') && el.points) {
            const xs = el.points.map((p) => p.x + dx);
            const ys = el.points.map((p) => p.y + dy);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const shiftX = minX < 6 ? 6 - minX : maxX > CANVAS_W - 6 ? CANVAS_W - 6 - maxX : 0;
            const shiftY = minY < 6 ? 6 - minY : maxY > CANVAS_H - 6 ? CANVAS_H - 6 - maxY : 0;
            return {
              ...el,
              points: el.points.map((p) => ({
                x: p.x + dx + shiftX,
                y: p.y + dy + shiftY
              }))
            };
          }
          const nx1 = (el.x1 ?? 0) + dx;
          const ny1 = (el.y1 ?? 0) + dy;
          const nx2 = (el.x2 ?? 0) + dx;
          const ny2 = (el.y2 ?? 0) + dy;
          const minX = Math.min(nx1, nx2);
          const maxX = Math.max(nx1, nx2);
          const minY = Math.min(ny1, ny2);
          const maxY = Math.max(ny1, ny2);
          const shiftX = minX < 6 ? 6 - minX : maxX > CANVAS_W - 6 ? CANVAS_W - 6 - maxX : 0;
          const shiftY = minY < 6 ? 6 - minY : maxY > CANVAS_H - 6 ? CANVAS_H - 6 - maxY : 0;
          return {
            ...el,
            x1: nx1 + shiftX,
            y1: ny1 + shiftY,
            x2: nx2 + shiftX,
            y2: ny2 + shiftY
          };
        }
        if (mode === 'p1') {
          return { ...el, x1: pos.x, y1: pos.y };
        }
        return { ...el, x2: pos.x, y2: pos.y };
      });

      workingListRef.current = updated;
      drawScene(ctx, updated, selectedId, true);
    }
  };

  const handlePointerUp = () => {
    const mode = dragModeRef.current;
    if (mode === 'none') return;
    dragModeRef.current = 'none';

    if (mode === 'draw' && draftElRef.current) {
      const draft = draftElRef.current;
      draftElRef.current = null;

      if (draft.tipo === 'measure') {
        const dist = Math.hypot((draft.x2 ?? 0) - (draft.x1 ?? 0), (draft.y2 ?? 0) - (draft.y1 ?? 0));
        if (dist >= 8) {
          setPendingMeasure({
            x1: draft.x1 ?? 0,
            y1: draft.y1 ?? 0,
            x2: draft.x2 ?? 0,
            y2: draft.y2 ?? 0,
            text: ''
          });
        } else {
          redrawCanvas(elementos, selectedId);
        }
        return;
      }

      if (draft.tipo !== 'pen' && draft.tipo !== 'eraser') {
        const dist = Math.hypot((draft.x2 ?? 0) - (draft.x1 ?? 0), (draft.y2 ?? 0) - (draft.y1 ?? 0));
        if (dist < 5) {
          const s = SYMBOL_SCALE_MAP[symbolSize];
          // Clic rápido sobre un símbolo: insertar con tamaño proporcional al modo (Pequeño / Mediano / Grande)
          if (draft.tipo === 'door' || draft.tipo === 'puerta-rf' || draft.tipo === 'puerta-corredera') {
            draft.x2 = (draft.x1 ?? 0) + Math.round(42 * s);
            draft.y2 = draft.y1 ?? 0;
          } else if (draft.tipo === 'bie') {
            const cx = draft.x1 ?? 0;
            const cy = draft.y1 ?? 0;
            draft.x1 = cx - Math.round(18 * s);
            draft.y1 = cy - Math.round(11 * s);
            draft.x2 = cx + Math.round(18 * s);
            draft.y2 = cy + Math.round(11 * s);
          } else if (draft.tipo === 'extintor') {
            const cx = draft.x1 ?? 0;
            const cy = draft.y1 ?? 0;
            draft.x1 = cx - Math.round(7.5 * s);
            draft.y1 = cy - Math.round(12 * s);
            draft.x2 = cx + Math.round(7.5 * s);
            draft.y2 = cy + Math.round(12 * s);
          } else if (draft.tipo === 'centralita' || draft.tipo === 'deposito' || draft.tipo === 'grupo-presion') {
            const cx = draft.x1 ?? 0;
            const cy = draft.y1 ?? 0;
            draft.x1 = cx - Math.round(24 * s);
            draft.y1 = cy - Math.round(16 * s);
            draft.x2 = cx + Math.round(24 * s);
            draft.y2 = cy + Math.round(16 * s);
          } else if (draft.tipo === 'sirena') {
            const cx = draft.x1 ?? 0;
            const cy = draft.y1 ?? 0;
            draft.x1 = cx - Math.round(19 * s);
            draft.y1 = cy - Math.round(12 * s);
            draft.x2 = cx + Math.round(19 * s);
            draft.y2 = cy + Math.round(12 * s);
          } else if (draft.tipo === 'sprinkler') {
            const cx = draft.x1 ?? 0;
            const cy = draft.y1 ?? 0;
            draft.x1 = cx - Math.round(12 * s);
            draft.y1 = cy - Math.round(16 * s);
            draft.x2 = cx + Math.round(12 * s);
            draft.y2 = cy + Math.round(16 * s);
          } else if (draft.tipo === 'detector' || draft.tipo === 'hidrante' || draft.tipo === 'pulsador' || draft.tipo === 'barrera') {
            const cx = draft.x1 ?? 0;
            const cy = draft.y1 ?? 0;
            draft.x1 = cx - Math.round(14 * s);
            draft.y1 = cy - Math.round(14 * s);
            draft.x2 = cx + Math.round(14 * s);
            draft.y2 = cy + Math.round(14 * s);
          } else {
            redrawCanvas(elementos, selectedId);
            return;
          }
        }
        const dMinX = Math.min(draft.x1 ?? 0, draft.x2 ?? 0);
        const dMaxX = Math.max(draft.x1 ?? 0, draft.x2 ?? 0);
        const dMinY = Math.min(draft.y1 ?? 0, draft.y2 ?? 0);
        const dMaxY = Math.max(draft.y1 ?? 0, draft.y2 ?? 0);
        const sX = dMinX < 6 ? 6 - dMinX : dMaxX > CANVAS_W - 6 ? CANVAS_W - 6 - dMaxX : 0;
        const sY = dMinY < 6 ? 6 - dMinY : dMaxY > CANVAS_H - 6 ? CANVAS_H - 6 - dMaxY : 0;
        draft.x1 = (draft.x1 ?? 0) + sX;
        draft.x2 = (draft.x2 ?? 0) + sX;
        draft.y1 = (draft.y1 ?? 0) + sY;
        draft.y2 = (draft.y2 ?? 0) + sY;
      }

      if (draft.tipo === 'barrera') {
        const w = Math.abs((draft.x2 ?? 0) - (draft.x1 ?? 0)) || 28;
        const offsetX = (draft.x2 ?? 0) + w + 24 <= CANVAS_W ? w + 18 : -(w + 18);
        const espejoDraft: NotaPlanoElemento = {
          id: `${draft.id}_espejo`,
          tipo: 'barrera-espejo',
          color: draft.color,
          lineWidth: draft.lineWidth,
          x1: (draft.x1 ?? 0) + offsetX,
          y1: draft.y1 ?? 0,
          x2: (draft.x2 ?? 0) + offsetX,
          y2: draft.y2 ?? 0,
          ...(typeof draft.numero === 'number' ? { numero: draft.numero } : {}),
          ...(draft.labelPos ? { labelPos: draft.labelPos } : {})
        };
        commitElementos([...elementos, draft, espejoDraft]);
      } else {
        commitElementos([...elementos, draft]);
      }
    } else if (mode === 'move' || mode === 'p1' || mode === 'p2') {
      commitElementos(workingListRef.current);
    }
  };

  const confirmPendingMeasure = () => {
    if (!pendingMeasure) return;
    const nuevo: NotaPlanoElemento = {
      id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tipo: 'measure',
      color,
      lineWidth,
      x1: pendingMeasure.x1,
      y1: pendingMeasure.y1,
      x2: pendingMeasure.x2,
      y2: pendingMeasure.y2,
      text: pendingMeasure.text.trim()
    };
    setPendingMeasure(null);
    commitElementos([...elementos, nuevo]);
  };

  const confirmPendingText = () => {
    if (!pendingText) return;
    if (pendingText.text.trim()) {
      const nuevo: NotaPlanoElemento = {
        id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tipo: 'text',
        color,
        lineWidth,
        x: pendingText.x,
        y: pendingText.y,
        text: pendingText.text.trim()
      };
      commitElementos([...elementos, nuevo]);
    }
    setPendingText(null);
  };

  const selectedElemento = elementos.find((e) => e.id === selectedId) || null;

  const handleUpdateSelectedText = () => {
    if (!selectedElemento) return;
    const next = elementos.map((e) =>
      e.id === selectedElemento.id
        ? {
            ...e,
            text: editSelectedText.trim(),
            ...(e.tipo === 'extintor'
              ? { ff: editSelectedFf.trim(), ut: editSelectedUt.trim(), estadoSenal: editSelectedSenal }
              : {}),
            ...(e.tipo === 'bie'
              ? { ff: editSelectedFf.trim(), ph: editSelectedPh.trim(), estadoSenal: editSelectedSenal }
              : {})
          }
        : e
    );
    commitElementos(next);
    setAppliedFeedback(true);
    if (appliedTimerRef.current) window.clearTimeout(appliedTimerRef.current);
    appliedTimerRef.current = window.setTimeout(() => {
      setAppliedFeedback(false);
    }, 3000);
  };

  const handleRecolorSelected = (newColor: string) => {
    if (!selectedElemento) return;
    const next = elementos.map((e) =>
      e.id === selectedElemento.id ? { ...e, color: newColor } : e
    );
    commitElementos(next);
  };

  const handleDeleteSelected = () => {
    if (!selectedElemento) return;
    const next = elementos.filter((e) => e.id !== selectedElemento.id);
    setSelectedId(null);
    commitElementos(next);
  };

  const handleFlipSelected = () => {
    if (!selectedElemento) return;
    if (selectedElemento.tipo === 'text' || selectedElemento.tipo === 'pen' || selectedElemento.tipo === 'eraser') return;
    if (selectedElemento.tipo === 'polygon' && selectedElemento.points?.length) {
      const xs = selectedElemento.points.map((p) => p.x);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const next = elementos.map((e) =>
        e.id === selectedElemento.id && e.points
          ? { ...e, points: e.points.map((p) => ({ x: 2 * cx - p.x, y: p.y })) }
          : e
      );
      commitElementos(next);
      return;
    }
    const next = elementos.map((e) =>
      e.id === selectedElemento.id
        ? { ...e, x1: e.x2 ?? 0, x2: e.x1 ?? 0 }
        : e
    );
    commitElementos(next);
  };

  const handleRotateSelected = (deltaDeg: number) => {
    if (!selectedElemento) return;
    if (selectedElemento.tipo === 'text' || selectedElemento.tipo === 'pen' || selectedElemento.tipo === 'eraser') return;
    if (selectedElemento.tipo === 'polygon' && selectedElemento.points?.length) {
      const xs = selectedElemento.points.map((p) => p.x);
      const ys = selectedElemento.points.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const rad = (deltaDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rotated = selectedElemento.points.map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        return {
          x: cx + dx * cos - dy * sin,
          y: cy + dx * sin + dy * cos
        };
      });
      const rXs = rotated.map((p) => p.x);
      const rYs = rotated.map((p) => p.y);
      const minX = Math.min(...rXs);
      const maxX = Math.max(...rXs);
      const minY = Math.min(...rYs);
      const maxY = Math.max(...rYs);
      const shiftX = minX < 6 ? 6 - minX : maxX > CANVAS_W - 6 ? CANVAS_W - 6 - maxX : 0;
      const shiftY = minY < 6 ? 6 - minY : maxY > CANVAS_H - 6 ? CANVAS_H - 6 - maxY : 0;
      const clampedPts = rotated.map((p) => ({
        x: Math.round((p.x + shiftX) * 10) / 10,
        y: Math.round((p.y + shiftY) * 10) / 10
      }));
      const next = elementos.map((e) =>
        e.id === selectedElemento.id ? { ...e, points: clampedPts } : e
      );
      commitElementos(next);
      return;
    }
    const next = elementos.map((e) => {
      if (e.id !== selectedElemento.id) return e;
      const nextRot = (((e.rotation ?? 0) + deltaDeg) % 360 + 360) % 360;
      return { ...e, rotation: nextRot };
    });
    commitElementos(next);
  };

  const handleSetSelectedLabelPos = (pos: 'bottom' | 'top' | 'left' | 'right') => {
    if (!selectedElemento) return;
    const next = elementos.map((e) =>
      e.id === selectedElemento.id ? { ...e, labelPos: pos } : e
    );
    commitElementos(next);
  };

  const formasList: { id: DrawTool; label: string; icon: typeof Pencil }[] = [
    { id: 'line', label: 'Línea continua', icon: Minus },
    { id: 'dashed-line', label: 'Línea discontinua', icon: Minus },
    { id: 'arrow', label: 'Flecha', icon: ArrowRight },
    { id: 'rect', label: 'Cuadrado', icon: Square },
    { id: 'circle', label: 'Círculo', icon: Circle },
    { id: 'polygon', label: 'Área / Polígono', icon: Square },
    { id: 'escalera', label: 'Escalera', icon: AlignJustify },
    { id: 'measure', label: 'Medida / Cota', icon: Ruler }
  ];

  const simbolosList: { id: DrawTool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'door', label: 'Puerta', icon: DoorOpen },
    { id: 'puerta-rf', label: 'Puerta RF', icon: ShieldAlert },
    { id: 'puerta-corredera', label: 'Puerta corredera RF', icon: ShieldAlert },
    { id: 'detector', label: 'Detector', icon: Radio },
    { id: 'extintor', label: 'Extintor', icon: ExtintorIcon },
    { id: 'bie', label: 'BIE', icon: Droplets },
    { id: 'hidrante', label: 'Hidrante', icon: Droplets },
    { id: 'centralita', label: 'Centralita', icon: Monitor },
    { id: 'pulsador', label: 'Pulsador', icon: BellRing },
    { id: 'sirena', label: 'Sirena', icon: Volume2 },
    { id: 'barrera', label: 'Barrera lineal', icon: CircleDot },
    { id: 'deposito', label: 'Depósito', icon: Cylinder },
    { id: 'grupo-presion', label: 'Grupo presión', icon: Gauge },
    { id: 'sprinkler', label: 'Sprinkler', icon: Droplets }
  ];

  const formaActiva = formasList.find((f) => f.id === tool);
  const simboloActivo = simbolosList.find((s) => s.id === tool);

  const selectTool = (nextTool: DrawTool, nextMode: 'create' | 'move' = 'create') => {
    setTool(nextTool);
    setToolMode(nextMode);
    setOpenMenu(null);
    setPolygonPts([]);
    polygonHoverRef.current = null;
    if (nextTool !== 'select') setSelectedId(null);
    if (nextTool === 'extintor') setSymbolLabel('ABC 6');
    else if (nextTool === 'bie') setSymbolLabel('BIE 25');
    else setSymbolLabel('');
    setSymbolLabelPos('bottom');
  };

  const activeToolLabel = formaActiva?.label || simboloActivo?.label || (tool === 'text' ? 'Texto' : '');
  const supportsCreateMove = Boolean(formaActiva || simboloActivo || tool === 'text');

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[125] bg-slate-100 p-2.5 sm:p-4 flex flex-col gap-2 overflow-y-auto'
          : 'mt-2.5 bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2'
      }
    >
      {isFullscreen && (
        <div className="flex items-center justify-between gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl shrink-0">
          <span className="text-xs font-black uppercase tracking-wide truncate">
            Plano: {seccionTitulo || 'Zona'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {onGuardarNota && (
              <button
                type="button"
                disabled={isSavingNota}
                onClick={onGuardarNota}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer transition-colors"
                title="Guardar nota sin salir de pantalla completa"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingNota ? 'Guardando...' : savedNotice ? '✓ Guardado' : 'Guardar nota'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer transition-colors"
              title="Volver a la nota"
            >
              <X className="w-4 h-4" />
              <span>Volver a la nota</span>
            </button>
          </div>
        </div>
      )}
      {/* Barra de herramientas del plano */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 relative">
          {/* Mover / Editar */}
          <button
            type="button"
            onClick={() => selectTool('select')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              tool === 'select'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            title="Mover / Editar"
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mover / Editar</span>
          </button>

          {/* Mano alzada con selector de grosor (Fino / Medio / Grueso) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (tool !== 'pen') {
                  selectTool('pen');
                }
                setOpenMenu(openMenu === 'pen' ? null : 'pen');
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tool === 'pen'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
              title="Mano alzada (elegir grosor)"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                Mano alzada ({lineWidth === 2 ? 'Fino' : lineWidth === 4 ? 'Medio' : 'Grueso'})
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {openMenu === 'pen' && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-30">
                {(
                  [
                    { val: 2, label: 'Fino', hClass: 'h-[2px]' },
                    { val: 4, label: 'Medio', hClass: 'h-[4px]' },
                    { val: 6, label: 'Grueso', hClass: 'h-[6px]' }
                  ] as const
                ).map((g) => (
                  <button
                    key={g.val}
                    type="button"
                    onClick={() => {
                      setLineWidth(g.val);
                      selectTool('pen');
                      setOpenMenu(null);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      tool === 'pen' && lineWidth === g.val
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{g.label}</span>
                    <span className={`w-8 rounded-full bg-current ${g.hClass}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desplegable FORMAS */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'formas' ? null : 'formas')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                formaActiva
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
              title="Formas geométricas y cotas"
            >
              {formaActiva ? <formaActiva.icon className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              <span>
                {formaActiva ? `${formaActiva.label} · ${toolMode === 'move' ? 'Mover' : 'Añadir'}` : 'Formas'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>
            {openMenu === 'formas' && (
              <div className="absolute left-0 top-full mt-1 z-30 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 space-y-1">
                {formasList.map((f) => {
                  const Icon = f.icon;
                  const isRowActive = tool === f.id;
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg ${
                        isRowActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectTool(f.id, 'create')}
                        className={`flex items-center gap-2 text-xs font-bold cursor-pointer flex-1 text-left ${
                          isRowActive ? 'text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{f.label}</span>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => selectTool(f.id, 'create')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            isRowActive && toolMode === 'create'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          Añadir
                        </button>
                        <button
                          type="button"
                          onClick={() => selectTool(f.id, 'move')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            isRowActive && toolMode === 'move'
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                          }`}
                        >
                          Mover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desplegable SÍMBOLOS */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'simbolos' ? null : 'simbolos')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                simboloActivo
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
              title="Símbolos PCI y puertas estilo AutoCAD"
            >
              {simboloActivo ? <simboloActivo.icon className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5 text-red-500" />}
              <span>
                {simboloActivo ? `${simboloActivo.label} · ${toolMode === 'move' ? 'Mover' : 'Añadir'}` : 'Símbolos'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>
            {openMenu === 'simbolos' && (
              <div className="absolute left-0 top-full mt-1 z-30 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 space-y-1">
                {simbolosList.map((s) => {
                  const Icon = s.icon;
                  const isRowActive = tool === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg ${
                        isRowActive ? 'bg-red-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectTool(s.id, 'create')}
                        className={`flex items-center gap-2 text-xs font-bold cursor-pointer flex-1 text-left ${
                          isRowActive ? 'text-red-700' : 'text-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{s.label}</span>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => selectTool(s.id, 'create')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            isRowActive && toolMode === 'create'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          Añadir
                        </button>
                        <button
                          type="button"
                          onClick={() => selectTool(s.id, 'move')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            isRowActive && toolMode === 'move'
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                          }`}
                        >
                          Mover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Texto */}
          <button
            type="button"
            onClick={() => selectTool('text')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              tool === 'text'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            title="Texto"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Texto</span>
          </button>

          {/* Borrador */}
          <button
            type="button"
            onClick={() => selectTool('eraser')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              tool === 'eraser'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            title="Borrador"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Borrador</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center gap-1 bg-white px-1.5 py-1 rounded-lg border border-slate-200"
            title={selectedElemento ? 'Cambiar color del elemento seleccionado y trazos' : 'Color de dibujo, texto y formas'}
          >
            {DRAW_COLORS.map((c) => {
              const isColorActive = selectedElemento ? selectedElemento.color === c.value : color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setColor(c.value);
                    if (selectedElemento) {
                      handleRecolorSelected(c.value);
                    }
                  }}
                  className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                    isColorActive ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              );
            })}
          </div>

          {/* Selector de Tamaño de Equipos (Pequeño / Mediano / Grande) */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5" title="Tamaño de todos los equipos contra incendios del plano">
            <span className="text-[10px] font-bold text-slate-500 px-1.5 hidden lg:inline">Equipos:</span>
            {(
              [
                { id: 'pequeno', label: 'Pequeño' },
                { id: 'mediano', label: 'Mediano' },
                { id: 'grande', label: 'Grande' }
              ] as const
            ).map((sz) => (
              <button
                key={sz.id}
                type="button"
                onClick={() => handleChangeSymbolSize(sz.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  symbolSize === sz.id
                    ? 'bg-red-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
              showGrid
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
            title="Mostrar/ocultar cuadrícula de plano"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleUndo}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
            title="Deshacer último cambio"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-600 border border-slate-200 cursor-pointer disabled:cursor-not-allowed"
            title="Rehacer / Hacer cambio deshecho"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {/* Zoom - / 100% / + */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5" title="Zoom del plano">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
              disabled={zoom <= 0.5}
              className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="Alejar zoom (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-1.5 py-0.5 text-[10px] font-black text-slate-700 hover:bg-slate-100 rounded cursor-pointer min-w-[38px]"
              title="Restablecer zoom al 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.25) * 100) / 100))}
              disabled={zoom >= 2}
              className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="Acercar zoom (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadImage}
            className="p-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 cursor-pointer"
            title="Descargar imagen del plano (PNG)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
              isFullscreen
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Abrir plano a pantalla completa'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isFullscreen ? 'Normal' : 'Pantalla completa'}</span>
          </button>
        </div>
      </div>

      {/* Conmutador Crear / Mover para la herramienta activa (se oculta cuando hay elemento seleccionado porque pasa a su fila) */}
      {supportsCreateMove && !selectedElemento && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-slate-700">
              {activeToolLabel}:
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setToolMode('create');
                  setSelectedId(null);
                  setPolygonPts([]);
                  polygonHoverRef.current = null;
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  toolMode === 'create'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3 h-3" />
                Crear
              </button>
              <button
                type="button"
                onClick={() => {
                  setToolMode('move');
                  setSelectedId(null);
                  setPolygonPts([]);
                  polygonHoverRef.current = null;
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  toolMode === 'move'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MousePointer2 className="w-3 h-3" />
                Mover
              </button>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-slate-500">
            {toolMode === 'move'
              ? `Pulsa un elemento de tipo "${activeToolLabel}" para moverlo o editar su etiqueta.`
              : `Pulsa o arrastra en el plano para añadir "${activeToolLabel}".`}
          </span>
        </div>
      )}

      {/* Barra de ayuda y cierre para Área / Polígono */}
      {tool === 'polygon' && toolMode === 'create' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPolygonOrtho((v) => !v)}
              className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                polygonOrtho
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="Activar/desactivar ajuste automático a ángulos rectos (90°)"
            >
              Ángulos 90°: {polygonOrtho ? 'ON' : 'OFF'}
            </button>
            <span className="text-[11px] text-blue-900 font-medium">
              Haz clic en cada esquina ({polygonPts.length} {polygonPts.length === 1 ? 'vértice' : 'vértices'}).
              {polygonPts.length >= 3 ? ' Pulsa el primer punto verde o "Cerrar área".' : ''}
            </span>
          </div>
          {polygonPts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPolygonPts((prev) => prev.slice(0, -1))}
                className="px-2 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px] font-bold cursor-pointer"
              >
                Deshacer esquina
              </button>
              <button
                type="button"
                onClick={() => {
                  setPolygonPts([]);
                  polygonHoverRef.current = null;
                }}
                className="px-2 py-1 rounded-md bg-white border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-bold cursor-pointer"
              >
                Cancelar
              </button>
              {polygonPts.length >= 2 && (
                <button
                  type="button"
                  onClick={() => commitPolygon(polygonPts, false)}
                  className="px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-800 text-[11px] font-bold cursor-pointer"
                >
                  Terminar línea
                </button>
              )}
              {polygonPts.length >= 3 && (
                <button
                  type="button"
                  onClick={() => commitPolygon(polygonPts, true)}
                  className="px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-bold cursor-pointer"
                >
                  Cerrar área
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Barra rápida de etiqueta para símbolos antes de insertar */}
      {simboloActivo && toolMode === 'create' && isEquipoNumerado(tool as NotaPlanoElemento['tipo']) && (
        <div className="flex flex-wrap items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] font-black text-red-900 shrink-0">
            Próximo: {EQUIPO_LABELS[tool as NotaPlanoElemento['tipo']] || simboloActivo.label}{' '}
            {String(
              prevSectionsElementos.filter(
                (x) => getEquipoGrupoKey(x.tipo) === getEquipoGrupoKey(tool as NotaPlanoElemento['tipo'])
              ).length +
                elementos.filter(
                  (x) => getEquipoGrupoKey(x.tipo) === getEquipoGrupoKey(tool as NotaPlanoElemento['tipo'])
                ).length +
                1
            ).padStart(2, '0')}
          </span>
          <span className="text-[11px] text-red-800">
            (En el plano solo se verá el número; pulsa el equipo en <strong>Mover</strong> para rellenar su etiqueta)
          </span>
          <div className="flex items-center gap-0.5 bg-white border border-red-200 rounded px-1 py-0.5 ml-auto" title="Posición del número respecto al símbolo">
            <span className="text-[10px] font-bold text-red-900 mr-0.5">Nº:</span>
            {(
              [
                { id: 'top', icon: ArrowUp, title: 'Número arriba' },
                { id: 'bottom', icon: ArrowDown, title: 'Número abajo' },
                { id: 'left', icon: ArrowLeft, title: 'Número izquierda' },
                { id: 'right', icon: ArrowRight, title: 'Número derecha' }
              ] as const
            ).map((dir) => {
              const DirIcon = dir.icon;
              return (
                <button
                  key={dir.id}
                  type="button"
                  onClick={() => setSymbolLabelPos(dir.id)}
                  title={dir.title}
                  className={`p-0.5 rounded transition-colors cursor-pointer ${
                    symbolLabelPos === dir.id
                      ? 'bg-red-600 text-white'
                      : 'text-red-700 hover:bg-red-100'
                  }`}
                >
                  <DirIcon className="w-3 h-3" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra contextual ordenada de elemento seleccionado (Mover / Editar / Eliminar) */}
      {selectedElemento && (() => {
        const supportsTextEdit =
          selectedElemento.tipo !== 'pen' &&
          selectedElemento.tipo !== 'eraser' &&
          selectedElemento.tipo !== 'line' &&
          selectedElemento.tipo !== 'rect' &&
          selectedElemento.tipo !== 'circle' &&
          selectedElemento.tipo !== 'polygon' &&
          selectedElemento.tipo !== 'door';
        const isExtOrBie = selectedElemento.tipo === 'extintor' || selectedElemento.tipo === 'bie';
        const isPuertaRf =
          selectedElemento.tipo === 'puerta-rf' || selectedElemento.tipo === 'puerta-corredera';
        const hasTipoPresets = isExtOrBie || isPuertaRf;
        const isNumerado = isEquipoNumerado(selectedElemento.tipo);
        const supportsTransform =
          selectedElemento.tipo !== 'text' &&
          selectedElemento.tipo !== 'pen' &&
          selectedElemento.tipo !== 'eraser';

        return (
          <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-2.5 space-y-2">
            {/* Fila 1: Identificador + Controles de color, giro, posición del número, aplicar y eliminar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-blue-200/70">
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-sm font-black tracking-wide shadow-2xs uppercase">
                  {isNumerado
                    ? formatCodigoEquipo(selectedElemento, elementos, prevSectionsElementos)
                    : selectedElemento.tipo === 'door'
                      ? 'Puerta'
                      : activeToolLabel || 'Elemento'}
                </span>
                {supportsCreateMove && (
                  <div className="inline-flex rounded-lg bg-white p-0.5 border border-blue-200">
                    <button
                      type="button"
                      onClick={() => {
                        setToolMode('create');
                        setSelectedId(null);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        toolMode === 'create'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      Crear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setToolMode('move');
                        setSelectedId(null);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        toolMode === 'move'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <MousePointer2 className="w-3 h-3" />
                      Mover
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {/* Girar y Voltear */}
                {supportsTransform && (
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-blue-900/75 leading-none pl-0.5">
                      Movimiento icono
                    </span>
                    <div className="inline-flex items-center gap-1 bg-white p-0.5 rounded-lg border border-blue-200">
                      <button
                        type="button"
                        onClick={() => handleRotateSelected(-45)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-blue-50 text-blue-700 rounded text-[11px] font-bold cursor-pointer"
                        title="Girar 45° a la izquierda"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotateSelected(45)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 hover:bg-blue-50 text-blue-700 rounded text-[11px] font-bold cursor-pointer"
                        title="Girar 45° a la derecha"
                      >
                        <RotateCw className="w-3 h-3" />
                        {selectedElemento.rotation ? `${selectedElemento.rotation}°` : 'Girar'}
                      </button>
                      <button
                        type="button"
                        onClick={handleFlipSelected}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 hover:bg-blue-50 text-blue-700 rounded text-[11px] font-bold cursor-pointer"
                        title="Dar la vuelta (voltear horizontalmente)"
                      >
                        <FlipHorizontal2 className="w-3 h-3" />
                        Voltear
                      </button>
                    </div>
                  </div>
                )}

                {/* Posición del número / etiqueta */}
                {isNumerado && (
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-blue-900/75 leading-none pl-0.5">
                      Posición etiqueta
                    </span>
                    <div className="inline-flex items-center gap-0.5 bg-white border border-blue-200 rounded-lg px-1.5 py-0.5" title="Posición del número respecto al equipo">
                      <span className="text-[10px] font-bold text-blue-900 mr-0.5">Nº:</span>
                      {(
                        [
                          { id: 'top', icon: ArrowUp, title: 'Número arriba' },
                          { id: 'bottom', icon: ArrowDown, title: 'Número abajo' },
                          { id: 'left', icon: ArrowLeft, title: 'Número izquierda' },
                          { id: 'right', icon: ArrowRight, title: 'Número derecha' }
                        ] as const
                      ).map((dir) => {
                        const DirIcon = dir.icon;
                        const activePos = selectedElemento.labelPos || 'bottom';
                        return (
                          <button
                            key={dir.id}
                            type="button"
                            onClick={() => handleSetSelectedLabelPos(dir.id)}
                            title={dir.title}
                            className={`p-0.5 rounded transition-colors cursor-pointer ${
                              activePos === dir.id
                                ? 'bg-blue-600 text-white'
                                : 'text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            <DirIcon className="w-3 h-3" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {supportsTextEdit && (
                  <button
                    type="button"
                    onClick={handleUpdateSelectedText}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-white rounded-lg text-[11px] font-bold cursor-pointer shrink-0 shadow-2xs transition-colors ${
                      appliedFeedback
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    {appliedFeedback ? 'Guardado' : 'Aplicar'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold cursor-pointer shrink-0"
                  title="Eliminar elemento seleccionado"
                >
                  <Trash2 className="w-3 h-3" />
                  Eliminar
                </button>
              </div>
            </div>

            {/* Fila 2: Tipo (desplegable) + Fechas (FF y UT/PH) + Señal en una sola línea compacta */}
            {(supportsTextEdit || isNumerado) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {supportsTextEdit && (
                  <>
                    <span className="text-[10px] font-bold text-blue-900 uppercase shrink-0">
                      {hasTipoPresets ? 'Tipo:' : selectedElemento.tipo === 'measure' ? 'Medida:' : 'Texto:'}
                    </span>
                    {hasTipoPresets ? (
                      (() => {
                        const presets =
                          selectedElemento.tipo === 'extintor'
                            ? EXTINTOR_PRESETS
                            : selectedElemento.tipo === 'bie'
                            ? BIE_PRESETS
                            : PUERTA_RF_PRESETS;
                        const isCustom = Boolean(editSelectedText) && !presets.includes(editSelectedText);
                        return (
                          <>
                            <select
                              value={presets.includes(editSelectedText) ? editSelectedText : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditSelectedText(val);
                                commitElementos(
                                  elementos.map((el) =>
                                    el.id === selectedElemento.id ? { ...el, text: val } : el
                                  )
                                );
                              }}
                              className="px-2 py-1 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                            >
                              <option value="">{isCustom ? 'Manual' : 'Tipo...'}</option>
                              {presets.map((preset) => (
                                <option key={preset} value={preset}>
                                  {preset}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={editSelectedText}
                              onChange={(e) => setEditSelectedText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleUpdateSelectedText();
                                }
                              }}
                              placeholder="Manual..."
                              className="w-20 sm:w-24 px-2 py-1 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                            />
                          </>
                        );
                      })()
                    ) : (
                      <input
                        type="text"
                        value={editSelectedText}
                        onChange={(e) => setEditSelectedText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUpdateSelectedText();
                          }
                        }}
                        placeholder={
                          selectedElemento.tipo === 'measure'
                            ? 'Medida (ej: 3,50 m)'
                            : 'Etiqueta / texto...'
                        }
                        className="flex-1 min-w-[140px] px-2 py-1 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </>
                )}

                {isExtOrBie && (
                  <>
                    <div className="flex items-center gap-1 bg-white/80 border border-blue-200/80 rounded-lg px-2 py-0.5">
                      <span className="text-[10px] font-bold text-blue-900 uppercase shrink-0">FF:</span>
                      <MonthYearSelect
                        value={editSelectedFf}
                        onChange={(v) => {
                          setEditSelectedFf(v);
                          commitElementos(
                            elementos.map((el) => (el.id === selectedElemento.id ? { ...el, ff: v } : el))
                          );
                        }}
                      />
                    </div>
                    {selectedElemento.tipo === 'extintor' ? (
                      <div className="flex items-center gap-1 bg-white/80 border border-blue-200/80 rounded-lg px-2 py-0.5">
                        <span className="text-[10px] font-bold text-blue-900 uppercase shrink-0">UT:</span>
                        <MonthYearSelect
                          value={editSelectedUt}
                          onChange={(v) => {
                            setEditSelectedUt(v);
                            commitElementos(
                              elementos.map((el) => (el.id === selectedElemento.id ? { ...el, ut: v } : el))
                            );
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-white/80 border border-blue-200/80 rounded-lg px-2 py-0.5">
                        <span className="text-[10px] font-bold text-blue-900 uppercase shrink-0">PH:</span>
                        <MonthYearSelect
                          value={editSelectedPh}
                          onChange={(v) => {
                            setEditSelectedPh(v);
                            commitElementos(
                              elementos.map((el) => (el.id === selectedElemento.id ? { ...el, ph: v } : el))
                            );
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                {isNumerado && (
                  <div className="flex items-center gap-1 bg-white/80 border border-blue-200/80 rounded-lg px-2 py-0.5">
                    <span className="text-[10px] font-bold text-blue-900 uppercase shrink-0">Señal:</span>
                    <select
                      value={editSelectedSenal}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditSelectedSenal(v);
                        commitElementos(
                          elementos.map((el) =>
                            el.id === selectedElemento.id ? { ...el, estadoSenal: v } : el
                          )
                        );
                      }}
                      className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="">Sin especificar</option>
                      {ESTADOS_SENAL.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Entrada inline de medida */}
      {pendingMeasure && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <Ruler className="w-4 h-4 text-amber-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={pendingMeasure.text}
            onChange={(e) => setPendingMeasure({ ...pendingMeasure, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmPendingMeasure();
              }
            }}
            placeholder="Escribe la medida (ej: 3,50 m)..."
            className="flex-1 px-2 py-1 bg-white border border-amber-300 rounded text-xs font-bold text-slate-800 focus:outline-none"
          />
          <button
            type="button"
            onClick={confirmPendingMeasure}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Poner medida
          </button>
        </div>
      )}

      {/* Entrada inline de texto */}
      {pendingText && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
          <Type className="w-4 h-4 text-blue-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={pendingText.text}
            onChange={(e) => setPendingText({ ...pendingText, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmPendingText();
              }
            }}
            placeholder="Etiqueta en plano (ej: BIE, EXT, Salida)..."
            className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded text-xs font-bold text-slate-800 focus:outline-none"
          />
          <button
            type="button"
            onClick={confirmPendingText}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Insertar
          </button>
        </div>
      )}

      {/* Lienzo con borde delimitador y soporte de Zoom */}
      <div
        className={`overflow-auto rounded-xl border-2 border-slate-400 bg-slate-100 ${
          isFullscreen ? 'flex-1 min-h-0 flex' : ''
        }`}
      >
        <div
          className={`relative bg-white ${
            isFullscreen ? 'max-w-6xl max-h-full m-auto' : ''
          } ${zoom < 1 && !isFullscreen ? 'mx-auto' : ''}`}
          style={{ width: `${zoom * 100}%`, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`w-full h-full block touch-none ${
              tool === 'select' || (toolMode === 'move' && supportsCreateMove)
                ? 'cursor-grab active:cursor-grabbing'
                : tool === 'text'
                ? 'cursor-text'
                : 'cursor-crosshair'
            }`}
          />
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none opacity-35"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-[10px] text-slate-500">
          Consejo: Usa <strong>Mover / Editar</strong> o el modo <strong>Mover</strong> de cada herramienta para desplazar o editar elementos.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {onGuardarNota && (
            <button
              type="button"
              disabled={isSavingNota}
              onClick={onGuardarNota}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
              title="Guardar la nota y sus planos sin cerrar el editor"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingNota ? 'Guardando...' : savedNotice ? '✓ Guardado' : 'Guardar nota'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadImage}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer transition-colors"
            title="Descargar imagen del plano con cajetín (PNG)"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar imagen
          </button>
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold cursor-pointer transition-colors"
            title="Borrar todo el plano"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Borrar plano
          </button>
        </div>
      </div>

      {confirmClearOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                ¿Borrar todo el plano?
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Esta acción eliminará todo el dibujo actual de esta zona y no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleClear();
                  setConfirmClearOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotaSeccionesEditor({
  secciones,
  onChange,
  cajetinMeta,
  onGuardarNota,
  isSavingNota,
  savedNotice,
  onVerReporte,
  onDescargarNotaPdf,
  isExportingPdf
}: NotaSeccionesEditorProps) {
  const [openCanvasIds, setOpenCanvasIds] = useState<Record<string, boolean>>({});

  const handleAddSeccion = () => {
    const nueva: NotaSeccionItem = {
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      titulo: '',
      contenidoHtml: '',
      dibujoDataUrl: '',
      planoElementos: []
    };
    onChange([...secciones, nueva]);
  };

  const handleUpdateSeccion = (id: string, patch: Partial<NotaSeccionItem>) => {
    onChange(secciones.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleRemoveSeccion = (id: string) => {
    onChange(secciones.filter((s) => s.id !== id));
  };

  const toggleCanvas = (id: string) => {
    setOpenCanvasIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            Zonas y planos
          </label>
          <p className="text-[11px] text-slate-500">
            Divide la nota en zonas (ej. Planta 1, Almacén) con texto formateado y croquis/plano.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onDescargarNotaPdf && secciones.length > 0 && (
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={onDescargarNotaPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Descargar PDF completo de la nota y sus planos"
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
            </button>
          )}
          {onVerReporte && secciones.length > 0 && (
            <button
              type="button"
              onClick={onVerReporte}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Ver y descargar reporte de elementos por zonas"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Reporte equipos
            </button>
          )}
          <button
            type="button"
            onClick={handleAddSeccion}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir zona / plano
          </button>
        </div>
      </div>

      {secciones.length > 0 && (
        <div className="space-y-3">
          {secciones.map((sec, idx) => {
            const canvasOpen = !!openCanvasIds[sec.id];
            return (
              <div
                key={sec.id}
                className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3 space-y-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2.5 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    Zona {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={sec.titulo}
                    onChange={(e) => handleUpdateSeccion(sec.id, { titulo: e.target.value })}
                    placeholder="Título de zona en negrita (ej: Planta 1, Almacén)..."
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => toggleCanvas(sec.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer shrink-0 ${
                      canvasOpen || sec.dibujoDataUrl
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Abrir o cerrar editor de plano y dibujo"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{sec.dibujoDataUrl ? 'Plano' : 'Dibujar plano'}</span>
                    {canvasOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSeccion(sec.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar zona"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <SeccionRichTextEditor
                  seccionId={sec.id}
                  value={sec.contenidoHtml}
                  onChange={(html) => handleUpdateSeccion(sec.id, { contenidoHtml: html })}
                />

                {!canvasOpen && sec.dibujoDataUrl && (
                  <div className="space-y-1.5">
                    <div
                      onClick={() => toggleCanvas(sec.id)}
                      className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 bg-white"
                      title="Clic para editar el plano"
                    >
                      <img
                        src={sec.dibujoDataUrl}
                        alt={`Plano ${sec.titulo || `Zona ${idx + 1}`}`}
                        className="w-full max-h-40 object-contain bg-white"
                      />
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-bold">
                        Clic para editar plano
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!sec.dibujoDataUrl) return;
                          const conCajetin = await exportarDataUrlConCajetin(
                            sec.dibujoDataUrl,
                            {
                              ...cajetinMeta,
                              seccionTitulo: sec.titulo?.trim()
                                ? `Zona ${idx + 1} ${sec.titulo.trim()}`
                                : `Zona ${idx + 1}`
                            },
                            sec.planoElementos
                          );
                          const link = document.createElement('a');
                          const slug = (sec.titulo || `zona-${idx + 1}`)
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/gi, '-')
                            .replace(/^-|-$/g, '');
                          link.href = conCajetin;
                          link.download = `plano-${slug || `zona-${idx + 1}`}.png`;
                          link.click();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        title="Descargar imagen de este plano con cajetín"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar imagen
                      </button>
                    </div>
                  </div>
                )}

                {canvasOpen && (
                  <SeccionPlanoCanvas
                    seccionTitulo={
                      sec.titulo?.trim()
                        ? `Zona ${idx + 1} ${sec.titulo.trim()}`
                        : `Zona ${idx + 1}`
                    }
                    cajetinMeta={cajetinMeta}
                    initialElementos={sec.planoElementos}
                    prevSectionsElementos={secciones
                      .slice(0, idx)
                      .flatMap((s) => s.planoElementos || [])}
                    initialDataUrl={sec.dibujoDataUrl}
                    initialSymbolSize={sec.planoSymbolSize}
                    onChange={(planoElementos, dibujoDataUrl, planoSymbolSize) =>
                      handleUpdateSeccion(sec.id, { planoElementos, dibujoDataUrl, planoSymbolSize })
                    }
                    onGuardarNota={onGuardarNota}
                    isSavingNota={isSavingNota}
                    savedNotice={savedNotice}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DESTACADO INFERIOR: REPORTE DE SISTEMAS Y EQUIPOS */}
      {onVerReporte && secciones.length > 0 && (() => {
        const resumen = buildReporteEquiposPorSecciones(secciones);
        return (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50 border-2 border-amber-400 rounded-2xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-black uppercase tracking-wide text-amber-950">
                    Reporte de Sistemas y Equipos
                  </span>
                  <span className="block text-[11px] font-medium text-amber-800/90">
                    {resumen.totalGeneral > 0
                      ? `${resumen.totalGeneral} equipos contabilizados en ${resumen.secciones.length} ${resumen.secciones.length === 1 ? 'zona' : 'zonas'}`
                      : 'Añade equipos en los planos para generar el recuento automático'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onVerReporte}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer shrink-0"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Ver / Descargar Reporte
              </button>
            </div>
            {resumen.resumenPorTipo.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-amber-300/70">
                {resumen.resumenPorTipo.map((r) => (
                  <span
                    key={r.tipoLabel}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-amber-300 text-[11px] font-black text-slate-800"
                  >
                    {r.tipoLabel}: <span className="text-red-600">{r.total} und.</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
