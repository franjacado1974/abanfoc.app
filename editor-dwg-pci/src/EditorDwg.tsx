import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  Save,
  LogOut,
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  Layers,
  Sun,
  Moon,
  RotateCcw,
  RotateCw,
  Check,
  X,
  Cable,
  Sparkles,
  Crosshair,
  AlertTriangle,
  FileCode2,
  Eye,
  EyeOff,
  Type,
  Pencil,
  Plus,
  Minus,
  ChevronDown,
  Flame,
  Square,
  Armchair,
  FlipHorizontal2,
  Spline as SplineIcon
} from 'lucide-react';
import {
  PCI_SYMBOL_CATALOG,
  ARCH_SYMBOL_CATALOG,
  FURNITURE_SYMBOL_CATALOG,
  ALL_SYMBOL_CATALOG,
  SHAPE_DRAW_CATALOG,
  PCI_CIRCUIT_CATALOG,
  PCI_COLOR_PALETTE,
  parseCadBuffer,
  exportModifiedDwgBuffer,
  createSampleArchitecturalDwg,
  getSymbolLocalPrimitives,
  computeWallPolygonPoints,
  getShapeBoundsAndScaledPoints,
  type PciSymbolKind,
  type PciCircuitKind,
  type ShapeDrawKind,
  type PciOverlayItem,
  type PlacedPciSymbol,
  type PlacedPciCable,
  type PlacedPciText,
  type PlacedShapeItem,
  type BaseDwgTextEdit,
  type BaseDwgObjectEdit,
  type CadRenderText,
  type CadBaseObjectMeta,
  type ParsedCadPlan
} from './services/dwgPciEngine';

type EditorTool =
  | { mode: 'select' }
  | { mode: 'pan' }
  | { mode: 'text' }
  | { mode: 'symbol'; kind: PciSymbolKind }
  | { mode: 'shape'; shapeKind: ShapeDrawKind }
  | { mode: 'cable'; circuit: PciCircuitKind };

type DropdownKey = 'pci' | 'formas' | 'mobiliario' | 'cableado' | null;

interface CameraState {
  cx: number;
  cy: number;
  zoom: number;
}

interface EditorSnapshot {
  items: PciOverlayItem[];
  baseTextEdits: Record<string, BaseDwgTextEdit>;
  baseObjectEdits: Record<number, BaseDwgObjectEdit>;
}

interface TextModalState {
  mode: 'create' | 'edit-overlay' | 'edit-base';
  x: number;
  y: number;
  targetId?: string;
  initialText: string;
}

interface ResizeBoxScreen {
  centerCadX: number;
  centerCadY: number;
  cornersScreen: Array<[number, number]>;
}

interface FileSystemWritableStreamLike {
  write: (data: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandleLike {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableStreamLike>;
}

function SymbolPreviewSvg({ kind, color }: { kind: PciSymbolKind; color: string }) {
  const prims = useMemo(() => getSymbolLocalPrimitives(kind), [kind]);
  return (
    <svg viewBox="-1.6 -1.45 3.2 2.9" className="w-7 h-7 shrink-0">
      {prims.map((p, idx) => {
        if (p.kind === 'line') {
          return (
            <line
              key={idx}
              x1={p.x1}
              y1={-p.y1}
              x2={p.x2}
              y2={-p.y2}
              stroke={color}
              strokeWidth={0.14}
              strokeLinecap="round"
            />
          );
        }
        if (p.kind === 'circle') {
          return (
            <circle
              key={idx}
              cx={p.cx}
              cy={-p.cy}
              r={p.r}
              fill="none"
              stroke={color}
              strokeWidth={0.14}
            />
          );
        }
        if (p.kind === 'filled_circle') {
          return <circle key={idx} cx={p.cx} cy={-p.cy} r={p.r} fill={color} />;
        }
        if (p.kind === 'poly') {
          const pts = p.points.map((pt) => `${pt.x},${-pt.y}`).join(' ');
          return p.closed ? (
            <polygon
              key={idx}
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth={0.14}
              strokeLinejoin="round"
            />
          ) : (
            <polyline
              key={idx}
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth={0.14}
              strokeLinejoin="round"
            />
          );
        }
        if (p.kind === 'solid') {
          const pts = p.points.map((pt) => `${pt.x},${-pt.y}`).join(' ');
          return <polygon key={idx} points={pts} fill={color} />;
        }
        if (p.kind === 'arc') {
          const segs: string[] = [];
          const steps = 14;
          for (let i = 0; i <= steps; i++) {
            const a = p.startRad + ((p.endRad - p.startRad) * i) / steps;
            const x = p.cx + Math.cos(a) * p.r;
            const y = -(p.cy + Math.sin(a) * p.r);
            segs.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`);
          }
          return (
            <path
              key={idx}
              d={segs.join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={0.14}
              strokeLinecap="round"
            />
          );
        }
        if (p.kind === 'text') {
          return (
            <text
              key={idx}
              x={p.x}
              y={-p.y + p.height * 0.34}
              textAnchor="middle"
              fill={color}
              fontSize={p.height * 0.95}
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              {p.text}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}

function ShapePreviewIcon({ kind }: { kind: ShapeDrawKind }) {
  if (kind === 'wall') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 7h14v10" />
        <path d="M3 11h10v6" />
        <path d="M3 7v4M17 17h-4" />
      </svg>
    );
  }
  if (kind === 'freehand') {
    return <SplineIcon className="w-5 h-5 text-slate-800" />;
  }
  if (kind === 'rect_shape') {
    return <Square className="w-5 h-5 text-slate-800" />;
  }
  if (kind === 'circle_shape') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 19L12 7l8 5" />
    </svg>
  );
}

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function estimateTextCadBox(
  text: string,
  heightCad: number,
  hAlign: 'left' | 'center' | 'right'
): { minLocalX: number; maxLocalX: number; minLocalY: number; maxLocalY: number } {
  const lines = text.split('\n');
  const maxChars = Math.max(1, ...lines.map((l) => l.length));
  const width = Math.max(heightCad * 1.1, maxChars * heightCad * 0.62);
  const totalH = lines.length * heightCad * 1.2;

  let minLocalX = 0;
  let maxLocalX = width;
  if (hAlign === 'center') {
    minLocalX = -width * 0.5;
    maxLocalX = width * 0.5;
  } else if (hAlign === 'right') {
    minLocalX = -width;
    maxLocalX = 0;
  }

  const minLocalY = -totalH * 0.55;
  const maxLocalY = heightCad * 1.15;
  return { minLocalX, maxLocalX, minLocalY, maxLocalY };
}

function isPointInsideRotatedText(
  cadX: number,
  cadY: number,
  anchorX: number,
  anchorY: number,
  text: string,
  heightCad: number,
  rotationRad: number,
  hAlign: 'left' | 'center' | 'right',
  extraPadCad: number
): boolean {
  const dx = cadX - anchorX;
  const dy = cadY - anchorY;
  const cos = Math.cos(-rotationRad);
  const sin = Math.sin(-rotationRad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const box = estimateTextCadBox(text, heightCad, hAlign);
  return (
    lx >= box.minLocalX - extraPadCad &&
    lx <= box.maxLocalX + extraPadCad &&
    ly >= box.minLocalY - extraPadCad &&
    ly <= box.maxLocalY + extraPadCad
  );
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
    .join('')}`;
}

export default function EditorDwg() {
  // Archivo DWG cargado
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandleLike | null>(null);
  const [plan, setPlan] = useState<ParsedCadPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isDragOverFile, setIsDragOverFile] = useState(false);

  // Estado de vista CAD
  const [darkTheme, setDarkTheme] = useState(true);
  const [hiddenLayers, setHiddenLayers] = useState<Record<string, boolean>>({});
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [camera, setCamera] = useState<CameraState>({ cx: 10, cy: 7, zoom: 30 });
  const [cursorCad, setCursorCad] = useState<{ x: number; y: number } | null>(null);
  const [hoverResizeCorner, setHoverResizeCorner] = useState<boolean>(false);

  // Desplegable abierto actualmente en la barra lateral
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);

  // Herramienta activa y configuración por defecto
  const [tool, setTool] = useState<EditorTool>({ mode: 'symbol', kind: 'extintor' });
  const [defaultScale, setDefaultScale] = useState<number>(1);
  const [defaultRotation, setDefaultRotation] = useState<number>(0);
  const [defaultMirrorX, setDefaultMirrorX] = useState<boolean>(false);
  const [defaultLabel, setDefaultLabel] = useState<string>('');
  const [customColorHex, setCustomColorHex] = useState<string>('#dc2626');
  const [customAci, setCustomAci] = useState<number>(1);
  const [customIsDefaultWB, setCustomIsDefaultWB] = useState<boolean>(false);
  const [cableDashed, setCableDashed] = useState<boolean>(false);
  const [wallThicknessFactor, setWallThicknessFactor] = useState<number>(1);
  const [orthoMode, setOrthoMode] = useState<boolean>(false);
  const [snapSymbols, setSnapSymbols] = useState<boolean>(true);

  // Elementos añadidos + ediciones de textos DWG + ediciones de objetos DWG + Historial
  const [items, setItems] = useState<PciOverlayItem[]>([]);
  const [baseTextEdits, setBaseTextEdits] = useState<Record<string, BaseDwgTextEdit>>({});
  const [baseObjectEdits, setBaseObjectEdits] = useState<Record<number, BaseDwgObjectEdit>>({});
  const [history, setHistory] = useState<EditorSnapshot[]>([
    { items: [], baseTextEdits: {}, baseObjectEdits: {} }
  ]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Selección activa
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBaseTextId, setSelectedBaseTextId] = useState<string | null>(null);
  const [selectedBaseObjHandle, setSelectedBaseObjHandle] = useState<number | null>(null);

  // Trazados multipunto en curso (cable, pared doble o polilínea recta) y trazos por arrastre (mano alzada, rectángulo, círculo)
  const [draftPolyPts, setDraftPolyPts] = useState<Array<{ x: number; y: number }>>([]);
  const [dragShapeDraft, setDragShapeDraft] = useState<Array<{ x: number; y: number }> | null>(
    null
  );
  const [snappedTarget, setSnappedTarget] = useState<{ x: number; y: number } | null>(null);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);

  // Modal rápido para crear o editar texto
  const [textModal, setTextModal] = useState<TextModalState | null>(null);
  const [textModalValue, setTextModalValue] = useState<string>('');
  const textModalInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textModal) {
      setTimeout(() => {
        textModalInputRef.current?.focus();
        textModalInputRef.current?.select();
      }, 20);
    }
  }, [textModal]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 960, h: 620 });

  const activeResizeBoxRef = useRef<ResizeBoxScreen | null>(null);

  const interactionRef = useRef<{
    type:
      | 'none'
      | 'pan'
      | 'drag-overlay-xy'
      | 'drag-overlay-shape'
      | 'drag-base-text'
      | 'drag-base-object'
      | 'drag-cable-vertex'
      | 'resize-selection'
      | 'draw-drag-shape';
    startScreenX: number;
    startScreenY: number;
    startCamCx: number;
    startCamCy: number;
    itemId?: string;
    objHandle?: number;
    vertexIdx?: number;
    origX?: number;
    origY?: number;
    origPoints?: Array<{ x: number; y: number }>;
    centerCadX?: number;
    centerCadY?: number;
    startDistCad?: number;
    startScaleVal?: number;
    moved?: boolean;
  }>({
    type: 'none',
    startScreenX: 0,
    startScreenY: 0,
    startCamCx: 0,
    startCamCy: 0
  });

  const spacePressedRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3400);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedBaseTextId(null);
    setSelectedBaseObjHandle(null);
  }, []);

  const commitSnapshot = useCallback(
    (
      nextItems: PciOverlayItem[],
      nextBaseEdits: Record<string, BaseDwgTextEdit>,
      nextObjEdits: Record<number, BaseDwgObjectEdit>
    ) => {
      setItems(nextItems);
      setBaseTextEdits(nextBaseEdits);
      setBaseObjectEdits(nextObjEdits);
      setHasUnsavedChanges(true);
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIdx + 1);
        const updated = [
          ...sliced,
          { items: nextItems, baseTextEdits: nextBaseEdits, baseObjectEdits: nextObjEdits }
        ];
        return updated.length > 60 ? updated.slice(updated.length - 60) : updated;
      });
      setHistoryIdx((prev) => Math.min(59, prev + 1));
    },
    [historyIdx]
  );

  const commitItems = useCallback(
    (nextItems: PciOverlayItem[]) => {
      commitSnapshot(nextItems, baseTextEdits, baseObjectEdits);
    },
    [baseObjectEdits, baseTextEdits, commitSnapshot]
  );

  const commitBaseTextEdits = useCallback(
    (nextBaseEdits: Record<string, BaseDwgTextEdit>) => {
      commitSnapshot(items, nextBaseEdits, baseObjectEdits);
    },
    [baseObjectEdits, commitSnapshot, items]
  );

  const commitBaseObjectEdits = useCallback(
    (nextObjEdits: Record<number, BaseDwgObjectEdit>) => {
      commitSnapshot(items, baseTextEdits, nextObjEdits);
    },
    [baseTextEdits, commitSnapshot, items]
  );

  const handleUndo = useCallback(() => {
    if (draftPolyPts.length > 0) {
      setDraftPolyPts((prev) => prev.slice(0, -1));
      return;
    }
    if (historyIdx > 0) {
      const nextIdx = historyIdx - 1;
      const snap = history[nextIdx];
      setHistoryIdx(nextIdx);
      setItems(snap.items);
      setBaseTextEdits(snap.baseTextEdits);
      setBaseObjectEdits(snap.baseObjectEdits);
      clearSelection();
    }
  }, [clearSelection, draftPolyPts.length, history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const nextIdx = historyIdx + 1;
      const snap = history[nextIdx];
      setHistoryIdx(nextIdx);
      setItems(snap.items);
      setBaseTextEdits(snap.baseTextEdits);
      setBaseObjectEdits(snap.baseObjectEdits);
      clearSelection();
    }
  }, [clearSelection, history, historyIdx]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setCanvasSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [plan]);

  const fitPlanToView = useCallback(
    (targetPlan: ParsedCadPlan, viewW?: number, viewH?: number) => {
      const w = viewW || canvasSize.w || 960;
      const h = viewH || canvasSize.h || 620;
      const spanX = Math.max(0.01, targetPlan.bounds.maxX - targetPlan.bounds.minX);
      const spanY = Math.max(0.01, targetPlan.bounds.maxY - targetPlan.bounds.minY);
      const pad = 0.86;
      const zoom = Math.min((w * pad) / spanX, (h * pad) / spanY);
      setCamera({
        cx: (targetPlan.bounds.minX + targetPlan.bounds.maxX) * 0.5,
        cy: (targetPlan.bounds.minY + targetPlan.bounds.maxY) * 0.5,
        zoom: Math.max(1e-5, zoom)
      });
    },
    [canvasSize.h, canvasSize.w]
  );

  const loadFromArrayBuffer = useCallback(
    (buffer: ArrayBuffer, name: string, handle: FileSystemFileHandleLike | null = null) => {
      setIsLoading(true);
      setErrorMsg(null);
      setTimeout(() => {
        try {
          const parsed = parseCadBuffer(buffer, name);
          const initHidden: Record<string, boolean> = {};
          for (const l of parsed.layers) {
            if (!l.visible) initHidden[l.name] = true;
          }
          setRawBuffer(buffer);
          setFileHandle(handle);
          setPlan(parsed);
          setHiddenLayers(initHidden);
          setItems([]);
          setBaseTextEdits({});
          setBaseObjectEdits({});
          setHistory([{ items: [], baseTextEdits: {}, baseObjectEdits: {} }]);
          setHistoryIdx(0);
          clearSelection();
          setDraftPolyPts([]);
          setDragShapeDraft(null);
          setHasUnsavedChanges(false);

          const el = containerRef.current;
          const rect = el?.getBoundingClientRect();
          fitPlanToView(parsed, rect?.width || 960, rect?.height || 620);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Error desconocido al leer el archivo DWG.';
          setErrorMsg(
            `No se pudo abrir el archivo "${name}". Verifica que sea un archivo DWG o DXF válido. (${message})`
          );
        } finally {
          setIsLoading(false);
        }
      }, 25);
    },
    [clearSelection, fitPlanToView]
  );

  const handleOpenWithPicker = async () => {
    const win = window as unknown as {
      showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike[]>;
    };
    if (typeof win.showOpenFilePicker === 'function') {
      try {
        const handles = await win.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'Planos CAD (.dwg, .dxf)',
              accept: {
                'application/acad': ['.dwg', '.dxf'],
                'image/vnd.dwg': ['.dwg'],
                'application/dxf': ['.dxf'],
                'image/vnd.dxf': ['.dxf']
              }
            },
            {
              description: 'AutoCAD Drawing (.dwg)',
              accept: { 'application/acad': ['.dwg'] }
            },
            {
              description: 'Drawing Exchange Format (.dxf)',
              accept: { 'application/dxf': ['.dxf'], 'text/plain': ['.dxf'] }
            }
          ]
        });
        if (handles && handles[0]) {
          const file = await handles[0].getFile();
          const buf = await file.arrayBuffer();
          loadFromArrayBuffer(buf, file.name, handles[0]);
          return;
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const buf = await file.arrayBuffer();
    loadFromArrayBuffer(buf, file.name, null);
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    loadFromArrayBuffer(buf, file.name, null);
  };

  const handleLoadSampleDwg = () => {
    const sampleBuf = createSampleArchitecturalDwg();
    loadFromArrayBuffer(sampleBuf, 'Plano_Ejemplo_PCI.dwg', null);
  };

  const handleSwitchSpace = (spaceBlockName: string) => {
    if (!rawBuffer || !plan) return;
    try {
      const parsed = parseCadBuffer(rawBuffer, plan.fileName, spaceBlockName);
      setPlan(parsed);
      clearSelection();
      fitPlanToView(parsed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar espacio';
      setErrorMsg(msg);
    }
  };

  // Selección de herramientas desde los desplegables
  const selectSymbolTool = (kind: PciSymbolKind) => {
    setDraftPolyPts([]);
    setDragShapeDraft(null);
    clearSelection();
    setOpenDropdown(null);
    const def = ALL_SYMBOL_CATALOG.find((s) => s.kind === kind);
    if (def) {
      setCustomColorHex(def.defaultColorHex);
      setCustomAci(def.defaultAci);
      setCustomIsDefaultWB(!!def.defaultIsWB);
      setDefaultScale(def.recommendedScale ?? 1);
    }
    setTool({ mode: 'symbol', kind });
  };

  const selectShapeTool = (shapeKind: ShapeDrawKind) => {
    setDraftPolyPts([]);
    setDragShapeDraft(null);
    clearSelection();
    setOpenDropdown(null);
    setCustomColorHex('#1e293b');
    setCustomAci(7);
    setCustomIsDefaultWB(true);
    setCableDashed(false);
    setTool({ mode: 'shape', shapeKind });
  };

  const selectCableTool = (circuit: PciCircuitKind) => {
    setDraftPolyPts([]);
    setDragShapeDraft(null);
    clearSelection();
    setOpenDropdown(null);
    const def = PCI_CIRCUIT_CATALOG.find((c) => c.kind === circuit);
    if (def) {
      setCustomColorHex(def.defaultColorHex);
      setCustomAci(def.defaultAci);
      setCustomIsDefaultWB(false);
      setCableDashed(def.defaultDashed);
    }
    setTool({ mode: 'cable', circuit });
  };

  const selectTextTool = () => {
    setDraftPolyPts([]);
    setDragShapeDraft(null);
    clearSelection();
    setOpenDropdown(null);
    setDefaultScale(1);
    setTool({ mode: 'text' });
  };

  // Conversión coordenadas CAD <-> Pantalla
  const cadToScreen = useCallback(
    (x: number, y: number): [number, number] => {
      return [
        (x - camera.cx) * camera.zoom + canvasSize.w * 0.5,
        canvasSize.h * 0.5 - (y - camera.cy) * camera.zoom
      ];
    },
    [camera.cx, camera.cy, camera.zoom, canvasSize.h, canvasSize.w]
  );

  const screenToCad = useCallback(
    (sx: number, sy: number): { x: number; y: number } => {
      return {
        x: (sx - canvasSize.w * 0.5) / camera.zoom + camera.cx,
        y: (canvasSize.h * 0.5 - sy) / camera.zoom + camera.cy
      };
    },
    [camera.cx, camera.cy, camera.zoom, canvasSize.h, canvasSize.w]
  );

  const transformBasePoint = useCallback(
    (rootHandle: number, px: number, py: number): [number, number] => {
      if (!rootHandle) return [px, py];
      const ed = baseObjectEdits[rootHandle];
      if (!ed) return [px, py];
      return [
        ed.origCx + (px - ed.origCx) * ed.scale + ed.dx,
        ed.origCy + (py - ed.origCy) * ed.scale + ed.dy
      ];
    },
    [baseObjectEdits]
  );

  const isMultiPointTool =
    tool.mode === 'cable' ||
    (tool.mode === 'shape' && (tool.shapeKind === 'wall' || tool.shapeKind === 'line_shape'));

  const isDragDrawTool =
    tool.mode === 'shape' &&
    (tool.shapeKind === 'freehand' ||
      tool.shapeKind === 'rect_shape' ||
      tool.shapeKind === 'circle_shape');

  const resolveCadPoint = useCallback(
    (rawX: number, rawY: number, shiftKey: boolean): { x: number; y: number; snapped: boolean } => {
      let x = rawX;
      let y = rawY;
      let snapped = false;

      if (snapSymbols && (tool.mode === 'cable' || interactionRef.current.type === 'drag-cable-vertex')) {
        const snapPxRadius = 16;
        const maxCadDist = snapPxRadius / camera.zoom;
        let bestDist = maxCadDist;
        for (const it of items) {
          if (it.type === 'symbol') {
            const d = Math.hypot(it.x - rawX, it.y - rawY);
            if (d < bestDist) {
              bestDist = d;
              x = it.x;
              y = it.y;
              snapped = true;
            }
          }
        }
      }

      if (!snapped && (orthoMode || shiftKey) && draftPolyPts.length > 0 && isMultiPointTool) {
        const last = draftPolyPts[draftPolyPts.length - 1];
        if (Math.abs(x - last.x) > Math.abs(y - last.y)) {
          y = last.y;
        } else {
          x = last.x;
        }
      }

      return { x, y, snapped };
    },
    [camera.zoom, draftPolyPts, isMultiPointTool, items, orthoMode, snapSymbols, tool.mode]
  );

  // Finalizar trazado multipunto (cable, pared doble o línea/polilínea)
  const finishMultiPointDraft = useCallback(() => {
    if (draftPolyPts.length < 2) {
      setDraftPolyPts([]);
      return;
    }

    if (tool.mode === 'cable') {
      const newCable: PlacedPciCable = {
        id: `cab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'cable',
        circuit: tool.circuit,
        points: draftPolyPts,
        dashed: cableDashed,
        colorHex: customColorHex,
        aciColor: customAci,
        widthFactor: tool.circuit === 'rociadores' ? 1.6 : 1.0,
        label: defaultLabel.trim()
      };
      commitItems([...items, newCable]);
      setDraftPolyPts([]);
      clearSelection();
      setSelectedId(newCable.id);
      return;
    }

    if (tool.mode === 'shape' && (tool.shapeKind === 'wall' || tool.shapeKind === 'line_shape')) {
      const newShape: PlacedShapeItem = {
        id: `shp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'shape',
        shapeKind: tool.shapeKind,
        points: draftPolyPts,
        scale: 1,
        thicknessFactor: wallThicknessFactor,
        dashed: cableDashed,
        colorHex: customColorHex,
        aciColor: customAci,
        isDefaultWhiteBlack: customIsDefaultWB
      };
      commitItems([...items, newShape]);
      setDraftPolyPts([]);
      clearSelection();
      setSelectedId(newShape.id);
    }
  }, [
    cableDashed,
    clearSelection,
    commitItems,
    customAci,
    customColorHex,
    customIsDefaultWB,
    defaultLabel,
    draftPolyPts,
    items,
    tool,
    wallThicknessFactor
  ]);

  // Selección activa resuelta
  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  const selectedBaseTextOriginal = useMemo<CadRenderText | null>(() => {
    if (!plan || !selectedBaseTextId) return null;
    return plan.texts.find((t) => t.id === selectedBaseTextId) ?? null;
  }, [plan, selectedBaseTextId]);

  const selectedBaseObjMeta = useMemo<CadBaseObjectMeta | null>(() => {
    if (!plan || !selectedBaseObjHandle) return null;
    return plan.baseObjects[selectedBaseObjHandle] ?? null;
  }, [plan, selectedBaseObjHandle]);

  const getEffectiveBaseObj = useCallback(
    (meta: CadBaseObjectMeta) => {
      const ed = baseObjectEdits[meta.handle];
      const scale = ed?.scale ?? 1;
      const dx = ed?.dx ?? 0;
      const dy = ed?.dy ?? 0;
      return {
        scale,
        dx,
        dy,
        deleted: !!ed?.deleted,
        isModified: !!ed,
        cx: meta.cx + dx,
        cy: meta.cy + dy,
        minX: meta.cx + (meta.minX - meta.cx) * scale + dx,
        maxX: meta.cx + (meta.maxX - meta.cx) * scale + dx,
        minY: meta.cy + (meta.minY - meta.cy) * scale + dy,
        maxY: meta.cy + (meta.maxY - meta.cy) * scale + dy
      };
    },
    [baseObjectEdits]
  );

  const upsertBaseObjectEdit = useCallback(
    (meta: CadBaseObjectMeta, patch: Partial<BaseDwgObjectEdit>, recordHistory = true) => {
      const curr = baseObjectEdits[meta.handle] ?? {
        handle: meta.handle,
        origCx: meta.cx,
        origCy: meta.cy,
        scale: 1,
        dx: 0,
        dy: 0
      };
      const updated: BaseDwgObjectEdit = { ...curr, ...patch };
      const nextMap = { ...baseObjectEdits, [meta.handle]: updated };
      if (recordHistory) {
        commitBaseObjectEdits(nextMap);
      } else {
        setBaseObjectEdits(nextMap);
        setHasUnsavedChanges(true);
      }
    },
    [baseObjectEdits, commitBaseObjectEdits]
  );

  const restoreSelectedBaseObject = useCallback(() => {
    if (!selectedBaseObjHandle) return;
    const nextMap = { ...baseObjectEdits };
    delete nextMap[selectedBaseObjHandle];
    commitBaseObjectEdits(nextMap);
    showToast('Objeto original del DWG restaurado.');
  }, [baseObjectEdits, commitBaseObjectEdits, selectedBaseObjHandle, showToast]);

  const getEffectiveBaseText = useCallback(
    (orig: CadRenderText) => {
      const parentObjEdit = orig.rootHandle ? baseObjectEdits[orig.rootHandle] : undefined;
      if (parentObjEdit?.deleted) {
        return {
          x: orig.x,
          y: orig.y,
          text: orig.text,
          height: orig.height,
          rotationDeg: 0,
          rotationRad: orig.rotationRad,
          rgb: orig.rgb,
          colorHex: rgbToHex(orig.rgb),
          isDefaultWhiteBlack: orig.isDefaultWhiteBlack,
          deleted: true,
          isModified: false
        };
      }

      const [parentX, parentY] = transformBasePoint(orig.rootHandle, orig.x, orig.y);
      const parentScale = parentObjEdit?.scale ?? 1;

      const edit = baseTextEdits[orig.id];
      if (!edit) {
        return {
          x: parentX,
          y: parentY,
          text: orig.text,
          height: orig.height * parentScale,
          rotationDeg: Math.round(((orig.rotationRad * 180) / Math.PI) * 10) / 10,
          rotationRad: orig.rotationRad,
          rgb: orig.rgb,
          colorHex: rgbToHex(orig.rgb),
          isDefaultWhiteBlack: orig.isDefaultWhiteBlack,
          deleted: false,
          isModified: false
        };
      }
      const rgbFromHex = (): [number, number, number] => {
        if (!edit.colorHex) return orig.rgb;
        const c = edit.colorHex.replace('#', '');
        if (c.length === 6) {
          return [
            parseInt(c.slice(0, 2), 16) || 0,
            parseInt(c.slice(2, 4), 16) || 0,
            parseInt(c.slice(4, 6), 16) || 0
          ];
        }
        return orig.rgb;
      };
      return {
        x: edit.x,
        y: edit.y,
        text: edit.text,
        height: edit.height,
        rotationDeg: edit.rotationDeg,
        rotationRad: (edit.rotationDeg * Math.PI) / 180,
        rgb: rgbFromHex(),
        colorHex: edit.colorHex ?? rgbToHex(orig.rgb),
        isDefaultWhiteBlack: edit.isDefaultWhiteBlack ?? orig.isDefaultWhiteBlack,
        deleted: !!edit.deleted,
        isModified: true
      };
    },
    [baseObjectEdits, baseTextEdits, transformBasePoint]
  );

  const upsertBaseTextEdit = useCallback(
    (orig: CadRenderText, patch: Partial<BaseDwgTextEdit>, recordHistory = true) => {
      const curr = baseTextEdits[orig.id] ?? {
        id: orig.id,
        entityHandle: orig.entityHandle,
        invMatrix: orig.invMatrix,
        matrixScale: orig.matrixScale,
        baseRotationRad: orig.baseRotationRad,
        x: orig.x,
        y: orig.y,
        text: orig.text,
        height: orig.height,
        rotationDeg: Math.round(((orig.rotationRad * 180) / Math.PI) * 10) / 10,
        isDefaultWhiteBlack: orig.isDefaultWhiteBlack
      };
      const updated: BaseDwgTextEdit = { ...curr, ...patch };
      const nextMap = { ...baseTextEdits, [orig.id]: updated };
      if (recordHistory) {
        commitBaseTextEdits(nextMap);
      } else {
        setBaseTextEdits(nextMap);
        setHasUnsavedChanges(true);
      }
    },
    [baseTextEdits, commitBaseTextEdits]
  );

  const restoreSelectedBaseText = useCallback(() => {
    if (!selectedBaseTextId) return;
    const nextMap = { ...baseTextEdits };
    delete nextMap[selectedBaseTextId];
    commitBaseTextEdits(nextMap);
    showToast('Texto original del DWG restaurado.');
  }, [baseTextEdits, commitBaseTextEdits, selectedBaseTextId, showToast]);

  const updateSelectedItem = useCallback(
    (updater: (item: PciOverlayItem) => PciOverlayItem) => {
      if (!selectedId) return;
      const next = items.map((it) => (it.id === selectedId ? updater(it) : it));
      commitItems(next);
    },
    [commitItems, items, selectedId]
  );

  const deleteSelection = useCallback(() => {
    if (selectedId) {
      commitItems(items.filter((it) => it.id !== selectedId));
      setSelectedId(null);
      return;
    }
    if (selectedBaseTextOriginal) {
      upsertBaseTextEdit(selectedBaseTextOriginal, { deleted: true }, true);
      setSelectedBaseTextId(null);
      return;
    }
    if (selectedBaseObjMeta) {
      upsertBaseObjectEdit(selectedBaseObjMeta, { deleted: true }, true);
      setSelectedBaseObjHandle(null);
    }
  }, [
    commitItems,
    items,
    selectedBaseObjMeta,
    selectedBaseTextOriginal,
    selectedId,
    upsertBaseObjectEdit,
    upsertBaseTextEdit
  ]);

  const duplicateSelection = useCallback(() => {
    if (!plan) return;
    const offset = plan.baseSymbolRadius * 1.3;

    if (selectedItem) {
      if (selectedItem.type === 'symbol') {
        const copy: PlacedPciSymbol = {
          ...selectedItem,
          id: `sym_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          x: selectedItem.x + offset,
          y: selectedItem.y - offset
        };
        commitItems([...items, copy]);
        setSelectedId(copy.id);
      } else if (selectedItem.type === 'text') {
        const copy: PlacedPciText = {
          ...selectedItem,
          id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          x: selectedItem.x + offset,
          y: selectedItem.y - offset
        };
        commitItems([...items, copy]);
        setSelectedId(copy.id);
      } else if (selectedItem.type === 'shape') {
        const copy: PlacedShapeItem = {
          ...selectedItem,
          id: `shp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          points: selectedItem.points.map((p) => ({ x: p.x + offset, y: p.y - offset }))
        };
        commitItems([...items, copy]);
        setSelectedId(copy.id);
      } else {
        const copy: PlacedPciCable = {
          ...selectedItem,
          id: `cab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          points: selectedItem.points.map((p) => ({ x: p.x + offset, y: p.y - offset }))
        };
        commitItems([...items, copy]);
        setSelectedId(copy.id);
      }
      return;
    }

    if (selectedBaseTextOriginal) {
      const eff = getEffectiveBaseText(selectedBaseTextOriginal);
      const baseTextH = Math.max(0.0001, plan.baseSymbolRadius * 0.55);
      const copy: PlacedPciText = {
        id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'text',
        x: eff.x + offset,
        y: eff.y - offset,
        text: eff.text,
        scale: Math.max(0.2, Math.min(8, eff.height / baseTextH)),
        rotationDeg: eff.rotationDeg,
        colorHex: eff.colorHex,
        aciColor: eff.isDefaultWhiteBlack ? 7 : 1,
        isDefaultWhiteBlack: eff.isDefaultWhiteBlack
      };
      commitItems([...items, copy]);
      clearSelection();
      setSelectedId(copy.id);
    }
  }, [
    clearSelection,
    commitItems,
    getEffectiveBaseText,
    items,
    plan,
    selectedBaseTextOriginal,
    selectedItem
  ]);

  const handleConfirmTextModal = () => {
    if (!textModal || !plan) return;
    const trimmed = textModalValue.trim();

    if (textModal.mode === 'create') {
      if (!trimmed) {
        setTextModal(null);
        return;
      }
      const newTxt: PlacedPciText = {
        id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'text',
        x: textModal.x,
        y: textModal.y,
        text: trimmed,
        scale: defaultScale,
        rotationDeg: defaultRotation,
        colorHex: customColorHex,
        aciColor: customAci,
        isDefaultWhiteBlack: customIsDefaultWB
      };
      commitItems([...items, newTxt]);
      clearSelection();
      setSelectedId(newTxt.id);
      setTextModal(null);
      return;
    }

    if (textModal.mode === 'edit-overlay' && textModal.targetId) {
      if (!trimmed) {
        commitItems(items.filter((it) => it.id !== textModal.targetId));
        setSelectedId(null);
      } else {
        commitItems(
          items.map((it) =>
            it.id === textModal.targetId
              ? it.type === 'text'
                ? { ...it, text: trimmed }
                : it.type === 'symbol' || it.type === 'cable'
                ? { ...it, label: trimmed }
                : it
              : it
          )
        );
      }
      setTextModal(null);
      return;
    }

    if (textModal.mode === 'edit-base' && textModal.targetId) {
      const orig = plan.texts.find((t) => t.id === textModal.targetId);
      if (orig) {
        if (!trimmed) {
          upsertBaseTextEdit(orig, { deleted: true }, true);
          setSelectedBaseTextId(null);
        } else {
          upsertBaseTextEdit(orig, { text: trimmed }, true);
        }
      }
      setTextModal(null);
    }
  };

  // Valores efectivos de escala / tamaño
  const effectiveSelectedBaseText = useMemo(
    () => (selectedBaseTextOriginal ? getEffectiveBaseText(selectedBaseTextOriginal) : null),
    [getEffectiveBaseText, selectedBaseTextOriginal]
  );

  const effectiveSelectedBaseObj = useMemo(
    () => (selectedBaseObjMeta ? getEffectiveBaseObj(selectedBaseObjMeta) : null),
    [getEffectiveBaseObj, selectedBaseObjMeta]
  );

  const baseRefHeight = plan ? Math.max(0.0001, plan.baseSymbolRadius * 0.55) : 1;

  const activeScaleValue = useMemo(() => {
    if (
      selectedItem?.type === 'symbol' ||
      selectedItem?.type === 'text' ||
      selectedItem?.type === 'shape'
    ) {
      return selectedItem.scale;
    }
    if (effectiveSelectedBaseText) {
      return Math.max(0.1, Math.min(12, effectiveSelectedBaseText.height / baseRefHeight));
    }
    if (effectiveSelectedBaseObj) {
      return effectiveSelectedBaseObj.scale;
    }
    return defaultScale;
  }, [baseRefHeight, defaultScale, effectiveSelectedBaseObj, effectiveSelectedBaseText, selectedItem]);

  const activeRotationValue = useMemo(() => {
    if (selectedItem?.type === 'symbol' || selectedItem?.type === 'text') {
      return selectedItem.rotationDeg;
    }
    if (effectiveSelectedBaseText) {
      return effectiveSelectedBaseText.rotationDeg;
    }
    return defaultRotation;
  }, [defaultRotation, effectiveSelectedBaseText, selectedItem]);

  const applyScaleToCurrentSelection = useCallback(
    (nextScale: number, recordHistory: boolean) => {
      const clamped = Math.max(0.15, Math.min(12, Number(nextScale.toFixed(3))));
      if (
        selectedItem?.type === 'symbol' ||
        selectedItem?.type === 'text' ||
        selectedItem?.type === 'shape'
      ) {
        if (recordHistory) {
          updateSelectedItem((it) =>
            it.type === 'symbol' || it.type === 'text' || it.type === 'shape'
              ? { ...it, scale: clamped }
              : it
          );
        } else {
          setItems((prev) =>
            prev.map((it) =>
              it.id === selectedItem.id &&
              (it.type === 'symbol' || it.type === 'text' || it.type === 'shape')
                ? { ...it, scale: clamped }
                : it
            )
          );
          setHasUnsavedChanges(true);
        }
        return;
      }
      if (selectedBaseTextOriginal) {
        upsertBaseTextEdit(
          selectedBaseTextOriginal,
          { height: Math.max(0.0001, baseRefHeight * clamped) },
          recordHistory
        );
        return;
      }
      if (selectedBaseObjMeta) {
        upsertBaseObjectEdit(selectedBaseObjMeta, { scale: clamped }, recordHistory);
        return;
      }
      setDefaultScale(clamped);
    },
    [
      baseRefHeight,
      selectedBaseObjMeta,
      selectedBaseTextOriginal,
      selectedItem,
      updateSelectedItem,
      upsertBaseObjectEdit,
      upsertBaseTextEdit
    ]
  );

  const handleRotationChange = (nextDeg: number) => {
    if (selectedItem?.type === 'symbol' || selectedItem?.type === 'text') {
      updateSelectedItem((it) =>
        it.type === 'symbol' || it.type === 'text' ? { ...it, rotationDeg: nextDeg } : it
      );
      return;
    }
    if (selectedBaseTextOriginal) {
      upsertBaseTextEdit(selectedBaseTextOriginal, { rotationDeg: nextDeg }, true);
      return;
    }
    setDefaultRotation(nextDeg);
  };

  const handleToggleMirrorX = () => {
    if (selectedItem?.type === 'symbol') {
      updateSelectedItem((it) =>
        it.type === 'symbol' ? { ...it, mirrorX: !it.mirrorX } : it
      );
    } else {
      setDefaultMirrorX((v) => !v);
    }
  };

  // Atajos de teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (textModal) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.code === 'Space' && !isInput) {
        spacePressedRef.current = true;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isInput) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !isInput) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (!isInput && (selectedId || selectedBaseTextId || selectedBaseObjHandle)) {
        if (e.key === '+' || (e.key === '=' && (e.ctrlKey || e.shiftKey))) {
          e.preventDefault();
          applyScaleToCurrentSelection(activeScaleValue * 1.18, true);
          return;
        }
        if (e.key === '-' && !e.ctrlKey) {
          e.preventDefault();
          applyScaleToCurrentSelection(activeScaleValue / 1.18, true);
          return;
        }
      }
      if (e.key === 'Enter' && !isInput && draftPolyPts.length >= 2) {
        e.preventDefault();
        finishMultiPointDraft();
        return;
      }
      if (e.key === 'Backspace' && !isInput && draftPolyPts.length > 0) {
        e.preventDefault();
        setDraftPolyPts((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        if (draftPolyPts.length > 0) {
          setDraftPolyPts([]);
        } else if (dragShapeDraft) {
          setDragShapeDraft(null);
        } else {
          clearSelection();
          setTool({ mode: 'select' });
        }
        return;
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !isInput &&
        (selectedId || selectedBaseTextId || selectedBaseObjHandle)
      ) {
        e.preventDefault();
        deleteSelection();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    activeScaleValue,
    applyScaleToCurrentSelection,
    clearSelection,
    deleteSelection,
    draftPolyPts.length,
    dragShapeDraft,
    finishMultiPointDraft,
    handleRedo,
    handleUndo,
    selectedBaseObjHandle,
    selectedBaseTextId,
    selectedId,
    textModal
  ]);

  // Hit-testing completo incluyendo paredes, mano alzada y formas dibujadas
  const hitTestAll = useCallback(
    (
      cadX: number,
      cadY: number
    ):
      | { kind: 'overlay'; item: PciOverlayItem; vertexIdx?: number }
      | { kind: 'base-text'; orig: CadRenderText }
      | { kind: 'base-object'; meta: CadBaseObjectMeta }
      | null => {
      if (!plan) return null;
      const strokeTol = 9 / camera.zoom;
      const padCad = 6 / camera.zoom;

      if (selectedItem?.type === 'cable') {
        for (let i = 0; i < selectedItem.points.length; i++) {
          const pt = selectedItem.points[i];
          if (Math.hypot(cadX - pt.x, cadY - pt.y) <= 12 / camera.zoom) {
            return { kind: 'overlay', item: selectedItem, vertexIdx: i };
          }
        }
      }

      // 1. Símbolos (PCI, puertas, mobiliario) y textos nuevos
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.type === 'text') {
          const hCad = plan.baseSymbolRadius * 0.55 * it.scale;
          if (
            isPointInsideRotatedText(
              cadX,
              cadY,
              it.x,
              it.y,
              it.text,
              hCad,
              (it.rotationDeg * Math.PI) / 180,
              'center',
              padCad
            )
          ) {
            return { kind: 'overlay', item: it };
          }
        } else if (it.type === 'symbol') {
          const rad = plan.baseSymbolRadius * it.scale * 1.25;
          if (Math.hypot(cadX - it.x, cadY - it.y) <= Math.max(rad, 10 / camera.zoom)) {
            return { kind: 'overlay', item: it };
          }
        }
      }

      // 2. Paredes, trazos a mano alzada y formas geométricas creadas
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.type !== 'shape') continue;
        const { scaledPoints, scaledRadius } = getShapeBoundsAndScaledPoints(it);

        if (it.shapeKind === 'circle_shape' && scaledPoints.length >= 1) {
          const distC = Math.hypot(cadX - scaledPoints[0].x, cadY - scaledPoints[0].y);
          if (Math.abs(distC - scaledRadius) <= strokeTol * 1.4) {
            return { kind: 'overlay', item: it };
          }
          continue;
        }

        if (scaledPoints.length < 2) continue;

        if (it.shapeKind === 'rect_shape') {
          const p1 = scaledPoints[0];
          const p2 = scaledPoints[scaledPoints.length - 1];
          const corners = [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p1.y },
            { x: p2.x, y: p2.y },
            { x: p1.x, y: p2.y }
          ];
          for (let s = 0; s < 4; s++) {
            const c1 = corners[s];
            const c2 = corners[(s + 1) % 4];
            if (pointToSegmentDist(cadX, cadY, c1.x, c1.y, c2.x, c2.y) <= strokeTol * 1.4) {
              return { kind: 'overlay', item: it };
            }
          }
          continue;
        }

        const wallTol =
          it.shapeKind === 'wall'
            ? Math.max(
                strokeTol * 1.4,
                plan.baseSymbolRadius * 0.25 * (it.thicknessFactor || 1) * (it.scale || 1)
              )
            : strokeTol * 1.4;

        for (let s = 0; s < scaledPoints.length - 1; s++) {
          const p1 = scaledPoints[s];
          const p2 = scaledPoints[s + 1];
          if (pointToSegmentDist(cadX, cadY, p1.x, p1.y, p2.x, p2.y) <= wallTol) {
            return { kind: 'overlay', item: it };
          }
        }
      }

      // 3. Cables añadidos
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.type === 'cable') {
          for (let s = 0; s < it.points.length - 1; s++) {
            const p1 = it.points[s];
            const p2 = it.points[s + 1];
            if (pointToSegmentDist(cadX, cadY, p1.x, p1.y, p2.x, p2.y) <= strokeTol * 1.25) {
              return { kind: 'overlay', item: it };
            }
          }
        }
      }

      // 4. Textos existentes del DWG
      for (let i = plan.texts.length - 1; i >= 0; i--) {
        const orig = plan.texts[i];
        if (orig.isNestedInBlock || hiddenLayers[orig.layer]) continue;
        const eff = getEffectiveBaseText(orig);
        if (eff.deleted) continue;
        if (
          isPointInsideRotatedText(
            cadX,
            cadY,
            eff.x,
            eff.y,
            eff.text,
            eff.height,
            eff.rotationRad,
            orig.hAlign,
            padCad
          )
        ) {
          return { kind: 'base-text', orig };
        }
      }

      // 5. Objetos / bloques existentes del DWG
      const candidateHandles = new Set<number>();

      for (const cir of plan.circles) {
        if (!cir.rootHandle || hiddenLayers[cir.layer]) continue;
        const meta = plan.baseObjects[cir.rootHandle];
        if (!meta) continue;
        const effObj = getEffectiveBaseObj(meta);
        if (effObj.deleted) continue;
        const [tcx, tcy] = transformBasePoint(cir.rootHandle, cir.cx, cir.cy);
        const tr = cir.r * effObj.scale;
        const distCenter = Math.hypot(cadX - tcx, cadY - tcy);
        if (
          Math.abs(distCenter - tr) <= strokeTol ||
          (tr < strokeTol * 2 && distCenter <= tr + strokeTol)
        ) {
          candidateHandles.add(cir.rootHandle);
        }
      }

      for (const poly of plan.polylines) {
        if (!poly.rootHandle || hiddenLayers[poly.layer]) continue;
        const meta = plan.baseObjects[poly.rootHandle];
        if (!meta) continue;
        const effObj = getEffectiveBaseObj(meta);
        if (effObj.deleted) continue;
        if (
          cadX < effObj.minX - strokeTol ||
          cadX > effObj.maxX + strokeTol ||
          cadY < effObj.minY - strokeTol ||
          cadY > effObj.maxY + strokeTol
        ) {
          continue;
        }
        const pts = poly.points;
        const segCount = poly.closed ? pts.length / 2 : pts.length / 2 - 1;
        for (let s = 0; s < segCount; s++) {
          const i1 = s * 2;
          const i2 = ((s + 1) % (pts.length / 2)) * 2;
          const [x1, y1] = transformBasePoint(poly.rootHandle, pts[i1], pts[i1 + 1]);
          const [x2, y2] = transformBasePoint(poly.rootHandle, pts[i2], pts[i2 + 1]);
          if (pointToSegmentDist(cadX, cadY, x1, y1, x2, y2) <= strokeTol) {
            candidateHandles.add(poly.rootHandle);
            break;
          }
        }
      }

      if (candidateHandles.size > 0) {
        let bestMeta: CadBaseObjectMeta | null = null;
        let bestSpan = Infinity;
        for (const h of candidateHandles) {
          const m = plan.baseObjects[h];
          if (!m) continue;
          const span = Math.hypot(m.maxX - m.minX, m.maxY - m.minY);
          if (span < bestSpan) {
            bestSpan = span;
            bestMeta = m;
          }
        }
        if (bestMeta) {
          return { kind: 'base-object', meta: bestMeta };
        }
      }

      return null;
    },
    [
      camera.zoom,
      getEffectiveBaseObj,
      getEffectiveBaseText,
      hiddenLayers,
      items,
      plan,
      selectedItem,
      transformBasePoint
    ]
  );

  const isNearResizeHandleScreen = (sx: number, sy: number): ResizeBoxScreen | null => {
    const box = activeResizeBoxRef.current;
    if (!box) return null;
    for (const [hx, hy] of box.cornersScreen) {
      if (Math.hypot(sx - hx, sy - hy) <= 11) {
        return box;
      }
    }
    return null;
  };

  // Zoom con rueda
  const handleCanvasWheel = useCallback(
    (e: WheelEvent) => {
      if (!plan) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      setCamera((prev) => {
        const worldX = (sx - canvasSize.w * 0.5) / prev.zoom + prev.cx;
        const worldY = (canvasSize.h * 0.5 - sy) / prev.zoom + prev.cy;
        const nextZoom = Math.max(1e-6, Math.min(1e7, prev.zoom * factor));
        const nextCx = worldX - (sx - canvasSize.w * 0.5) / nextZoom;
        const nextCy = worldY - (canvasSize.h * 0.5 - sy) / nextZoom;
        return { cx: nextCx, cy: nextCy, zoom: nextZoom };
      });
    },
    [canvasSize.h, canvasSize.w, plan]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleCanvasWheel);
  }, [handleCanvasWheel]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!plan) return;
    setOpenDropdown(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (
      e.button === 1 ||
      (e.button === 2 && draftPolyPts.length === 0) ||
      tool.mode === 'pan' ||
      spacePressedRef.current
    ) {
      e.preventDefault();
      interactionRef.current = {
        type: 'pan',
        startScreenX: sx,
        startScreenY: sy,
        startCamCx: camera.cx,
        startCamCy: camera.cy,
        moved: false
      };
      return;
    }

    if (e.button === 2 && draftPolyPts.length >= 2) {
      e.preventDefault();
      finishMultiPointDraft();
      return;
    }

    if (e.button !== 0) return;

    const rawCad = screenToCad(sx, sy);

    // 1. Comprobar tiradores de esquina de redimensionamiento
    const resizeHit = isNearResizeHandleScreen(sx, sy);
    if (resizeHit) {
      const startDist = Math.max(
        1e-5,
        Math.hypot(rawCad.x - resizeHit.centerCadX, rawCad.y - resizeHit.centerCadY)
      );
      interactionRef.current = {
        type: 'resize-selection',
        startScreenX: sx,
        startScreenY: sy,
        startCamCx: camera.cx,
        startCamCy: camera.cy,
        centerCadX: resizeHit.centerCadX,
        centerCadY: resizeHit.centerCadY,
        startDistCad: startDist,
        startScaleVal: activeScaleValue,
        moved: false
      };
      return;
    }

    if (tool.mode === 'select') {
      const hit = hitTestAll(rawCad.x, rawCad.y);
      if (hit?.kind === 'overlay') {
        clearSelection();
        setSelectedId(hit.item.id);
        if (hit.item.type === 'cable' && typeof hit.vertexIdx === 'number') {
          interactionRef.current = {
            type: 'drag-cable-vertex',
            startScreenX: sx,
            startScreenY: sy,
            startCamCx: camera.cx,
            startCamCy: camera.cy,
            itemId: hit.item.id,
            vertexIdx: hit.vertexIdx,
            moved: false
          };
        } else if (hit.item.type === 'symbol' || hit.item.type === 'text') {
          interactionRef.current = {
            type: 'drag-overlay-xy',
            startScreenX: sx,
            startScreenY: sy,
            startCamCx: camera.cx,
            startCamCy: camera.cy,
            itemId: hit.item.id,
            origX: hit.item.x,
            origY: hit.item.y,
            moved: false
          };
        } else if (hit.item.type === 'shape') {
          interactionRef.current = {
            type: 'drag-overlay-shape',
            startScreenX: sx,
            startScreenY: sy,
            startCamCx: camera.cx,
            startCamCy: camera.cy,
            itemId: hit.item.id,
            origPoints: hit.item.points.map((p) => ({ ...p })),
            moved: false
          };
        }
      } else if (hit?.kind === 'base-text') {
        const eff = getEffectiveBaseText(hit.orig);
        clearSelection();
        setSelectedBaseTextId(hit.orig.id);
        interactionRef.current = {
          type: 'drag-base-text',
          startScreenX: sx,
          startScreenY: sy,
          startCamCx: camera.cx,
          startCamCy: camera.cy,
          itemId: hit.orig.id,
          origX: eff.x,
          origY: eff.y,
          moved: false
        };
      } else if (hit?.kind === 'base-object') {
        const effObj = getEffectiveBaseObj(hit.meta);
        clearSelection();
        setSelectedBaseObjHandle(hit.meta.handle);
        interactionRef.current = {
          type: 'drag-base-object',
          startScreenX: sx,
          startScreenY: sy,
          startCamCx: camera.cx,
          startCamCy: camera.cy,
          objHandle: hit.meta.handle,
          origX: effObj.dx,
          origY: effObj.dy,
          moved: false
        };
      } else {
        clearSelection();
        interactionRef.current = {
          type: 'pan',
          startScreenX: sx,
          startScreenY: sy,
          startCamCx: camera.cx,
          startCamCy: camera.cy,
          moved: false
        };
      }
      return;
    }

    // Dibujo por arrastre: Mano alzada, Rectángulo o Círculo
    if (isDragDrawTool) {
      setDragShapeDraft([{ x: rawCad.x, y: rawCad.y }]);
      interactionRef.current = {
        type: 'draw-drag-shape',
        startScreenX: sx,
        startScreenY: sy,
        startCamCx: camera.cx,
        startCamCy: camera.cy,
        moved: false
      };
      return;
    }

    if (tool.mode === 'text') {
      const initial = defaultLabel.trim();
      setTextModalValue(initial);
      setTextModal({
        mode: 'create',
        x: rawCad.x,
        y: rawCad.y,
        initialText: initial
      });
      return;
    }

    if (tool.mode === 'symbol') {
      const def = ALL_SYMBOL_CATALOG.find((s) => s.kind === tool.kind) ?? ALL_SYMBOL_CATALOG[0];
      const newSym: PlacedPciSymbol = {
        id: `sym_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'symbol',
        kind: tool.kind,
        x: rawCad.x,
        y: rawCad.y,
        scale: defaultScale,
        rotationDeg: defaultRotation,
        mirrorX: defaultMirrorX,
        colorHex: customColorHex || def.defaultColorHex,
        aciColor: customAci || def.defaultAci,
        isDefaultWhiteBlack: customIsDefaultWB,
        label: defaultLabel.trim()
      };
      commitItems([...items, newSym]);
      clearSelection();
      setSelectedId(newSym.id);
      return;
    }

    // Herramientas multipunto: Cableado, Pared doble o Línea/Polilínea recta
    if (isMultiPointTool) {
      const pt = resolveCadPoint(rawCad.x, rawCad.y, e.shiftKey);
      if (draftPolyPts.length > 0) {
        const last = draftPolyPts[draftPolyPts.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < 3 / camera.zoom) {
          return;
        }
      }
      setDraftPolyPts((prev) => [...prev, { x: pt.x, y: pt.y }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!plan) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const rawCad = screenToCad(sx, sy);
    const resolved = resolveCadPoint(rawCad.x, rawCad.y, e.shiftKey);
    setCursorCad({ x: resolved.x, y: resolved.y });
    setSnappedTarget(resolved.snapped ? { x: resolved.x, y: resolved.y } : null);

    const inter = interactionRef.current;

    if (inter.type === 'none') {
      setHoverResizeCorner(!!isNearResizeHandleScreen(sx, sy));
      return;
    }

    if (inter.type === 'draw-drag-shape' && tool.mode === 'shape') {
      inter.moved = true;
      if (tool.shapeKind === 'freehand') {
        const minStepCad = 3.5 / camera.zoom;
        setDragShapeDraft((prev) => {
          if (!prev || prev.length === 0) return [{ x: rawCad.x, y: rawCad.y }];
          const last = prev[prev.length - 1];
          if (Math.hypot(rawCad.x - last.x, rawCad.y - last.y) < minStepCad) return prev;
          return [...prev, { x: rawCad.x, y: rawCad.y }];
        });
      } else {
        setDragShapeDraft((prev) => {
          const start = prev?.[0] ?? { x: rawCad.x, y: rawCad.y };
          return [start, { x: rawCad.x, y: rawCad.y }];
        });
      }
      return;
    }

    if (inter.type === 'resize-selection') {
      inter.moved = true;
      const cx = inter.centerCadX ?? 0;
      const cy = inter.centerCadY ?? 0;
      const currDist = Math.max(1e-5, Math.hypot(rawCad.x - cx, rawCad.y - cy));
      const ratio = currDist / Math.max(1e-5, inter.startDistCad ?? 1);
      const nextScale = (inter.startScaleVal ?? 1) * ratio;
      applyScaleToCurrentSelection(nextScale, false);
      return;
    }

    if (inter.type === 'pan') {
      const dx = sx - inter.startScreenX;
      const dy = sy - inter.startScreenY;
      if (Math.hypot(dx, dy) > 2) inter.moved = true;
      setCamera((prev) => ({
        ...prev,
        cx: inter.startCamCx - dx / prev.zoom,
        cy: inter.startCamCy + dy / prev.zoom
      }));
      return;
    }

    if (inter.type === 'drag-overlay-xy' && inter.itemId) {
      const dx = (sx - inter.startScreenX) / camera.zoom;
      const dy = -(sy - inter.startScreenY) / camera.zoom;
      if (Math.hypot(sx - inter.startScreenX, sy - inter.startScreenY) > 2) {
        inter.moved = true;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === inter.itemId && (it.type === 'symbol' || it.type === 'text')
            ? { ...it, x: (inter.origX ?? it.x) + dx, y: (inter.origY ?? it.y) + dy }
            : it
        )
      );
      return;
    }

    if (inter.type === 'drag-overlay-shape' && inter.itemId && inter.origPoints) {
      const dx = (sx - inter.startScreenX) / camera.zoom;
      const dy = -(sy - inter.startScreenY) / camera.zoom;
      if (Math.hypot(sx - inter.startScreenX, sy - inter.startScreenY) > 2) {
        inter.moved = true;
      }
      const basePts = inter.origPoints;
      setItems((prev) =>
        prev.map((it) =>
          it.id === inter.itemId && it.type === 'shape'
            ? { ...it, points: basePts.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
            : it
        )
      );
      return;
    }

    if (inter.type === 'drag-base-text' && inter.itemId) {
      const dx = (sx - inter.startScreenX) / camera.zoom;
      const dy = -(sy - inter.startScreenY) / camera.zoom;
      if (Math.hypot(sx - inter.startScreenX, sy - inter.startScreenY) > 2) {
        inter.moved = true;
      }
      const orig = plan.texts.find((t) => t.id === inter.itemId);
      if (orig) {
        upsertBaseTextEdit(
          orig,
          {
            x: (inter.origX ?? orig.x) + dx,
            y: (inter.origY ?? orig.y) + dy
          },
          false
        );
      }
      return;
    }

    if (inter.type === 'drag-base-object' && inter.objHandle) {
      const dx = (sx - inter.startScreenX) / camera.zoom;
      const dy = -(sy - inter.startScreenY) / camera.zoom;
      if (Math.hypot(sx - inter.startScreenX, sy - inter.startScreenY) > 2) {
        inter.moved = true;
      }
      const meta = plan.baseObjects[inter.objHandle];
      if (meta) {
        upsertBaseObjectEdit(
          meta,
          {
            dx: (inter.origX ?? 0) + dx,
            dy: (inter.origY ?? 0) + dy
          },
          false
        );
      }
      return;
    }

    if (inter.type === 'drag-cable-vertex' && inter.itemId && typeof inter.vertexIdx === 'number') {
      inter.moved = true;
      const vIdx = inter.vertexIdx;
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== inter.itemId || it.type !== 'cable') return it;
          const nextPts = it.points.map((p, idx) =>
            idx === vIdx ? { x: resolved.x, y: resolved.y } : p
          );
          return { ...it, points: nextPts };
        })
      );
    }
  };

  const handleMouseUp = () => {
    const inter = interactionRef.current;

    if (inter.type === 'draw-drag-shape' && tool.mode === 'shape' && dragShapeDraft) {
      if (dragShapeDraft.length >= 2) {
        const pStart = dragShapeDraft[0];
        const pEnd = dragShapeDraft[dragShapeDraft.length - 1];
        const dist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

        if (tool.shapeKind === 'circle_shape' && dist > 2 / camera.zoom) {
          const newCir: PlacedShapeItem = {
            id: `shp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: 'shape',
            shapeKind: 'circle_shape',
            points: [pStart],
            radius: dist,
            scale: 1,
            dashed: cableDashed,
            colorHex: customColorHex,
            aciColor: customAci,
            isDefaultWhiteBlack: customIsDefaultWB
          };
          commitItems([...items, newCir]);
          clearSelection();
          setSelectedId(newCir.id);
        } else if (tool.shapeKind === 'rect_shape' && dist > 2 / camera.zoom) {
          const newRect: PlacedShapeItem = {
            id: `shp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: 'shape',
            shapeKind: 'rect_shape',
            points: [pStart, pEnd],
            scale: 1,
            dashed: cableDashed,
            colorHex: customColorHex,
            aciColor: customAci,
            isDefaultWhiteBlack: customIsDefaultWB
          };
          commitItems([...items, newRect]);
          clearSelection();
          setSelectedId(newRect.id);
        } else if (tool.shapeKind === 'freehand' && dragShapeDraft.length >= 2) {
          const newFree: PlacedShapeItem = {
            id: `shp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: 'shape',
            shapeKind: 'freehand',
            points: dragShapeDraft,
            scale: 1,
            dashed: cableDashed,
            colorHex: customColorHex,
            aciColor: customAci,
            isDefaultWhiteBlack: customIsDefaultWB
          };
          commitItems([...items, newFree]);
          clearSelection();
          setSelectedId(newFree.id);
        }
      }
      setDragShapeDraft(null);
    } else if (
      (inter.type === 'drag-overlay-xy' ||
        inter.type === 'drag-overlay-shape' ||
        inter.type === 'drag-base-text' ||
        inter.type === 'drag-base-object' ||
        inter.type === 'drag-cable-vertex' ||
        inter.type === 'resize-selection') &&
      inter.moved
    ) {
      commitSnapshot(items, baseTextEdits, baseObjectEdits);
    }

    interactionRef.current = {
      type: 'none',
      startScreenX: 0,
      startScreenY: 0,
      startCamCx: camera.cx,
      startCamCy: camera.cy
    };
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!plan) return;
    if (isMultiPointTool && draftPolyPts.length >= 2) {
      finishMultiPointDraft();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const rawCad = screenToCad(e.clientX - rect.left, e.clientY - rect.top);
    const hit = hitTestAll(rawCad.x, rawCad.y);

    if (hit?.kind === 'overlay') {
      if (hit.item.type === 'text') {
        clearSelection();
        setSelectedId(hit.item.id);
        setTextModalValue(hit.item.text);
        setTextModal({
          mode: 'edit-overlay',
          x: hit.item.x,
          y: hit.item.y,
          targetId: hit.item.id,
          initialText: hit.item.text
        });
      } else if (hit.item.type === 'symbol') {
        clearSelection();
        setSelectedId(hit.item.id);
        setTextModalValue(hit.item.label);
        setTextModal({
          mode: 'edit-overlay',
          x: hit.item.x,
          y: hit.item.y,
          targetId: hit.item.id,
          initialText: hit.item.label
        });
      }
      return;
    }

    if (hit?.kind === 'base-text') {
      const eff = getEffectiveBaseText(hit.orig);
      clearSelection();
      setSelectedBaseTextId(hit.orig.id);
      setTextModalValue(eff.text);
      setTextModal({
        mode: 'edit-base',
        x: eff.x,
        y: eff.y,
        targetId: hit.orig.id,
        initialText: eff.text
      });
    }
  };

  // ============================================================================
  // RENDERIZADO DEL PLANO DWG + PAREDES + FORMAS + MOBILIARIO + PCI EN CANVAS 2D
  // ============================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(canvasSize.w * dpr));
    canvas.height = Math.max(1, Math.floor(canvasSize.h * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    activeResizeBoxRef.current = null;

    ctx.fillStyle = darkTheme ? '#0b1120' : '#ffffff';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    const viewMinX = camera.cx - (canvasSize.w * 0.65) / camera.zoom;
    const viewMaxX = camera.cx + (canvasSize.w * 0.65) / camera.zoom;
    const viewMinY = camera.cy - (canvasSize.h * 0.65) / camera.zoom;
    const viewMaxY = camera.cy + (canvasSize.h * 0.65) / camera.zoom;

    const getCadStrokeStyle = (
      rgb: [number, number, number],
      isDefaultWB: boolean,
      isHighlightedObj = false
    ): string => {
      if (isHighlightedObj) return '#f59e0b';
      if (isDefaultWB) {
        return darkTheme ? '#e2e8f0' : '#1e293b';
      }
      if (!darkTheme && rgb[0] > 225 && rgb[1] > 225 && rgb[2] > 200) {
        return '#475569';
      }
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    };

    const resolveOverlayColor = (colorHex: string, isWB?: boolean): string => {
      if (isWB) return darkTheme ? '#e2e8f0' : '#1e293b';
      return colorHex;
    };

    const drawSelectionFrameWithHandles = (
      centerCadX: number,
      centerCadY: number,
      cornersScreen: Array<[number, number]>
    ) => {
      activeResizeBoxRef.current = { centerCadX, centerCadY, cornersScreen };

      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.10)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      cornersScreen.forEach(([sx, sy], idx) => {
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      for (const [hx, hy] of cornersScreen) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.rect(hx - 5.5, hy - 5.5, 11, 11);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawRotatedTextSelectionHandles = (
      anchorX: number,
      anchorY: number,
      text: string,
      heightCad: number,
      rotRad: number,
      hAlign: 'left' | 'center' | 'right'
    ) => {
      const box = estimateTextCadBox(text, heightCad, hAlign);
      const pad = Math.max(heightCad * 0.25, 6 / camera.zoom);
      const cornersLocal = [
        [box.minLocalX - pad, box.minLocalY - pad],
        [box.maxLocalX + pad, box.minLocalY - pad],
        [box.maxLocalX + pad, box.maxLocalY + pad],
        [box.minLocalX - pad, box.maxLocalY + pad]
      ];
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);
      const cornersScreen: Array<[number, number]> = cornersLocal.map(([lx, ly]) => {
        const wx = anchorX + lx * cos - ly * sin;
        const wy = anchorY + lx * sin + ly * cos;
        return cadToScreen(wx, wy);
      });
      const midLx = (box.minLocalX + box.maxLocalX) * 0.5;
      const midLy = (box.minLocalY + box.maxLocalY) * 0.5;
      const centerCadX = anchorX + midLx * cos - midLy * sin;
      const centerCadY = anchorY + midLx * sin + midLy * cos;
      drawSelectionFrameWithHandles(centerCadX, centerCadY, cornersScreen);
    };

    // 1. Sólidos del plano base
    for (const sol of plan.solids) {
      if (hiddenLayers[sol.layer]) continue;
      if (sol.rootHandle && baseObjectEdits[sol.rootHandle]?.deleted) continue;
      const pts = sol.points;
      if (pts.length < 6) continue;
      const isSelObj = !!sol.rootHandle && sol.rootHandle === selectedBaseObjHandle;
      ctx.fillStyle = getCadStrokeStyle(sol.rgb, sol.isDefaultWhiteBlack, isSelObj);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        const [wx, wy] = transformBasePoint(sol.rootHandle, pts[i], pts[i + 1]);
        const [sx, sy] = cadToScreen(wx, wy);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    }

    // 2. Polilíneas / Líneas / Arcos del plano base
    for (const poly of plan.polylines) {
      if (hiddenLayers[poly.layer]) continue;
      if (poly.rootHandle && baseObjectEdits[poly.rootHandle]?.deleted) continue;
      const pts = poly.points;
      if (pts.length < 4) continue;
      const isSelObj = !!poly.rootHandle && poly.rootHandle === selectedBaseObjHandle;
      ctx.lineWidth = isSelObj ? 2.4 : 1.05;
      ctx.strokeStyle = getCadStrokeStyle(poly.rgb, poly.isDefaultWhiteBlack, isSelObj);
      ctx.beginPath();
      const [wx0, wy0] = transformBasePoint(poly.rootHandle, pts[0], pts[1]);
      const [sx0, sy0] = cadToScreen(wx0, wy0);
      ctx.moveTo(sx0, sy0);
      for (let i = 2; i < pts.length; i += 2) {
        const [wx, wy] = transformBasePoint(poly.rootHandle, pts[i], pts[i + 1]);
        const [sx, sy] = cadToScreen(wx, wy);
        ctx.lineTo(sx, sy);
      }
      if (poly.closed) ctx.closePath();
      ctx.stroke();
    }

    // 3. Círculos del plano base
    for (const cir of plan.circles) {
      if (hiddenLayers[cir.layer]) continue;
      const objEd = cir.rootHandle ? baseObjectEdits[cir.rootHandle] : undefined;
      if (objEd?.deleted) continue;
      const [wx, wy] = transformBasePoint(cir.rootHandle, cir.cx, cir.cy);
      const wr = cir.r * (objEd?.scale ?? 1);
      if (
        wx + wr < viewMinX ||
        wx - wr > viewMaxX ||
        wy + wr < viewMinY ||
        wy - wr > viewMaxY
      ) {
        continue;
      }
      const [sx, sy] = cadToScreen(wx, wy);
      const sr = wr * camera.zoom;
      if (sr < 0.35) continue;
      const isSelObj = !!cir.rootHandle && cir.rootHandle === selectedBaseObjHandle;
      ctx.lineWidth = isSelObj ? 2.4 : 1.05;
      ctx.strokeStyle = getCadStrokeStyle(cir.rgb, cir.isDefaultWhiteBlack, isSelObj);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (selectedBaseObjMeta && effectiveSelectedBaseObj && !effectiveSelectedBaseObj.deleted) {
      const pad = Math.max(plan.baseSymbolRadius * 0.15, 7 / camera.zoom);
      const minX = effectiveSelectedBaseObj.minX - pad;
      const maxX = effectiveSelectedBaseObj.maxX + pad;
      const minY = effectiveSelectedBaseObj.minY - pad;
      const maxY = effectiveSelectedBaseObj.maxY + pad;
      drawSelectionFrameWithHandles(effectiveSelectedBaseObj.cx, effectiveSelectedBaseObj.cy, [
        cadToScreen(minX, minY),
        cadToScreen(maxX, minY),
        cadToScreen(maxX, maxY),
        cadToScreen(minX, maxY)
      ]);
    }

    // 4. Textos originales del DWG
    for (const orig of plan.texts) {
      if (hiddenLayers[orig.layer]) continue;
      const eff = getEffectiveBaseText(orig);
      if (eff.deleted) continue;

      const pxH = eff.height * camera.zoom;
      if (pxH < 3.2 || pxH > 900) continue;
      if (
        eff.x < viewMinX - eff.height * 25 ||
        eff.x > viewMaxX + eff.height * 25 ||
        eff.y < viewMinY - eff.height * 12 ||
        eff.y > viewMaxY + eff.height * 12
      ) {
        continue;
      }

      if (orig.id === selectedBaseTextId) {
        drawRotatedTextSelectionHandles(
          eff.x,
          eff.y,
          eff.text,
          eff.height,
          eff.rotationRad,
          orig.hAlign
        );
      }

      const [sx, sy] = cadToScreen(eff.x, eff.y);
      const isPartOfSelBlock = !!orig.rootHandle && orig.rootHandle === selectedBaseObjHandle;
      ctx.save();
      ctx.translate(sx, sy);
      if (eff.rotationRad) ctx.rotate(-eff.rotationRad);
      ctx.fillStyle = getCadStrokeStyle(eff.rgb, eff.isDefaultWhiteBlack, isPartOfSelBlock);
      ctx.font = `${Math.max(5, Math.min(240, pxH)).toFixed(1)}px Arial, sans-serif`;
      ctx.textAlign = orig.hAlign;
      ctx.textBaseline = orig.hAlign === 'center' ? 'middle' : 'alphabetic';
      const lines = eff.text.split('\n');
      const startY =
        orig.hAlign === 'center' && lines.length > 1
          ? -((lines.length - 1) * pxH * 1.18) * 0.5
          : 0;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, startY + i * pxH * 1.18);
      }
      ctx.restore();
    }

    // 5. Dibujar paredes, mano alzada y formas creadas por el usuario
    const drawShapeGeometry = (
      shapeKind: ShapeDrawKind,
      pts: Array<{ x: number; y: number }>,
      radiusCad: number,
      thickFactor: number,
      scaleVal: number,
      dashed: boolean | undefined,
      strokeCol: string,
      alpha = 1
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = shapeKind === 'wall' ? 2.1 : 1.9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (dashed && shapeKind !== 'wall') ctx.setLineDash([8, 5]);

      if (shapeKind === 'circle_shape' && pts.length >= 1 && radiusCad > 0) {
        const [sx, sy] = cadToScreen(pts[0].x, pts[0].y);
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, radiusCad * camera.zoom), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (pts.length < 2) {
        ctx.restore();
        return;
      }

      if (shapeKind === 'wall') {
        const halfThick = Math.max(
          0.0001,
          plan.baseSymbolRadius * 0.22 * thickFactor * scaleVal
        );
        const outline = computeWallPolygonPoints(pts, halfThick);
        ctx.fillStyle = darkTheme ? 'rgba(30, 41, 59, 0.65)' : 'rgba(226, 232, 240, 0.72)';
        ctx.beginPath();
        outline.forEach((pt, idx) => {
          const [sx, sy] = cadToScreen(pt.x, pt.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (shapeKind === 'rect_shape') {
        const p1 = pts[0];
        const p2 = pts[pts.length - 1];
        const [x1, y1] = cadToScreen(p1.x, p1.y);
        const [x2, y2] = cadToScreen(p2.x, p2.y);
        ctx.beginPath();
        ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        ctx.stroke();
        ctx.restore();
        return;
      }

      ctx.beginPath();
      pts.forEach((pt, idx) => {
        const [sx, sy] = cadToScreen(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.restore();
    };

    for (const item of items) {
      if (item.type !== 'shape') continue;
      const isSel = item.id === selectedId;
      const boundsInfo = getShapeBoundsAndScaledPoints(item);
      const strokeCol = resolveOverlayColor(item.colorHex, item.isDefaultWhiteBlack);

      drawShapeGeometry(
        item.shapeKind,
        boundsInfo.scaledPoints,
        boundsInfo.scaledRadius,
        item.thicknessFactor || 1,
        item.scale || 1,
        item.dashed,
        strokeCol,
        1
      );

      if (isSel) {
        const pad = Math.max(plan.baseSymbolRadius * 0.2, 7 / camera.zoom);
        const minX = boundsInfo.minX - pad;
        const maxX = boundsInfo.maxX + pad;
        const minY = boundsInfo.minY - pad;
        const maxY = boundsInfo.maxY + pad;
        drawSelectionFrameWithHandles(boundsInfo.cx, boundsInfo.cy, [
          cadToScreen(minX, minY),
          cadToScreen(maxX, minY),
          cadToScreen(maxX, maxY),
          cadToScreen(minX, maxY)
        ]);
      }
    }

    // Helper para dibujar símbolos (PCI, Puertas/Carpintería y Mobiliario)
    const drawPciSymbol = (
      kind: PciSymbolKind,
      worldX: number,
      worldY: number,
      scale: number,
      rotDeg: number,
      mirrorX: boolean | undefined,
      colorHex: string,
      isDefaultWB: boolean | undefined,
      label: string,
      isSelected: boolean,
      alpha = 1
    ) => {
      const def = ALL_SYMBOL_CATALOG.find((s) => s.kind === kind);
      const worldR = plan.baseSymbolRadius * scale;
      const rotRad = (rotDeg * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);
      const prims = getSymbolLocalPrimitives(kind);
      const strokeCol = resolveOverlayColor(colorHex, isDefaultWB);

      const toScreen = (lx: number, ly: number): [number, number] => {
        const mx = mirrorX ? -lx : lx;
        const wx = worldX + (mx * cos - ly * sin) * worldR;
        const wy = worldY + (mx * sin + ly * cos) * worldR;
        return cadToScreen(wx, wy);
      };

      ctx.save();
      ctx.globalAlpha = alpha;

      if (isSelected) {
        const halfW = (kind === 'centralita' ? 1.55 : 1.3) * worldR + 5 / camera.zoom;
        const halfH = (kind === 'centralita' ? 1.15 : 1.3) * worldR + 5 / camera.zoom;
        drawSelectionFrameWithHandles(worldX, worldY, [
          cadToScreen(worldX - halfW, worldY - halfH),
          cadToScreen(worldX + halfW, worldY - halfH),
          cadToScreen(worldX + halfW, worldY + halfH),
          cadToScreen(worldX - halfW, worldY + halfH)
        ]);
      }

      const [centerSx, centerSy] = cadToScreen(worldX, worldY);
      const pxRadius = worldR * camera.zoom;

      if (!def?.transparentBackdrop) {
        ctx.fillStyle = darkTheme ? 'rgba(11, 17, 32, 0.72)' : 'rgba(255, 255, 255, 0.82)';
        if (
          kind === 'centralita' ||
          kind === 'pulsador_alarma' ||
          kind === 'pulsador_disparo' ||
          kind === 'pulsador_paro' ||
          kind === 'mob_cuadro_elec'
        ) {
          const bw = kind === 'centralita' ? 1.4 : kind === 'pulsador_alarma' ? 0.95 : 1.05;
          const bh = kind === 'centralita' ? 0.95 : kind === 'pulsador_alarma' ? 0.95 : 1.05;
          const corners = [
            toScreen(-bw, -bh),
            toScreen(bw, -bh),
            toScreen(bw, bh),
            toScreen(-bw, bh)
          ];
          ctx.beginPath();
          ctx.moveTo(corners[0][0], corners[0][1]);
          ctx.lineTo(corners[1][0], corners[1][1]);
          ctx.lineTo(corners[2][0], corners[2][1]);
          ctx.lineTo(corners[3][0], corners[3][1]);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(centerSx, centerSy, Math.max(2, pxRadius * 0.98), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = strokeCol;
      ctx.fillStyle = strokeCol;
      ctx.lineWidth = def?.transparentBackdrop
        ? Math.max(1.4, Math.min(2.6, pxRadius * 0.08))
        : Math.max(1.8, Math.min(3.4, pxRadius * 0.12));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const p of prims) {
        if (p.kind === 'line') {
          const [x1, y1] = toScreen(p.x1, p.y1);
          const [x2, y2] = toScreen(p.x2, p.y2);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (p.kind === 'circle') {
          const [scx, scy] = toScreen(p.cx, p.cy);
          ctx.beginPath();
          ctx.arc(scx, scy, Math.max(1, p.r * pxRadius), 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'filled_circle') {
          const [scx, scy] = toScreen(p.cx, p.cy);
          ctx.beginPath();
          ctx.arc(scx, scy, Math.max(1.2, p.r * pxRadius), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'poly') {
          ctx.beginPath();
          p.points.forEach((pt, idx) => {
            const [sx, sy] = toScreen(pt.x, pt.y);
            if (idx === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          });
          if (p.closed) ctx.closePath();
          ctx.stroke();
        } else if (p.kind === 'solid') {
          ctx.beginPath();
          p.points.forEach((pt, idx) => {
            const [sx, sy] = toScreen(pt.x, pt.y);
            if (idx === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          });
          ctx.closePath();
          ctx.fill();
        } else if (p.kind === 'arc') {
          ctx.beginPath();
          const steps = 18;
          for (let i = 0; i <= steps; i++) {
            const a = p.startRad + ((p.endRad - p.startRad) * i) / steps;
            const [sx, sy] = toScreen(p.cx + Math.cos(a) * p.r, p.cy + Math.sin(a) * p.r);
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        } else if (p.kind === 'text') {
          const fontPx = p.height * pxRadius;
          if (fontPx >= 4) {
            const [tx, ty] = toScreen(p.x, p.y);
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(-rotRad);
            ctx.font = `800 ${fontPx.toFixed(1)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text, 0, 0);
            ctx.restore();
          }
        }
      }

      if (label.trim()) {
        const labelOffset = worldR * (kind === 'centralita' ? 1.32 : 1.42);
        const [lx, ly] = cadToScreen(worldX, worldY - labelOffset);
        const fontPx = Math.max(9, Math.min(28, worldR * camera.zoom * 0.38));
        ctx.font = `700 ${fontPx.toFixed(1)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label.trim(), lx, ly);
      }

      ctx.restore();
    };

    const drawPlacedText = (
      worldX: number,
      worldY: number,
      text: string,
      scale: number,
      rotDeg: number,
      colorHex: string,
      isDefaultWB: boolean | undefined,
      isSelected: boolean,
      alpha = 1
    ) => {
      const hCad = plan.baseSymbolRadius * 0.55 * scale;
      const pxH = hCad * camera.zoom;
      if (pxH < 2.5) return;
      const rotRad = (rotDeg * Math.PI) / 180;

      if (isSelected) {
        drawRotatedTextSelectionHandles(worldX, worldY, text, hCad, rotRad, 'center');
      }

      const [sx, sy] = cadToScreen(worldX, worldY);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy);
      if (rotRad) ctx.rotate(-rotRad);
      ctx.fillStyle = isDefaultWB ? (darkTheme ? '#f1f5f9' : '#0f172a') : colorHex;
      ctx.font = `700 ${Math.max(6, Math.min(260, pxH)).toFixed(1)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = text.split('\n');
      const startY = lines.length > 1 ? -((lines.length - 1) * pxH * 1.18) * 0.5 : 0;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, startY + i * pxH * 1.18);
      }
      ctx.restore();
    };

    // 6. Dibujar cableado PCI colocado
    for (const item of items) {
      if (item.type !== 'cable' || item.points.length < 2) continue;
      const isSel = item.id === selectedId;

      ctx.save();
      if (isSel) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        item.points.forEach((pt, idx) => {
          const [sx, sy] = cadToScreen(pt.x, pt.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      ctx.strokeStyle = item.colorHex;
      ctx.lineWidth = Math.max(2.2, 2.4 * (item.widthFactor || 1));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (item.dashed) ctx.setLineDash([9, 6]);
      ctx.beginPath();
      item.points.forEach((pt, idx) => {
        const [sx, sy] = cadToScreen(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      if (item.label.trim()) {
        const midIdx = Math.floor((item.points.length - 1) / 2);
        const p1 = item.points[midIdx];
        const p2 = item.points[midIdx + 1] ?? p1;
        const [mx, my] = cadToScreen(
          (p1.x + p2.x) * 0.5,
          (p1.y + p2.y) * 0.5 + plan.baseSymbolRadius * 0.35
        );
        const fontPx = Math.max(10, Math.min(24, plan.baseSymbolRadius * camera.zoom * 0.36));
        ctx.fillStyle = item.colorHex;
        ctx.font = `700 ${fontPx.toFixed(1)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(item.label.trim(), mx, my);
      }

      if (isSel) {
        for (const pt of item.points) {
          const [vx, vy] = cadToScreen(pt.x, pt.y);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(vx, vy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 7. Dibujar símbolos (PCI, puertas, mobiliario)
    for (const item of items) {
      if (item.type !== 'symbol') continue;
      drawPciSymbol(
        item.kind,
        item.x,
        item.y,
        item.scale,
        item.rotationDeg,
        item.mirrorX,
        item.colorHex,
        item.isDefaultWhiteBlack,
        item.label,
        item.id === selectedId,
        1
      );
    }

    // 8. Dibujar textos nuevos
    for (const item of items) {
      if (item.type !== 'text') continue;
      drawPlacedText(
        item.x,
        item.y,
        item.text,
        item.scale,
        item.rotationDeg,
        item.colorHex,
        item.isDefaultWhiteBlack,
        item.id === selectedId,
        1
      );
    }

    // 9a. Vista previa en vivo de forma por arrastre (mano alzada, rectángulo, círculo)
    if (tool.mode === 'shape' && dragShapeDraft && dragShapeDraft.length >= 2) {
      const p0 = dragShapeDraft[0];
      const pLast = dragShapeDraft[dragShapeDraft.length - 1];
      const rCad =
        tool.shapeKind === 'circle_shape' ? Math.hypot(pLast.x - p0.x, pLast.y - p0.y) : 0;
      drawShapeGeometry(
        tool.shapeKind,
        dragShapeDraft,
        rCad,
        wallThicknessFactor,
        1,
        cableDashed,
        resolveOverlayColor(customColorHex, customIsDefaultWB),
        0.8
      );
    }

    // 9b. Vista previa en vivo de trazado multipunto (cable, pared doble o línea recta)
    if (isMultiPointTool && draftPolyPts.length > 0) {
      const previewPts = cursorCad ? [...draftPolyPts, cursorCad] : draftPolyPts;
      if (tool.mode === 'shape' && (tool.shapeKind === 'wall' || tool.shapeKind === 'line_shape')) {
        drawShapeGeometry(
          tool.shapeKind,
          previewPts,
          0,
          wallThicknessFactor,
          1,
          cableDashed,
          resolveOverlayColor(customColorHex, customIsDefaultWB),
          0.78
        );
      } else {
        ctx.save();
        ctx.strokeStyle = customColorHex;
        ctx.lineWidth = 2.5;
        if (cableDashed) ctx.setLineDash([8, 5]);
        ctx.beginPath();
        previewPts.forEach((pt, idx) => {
          const [sx, sy] = cadToScreen(pt.x, pt.y);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      for (const pt of draftPolyPts) {
        const [vx, vy] = cadToScreen(pt.x, pt.y);
        ctx.fillStyle = resolveOverlayColor(customColorHex, customIsDefaultWB);
        ctx.beginPath();
        ctx.arc(vx, vy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 10. Indicador magnético de Snap
    if (snappedTarget) {
      const [sx, sy] = cadToScreen(snappedTarget.x, snappedTarget.y);
      ctx.save();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 7, sy - 7, 14, 14);
      ctx.restore();
    }

    // 11. Vista previa fantasma de símbolo o texto
    if (tool.mode === 'symbol' && cursorCad && interactionRef.current.type === 'none') {
      drawPciSymbol(
        tool.kind,
        cursorCad.x,
        cursorCad.y,
        defaultScale,
        defaultRotation,
        defaultMirrorX,
        customColorHex,
        customIsDefaultWB,
        defaultLabel,
        false,
        0.58
      );
    } else if (
      tool.mode === 'text' &&
      cursorCad &&
      !textModal &&
      interactionRef.current.type === 'none'
    ) {
      drawPlacedText(
        cursorCad.x,
        cursorCad.y,
        defaultLabel.trim() || 'Texto...',
        defaultScale,
        defaultRotation,
        customColorHex,
        customIsDefaultWB,
        false,
        0.55
      );
    }
  }, [
    baseObjectEdits,
    baseTextEdits,
    cableDashed,
    cadToScreen,
    camera,
    canvasSize.h,
    canvasSize.w,
    cursorCad,
    customColorHex,
    customIsDefaultWB,
    darkTheme,
    defaultLabel,
    defaultMirrorX,
    defaultRotation,
    defaultScale,
    draftPolyPts,
    dragShapeDraft,
    effectiveSelectedBaseObj,
    getEffectiveBaseText,
    hiddenLayers,
    isMultiPointTool,
    items,
    plan,
    selectedBaseObjHandle,
    selectedBaseObjMeta,
    selectedBaseTextId,
    selectedId,
    snappedTarget,
    textModal,
    tool,
    transformBasePoint,
    wallThicknessFactor
  ]);

  // ============================================================================
  // GUARDADO EN FORMATO .DWG O .DXF Y CIERRE DEL ARCHIVO
  // ============================================================================
  const saveDwgFile = async (closeAfterSave: boolean, forcedFormat?: 'dwg' | 'dxf') => {
    if (!rawBuffer || !plan) return;
    setIsSaving(true);
    setErrorMsg(null);

    const outFmt: 'dwg' | 'dxf' = forcedFormat ?? (plan.isDxf ? 'dxf' : 'dwg');
    const ext = outFmt === 'dxf' ? '.dxf' : '.dwg';

    try {
      const textEditsList = Object.values(baseTextEdits);
      const objEditsList = Object.values(baseObjectEdits);
      const outputBytes = exportModifiedDwgBuffer(
        rawBuffer,
        plan.isDxf,
        plan.activeBlockName,
        plan.baseSymbolRadius,
        items,
        textEditsList,
        objEditsList,
        outFmt
      );

      const baseName = plan.fileName.replace(/\.(dwg|dxf)$/i, '');
      const suggestedName = `${baseName}_PCI${ext}`;

      let savedViaPicker = false;
      const win = window as unknown as {
        showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike>;
      };

      if (typeof win.showSaveFilePicker === 'function') {
        try {
          const sameExtAsHandle =
            fileHandle?.name?.toLowerCase().endsWith(ext) ? fileHandle.name : suggestedName;
          const targetHandle = await win.showSaveFilePicker({
            suggestedName: sameExtAsHandle,
            types:
              outFmt === 'dxf'
                ? [
                    {
                      description: 'Archivo AutoCAD DXF (.dxf)',
                      accept: { 'application/dxf': ['.dxf'] }
                    }
                  ]
                : [
                    {
                      description: 'Archivo AutoCAD Drawing (.dwg)',
                      accept: { 'application/acad': ['.dwg'] }
                    }
                  ]
          });
          const writable = await targetHandle.createWritable();
          await writable.write(outputBytes);
          await writable.close();
          savedViaPicker = true;
        } catch (pickerErr: unknown) {
          if (pickerErr instanceof DOMException && pickerErr.name === 'AbortError') {
            setIsSaving(false);
            return;
          }
        }
      }

      if (!savedViaPicker) {
        const copyBuf = new Uint8Array(outputBytes.byteLength);
        copyBuf.set(outputBytes);
        const blob = new Blob([copyBuf.buffer], {
          type: outFmt === 'dxf' ? 'application/dxf' : 'application/acad'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }

      setHasUnsavedChanges(false);

      if (closeAfterSave) {
        setRawBuffer(null);
        setFileHandle(null);
        setPlan(null);
        setItems([]);
        setBaseTextEdits({});
        setBaseObjectEdits({});
        setHistory([{ items: [], baseTextEdits: {}, baseObjectEdits: {} }]);
        setHistoryIdx(0);
        clearSelection();
        setDraftPolyPts([]);
        showToast(
          `Archivo ${ext.toUpperCase()} guardado correctamente y cerrado.`
        );
      } else {
        showToast(`Archivo ${ext} guardado correctamente.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar el archivo CAD.';
      setErrorMsg(`No se pudo guardar el archivo ${ext.toUpperCase()}: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseWithoutSaveRequest = () => {
    const hasEdits =
      items.length > 0 ||
      Object.keys(baseTextEdits).length > 0 ||
      Object.keys(baseObjectEdits).length > 0;
    if (hasUnsavedChanges && hasEdits) {
      setShowCloseConfirmModal(true);
      return;
    }
    setRawBuffer(null);
    setFileHandle(null);
    setPlan(null);
    setItems([]);
    setBaseTextEdits({});
    setBaseObjectEdits({});
    setDraftPolyPts([]);
    clearSelection();
  };

  const countsByKind = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      const key =
        it.type === 'symbol'
          ? it.kind
          : it.type === 'text'
          ? 'text_added'
          : it.type === 'shape'
          ? `shape_${it.shapeKind}`
          : `cable_${it.circuit}`;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [items]);

  const hasResizableSelection =
    (selectedItem &&
      (selectedItem.type === 'symbol' ||
        selectedItem.type === 'text' ||
        selectedItem.type === 'shape')) ||
    !!selectedBaseTextOriginal ||
    !!selectedBaseObjMeta;

  const selectionTitleLabel = useMemo(() => {
    if (selectedItem?.type === 'symbol') {
      return ALL_SYMBOL_CATALOG.find((s) => s.kind === selectedItem.kind)?.label ?? 'Símbolo';
    }
    if (selectedItem?.type === 'shape') {
      return SHAPE_DRAW_CATALOG.find((s) => s.kind === selectedItem.shapeKind)?.label ?? 'Forma';
    }
    if (selectedItem?.type === 'text') return 'Texto Nuevo';
    if (selectedItem?.type === 'cable') return 'Cableado PCI';
    if (selectedBaseTextOriginal) return 'Texto del DWG';
    if (selectedBaseObjMeta) return selectedBaseObjMeta.label;
    return null;
  }, [selectedBaseObjMeta, selectedBaseTextOriginal, selectedItem]);

  // Etiquetas activas para mostrar en la cabecera de cada desplegable
  const activePciSym =
    tool.mode === 'symbol' ? PCI_SYMBOL_CATALOG.find((s) => s.kind === tool.kind) : null;
  const activeArchSym =
    tool.mode === 'symbol' ? ARCH_SYMBOL_CATALOG.find((s) => s.kind === tool.kind) : null;
  const activeShapeDef =
    tool.mode === 'shape' ? SHAPE_DRAW_CATALOG.find((s) => s.kind === tool.shapeKind) : null;
  const activeFurnSym =
    tool.mode === 'symbol' ? FURNITURE_SYMBOL_CATALOG.find((s) => s.kind === tool.kind) : null;
  const activeCableDef =
    tool.mode === 'cable' ? PCI_CIRCUIT_CATALOG.find((c) => c.kind === tool.circuit) : null;

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-slate-100 text-slate-800">
      <input
        ref={fileInputRef}
        type="file"
        accept=".dwg,.dxf,.DWG,.DXF"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Cabecera compacta integrada */}
      <div className="bg-white border-b border-zinc-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <FileCode2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight">
                Editor de Planos DWG / DXF · PCI y Arquitectura
              </h1>
              {plan && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 truncate max-w-[260px]">
                  {plan.fileName} · {plan.versionLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Abre archivos .dwg o .dxf, dibuja paredes, puertas, mobiliario, textos y simbología PCI y guárdalo en .dwg o .dxf
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleOpenWithPicker}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-slate-700" />
            {plan ? 'Abrir otro DWG / DXF' : 'Abrir .DWG / .DXF'}
          </button>

          {plan && (
            <>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveDwgFile(false, 'dwg')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Guardar .DWG
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveDwgFile(false, 'dxf')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white shadow-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Guardar .DXF
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveDwgFile(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Guardar y cerrar ({plan.isDxf ? '.DXF' : '.DWG'})
              </button>

              <button
                type="button"
                onClick={handleCloseWithoutSaveRequest}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 transition cursor-pointer"
                title="Cerrar plano actual"
              >
                <LogOut className="w-4 h-4" />
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mensajes de estado o error */}
      {errorMsg && (
        <div className="mx-4 sm:mx-6 mt-3 px-4 py-3 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 rounded-lg hover:bg-red-100 text-red-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {toastMsg && (
        <div className="mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Pantalla inicial de carga cuando no hay plano abierto */}
      {!plan ? (
        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverFile(true);
            }}
            onDragLeave={() => setIsDragOverFile(false)}
            onDrop={handleDropFile}
            className={`w-full max-w-2xl rounded-3xl border-2 border-dashed p-10 text-center transition bg-white shadow-sm ${
              isDragOverFile
                ? 'border-red-500 bg-red-50/40 scale-[1.01]'
                : 'border-slate-300 hover:border-red-400'
            }`}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">
              {isLoading ? 'Abriendo y procesando plano CAD...' : 'Carga tu archivo CAD (.dwg o .dxf)'}
            </h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6">
              Arrastra tu archivo <code>.dwg</code> o <code>.dxf</code> aquí o selecciónalo desde tu ordenador. Incluye desplegables completos para{' '}
              <span className="font-semibold text-slate-800">
                Símbolos PCI, Paredes / Formas / Mano alzada / Puertas, Mobiliario, Cableado y Textos
              </span>{' '}
              y guarda directamente en <code>.dwg</code> o <code>.dxf</code>.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleOpenWithPicker}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                Seleccionar archivo .DWG o .DXF
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleLoadSampleDwg}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold text-sm transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                Probar con plano DWG de ejemplo
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Área principal de edición CAD */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Panel lateral izquierdo compacto con DESPLEGABLES */}
          <aside className="w-full lg:w-76 xl:w-82 bg-white border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col shrink-0 overflow-y-auto max-h-[45vh] lg:max-h-full">
            {/* 1. Modos de selección y texto */}
            <div className="p-3 border-b border-zinc-200 space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDraftPolyPts([]);
                    setOpenDropdown(null);
                    setTool({ mode: 'select' });
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    tool.mode === 'select'
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <MousePointer2 className="w-3.5 h-3.5" />
                  Seleccionar / Escalar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftPolyPts([]);
                    setOpenDropdown(null);
                    setTool({ mode: 'pan' });
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    tool.mode === 'pan'
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <Hand className="w-3.5 h-3.5" />
                  Mover plano
                </button>
              </div>

              <button
                type="button"
                onClick={selectTextTool}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  tool.mode === 'text'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-900 border-indigo-200'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Añadir Texto Libre
                </span>
                {(countsByKind.text_added || 0) > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      tool.mode === 'text' ? 'bg-white text-indigo-700' : 'bg-indigo-700 text-white'
                    }`}
                  >
                    {countsByKind.text_added}
                  </span>
                )}
              </button>
            </div>

            {/* 2. BLOQUE DE LOS 4 MENÚS DESPLEGABLES */}
            <div className="p-3 border-b border-zinc-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
                  Bibliotecas y Dibujo CAD
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOrthoMode((v) => !v)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
                      orthoMode
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                    title="Fuerza ángulos rectos de 90° en paredes, líneas y cables"
                  >
                    90° Orto
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnapSymbols((v) => !v)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
                      snapSymbols
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                    title="Imanta el cableado al centro de los símbolos"
                  >
                    Imán
                  </button>
                </div>
              </div>

              {/* DESPLEGABLE 1: SÍMBOLOS PCI */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown((curr) => (curr === 'pci' ? null : 'pci'))}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                    activePciSym
                      ? 'bg-red-50 border-red-500 text-red-950 ring-1 ring-red-400/40'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {activePciSym ? (
                      <SymbolPreviewSvg kind={activePciSym.kind} color={activePciSym.defaultColorHex} />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <Flame className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                        Símbolos PCI
                      </div>
                      <div className="text-xs font-bold truncate">
                        {activePciSym ? activePciSym.label : 'Elegir símbolo contra incendios...'}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${
                      openDropdown === 'pci' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'pci' && (
                  <div className="mt-1 rounded-xl border border-slate-300 bg-white shadow-lg max-h-68 overflow-y-auto divide-y divide-slate-100 z-30">
                    {PCI_SYMBOL_CATALOG.map((sym) => {
                      const count = countsByKind[sym.kind] || 0;
                      const isAct = activePciSym?.kind === sym.kind;
                      return (
                        <button
                          key={sym.kind}
                          type="button"
                          onClick={() => selectSymbolTool(sym.kind)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-red-50/70 transition cursor-pointer ${
                            isAct ? 'bg-red-50 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SymbolPreviewSvg kind={sym.kind} color={sym.defaultColorHex} />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">
                                {sym.label}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {sym.layerName}
                              </div>
                            </div>
                          </div>
                          {count > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shrink-0">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* DESPLEGABLE 2: PAREDES, FORMAS, MANO ALZADA Y PUERTAS */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown((curr) => (curr === 'formas' ? null : 'formas'))}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                    activeShapeDef || activeArchSym
                      ? 'bg-sky-50 border-sky-500 text-sky-950 ring-1 ring-sky-400/40'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {activeArchSym ? (
                      <SymbolPreviewSvg kind={activeArchSym.kind} color="#0f172a" />
                    ) : activeShapeDef ? (
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
                        <ShapePreviewIcon kind={activeShapeDef.kind} />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                        <Square className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        Paredes, Formas y Puertas
                      </div>
                      <div className="text-xs font-bold truncate">
                        {activeShapeDef
                          ? activeShapeDef.label
                          : activeArchSym
                          ? activeArchSym.label
                          : 'Dibujar pared, mano alzada, puerta...'}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${
                      openDropdown === 'formas' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'formas' && (
                  <div className="mt-1 rounded-xl border border-slate-300 bg-white shadow-lg max-h-72 overflow-y-auto z-30">
                    <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Dibujo de Paredes, Mano Alzada y Formas
                    </div>
                    <div className="divide-y divide-slate-100">
                      {SHAPE_DRAW_CATALOG.map((sh) => {
                        const isAct = activeShapeDef?.kind === sh.kind;
                        const count = countsByKind[`shape_${sh.kind}`] || 0;
                        return (
                          <button
                            key={sh.kind}
                            type="button"
                            onClick={() => selectShapeTool(sh.kind)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-sky-50/70 transition cursor-pointer ${
                              isAct ? 'bg-sky-50 font-bold' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                <ShapePreviewIcon kind={sh.kind} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-800 truncate">
                                  {sh.label}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {sh.description}
                                </div>
                              </div>
                            </div>
                            {count > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-700 text-white shrink-0">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-t border-slate-200">
                      Puertas, Ventanas y Escaleras
                    </div>
                    <div className="divide-y divide-slate-100">
                      {ARCH_SYMBOL_CATALOG.map((sym) => {
                        const isAct = activeArchSym?.kind === sym.kind;
                        const count = countsByKind[sym.kind] || 0;
                        return (
                          <button
                            key={sym.kind}
                            type="button"
                            onClick={() => selectSymbolTool(sym.kind)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-sky-50/70 transition cursor-pointer ${
                              isAct ? 'bg-sky-50 font-bold' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <SymbolPreviewSvg kind={sym.kind} color="#0f172a" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-800 truncate">
                                  {sym.label}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {sym.description}
                                </div>
                              </div>
                            </div>
                            {count > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-700 text-white shrink-0">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* DESPLEGABLE 3: MOBILIARIO */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown((curr) => (curr === 'mobiliario' ? null : 'mobiliario'))
                  }
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                    activeFurnSym
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-400/40'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {activeFurnSym ? (
                      <SymbolPreviewSvg
                        kind={activeFurnSym.kind}
                        color={activeFurnSym.defaultColorHex}
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Armchair className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Mobiliario y Equipos
                      </div>
                      <div className="text-xs font-bold truncate">
                        {activeFurnSym ? activeFurnSym.label : 'Elegir mesa, silla, baño, coche...'}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${
                      openDropdown === 'mobiliario' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'mobiliario' && (
                  <div className="mt-1 rounded-xl border border-slate-300 bg-white shadow-lg max-h-68 overflow-y-auto divide-y divide-slate-100 z-30">
                    {FURNITURE_SYMBOL_CATALOG.map((sym) => {
                      const isAct = activeFurnSym?.kind === sym.kind;
                      const count = countsByKind[sym.kind] || 0;
                      return (
                        <button
                          key={sym.kind}
                          type="button"
                          onClick={() => selectSymbolTool(sym.kind)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-emerald-50/70 transition cursor-pointer ${
                            isAct ? 'bg-emerald-50 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SymbolPreviewSvg kind={sym.kind} color={sym.defaultColorHex} />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">
                                {sym.label}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {sym.description}
                              </div>
                            </div>
                          </div>
                          {count > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-700 text-white shrink-0">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* DESPLEGABLE 4: CABLEADO Y TUBERÍAS PCI */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown((curr) => (curr === 'cableado' ? null : 'cableado'))
                  }
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                    activeCableDef
                      ? 'bg-amber-50 border-amber-500 text-amber-950 ring-1 ring-amber-400/40'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Cable className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Cableado y Tubería PCI
                      </div>
                      <div className="text-xs font-bold truncate">
                        {activeCableDef ? activeCableDef.label : 'Trazar línea de cableado...'}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${
                      openDropdown === 'cableado' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'cableado' && (
                  <div className="mt-1 rounded-xl border border-slate-300 bg-white shadow-lg overflow-hidden divide-y divide-slate-100 z-30">
                    {PCI_CIRCUIT_CATALOG.map((cir) => {
                      const isAct = activeCableDef?.kind === cir.kind;
                      const count = countsByKind[`cable_${cir.kind}`] || 0;
                      return (
                        <button
                          key={cir.kind}
                          type="button"
                          onClick={() => selectCableTool(cir.kind)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-amber-50/70 transition cursor-pointer ${
                            isAct ? 'bg-amber-50 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-6 h-0.5 shrink-0"
                              style={{
                                borderTop: cir.defaultDashed
                                  ? `2.5px dashed ${cir.defaultColorHex}`
                                  : `3px solid ${cir.defaultColorHex}`
                              }}
                            />
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {cir.label}
                            </span>
                          </div>
                          {count > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-900 text-white shrink-0">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Opciones rápidas extra si está dibujando pared o cable/forma */}
              {tool.mode === 'shape' && tool.shapeKind === 'wall' && (
                <div className="flex items-center justify-between gap-2 bg-sky-50/80 p-2 rounded-xl border border-sky-200">
                  <span className="text-[11px] font-bold text-sky-900">Grosor pared:</span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: 'Tabique', val: 0.7 },
                      { label: 'Normal', val: 1.0 },
                      { label: 'Muro', val: 1.65 }
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setWallThicknessFactor(opt.val)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          Math.abs(wallThicknessFactor - opt.val) < 0.05
                            ? 'bg-sky-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(tool.mode === 'cable' ||
                (tool.mode === 'shape' && tool.shapeKind !== 'wall')) && (
                <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-600">Tipo de línea:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCableDashed(false)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        !cableDashed
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      Continua
                    </button>
                    <button
                      type="button"
                      onClick={() => setCableDashed(true)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        cableDashed
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      Discontinua
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. PROPIEDADES Y TRANSFORMACIÓN SIEMPRE VISIBLES */}
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
                  {selectionTitleLabel ? `Seleccionado: ${selectionTitleLabel}` : 'Ajustes de Herramienta'}
                </span>
                {(selectedBaseTextOriginal || selectedItem?.type === 'text') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedItem?.type === 'text') {
                        setTextModalValue(selectedItem.text);
                        setTextModal({
                          mode: 'edit-overlay',
                          x: selectedItem.x,
                          y: selectedItem.y,
                          targetId: selectedItem.id,
                          initialText: selectedItem.text
                        });
                      } else if (selectedBaseTextOriginal && effectiveSelectedBaseText) {
                        setTextModalValue(effectiveSelectedBaseText.text);
                        setTextModal({
                          mode: 'edit-base',
                          x: effectiveSelectedBaseText.x,
                          y: effectiveSelectedBaseText.y,
                          targetId: selectedBaseTextOriginal.id,
                          initialText: effectiveSelectedBaseText.text
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" /> Ventana
                  </button>
                )}
              </div>

              {(selectedItem?.type === 'text' ||
                (selectedBaseTextOriginal && effectiveSelectedBaseText)) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contenido del texto
                  </label>
                  <textarea
                    rows={2}
                    value={
                      selectedItem?.type === 'text'
                        ? selectedItem.text
                        : effectiveSelectedBaseText?.text ?? ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (selectedItem?.type === 'text') {
                        updateSelectedItem((it) => (it.type === 'text' ? { ...it, text: val } : it));
                      } else if (selectedBaseTextOriginal) {
                        upsertBaseTextEdit(selectedBaseTextOriginal, { text: val }, true);
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-indigo-300 bg-indigo-50/30 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Tamaño / Escala */}
              {(!selectedItem || selectedItem.type !== 'cable') && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Tamaño / Escala</span>
                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {(activeScaleValue * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => applyScaleToCurrentSelection(activeScaleValue / 1.2, true)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" /> Reducir
                    </button>
                    <button
                      type="button"
                      onClick={() => applyScaleToCurrentSelection(activeScaleValue * 1.2, true)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Más grande
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={6.0}
                    step={0.05}
                    value={Math.min(6, activeScaleValue)}
                    onChange={(e) => applyScaleToCurrentSelection(parseFloat(e.target.value), false)}
                    onMouseUp={() => commitSnapshot(items, baseTextEdits, baseObjectEdits)}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              )}

              {/* Rotación y Volteo (para puertas, mobiliario, símbolos PCI y textos) */}
              {!selectedBaseObjMeta &&
                (!selectedItem ||
                  selectedItem.type === 'symbol' ||
                  selectedItem.type === 'text') && (
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>Orientación y Volteo</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {activeRotationValue}°
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleRotationChange((Math.round(activeRotationValue) - 90 + 360) % 360)
                        }
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                        title="Girar -90°"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> -90°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleRotationChange((Math.round(activeRotationValue) + 45) % 360)
                        }
                        className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                        title="Girar +45°"
                      >
                        +45°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleRotationChange((Math.round(activeRotationValue) + 90) % 360)
                        }
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                        title="Girar +90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" /> +90°
                      </button>
                      {(selectedItem?.type === 'symbol' ||
                        (!selectedItem && !selectedBaseTextOriginal && tool.mode === 'symbol')) && (
                        <button
                          type="button"
                          onClick={handleToggleMirrorX}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer inline-flex items-center gap-1 ${
                            (selectedItem?.type === 'symbol' ? selectedItem.mirrorX : defaultMirrorX)
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                          title="Voltear horizontalmente (ideal para cambiar mano de apertura de puertas)"
                        >
                          <FlipHorizontal2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* Etiqueta opcional */}
              {!selectedBaseTextOriginal &&
                !selectedBaseObjMeta &&
                selectedItem?.type !== 'text' &&
                selectedItem?.type !== 'shape' &&
                tool.mode !== 'shape' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {tool.mode === 'text'
                        ? 'Texto inicial (opcional)'
                        : 'Etiqueta en plano (opcional)'}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        tool.mode === 'text'
                          ? 'Ej: SALA DE CALDERAS...'
                          : 'Ej: EXT-01, ZONA 1, RF-60...'
                      }
                      value={
                        selectedItem &&
                        (selectedItem.type === 'symbol' || selectedItem.type === 'cable')
                          ? selectedItem.label
                          : defaultLabel
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (
                          selectedItem &&
                          (selectedItem.type === 'symbol' || selectedItem.type === 'cable')
                        ) {
                          updateSelectedItem((it) =>
                            it.type === 'symbol' || it.type === 'cable' ? { ...it, label: v } : it
                          );
                        } else {
                          setDefaultLabel(v);
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                    />
                  </div>
                )}

              {/* Paleta de color CAD */}
              {!selectedBaseObjMeta && (
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Color CAD
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PCI_COLOR_PALETTE.map((col) => {
                      const isWBActive = selectedItem
                        ? (selectedItem.type === 'text' ||
                            selectedItem.type === 'symbol' ||
                            selectedItem.type === 'shape') &&
                          !!selectedItem.isDefaultWhiteBlack
                        : effectiveSelectedBaseText
                        ? effectiveSelectedBaseText.isDefaultWhiteBlack
                        : customIsDefaultWB;

                      const activeHex = selectedItem
                        ? selectedItem.colorHex
                        : effectiveSelectedBaseText
                        ? effectiveSelectedBaseText.colorHex
                        : customColorHex;

                      const isAct = col.isDefaultWB
                        ? isWBActive
                        : !isWBActive && activeHex.toLowerCase() === col.hex.toLowerCase();

                      return (
                        <button
                          key={col.label}
                          type="button"
                          title={col.label}
                          onClick={() => {
                            if (selectedItem) {
                              updateSelectedItem((it) =>
                                it.type === 'text' || it.type === 'symbol' || it.type === 'shape'
                                  ? {
                                      ...it,
                                      colorHex: col.hex,
                                      aciColor: col.aci,
                                      isDefaultWhiteBlack: !!col.isDefaultWB
                                    }
                                  : { ...it, colorHex: col.hex, aciColor: col.aci }
                              );
                            } else if (selectedBaseTextOriginal) {
                              upsertBaseTextEdit(
                                selectedBaseTextOriginal,
                                {
                                  colorHex: col.hex,
                                  aciColor: col.aci,
                                  isDefaultWhiteBlack: !!col.isDefaultWB
                                },
                                true
                              );
                            } else {
                              setCustomColorHex(col.hex);
                              setCustomAci(col.aci);
                              setCustomIsDefaultWB(!!col.isDefaultWB);
                            }
                          }}
                          className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                            isAct ? 'border-zinc-900 scale-115 shadow-xs' : 'border-white shadow-xs'
                          }`}
                          style={{
                            background: col.isDefaultWB
                              ? 'linear-gradient(135deg, #0f172a 50%, #f8fafc 50%)'
                              : col.hex
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Acciones sobre la selección actual */}
              {(selectedItem || selectedBaseTextOriginal || selectedBaseObjMeta) && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    {!selectedBaseObjMeta && (
                      <button
                        type="button"
                        onClick={duplicateSelection}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Duplicar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={deleteSelection}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>

                  {selectedBaseTextOriginal && effectiveSelectedBaseText?.isModified && (
                    <button
                      type="button"
                      onClick={restoreSelectedBaseText}
                      className="w-full py-1.5 rounded-xl text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                    >
                      Restaurar texto original del DWG
                    </button>
                  )}

                  {selectedBaseObjMeta && effectiveSelectedBaseObj?.isModified && (
                    <button
                      type="button"
                      onClick={restoreSelectedBaseObject}
                      className="w-full py-1.5 rounded-xl text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                    >
                      Restaurar objeto original del DWG
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Lienzo interactivo central del DWG */}
          <div className="flex-1 flex flex-col relative min-h-[460px]">
            {/* Barra flotante superior de controles del visor CAD + Barra rápida de Tamaño */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none flex-wrap">
              <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-xs border border-slate-300 rounded-xl px-2 py-1.5 shadow-sm pointer-events-auto">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyIdx === 0 && draftPolyPts.length === 0}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-35 text-slate-700 cursor-pointer"
                  title="Deshacer (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyIdx >= history.length - 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-35 text-slate-700 cursor-pointer"
                  title="Rehacer (Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setCamera((p) => ({ ...p, zoom: p.zoom * 1.25 }))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  title="Acercar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCamera((p) => ({ ...p, zoom: p.zoom / 1.25 }))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  title="Alejar zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fitPlanToView(plan)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                  title="Encuadrar todo el plano"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> Encuadrar
                </button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setDarkTheme((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                  title="Alternar fondo oscuro AutoCAD / papel blanco"
                >
                  {darkTheme ? (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-slate-700" />
                  )}
                  {darkTheme ? 'Papel' : 'Oscuro'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLayersPanel((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    showLayersPanel ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Capas ({plan.layers.length})
                </button>

                {plan.availableSpaces.length > 1 && (
                  <select
                    value={plan.activeBlockName}
                    onChange={(e) => handleSwitchSpace(e.target.value)}
                    className="ml-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    {plan.availableSpaces.map((sp) => (
                      <option key={sp.name} value={sp.name}>
                        {sp.label} ({sp.count})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* BARRA FLOTANTE DIRECTA DE ESCALADO Y VOLTEO */}
              {hasResizableSelection && (
                <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl shadow-lg border border-slate-700 pointer-events-auto text-xs">
                  <span className="font-bold text-amber-400 truncate max-w-[140px]">
                    {selectionTitleLabel}
                  </span>
                  <div className="w-px h-4 bg-slate-700" />
                  <button
                    type="button"
                    onClick={() => applyScaleToCurrentSelection(activeScaleValue / 1.2, true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-white cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" /> Reducir
                  </button>
                  <span className="font-mono font-bold text-xs min-w-[46px] text-center">
                    {(activeScaleValue * 100).toFixed(0)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => applyScaleToCurrentSelection(activeScaleValue * 1.2, true)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 font-extrabold text-white shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Más grande
                  </button>
                  {selectedItem?.type === 'symbol' && (
                    <button
                      type="button"
                      onClick={handleToggleMirrorX}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-sky-300 cursor-pointer"
                      title="Voltear horizontalmente"
                    >
                      <FlipHorizontal2 className="w-3.5 h-3.5" /> Voltear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={deleteSelection}
                    className="p-1.5 rounded-lg hover:bg-red-600/80 text-red-300 hover:text-white cursor-pointer"
                    title="Eliminar (Supr)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Banner interactivo para herramientas de pared, polilínea, mano alzada o cableado */}
              {isMultiPointTool && !hasResizableSelection && (
                <div className="flex items-center gap-2 bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl shadow-md pointer-events-auto text-xs font-bold">
                  <span>
                    {draftPolyPts.length === 0
                      ? tool.mode === 'shape' && tool.shapeKind === 'wall'
                        ? 'Haz clic para iniciar el tramo de pared (Shift o 90° Orto para escuadra)'
                        : 'Haz clic en el punto inicial'
                      : `Puntos: ${draftPolyPts.length} · Clic para añadir esquina, Doble clic o Enter para terminar`}
                  </span>
                  {draftPolyPts.length >= 2 && (
                    <button
                      type="button"
                      onClick={finishMultiPointDraft}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      ✓ Terminar trazo
                    </button>
                  )}
                  {draftPolyPts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraftPolyPts([])}
                      className="p-1 rounded-lg hover:bg-amber-400 text-slate-900 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {isDragDrawTool && !hasResizableSelection && (
                <div className="flex items-center gap-2 bg-sky-600 text-white px-3 py-1.5 rounded-xl shadow-md pointer-events-auto text-xs font-bold">
                  <span>
                    {tool.mode === 'shape' && tool.shapeKind === 'freehand'
                      ? 'Mantén pulsado el botón izquierdo y arrastra para dibujar a mano alzada'
                      : tool.mode === 'shape' && tool.shapeKind === 'rect_shape'
                      ? 'Mantén pulsado y arrastra de esquina a esquina para dibujar el rectángulo / sala'
                      : 'Mantén pulsado en el centro y arrastra hacia fuera para dibujar el círculo'}
                  </span>
                </div>
              )}
            </div>

            {/* Panel flotante de capas del DWG */}
            {showLayersPanel && (
              <div className="absolute top-16 left-3 z-20 w-72 max-h-80 bg-white border border-slate-300 rounded-2xl shadow-xl flex flex-col overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between text-xs font-bold">
                  <span>Capas del plano DWG</span>
                  <button
                    type="button"
                    onClick={() => setShowLayersPanel(false)}
                    className="p-0.5 rounded hover:bg-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-y-auto divide-y divide-slate-100 p-1.5">
                  {plan.layers.map((lyr) => {
                    const isHidden = !!hiddenLayers[lyr.name];
                    return (
                      <button
                        key={lyr.name}
                        type="button"
                        onClick={() =>
                          setHiddenLayers((prev) => ({ ...prev, [lyr.name]: !prev[lyr.name] }))
                        }
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-left text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-xs border border-slate-400 shrink-0"
                            style={{ backgroundColor: lyr.colorHex }}
                          />
                          <span
                            className={`truncate ${
                              isHidden ? 'line-through text-slate-400' : 'font-medium text-slate-800'
                            }`}
                          >
                            {lyr.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                          <span className="text-[10px]">{lyr.entityCount}</span>
                          {isHidden ? (
                            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Contenedor del Canvas */}
            <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  handleMouseUp();
                  setCursorCad(null);
                  setHoverResizeCorner(false);
                }}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(e) => e.preventDefault()}
                className={`block w-full h-full select-none ${
                  hoverResizeCorner
                    ? 'cursor-nwse-resize'
                    : tool.mode === 'pan'
                    ? 'cursor-grab active:cursor-grabbing'
                    : tool.mode === 'select'
                    ? 'cursor-default'
                    : 'cursor-crosshair'
                }`}
              />
            </div>

            {/* Barra inferior de estado CAD */}
            <div className="bg-slate-900 text-slate-300 px-4 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 font-mono text-slate-200">
                  <Crosshair className="w-3.5 h-3.5 text-red-400" />
                  {cursorCad
                    ? `X: ${cursorCad.x.toFixed(2)}  Y: ${cursorCad.y.toFixed(2)}`
                    : 'X: --  Y: --'}
                </span>
                <span className="text-slate-400">
                  Entidades base: <strong className="text-slate-200">{plan.totalEntities}</strong>
                </span>
                <span className="text-slate-400">
                  Elementos añadidos: <strong className="text-emerald-400">{items.length}</strong>
                </span>
              </div>
              <div className="text-slate-400 hidden sm:block">
                Clic en objeto/texto: Tira de las 4 esquinas para escalar · Voltear cambia mano de puertas · Doble clic edita texto
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal rápido para crear o editar texto */}
      {textModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Type className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {textModal.mode === 'create'
                      ? 'Insertar Texto en Plano DWG'
                      : 'Editar Texto del Plano'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter confirma · Shift+Enter añade salto de línea
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTextModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              ref={textModalInputRef}
              rows={3}
              value={textModalValue}
              onChange={(e) => setTextModalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleConfirmTextModal();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setTextModal(null);
                }
              }}
              placeholder="Escribe el texto para el plano..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600"
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTextModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmTextModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                {textModal.mode === 'create' ? 'Insertar texto' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal flotante de confirmación al cerrar con cambios sin guardar */}
      {showCloseConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  ¿Cerrar plano DWG sin guardar?
                </h3>
                <p className="text-xs text-slate-500">
                  Tienes cambios pendientes en el plano que aún no se han guardado en formato .dwg.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCloseConfirmModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirmModal(false);
                  setRawBuffer(null);
                  setFileHandle(null);
                  setPlan(null);
                  setItems([]);
                  setBaseTextEdits({});
                  setBaseObjectEdits({});
                  setDraftPolyPts([]);
                  clearSelection();
                  setHasUnsavedChanges(false);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer"
              >
                Cerrar sin guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirmModal(false);
                  saveDwgFile(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Guardar y cerrar DWG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
