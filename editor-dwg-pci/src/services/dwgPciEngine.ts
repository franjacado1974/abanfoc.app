import {
  ACadVersion,
  Arc,
  AttachmentPointType,
  AttributeEntity,
  BlockRecord,
  CadDocument,
  Circle,
  Color,
  Dimension,
  DwgReader,
  DwgReaderConfiguration,
  DwgWriter,
  DwgWriterConfiguration,
  DxfReader,
  DxfReaderConfiguration,
  DxfWriter,
  DxfWriterConfiguration,
  Ellipse,
  Entity,
  Face3D,
  Hatch,
  Insert,
  Layer,
  Leader,
  Line,
  LineType,
  LineTypeSegment,
  LwPolyline,
  LwPolylineVertex,
  MText,
  Point,
  Polyline,
  Solid,
  Spline,
  TextEntity,
  TextHorizontalAlignment,
  TextVerticalAlignmentType,
  XY,
  XYZ
} from '@node-projects/acad-ts';

export type PciSymbolKind =
  | 'extintor'
  | 'detector_y'
  | 'pulsador_alarma'
  | 'detector_incendios'
  | 'detector_llama'
  | 'centralita'
  | 'pulsador_disparo'
  | 'pulsador_paro'
  | 'sirena'
  | 'rociador'
  // Elementos constructivos y puertas
  | 'arq_puerta_simple'
  | 'arq_puerta_doble'
  | 'arq_puerta_corredera'
  | 'arq_ventana'
  | 'arq_escalera'
  | 'arq_pilar'
  // Mobiliario y equipamiento en planta
  | 'mob_mesa_oficina'
  | 'mob_mesa_reuniones'
  | 'mob_silla'
  | 'mob_armario'
  | 'mob_sofa'
  | 'mob_cama'
  | 'mob_wc'
  | 'mob_lavabo'
  | 'mob_cocina'
  | 'mob_cuadro_elec'
  | 'mob_vehiculo';

export type ShapeDrawKind =
  | 'wall'
  | 'freehand'
  | 'line_shape'
  | 'rect_shape'
  | 'circle_shape';

export interface ShapeToolDefinition {
  kind: ShapeDrawKind;
  label: string;
  description: string;
  layerName: string;
}

export type PciCircuitKind =
  | 'deteccion'
  | 'disparo'
  | 'paro'
  | 'sirenas'
  | 'rociadores';

export interface PciSymbolDefinition {
  kind: PciSymbolKind;
  category?: 'pci' | 'arquitectura' | 'mobiliario';
  label: string;
  shortTag: string;
  description: string;
  layerName: string;
  blockName: string;
  defaultColorHex: string;
  defaultAci: number;
  defaultIsWB?: boolean;
  /** Escala inicial recomendada respecto al radio base */
  recommendedScale?: number;
  /** Si carece de fondo opaco por ser elemento arquitectónico hueco (ej. puerta, mesa) */
  transparentBackdrop?: boolean;
}

export interface PciCircuitDefinition {
  kind: PciCircuitKind;
  label: string;
  layerName: string;
  defaultColorHex: string;
  defaultAci: number;
  defaultDashed: boolean;
}

export const PCI_SYMBOL_CATALOG: PciSymbolDefinition[] = [
  {
    kind: 'extintor',
    label: 'Extintor',
    shortTag: 'EXT',
    description: 'Extintor portátil contra incendios',
    layerName: 'PCI-EXTINTORES',
    blockName: 'PCI_BLK_EXTINTOR',
    defaultColorHex: '#dc2626',
    defaultAci: 1
  },
  {
    kind: 'detector_y',
    label: 'Detector (Círculo con Y)',
    shortTag: 'DET-Y',
    description: 'Detector de incendios (círculo con Y griega interior)',
    layerName: 'PCI-DETECCION',
    blockName: 'PCI_BLK_DETECTOR_Y',
    defaultColorHex: '#dc2626',
    defaultAci: 1
  },
  {
    kind: 'pulsador_alarma',
    label: 'Pulsador de alarma',
    shortTag: 'PUL',
    description: 'Pulsador manual de alarma (cuadrado con círculo relleno)',
    layerName: 'PCI-PULSADORES',
    blockName: 'PCI_BLK_PULSADOR_ALARMA',
    defaultColorHex: '#dc2626',
    defaultAci: 1
  },
  {
    kind: 'detector_incendios',
    label: 'Detector de incendios',
    shortTag: 'DET',
    description: 'Detector puntual de humos / térmico (UNE 23032)',
    layerName: 'PCI-DETECCION',
    blockName: 'PCI_BLK_DETECTOR_INC',
    defaultColorHex: '#dc2626',
    defaultAci: 1
  },
  {
    kind: 'detector_llama',
    label: 'Detector de llama',
    shortTag: 'DLL',
    description: 'Detector óptico de llama UV/IR',
    layerName: 'PCI-DETECCION',
    blockName: 'PCI_BLK_DETECTOR_LLAMA',
    defaultColorHex: '#dc2626',
    defaultAci: 1
  },
  {
    kind: 'centralita',
    label: 'Centralita',
    shortTag: 'CIE',
    description: 'Central de detección, alarma y extinción',
    layerName: 'PCI-CENTRAL',
    blockName: 'PCI_BLK_CENTRALITA',
    defaultColorHex: '#dc2626',
    defaultAci: 1
  },
  {
    kind: 'pulsador_disparo',
    label: 'Pulsador de disparo',
    shortTag: 'P.DISP',
    description: 'Pulsador manual de disparo de extinción',
    layerName: 'PCI-PULSADORES',
    blockName: 'PCI_BLK_PULSADOR_DISPARO',
    defaultColorHex: '#ea580c',
    defaultAci: 30
  },
  {
    kind: 'pulsador_paro',
    label: 'Pulsador de paro',
    shortTag: 'P.PARO',
    description: 'Pulsador manual de paro / bloqueo de extinción',
    layerName: 'PCI-PULSADORES',
    blockName: 'PCI_BLK_PULSADOR_PARO',
    defaultColorHex: '#2563eb',
    defaultAci: 5
  },
  {
    kind: 'sirena',
    label: 'Sirena',
    shortTag: 'SIR',
    description: 'Sirena acústica / óptico-acústica de alarma',
    layerName: 'PCI-SIRENAS',
    blockName: 'PCI_BLK_SIRENA',
    defaultColorHex: '#dc2626',
    defaultAci: 1
  },
  {
    kind: 'rociador',
    label: 'Rociador',
    shortTag: 'ROC',
    description: 'Rociador automático de agua (Sprinkler)',
    layerName: 'PCI-ROCIADORES',
    blockName: 'PCI_BLK_ROCIADOR',
    defaultColorHex: '#0284c7',
    defaultAci: 4
  }
];

export const SHAPE_DRAW_CATALOG: ShapeToolDefinition[] = [
  {
    kind: 'wall',
    label: 'Pared / Muro doble',
    description: 'Traza tabiques o muros de doble línea punto a punto',
    layerName: 'ARQ-MUROS'
  },
  {
    kind: 'freehand',
    label: 'Mano alzada (Lápiz libre)',
    description: 'Dibuja paredes o croquis libremente arrastrando el ratón',
    layerName: 'ARQ-MANO-ALZADA'
  },
  {
    kind: 'rect_shape',
    label: 'Rectángulo / Habitación',
    description: 'Arrastra de esquina a esquina para crear estancias o recuadros',
    layerName: 'ARQ-FORMAS'
  },
  {
    kind: 'line_shape',
    label: 'Línea / Polilínea recta',
    description: 'Traza líneas rectas o poligonales punto a punto',
    layerName: 'ARQ-FORMAS'
  },
  {
    kind: 'circle_shape',
    label: 'Círculo',
    description: 'Arrastra desde el centro hacia fuera para crear un círculo',
    layerName: 'ARQ-FORMAS'
  }
];

export const ARCH_SYMBOL_CATALOG: PciSymbolDefinition[] = [
  {
    kind: 'arq_puerta_simple',
    category: 'arquitectura',
    label: 'Puerta abatible (1 hoja)',
    shortTag: 'PTA',
    description: 'Puerta de paso de 1 hoja con arco de barrido 90°',
    layerName: 'ARQ-CARPINTERIA',
    blockName: 'ARQ_BLK_PUERTA_1H',
    defaultColorHex: '#1e293b',
    defaultAci: 7,
    defaultIsWB: true,
    recommendedScale: 1.55,
    transparentBackdrop: true
  },
  {
    kind: 'arq_puerta_doble',
    category: 'arquitectura',
    label: 'Puerta doble (2 hojas)',
    shortTag: 'PTA2',
    description: 'Puerta abatible simétrica de doble hoja',
    layerName: 'ARQ-CARPINTERIA',
    blockName: 'ARQ_BLK_PUERTA_2H',
    defaultColorHex: '#1e293b',
    defaultAci: 7,
    defaultIsWB: true,
    recommendedScale: 1.85,
    transparentBackdrop: true
  },
  {
    kind: 'arq_puerta_corredera',
    category: 'arquitectura',
    label: 'Puerta corredera / RF',
    shortTag: 'PRF',
    description: 'Puerta corredera o cortafuegos deslizante',
    layerName: 'ARQ-CARPINTERIA',
    blockName: 'ARQ_BLK_PUERTA_CORREDERA',
    defaultColorHex: '#1e293b',
    defaultAci: 7,
    defaultIsWB: true,
    recommendedScale: 1.65,
    transparentBackdrop: true
  },
  {
    kind: 'arq_ventana',
    category: 'arquitectura',
    label: 'Ventana',
    shortTag: 'VNT',
    description: 'Carpintería de ventana con acristalamiento central',
    layerName: 'ARQ-CARPINTERIA',
    blockName: 'ARQ_BLK_VENTANA',
    defaultColorHex: '#1e293b',
    defaultAci: 7,
    defaultIsWB: true,
    recommendedScale: 1.65,
    transparentBackdrop: true
  },
  {
    kind: 'arq_escalera',
    category: 'arquitectura',
    label: 'Escalera',
    shortTag: 'ESC',
    description: 'Tramo de escalera con peldaños y sentido de subida',
    layerName: 'ARQ-ESCALERAS',
    blockName: 'ARQ_BLK_ESCALERA',
    defaultColorHex: '#1e293b',
    defaultAci: 7,
    defaultIsWB: true,
    recommendedScale: 2.3,
    transparentBackdrop: true
  },
  {
    kind: 'arq_pilar',
    category: 'arquitectura',
    label: 'Pilar / Columna',
    shortTag: 'PIL',
    description: 'Pilar estructural cuadrado en planta',
    layerName: 'ARQ-ESTRUCTURA',
    blockName: 'ARQ_BLK_PILAR',
    defaultColorHex: '#1e293b',
    defaultAci: 7,
    defaultIsWB: true,
    recommendedScale: 0.75,
    transparentBackdrop: true
  }
];

export const FURNITURE_SYMBOL_CATALOG: PciSymbolDefinition[] = [
  {
    kind: 'mob_mesa_oficina',
    category: 'mobiliario',
    label: 'Mesa de oficina + Silla',
    shortTag: 'MESA',
    description: 'Puesto de trabajo con escritorio y silla en planta',
    layerName: 'ARQ-MOBILIARIO',
    blockName: 'MOB_BLK_MESA_OFICINA',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 1.75,
    transparentBackdrop: true
  },
  {
    kind: 'mob_mesa_reuniones',
    category: 'mobiliario',
    label: 'Mesa de reuniones (6 plazas)',
    shortTag: 'REUN',
    description: 'Mesa alargada con 6 sillas alrededor',
    layerName: 'ARQ-MOBILIARIO',
    blockName: 'MOB_BLK_MESA_REUNIONES',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 2.35,
    transparentBackdrop: true
  },
  {
    kind: 'mob_silla',
    category: 'mobiliario',
    label: 'Silla',
    shortTag: 'SIL',
    description: 'Silla individual en planta',
    layerName: 'ARQ-MOBILIARIO',
    blockName: 'MOB_BLK_SILLA',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 0.85,
    transparentBackdrop: true
  },
  {
    kind: 'mob_armario',
    category: 'mobiliario',
    label: 'Armario / Estantería',
    shortTag: 'ARM',
    description: 'Módulo de armario o estantería con aspa interior',
    layerName: 'ARQ-MOBILIARIO',
    blockName: 'MOB_BLK_ARMARIO',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 1.65,
    transparentBackdrop: true
  },
  {
    kind: 'mob_sofa',
    category: 'mobiliario',
    label: 'Sofá',
    shortTag: 'SOFA',
    description: 'Sofá de 2-3 plazas en planta',
    layerName: 'ARQ-MOBILIARIO',
    blockName: 'MOB_BLK_SOFA',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 1.95,
    transparentBackdrop: true
  },
  {
    kind: 'mob_cama',
    category: 'mobiliario',
    label: 'Cama doble',
    shortTag: 'CAMA',
    description: 'Cama en planta con almohadas y embozo',
    layerName: 'ARQ-MOBILIARIO',
    blockName: 'MOB_BLK_CAMA',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 2.25,
    transparentBackdrop: true
  },
  {
    kind: 'mob_wc',
    category: 'mobiliario',
    label: 'Inodoro / WC',
    shortTag: 'WC',
    description: 'Aparato sanitario inodoro en planta',
    layerName: 'ARQ-SANITARIOS',
    blockName: 'MOB_BLK_WC',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 0.95,
    transparentBackdrop: true
  },
  {
    kind: 'mob_lavabo',
    category: 'mobiliario',
    label: 'Lavabo',
    shortTag: 'LAV',
    description: 'Lavabo mural con grifería en planta',
    layerName: 'ARQ-SANITARIOS',
    blockName: 'MOB_BLK_LAVABO',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 0.95,
    transparentBackdrop: true
  },
  {
    kind: 'mob_cocina',
    category: 'mobiliario',
    label: 'Cocina / Fregadero',
    shortTag: 'COC',
    description: 'Encimera con placa de cocción y seno',
    layerName: 'ARQ-MOBILIARIO',
    blockName: 'MOB_BLK_COCINA',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 1.85,
    transparentBackdrop: true
  },
  {
    kind: 'mob_cuadro_elec',
    category: 'mobiliario',
    label: 'Cuadro eléctrico',
    shortTag: 'CE',
    description: 'Armario / cuadro eléctrico general',
    layerName: 'ARQ-INSTALACIONES',
    blockName: 'MOB_BLK_CUADRO_ELEC',
    defaultColorHex: '#ca8a04',
    defaultAci: 2,
    recommendedScale: 1.15,
    transparentBackdrop: false
  },
  {
    kind: 'mob_vehiculo',
    category: 'mobiliario',
    label: 'Vehículo / Plaza garaje',
    shortTag: 'VEH',
    description: 'Turismo en planta para planos de aparcamiento',
    layerName: 'ARQ-MOBILIARIO',
    blockName: 'MOB_BLK_VEHICULO',
    defaultColorHex: '#64748b',
    defaultAci: 8,
    recommendedScale: 3.1,
    transparentBackdrop: true
  }
];

export const ALL_SYMBOL_CATALOG: PciSymbolDefinition[] = [
  ...PCI_SYMBOL_CATALOG,
  ...ARCH_SYMBOL_CATALOG,
  ...FURNITURE_SYMBOL_CATALOG
];

export const PCI_CIRCUIT_CATALOG: PciCircuitDefinition[] = [
  {
    kind: 'deteccion',
    label: 'Lazo Detección',
    layerName: 'PCI-CABLEADO-DETECCION',
    defaultColorHex: '#dc2626',
    defaultAci: 1,
    defaultDashed: false
  },
  {
    kind: 'disparo',
    label: 'Línea Disparo',
    layerName: 'PCI-CABLEADO-DISPARO',
    defaultColorHex: '#ea580c',
    defaultAci: 30,
    defaultDashed: true
  },
  {
    kind: 'paro',
    label: 'Línea Paro',
    layerName: 'PCI-CABLEADO-PARO',
    defaultColorHex: '#2563eb',
    defaultAci: 5,
    defaultDashed: true
  },
  {
    kind: 'sirenas',
    label: 'Línea Sirenas',
    layerName: 'PCI-CABLEADO-SIRENAS',
    defaultColorHex: '#e11d48',
    defaultAci: 1,
    defaultDashed: true
  },
  {
    kind: 'rociadores',
    label: 'Tubería Rociadores',
    layerName: 'PCI-TUBERIA-ROCIADORES',
    defaultColorHex: '#0284c7',
    defaultAci: 4,
    defaultDashed: false
  }
];

export const PCI_COLOR_PALETTE: Array<{
  label: string;
  hex: string;
  aci: number;
  isDefaultWB?: boolean;
}> = [
  { label: 'Blanco / Negro CAD', hex: '#1e293b', aci: 7, isDefaultWB: true },
  { label: 'Rojo PCI', hex: '#dc2626', aci: 1 },
  { label: 'Gris Mobiliario', hex: '#64748b', aci: 8 },
  { label: 'Naranja Disparo', hex: '#ea580c', aci: 30 },
  { label: 'Azul Paro', hex: '#2563eb', aci: 5 },
  { label: 'Cian Rociadores', hex: '#0284c7', aci: 4 },
  { label: 'Magenta', hex: '#db2777', aci: 6 },
  { label: 'Verde', hex: '#16a34a', aci: 3 },
  { label: 'Amarillo', hex: '#ca8a04', aci: 2 }
];

export interface PlacedPciSymbol {
  id: string;
  type: 'symbol';
  kind: PciSymbolKind;
  x: number;
  y: number;
  /** Escala multiplicadora sobre baseUnit del plano (ej. 1 = Mediano) */
  scale: number;
  /** Rotación en grados en sentido antihorario CAD */
  rotationDeg: number;
  /** Volteo horizontal (espejo en eje X, ideal para puertas) */
  mirrorX?: boolean;
  colorHex: string;
  aciColor: number;
  isDefaultWhiteBlack?: boolean;
  label: string;
}

export interface PlacedShapeItem {
  id: string;
  type: 'shape';
  shapeKind: ShapeDrawKind;
  points: Array<{ x: number; y: number }>;
  /** Para circle_shape */
  radius?: number;
  /** Escala de tamaño al redimensionar con los 4 tiradores (1 = original) */
  scale: number;
  /** Multiplicador de espesor de muro en wall (1 = tabique normal) */
  thicknessFactor?: number;
  dashed?: boolean;
  colorHex: string;
  aciColor: number;
  isDefaultWhiteBlack?: boolean;
}

export interface PlacedPciCable {
  id: string;
  type: 'cable';
  circuit: PciCircuitKind;
  points: Array<{ x: number; y: number }>;
  dashed: boolean;
  colorHex: string;
  aciColor: number;
  widthFactor: number;
  label: string;
}

export interface PlacedPciText {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  /** Escala sobre la altura base de texto del plano (1.0 = Mediano) */
  scale: number;
  rotationDeg: number;
  colorHex: string;
  aciColor: number;
  isDefaultWhiteBlack?: boolean;
}

export type PciOverlayItem =
  | PlacedPciSymbol
  | PlacedPciCable
  | PlacedPciText
  | PlacedShapeItem;

export interface Affine2D {
  // x' = a*x + c*y + tx
  // y' = b*x + d*y + ty
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface BaseDwgTextEdit {
  id: string;
  entityHandle: number;
  invMatrix: Affine2D;
  matrixScale: number;
  baseRotationRad: number;
  deleted?: boolean;
  x: number;
  y: number;
  text: string;
  height: number;
  rotationDeg: number;
  colorHex?: string;
  aciColor?: number;
  isDefaultWhiteBlack?: boolean;
}

export interface CadBaseObjectMeta {
  handle: number;
  label: string;
  layer: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
}

export interface BaseDwgObjectEdit {
  handle: number;
  origCx: number;
  origCy: number;
  scale: number;
  dx: number;
  dy: number;
  deleted?: boolean;
}

export type SymbolLocalPrimitive =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'filled_circle'; cx: number; cy: number; r: number }
  | { kind: 'arc'; cx: number; cy: number; r: number; startRad: number; endRad: number }
  | { kind: 'poly'; points: Array<{ x: number; y: number }>; closed: boolean }
  | { kind: 'solid'; points: Array<{ x: number; y: number }> }
  | { kind: 'text'; x: number; y: number; text: string; height: number };

/**
 * Devuelve la geometría vectorial normativa en coordenadas normalizadas (radio base = 1.0).
 * Se usa exactamente igual para renderizar en Canvas y para escribir bloques nativos en el DWG.
 */
export function getSymbolLocalPrimitives(kind: PciSymbolKind): SymbolLocalPrimitive[] {
  switch (kind) {
    case 'extintor':
      return [
        {
          kind: 'poly',
          closed: false,
          points: [
            { x: -0.42, y: 0.28 },
            { x: -0.42, y: -1.0 },
            { x: 0.42, y: -1.0 },
            { x: 0.42, y: 0.28 }
          ]
        },
        { kind: 'arc', cx: 0, cy: 0.28, r: 0.42, startRad: 0, endRad: Math.PI },
        { kind: 'line', x1: -0.42, y1: -0.06, x2: 0.42, y2: -0.06 },
        { kind: 'line', x1: -0.42, y1: -0.38, x2: 0.42, y2: -0.38 },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.13, y: 0.7 },
            { x: 0.13, y: 0.7 },
            { x: 0.13, y: 0.9 },
            { x: -0.13, y: 0.9 }
          ]
        },
        { kind: 'line', x1: -0.08, y1: 0.9, x2: 0.54, y2: 0.9 },
        { kind: 'line', x1: -0.04, y1: 0.92, x2: 0.5, y2: 1.12 },
        {
          kind: 'poly',
          closed: false,
          points: [
            { x: -0.13, y: 0.8 },
            { x: -0.62, y: 0.66 },
            { x: -0.66, y: -0.34 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.66, y: -0.34 },
            { x: -0.79, y: -0.7 },
            { x: -0.53, y: -0.7 }
          ]
        }
      ];

    case 'detector_y':
      return [
        { kind: 'circle', cx: 0, cy: 0, r: 1.0 },
        { kind: 'line', x1: 0, y1: -0.62, x2: 0, y2: 0.02 },
        { kind: 'line', x1: 0, y1: 0.02, x2: -0.48, y2: 0.56 },
        { kind: 'line', x1: 0, y1: 0.02, x2: 0.48, y2: 0.56 }
      ];

    case 'pulsador_alarma':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.95, y: -0.95 },
            { x: 0.95, y: -0.95 },
            { x: 0.95, y: 0.95 },
            { x: -0.95, y: 0.95 }
          ]
        },
        { kind: 'filled_circle', cx: 0, cy: 0, r: 0.44 }
      ];

    case 'detector_incendios':
      return [
        { kind: 'circle', cx: 0, cy: 0, r: 1.0 },
        { kind: 'line', x1: -0.78, y1: 0.25, x2: 0.78, y2: 0.25 },
        {
          kind: 'poly',
          closed: false,
          points: [
            { x: -0.46, y: 0.25 },
            { x: -0.28, y: -0.35 },
            { x: 0.28, y: -0.35 },
            { x: 0.46, y: 0.25 }
          ]
        },
        { kind: 'circle', cx: 0, cy: -0.58, r: 0.11 }
      ];

    case 'detector_llama':
      return [
        { kind: 'circle', cx: 0, cy: 0, r: 1.0 },
        { kind: 'line', x1: -0.52, y1: -0.58, x2: 0.52, y2: -0.58 },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.32, y: -0.46 },
            { x: -0.46, y: -0.04 },
            { x: -0.18, y: 0.34 },
            { x: -0.20, y: 0.04 },
            { x: 0.0, y: 0.70 },
            { x: 0.20, y: 0.04 },
            { x: 0.18, y: 0.34 },
            { x: 0.46, y: -0.04 },
            { x: 0.32, y: -0.46 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.13, y: -0.46 },
            { x: -0.16, y: -0.14 },
            { x: 0.0, y: 0.22 },
            { x: 0.16, y: -0.14 },
            { x: 0.13, y: -0.46 }
          ]
        }
      ];

    case 'centralita':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.4, y: -0.95 },
            { x: 1.4, y: -0.95 },
            { x: 1.4, y: 0.95 },
            { x: -1.4, y: 0.95 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.22, y: -0.78 },
            { x: 1.22, y: -0.78 },
            { x: 1.22, y: 0.78 },
            { x: -1.22, y: 0.78 }
          ]
        },
        { kind: 'line', x1: -1.22, y1: 0.32, x2: 1.22, y2: 0.32 },
        { kind: 'circle', cx: -0.88, cy: 0.55, r: 0.09 },
        { kind: 'circle', cx: -0.56, cy: 0.55, r: 0.09 },
        { kind: 'circle', cx: -0.24, cy: 0.55, r: 0.09 },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: 0.12, y: 0.43 },
            { x: 1.04, y: 0.43 },
            { x: 1.04, y: 0.67 },
            { x: 0.12, y: 0.67 }
          ]
        },
        { kind: 'text', x: 0, y: -0.24, text: 'CENTRAL', height: 0.32 }
      ];

    case 'pulsador_disparo':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.05, y: -1.05 },
            { x: 1.05, y: -1.05 },
            { x: 1.05, y: 1.05 },
            { x: -1.05, y: 1.05 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.86, y: -0.86 },
            { x: 0.86, y: -0.86 },
            { x: 0.86, y: 0.86 },
            { x: -0.86, y: 0.86 }
          ]
        },
        { kind: 'circle', cx: 0, cy: 0.18, r: 0.30 },
        {
          kind: 'solid',
          points: [
            { x: -0.10, y: 0.08 },
            { x: 0.10, y: 0.08 },
            { x: 0.10, y: 0.28 },
            { x: -0.10, y: 0.28 }
          ]
        },
        { kind: 'line', x1: -0.72, y1: 0.18, x2: -0.38, y2: 0.18 },
        {
          kind: 'solid',
          points: [
            { x: -0.36, y: 0.18 },
            { x: -0.52, y: 0.28 },
            { x: -0.52, y: 0.08 }
          ]
        },
        { kind: 'line', x1: 0.72, y1: 0.18, x2: 0.38, y2: 0.18 },
        {
          kind: 'solid',
          points: [
            { x: 0.36, y: 0.18 },
            { x: 0.52, y: 0.28 },
            { x: 0.52, y: 0.08 }
          ]
        },
        { kind: 'text', x: 0, y: -0.52, text: 'DISPARO', height: 0.23 }
      ];

    case 'pulsador_paro':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.05, y: -1.05 },
            { x: 1.05, y: -1.05 },
            { x: 1.05, y: 1.05 },
            { x: -1.05, y: 1.05 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.86, y: -0.86 },
            { x: 0.86, y: -0.86 },
            { x: 0.86, y: 0.86 },
            { x: -0.86, y: 0.86 }
          ]
        },
        { kind: 'circle', cx: 0, cy: 0.18, r: 0.34 },
        {
          kind: 'solid',
          points: [
            { x: -0.15, y: 0.03 },
            { x: 0.15, y: 0.03 },
            { x: 0.15, y: 0.33 },
            { x: -0.15, y: 0.33 }
          ]
        },
        { kind: 'text', x: 0, y: -0.52, text: 'PARO', height: 0.26 }
      ];

    case 'sirena':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.0, y: -0.42 },
            { x: -0.48, y: -0.42 },
            { x: -0.48, y: 0.42 },
            { x: -1.0, y: 0.42 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.48, y: -0.32 },
            { x: 0.28, y: -0.88 },
            { x: 0.28, y: 0.88 },
            { x: -0.48, y: 0.32 }
          ]
        },
        { kind: 'arc', cx: 0.18, cy: 0, r: 0.56, startRad: -0.68, endRad: 0.68 },
        { kind: 'arc', cx: 0.18, cy: 0, r: 0.86, startRad: -0.74, endRad: 0.74 }
      ];

    case 'rociador':
      return [
        { kind: 'circle', cx: 0, cy: 0, r: 0.82 },
        { kind: 'circle', cx: 0, cy: 0, r: 0.22 },
        { kind: 'line', x1: -0.58, y1: -0.58, x2: -0.16, y2: -0.16 },
        { kind: 'line', x1: 0.58, y1: -0.58, x2: 0.16, y2: -0.16 },
        { kind: 'line', x1: 0.58, y1: 0.58, x2: 0.16, y2: 0.16 },
        { kind: 'line', x1: -0.58, y1: 0.58, x2: -0.16, y2: 0.16 },
        { kind: 'line', x1: 0, y1: 0.82, x2: 0, y2: 1.12 },
        { kind: 'line', x1: -0.32, y1: 1.12, x2: 0.32, y2: 1.12 },
        { kind: 'line', x1: 0, y1: -0.82, x2: 0, y2: -1.12 },
        { kind: 'line', x1: -0.32, y1: -1.12, x2: 0.32, y2: -1.12 }
      ];

    // ===================== CARPINTERÍA Y ELEMENTOS CONSTRUCTIVOS =====================
    case 'arq_puerta_simple':
      return [
        // Jamba izquierda en (-0.85, -0.75), hoja vertical de longitud 1.50 y barrido 90°
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.85, y: -0.75 },
            { x: -0.75, y: -0.75 },
            { x: -0.75, y: 0.75 },
            { x: -0.85, y: 0.75 }
          ]
        },
        { kind: 'arc', cx: -0.85, cy: -0.75, r: 1.5, startRad: 0, endRad: Math.PI / 2 },
        { kind: 'line', x1: -0.95, y1: -0.75, x2: -0.85, y2: -0.75 },
        { kind: 'line', x1: 0.65, y1: -0.75, x2: 0.75, y2: -0.75 }
      ];

    case 'arq_puerta_doble':
      return [
        { kind: 'line', x1: -1.1, y1: -0.55, x2: -1.1, y2: 0.55 },
        { kind: 'arc', cx: -1.1, cy: -0.55, r: 1.1, startRad: 0, endRad: Math.PI / 2 },
        { kind: 'line', x1: 1.1, y1: -0.55, x2: 1.1, y2: 0.55 },
        { kind: 'arc', cx: 1.1, cy: -0.55, r: 1.1, startRad: Math.PI / 2, endRad: Math.PI }
      ];

    case 'arq_puerta_corredera':
      return [
        { kind: 'line', x1: -1.2, y1: -0.15, x2: -0.1, y2: -0.15 },
        { kind: 'line', x1: 0.45, y1: -0.15, x2: 1.2, y2: -0.15 },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.65, y: 0.02 },
            { x: 0.55, y: 0.02 },
            { x: 0.55, y: 0.16 },
            { x: -0.65, y: 0.16 }
          ]
        },
        { kind: 'line', x1: -0.3, y1: 0.42, x2: 0.35, y2: 0.42 },
        { kind: 'line', x1: 0.15, y1: 0.56, x2: 0.35, y2: 0.42 },
        { kind: 'line', x1: 0.15, y1: 0.28, x2: 0.35, y2: 0.42 }
      ];

    case 'arq_ventana':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.15, y: -0.22 },
            { x: 1.15, y: -0.22 },
            { x: 1.15, y: 0.22 },
            { x: -1.15, y: 0.22 }
          ]
        },
        { kind: 'line', x1: -1.15, y1: -0.05, x2: 1.15, y2: -0.05 },
        { kind: 'line', x1: -1.15, y1: 0.05, x2: 1.15, y2: 0.05 }
      ];

    case 'arq_escalera':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.2, y: -0.65 },
            { x: 1.2, y: -0.65 },
            { x: 1.2, y: 0.65 },
            { x: -1.2, y: 0.65 }
          ]
        },
        { kind: 'line', x1: -0.8, y1: -0.65, x2: -0.8, y2: 0.65 },
        { kind: 'line', x1: -0.4, y1: -0.65, x2: -0.4, y2: 0.65 },
        { kind: 'line', x1: 0.0, y1: -0.65, x2: 0.0, y2: 0.65 },
        { kind: 'line', x1: 0.4, y1: -0.65, x2: 0.4, y2: 0.65 },
        { kind: 'line', x1: 0.8, y1: -0.65, x2: 0.8, y2: 0.65 },
        { kind: 'line', x1: -0.95, y1: 0, x2: 0.95, y2: 0 },
        { kind: 'line', x1: 0.68, y1: 0.22, x2: 0.95, y2: 0 },
        { kind: 'line', x1: 0.68, y1: -0.22, x2: 0.95, y2: 0 }
      ];

    case 'arq_pilar':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.75, y: -0.75 },
            { x: 0.75, y: -0.75 },
            { x: 0.75, y: 0.75 },
            { x: -0.75, y: 0.75 }
          ]
        },
        { kind: 'line', x1: -0.75, y1: -0.75, x2: 0.75, y2: 0.75 },
        { kind: 'line', x1: -0.75, y1: 0.75, x2: 0.75, y2: -0.75 }
      ];

    // ===================== MOBILIARIO Y EQUIPAMIENTO EN PLANTA =====================
    case 'mob_mesa_oficina':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.05, y: -0.2 },
            { x: 1.05, y: -0.2 },
            { x: 1.05, y: 0.75 },
            { x: -1.05, y: 0.75 }
          ]
        },
        { kind: 'circle', cx: 0, cy: -0.56, r: 0.28 },
        { kind: 'arc', cx: 0, cy: -0.56, r: 0.38, startRad: Math.PI * 1.15, endRad: Math.PI * 1.85 }
      ];

    case 'mob_mesa_reuniones':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.25, y: -0.52 },
            { x: 1.25, y: -0.52 },
            { x: 1.25, y: 0.52 },
            { x: -1.25, y: 0.52 }
          ]
        },
        { kind: 'arc', cx: -0.72, cy: 0.68, r: 0.22, startRad: 0, endRad: Math.PI },
        { kind: 'arc', cx: 0, cy: 0.68, r: 0.22, startRad: 0, endRad: Math.PI },
        { kind: 'arc', cx: 0.72, cy: 0.68, r: 0.22, startRad: 0, endRad: Math.PI },
        { kind: 'arc', cx: -0.72, cy: -0.68, r: 0.22, startRad: Math.PI, endRad: Math.PI * 2 },
        { kind: 'arc', cx: 0, cy: -0.68, r: 0.22, startRad: Math.PI, endRad: Math.PI * 2 },
        { kind: 'arc', cx: 0.72, cy: -0.68, r: 0.22, startRad: Math.PI, endRad: Math.PI * 2 }
      ];

    case 'mob_silla':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.55, y: -0.45 },
            { x: 0.55, y: -0.45 },
            { x: 0.55, y: 0.45 },
            { x: -0.55, y: 0.45 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.55, y: 0.45 },
            { x: 0.55, y: 0.45 },
            { x: 0.55, y: 0.65 },
            { x: -0.55, y: 0.65 }
          ]
        }
      ];

    case 'mob_armario':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.15, y: -0.42 },
            { x: 1.15, y: -0.42 },
            { x: 1.15, y: 0.42 },
            { x: -1.15, y: 0.42 }
          ]
        },
        { kind: 'line', x1: -1.15, y1: -0.42, x2: 1.15, y2: 0.42 },
        { kind: 'line', x1: -1.15, y1: 0.42, x2: 1.15, y2: -0.42 }
      ];

    case 'mob_sofa':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.2, y: -0.5 },
            { x: 1.2, y: -0.5 },
            { x: 1.2, y: 0.55 },
            { x: -1.2, y: 0.55 }
          ]
        },
        { kind: 'line', x1: -0.95, y1: 0.28, x2: 0.95, y2: 0.28 },
        { kind: 'line', x1: -0.95, y1: -0.5, x2: -0.95, y2: 0.55 },
        { kind: 'line', x1: 0.95, y1: -0.5, x2: 0.95, y2: 0.55 },
        { kind: 'line', x1: 0, y1: -0.5, x2: 0, y2: 0.28 }
      ];

    case 'mob_cama':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.9, y: -1.1 },
            { x: 0.9, y: -1.1 },
            { x: 0.9, y: 1.1 },
            { x: -0.9, y: 1.1 }
          ]
        },
        { kind: 'line', x1: -0.9, y1: 0.45, x2: 0.9, y2: 0.45 },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.76, y: 0.6 },
            { x: -0.1, y: 0.6 },
            { x: -0.1, y: 0.96 },
            { x: -0.76, y: 0.96 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: 0.1, y: 0.6 },
            { x: 0.76, y: 0.6 },
            { x: 0.76, y: 0.96 },
            { x: 0.1, y: 0.96 }
          ]
        }
      ];

    case 'mob_wc':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.48, y: 0.42 },
            { x: 0.48, y: 0.42 },
            { x: 0.48, y: 0.85 },
            { x: -0.48, y: 0.85 }
          ]
        },
        { kind: 'circle', cx: 0, cy: -0.16, r: 0.46 },
        { kind: 'circle', cx: 0, cy: -0.18, r: 0.28 }
      ];

    case 'mob_lavabo':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.68, y: -0.48 },
            { x: 0.68, y: -0.48 },
            { x: 0.68, y: 0.55 },
            { x: -0.68, y: 0.55 }
          ]
        },
        { kind: 'circle', cx: 0, cy: -0.04, r: 0.34 },
        { kind: 'line', x1: 0, y1: 0.55, x2: 0, y2: 0.24 },
        { kind: 'circle', cx: 0, cy: 0.02, r: 0.06 }
      ];

    case 'mob_cocina':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.15, y: -0.55 },
            { x: 1.15, y: -0.55 },
            { x: 1.15, y: 0.55 },
            { x: -1.15, y: 0.55 }
          ]
        },
        { kind: 'circle', cx: -0.72, cy: 0.22, r: 0.18 },
        { kind: 'circle', cx: -0.26, cy: 0.22, r: 0.16 },
        { kind: 'circle', cx: -0.72, cy: -0.22, r: 0.16 },
        { kind: 'circle', cx: -0.26, cy: -0.22, r: 0.18 },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: 0.18, y: -0.35 },
            { x: 0.96, y: -0.35 },
            { x: 0.96, y: 0.35 },
            { x: 0.18, y: 0.35 }
          ]
        },
        { kind: 'circle', cx: 0.57, cy: 0, r: 0.07 }
      ];

    case 'mob_cuadro_elec':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.95, y: -0.68 },
            { x: 0.95, y: -0.68 },
            { x: 0.95, y: 0.68 },
            { x: -0.95, y: 0.68 }
          ]
        },
        {
          kind: 'poly',
          closed: false,
          points: [
            { x: 0.12, y: 0.46 },
            { x: -0.24, y: 0.02 },
            { x: 0.12, y: 0.02 },
            { x: -0.14, y: -0.46 }
          ]
        }
      ];

    case 'mob_vehiculo':
      return [
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -1.2, y: -0.56 },
            { x: 1.05, y: -0.56 },
            { x: 1.25, y: -0.38 },
            { x: 1.25, y: 0.38 },
            { x: 1.05, y: 0.56 },
            { x: -1.2, y: 0.56 }
          ]
        },
        {
          kind: 'poly',
          closed: true,
          points: [
            { x: -0.55, y: -0.42 },
            { x: 0.55, y: -0.42 },
            { x: 0.38, y: 0.42 },
            { x: -0.55, y: 0.42 }
          ]
        }
      ];
  }
}

/**
 * Calcula el contorno cerrado de doble línea paralela para una pared/muro por puntos.
 */
export function computeWallPolygonPoints(
  pts: Array<{ x: number; y: number }>,
  halfThick: number
): Array<{ x: number; y: number }> {
  if (pts.length < 2 || halfThick <= 0) return pts;
  const clean: Array<{ x: number; y: number }> = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (Math.hypot(pts[i].x - clean[clean.length - 1].x, pts[i].y - clean[clean.length - 1].y) > 1e-6) {
      clean.push(pts[i]);
    }
  }
  if (clean.length < 2) return pts;

  const normals: Array<{ nx: number; ny: number }> = [];
  for (let i = 0; i < clean.length - 1; i++) {
    const dx = clean[i + 1].x - clean[i].x;
    const dy = clean[i + 1].y - clean[i].y;
    const len = Math.hypot(dx, dy) || 1;
    normals.push({ nx: -dy / len, ny: dx / len });
  }

  const leftSide: Array<{ x: number; y: number }> = [];
  const rightSide: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < clean.length; i++) {
    let mx = 0;
    let my = 0;
    if (i === 0) {
      mx = normals[0].nx * halfThick;
      my = normals[0].ny * halfThick;
    } else if (i === clean.length - 1) {
      const lastN = normals[normals.length - 1];
      mx = lastN.nx * halfThick;
      my = lastN.ny * halfThick;
    } else {
      const n1 = normals[i - 1];
      const n2 = normals[i];
      let bx = n1.nx + n2.nx;
      let by = n1.ny + n2.ny;
      const blen = Math.hypot(bx, by);
      if (blen < 1e-5) {
        bx = n2.nx;
        by = n2.ny;
      } else {
        bx /= blen;
        by /= blen;
      }
      const dot = Math.max(0.42, bx * n2.nx + by * n2.ny);
      const miterLen = halfThick / dot;
      mx = bx * miterLen;
      my = by * miterLen;
    }
    leftSide.push({ x: clean[i].x + mx, y: clean[i].y + my });
    rightSide.push({ x: clean[i].x - mx, y: clean[i].y - my });
  }

  return [...leftSide, ...rightSide.reverse()];
}

export function getShapeBoundsAndScaledPoints(shape: PlacedShapeItem): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  scaledPoints: Array<{ x: number; y: number }>;
  scaledRadius: number;
} {
  if (shape.shapeKind === 'circle_shape' && shape.points.length >= 1) {
    const cx = shape.points[0].x;
    const cy = shape.points[0].y;
    const r = Math.max(1e-4, (shape.radius || 1) * (shape.scale || 1));
    return {
      minX: cx - r,
      minY: cy - r,
      maxX: cx + r,
      maxY: cy + r,
      cx,
      cy,
      scaledPoints: [{ x: cx, y: cy }],
      scaledRadius: r
    };
  }

  if (shape.points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      cx: 0,
      cy: 0,
      scaledPoints: [],
      scaledRadius: 0
    };
  }

  let rawMinX = Infinity;
  let rawMinY = Infinity;
  let rawMaxX = -Infinity;
  let rawMaxY = -Infinity;
  for (const pt of shape.points) {
    if (pt.x < rawMinX) rawMinX = pt.x;
    if (pt.x > rawMaxX) rawMaxX = pt.x;
    if (pt.y < rawMinY) rawMinY = pt.y;
    if (pt.y > rawMaxY) rawMaxY = pt.y;
  }
  const cx = (rawMinX + rawMaxX) * 0.5;
  const cy = (rawMinY + rawMaxY) * 0.5;
  const sc = shape.scale || 1;

  const scaledPoints = shape.points.map((pt) => ({
    x: cx + (pt.x - cx) * sc,
    y: cy + (pt.y - cy) * sc
  }));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of scaledPoints) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  return { minX, minY, maxX, maxY, cx, cy, scaledPoints, scaledRadius: 0 };
}

// ============================================================================
// ESTRUCTURAS DE RENDERIZADO 2D DEL PLANO BASE DWG
// ============================================================================

export interface CadRenderPolyline {
  rootHandle: number;
  layer: string;
  rgb: [number, number, number];
  isDefaultWhiteBlack: boolean;
  closed: boolean;
  points: Float64Array; // [x0, y0, x1, y1, ...]
}

export interface CadRenderCircle {
  rootHandle: number;
  layer: string;
  rgb: [number, number, number];
  isDefaultWhiteBlack: boolean;
  cx: number;
  cy: number;
  r: number;
}

export interface CadRenderSolid {
  rootHandle: number;
  layer: string;
  rgb: [number, number, number];
  isDefaultWhiteBlack: boolean;
  points: Float64Array;
}

export interface CadRenderText {
  id: string;
  rootHandle: number;
  isNestedInBlock: boolean;
  entityHandle: number;
  invMatrix: Affine2D;
  matrixScale: number;
  baseRotationRad: number;
  hAlign: 'left' | 'center' | 'right';
  layer: string;
  rgb: [number, number, number];
  isDefaultWhiteBlack: boolean;
  x: number;
  y: number;
  text: string;
  height: number;
  rotationRad: number;
}

export interface CadLayerSummary {
  name: string;
  visible: boolean;
  colorHex: string;
  entityCount: number;
}

export interface CadBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ParsedCadPlan {
  fileName: string;
  isDxf: boolean;
  versionLabel: string;
  activeBlockName: string;
  availableSpaces: Array<{ name: string; label: string; count: number }>;
  layers: CadLayerSummary[];
  polylines: CadRenderPolyline[];
  circles: CadRenderCircle[];
  solids: CadRenderSolid[];
  texts: CadRenderText[];
  baseObjects: Record<number, CadBaseObjectMeta>;
  bounds: CadBounds;
  /** Radio base recomendado para un símbolo PCI de escala 1.0 en unidades del DWG */
  baseSymbolRadius: number;
  totalEntities: number;
  warnings: string[];
}

const IDENTITY_MATRIX: Affine2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

function invertAffine(m: Affine2D): Affine2D {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) return IDENTITY_MATRIX;
  const invDet = 1 / det;
  const a = m.d * invDet;
  const b = -m.b * invDet;
  const c = -m.c * invDet;
  const d = m.a * invDet;
  return {
    a,
    b,
    c,
    d,
    tx: -(a * m.tx + c * m.ty),
    ty: -(b * m.tx + d * m.ty)
  };
}

function multiplyAffine(m1: Affine2D, m2: Affine2D): Affine2D {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty
  };
}

function applyAffine(m: Affine2D, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty];
}

function getMatrixScale(m: Affine2D): number {
  const sx = Math.hypot(m.a, m.b);
  const sy = Math.hypot(m.c, m.d);
  return (sx + sy) * 0.5 || 1;
}

function isUniformMatrix(m: Affine2D): boolean {
  const sx = Math.hypot(m.a, m.b);
  const sy = Math.hypot(m.c, m.d);
  if (sx === 0 || sy === 0) return false;
  return Math.abs(sx - sy) / Math.max(sx, sy) < 0.02;
}

function resolveEntityColor(
  entity: Entity,
  inheritedLayer: string,
  inheritedColor: Color | null,
  doc: CadDocument
): { layer: string; rgb: [number, number, number]; isDefaultWhiteBlack: boolean } {
  const rawLayerName = entity.layer?.name || '0';
  const effectiveLayerName = rawLayerName === '0' && inheritedLayer ? inheritedLayer : rawLayerName;

  let c = entity.color;
  if (c.isByBlock && inheritedColor) {
    c = inheritedColor;
  }
  if (c.isByLayer || c.isByBlock) {
    const layerObj = doc.layers?.tryGetValue(effectiveLayerName) ?? entity.layer;
    if (layerObj?.color) {
      c = layerObj.color;
    }
  }

  const isWhiteBlack = !c.isTrueColor && (c.index === 7 || c.index === 0 || c.index === 256);
  try {
    const rgbArr = c.getRgb();
    if (Array.isArray(rgbArr) && rgbArr.length >= 3) {
      return {
        layer: effectiveLayerName,
        rgb: [rgbArr[0] ?? 200, rgbArr[1] ?? 200, rgbArr[2] ?? 200],
        isDefaultWhiteBlack: isWhiteBlack
      };
    }
  } catch {
    // Fallback color
  }
  return {
    layer: effectiveLayerName,
    rgb: [210, 214, 220],
    isDefaultWhiteBlack: true
  };
}

function formatVersionLabel(ver: ACadVersion | undefined, isDxf = false): string {
  const fmt = isDxf ? 'DXF' : 'DWG';
  switch (ver) {
    case ACadVersion.AC1009:
      return `AutoCAD R11/R12 ${fmt} (AC1009)`;
    case ACadVersion.AC1012:
      return `AutoCAD R13 ${fmt} (AC1012)`;
    case ACadVersion.AC1014:
      return `AutoCAD R14 ${fmt} (AC1014)`;
    case ACadVersion.AC1015:
      return `AutoCAD 2000 ${fmt} (AC1015)`;
    case ACadVersion.AC1018:
      return `AutoCAD 2004 ${fmt} (AC1018)`;
    case ACadVersion.AC1021:
      return `AutoCAD 2007 ${fmt} (AC1021)`;
    case ACadVersion.AC1024:
      return `AutoCAD 2010 ${fmt} (AC1024)`;
    case ACadVersion.AC1027:
      return `AutoCAD 2013 ${fmt} (AC1027)`;
    case ACadVersion.AC1032:
      return `AutoCAD 2018+ ${fmt} (AC1032)`;
    default:
      return `AutoCAD ${fmt}`;
  }
}

export function detectIsDxfBuffer(buffer: ArrayBuffer, fileName: string): boolean {
  const bytes = new Uint8Array(buffer);
  // Cabecera mágica binaria DWG: empieza siempre por "AC10" (0x41 0x43 0x31 0x30)
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x41 &&
    bytes[1] === 0x43 &&
    bytes[2] === 0x31 &&
    bytes[3] === 0x30
  ) {
    return false;
  }
  if (fileName.toLowerCase().endsWith('.dxf')) {
    return true;
  }
  // Comprobar cabecera ASCII/Binary DXF (SECTION, 999, AutoCAD Binary DXF)
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(128, bytes.length)));
  if (
    head.includes('SECTION') ||
    head.includes('AutoCAD Binary DXF') ||
    /^\s*(0|999)\r?\n/.test(head.replace(/^\uFEFF/, ''))
  ) {
    return true;
  }
  return false;
}

function stripUtf8Bom(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return bytes.subarray(3);
  }
  return bytes;
}

function readCadDocumentFromBuffer(
  buffer: ArrayBuffer,
  isDxf: boolean,
  warnings: string[]
): CadDocument {
  if (isDxf) {
    const cleanBytes = stripUtf8Bom(new Uint8Array(buffer));
    const dxfCfg = new DxfReaderConfiguration();
    dxfCfg.failsafe = true;
    dxfCfg.createDefaults = true;
    try {
      const doc = DxfReader.readFromStreamWithConfig(cleanBytes, dxfCfg, (_s, e) => {
        if (e?.message && warnings.length < 25) warnings.push(e.message);
      });
      if (!doc.modelSpace) {
        doc.createDefaults();
      }
      return doc;
    } catch {
      // Fallback tolerante para archivos DXF minimalistas que sólo traen sección ENTITIES sin HEADER/TABLES
      const reader = new DxfReader(cleanBytes, (_s, e) => {
        if (e?.message && warnings.length < 25) warnings.push(e.message);
      });
      const fallbackDoc = new CadDocument(ACadVersion.AC1024, true);
      try {
        const ents = reader.readEntitiesOnly();
        for (const ent of ents) {
          fallbackDoc.modelSpace?.entities.add(ent);
        }
      } finally {
        reader.dispose();
      }
      return fallbackDoc;
    }
  }
  const cfg = new DwgReaderConfiguration();
  cfg.failsafe = true;
  cfg.crcCheck = false;
  return DwgReader.readFromStreamWithConfig(buffer, cfg, (_s, e) => {
    if (e?.message && warnings.length < 25) warnings.push(e.message);
  });
}

export function parseCadBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  preferredBlockName?: string
): ParsedCadPlan {
  const isDxf = detectIsDxfBuffer(buffer, fileName);
  const warnings: string[] = [];
  const doc = readCadDocumentFromBuffer(buffer, isDxf, warnings);

  // Detectar espacios disponibles (ModelSpace + PaperSpace / Layouts con geometría)
  const availableSpaces: Array<{ name: string; label: string; count: number }> = [];
  if (doc.modelSpace) {
    availableSpaces.push({
      name: doc.modelSpace.name,
      label: 'Modelo (Model Space)',
      count: doc.modelSpace.entities.count
    });
  }
  if (doc.layouts) {
    for (const layout of doc.layouts) {
      const blk = layout.associatedBlock;
      if (blk && blk.name !== doc.modelSpace?.name && blk.entities.count > 0) {
        availableSpaces.push({
          name: blk.name,
          label: `Presentación: ${layout.name}`,
          count: blk.entities.count
        });
      }
    }
  }

  let targetBlock: BlockRecord | null = doc.modelSpace;
  if (preferredBlockName && doc.blockRecords?.contains(preferredBlockName)) {
    targetBlock = doc.blockRecords.get(preferredBlockName);
  } else if (targetBlock && targetBlock.entities.count === 0 && availableSpaces.length > 1) {
    const richest = [...availableSpaces].sort((a, b) => b.count - a.count)[0];
    if (richest && doc.blockRecords?.contains(richest.name)) {
      targetBlock = doc.blockRecords.get(richest.name);
    }
  }

  const polylines: CadRenderPolyline[] = [];
  const circles: CadRenderCircle[] = [];
  const solids: CadRenderSolid[] = [];
  const texts: CadRenderText[] = [];
  const baseObjects: Record<number, CadBaseObjectMeta> = {};
  let textSeq = 0;
  const layerCounts = new Map<string, number>();

  const sampleXs: number[] = [];
  const sampleYs: number[] = [];

  const expandObjectBounds = (rootHandle: number, x: number, y: number) => {
    if (!rootHandle || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const meta = baseObjects[rootHandle];
    if (!meta) return;
    if (x < meta.minX) meta.minX = x;
    if (x > meta.maxX) meta.maxX = x;
    if (y < meta.minY) meta.minY = y;
    if (y > meta.maxY) meta.maxY = y;
  };

  const recordSample = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (Math.abs(x) > 1e11 || Math.abs(y) > 1e11) return;
    // Submuestreo ligero si hubiera cientos de miles de vértices
    if (sampleXs.length < 40000 || Math.random() < 0.15) {
      sampleXs.push(x);
      sampleYs.push(y);
    }
  };

  const pushPolylineXYZ = (
    pts: Array<{ x: number; y: number }>,
    closed: boolean,
    matrix: Affine2D,
    style: { layer: string; rgb: [number, number, number]; isDefaultWhiteBlack: boolean },
    rootHandle: number
  ) => {
    if (pts.length < 2) return;
    const arr = new Float64Array(pts.length * 2);
    let validCount = 0;
    for (let i = 0; i < pts.length; i++) {
      const [tx, ty] = applyAffine(matrix, pts[i].x, pts[i].y);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
      arr[validCount * 2] = tx;
      arr[validCount * 2 + 1] = ty;
      recordSample(tx, ty);
      expandObjectBounds(rootHandle, tx, ty);
      validCount++;
    }
    if (validCount < 2) return;
    const trimmed = validCount === pts.length ? arr : arr.subarray(0, validCount * 2);
    polylines.push({
      rootHandle,
      layer: style.layer,
      rgb: style.rgb,
      isDefaultWhiteBlack: style.isDefaultWhiteBlack,
      closed,
      points: trimmed
    });
    layerCounts.set(style.layer, (layerCounts.get(style.layer) ?? 0) + 1);
  };

  const visitEntity = (
    ent: Entity,
    matrix: Affine2D,
    inheritedLayer: string,
    inheritedColor: Color | null,
    depth: number,
    rootHandle: number
  ) => {
    if (depth > 8 || ent.isInvisible) return;
    const layerObj = doc.layers?.tryGetValue(ent.layer?.name || '0') ?? ent.layer;
    if (layerObj && layerObj.isOn === false) {
      // Aun así registramos la capa pero podemos incluir sus entidades para permitir encenderla/apagarla en UI
    }

    const style = resolveEntityColor(ent, inheritedLayer, inheritedColor, doc);

    if (ent instanceof Line) {
      pushPolylineXYZ([ent.startPoint, ent.endPoint], false, matrix, style, rootHandle);
      return;
    }

    if (ent instanceof LwPolyline) {
      try {
        const pts = ent.getPoints(16);
        pushPolylineXYZ(pts, ent.isClosed, matrix, style, rootHandle);
      } catch {
        const rawPts = ent.vertices.map((v) => v.location);
        pushPolylineXYZ(rawPts, ent.isClosed, matrix, style, rootHandle);
      }
      return;
    }

    if (ent instanceof Polyline) {
      try {
        const pts = ent.getPoints(16);
        pushPolylineXYZ(pts, ent.isClosed, matrix, style, rootHandle);
      } catch {
        // Ignore malformed legacy polyline
      }
      return;
    }

    // Importante: Arc hereda de Circle, comprobar Arc ANTES que Circle
    if (ent instanceof Arc) {
      try {
        const pts = ent.polygonalVertexes(28);
        pushPolylineXYZ(pts, false, matrix, style, rootHandle);
      } catch {
        // Ignore degenerate arc
      }
      return;
    }

    if (ent instanceof Circle) {
      if (ent.radius > 0 && isUniformMatrix(matrix)) {
        const [cx, cy] = applyAffine(matrix, ent.center.x, ent.center.y);
        const r = ent.radius * getMatrixScale(matrix);
        if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r) && r > 0) {
          circles.push({
            rootHandle,
            layer: style.layer,
            rgb: style.rgb,
            isDefaultWhiteBlack: style.isDefaultWhiteBlack,
            cx,
            cy,
            r
          });
          recordSample(cx - r, cy - r);
          recordSample(cx + r, cy + r);
          expandObjectBounds(rootHandle, cx - r, cy - r);
          expandObjectBounds(rootHandle, cx + r, cy + r);
          layerCounts.set(style.layer, (layerCounts.get(style.layer) ?? 0) + 1);
        }
      } else if (ent.radius > 0) {
        const pts = ent.polygonalVertexes(32);
        pushPolylineXYZ(pts, true, matrix, style, rootHandle);
      }
      return;
    }

    if (ent instanceof Ellipse) {
      try {
        const pts = ent.polygonalVertexes(36);
        pushPolylineXYZ(pts, ent.isFullEllipse, matrix, style, rootHandle);
      } catch {
        // Ignore degenerate ellipse
      }
      return;
    }

    if (ent instanceof Spline) {
      try {
        const res = ent.tryPolygonalVertexes(32);
        if (res.success && res.points.length >= 2) {
          pushPolylineXYZ(res.points, ent.isClosed, matrix, style, rootHandle);
        } else if (ent.controlPoints.length >= 2) {
          pushPolylineXYZ(ent.controlPoints, ent.isClosed, matrix, style, rootHandle);
        } else if (ent.fitPoints.length >= 2) {
          pushPolylineXYZ(ent.fitPoints, ent.isClosed, matrix, style, rootHandle);
        }
      } catch {
        // Ignore spline failure
      }
      return;
    }

    if (ent instanceof Solid || ent instanceof Face3D) {
      const rawCorners =
        ent instanceof Solid
          ? [ent.firstCorner, ent.secondCorner, ent.fourthCorner, ent.thirdCorner]
          : [ent.firstCorner, ent.secondCorner, ent.thirdCorner, ent.fourthCorner];
      const arr = new Float64Array(rawCorners.length * 2);
      for (let i = 0; i < rawCorners.length; i++) {
        const [tx, ty] = applyAffine(matrix, rawCorners[i].x, rawCorners[i].y);
        arr[i * 2] = tx;
        arr[i * 2 + 1] = ty;
        recordSample(tx, ty);
        expandObjectBounds(rootHandle, tx, ty);
      }
      solids.push({
        rootHandle,
        layer: style.layer,
        rgb: style.rgb,
        isDefaultWhiteBlack: style.isDefaultWhiteBlack,
        points: arr
      });
      layerCounts.set(style.layer, (layerCounts.get(style.layer) ?? 0) + 1);
      return;
    }

    if (ent instanceof Hatch) {
      for (const path of ent.paths) {
        for (const edge of path.edges) {
          try {
            const subEnt = edge.toEntity();
            if (subEnt) {
              visitEntity(subEnt, matrix, style.layer, ent.color, depth + 1, rootHandle);
            }
          } catch {
            // Ignore complex hatch edge
          }
        }
      }
      return;
    }

    if (ent instanceof Leader) {
      if (ent.vertices && ent.vertices.length >= 2) {
        pushPolylineXYZ(ent.vertices, false, matrix, style, rootHandle);
      }
      return;
    }

    if (ent instanceof Point) {
      const [px, py] = applyAffine(matrix, ent.location.x, ent.location.y);
      recordSample(px, py);
      expandObjectBounds(rootHandle, px, py);
      return;
    }

    if (ent instanceof TextEntity) {
      const clean = (ent.value || '').trim();
      if (!clean) return;
      const basePt =
        ent.horizontalAlignment !== TextHorizontalAlignment.Left &&
        (ent.alignmentPoint.x !== 0 || ent.alignmentPoint.y !== 0)
          ? ent.alignmentPoint
          : ent.insertPoint;
      const [tx, ty] = applyAffine(matrix, basePt.x, basePt.y);
      const mScale = getMatrixScale(matrix);
      const h = Math.max(0.0001, ent.height * mScale);
      const baseRot = Math.atan2(matrix.b, matrix.a);
      const hAlign: 'left' | 'center' | 'right' =
        ent.horizontalAlignment === TextHorizontalAlignment.Center ||
        ent.horizontalAlignment === TextHorizontalAlignment.Middle
          ? 'center'
          : ent.horizontalAlignment === TextHorizontalAlignment.Right
          ? 'right'
          : 'left';
      texts.push({
        id: `dwgtxt_${ent.handle}_${textSeq++}`,
        rootHandle: depth > 0 ? rootHandle : 0,
        isNestedInBlock: depth > 0,
        entityHandle: ent.handle,
        invMatrix: invertAffine(matrix),
        matrixScale: mScale,
        baseRotationRad: baseRot,
        hAlign,
        layer: style.layer,
        rgb: style.rgb,
        isDefaultWhiteBlack: style.isDefaultWhiteBlack,
        x: tx,
        y: ty,
        text: clean,
        height: h,
        rotationRad: baseRot + (ent.rotation || 0)
      });
      recordSample(tx, ty);
      if (depth > 0) expandObjectBounds(rootHandle, tx, ty);
      layerCounts.set(style.layer, (layerCounts.get(style.layer) ?? 0) + 1);
      return;
    }

    if (ent instanceof MText) {
      const clean = (ent.plainText || ent.value || '').replace(/\\P/g, '\n').trim();
      if (!clean) return;
      const [tx, ty] = applyAffine(matrix, ent.insertPoint.x, ent.insertPoint.y);
      const mScale = getMatrixScale(matrix);
      const h = Math.max(0.0001, ent.height * mScale);
      const baseRot = Math.atan2(matrix.b, matrix.a);
      const ap = ent.attachmentPoint;
      const hAlign: 'left' | 'center' | 'right' =
        ap === AttachmentPointType.TopCenter ||
        ap === AttachmentPointType.MiddleCenter ||
        ap === AttachmentPointType.BottomCenter
          ? 'center'
          : ap === AttachmentPointType.TopRight ||
            ap === AttachmentPointType.MiddleRight ||
            ap === AttachmentPointType.BottomRight
          ? 'right'
          : 'left';
      texts.push({
        id: `dwgtxt_${ent.handle}_${textSeq++}`,
        rootHandle: depth > 0 ? rootHandle : 0,
        isNestedInBlock: depth > 0,
        entityHandle: ent.handle,
        invMatrix: invertAffine(matrix),
        matrixScale: mScale,
        baseRotationRad: baseRot,
        hAlign,
        layer: style.layer,
        rgb: style.rgb,
        isDefaultWhiteBlack: style.isDefaultWhiteBlack,
        x: tx,
        y: ty,
        text: clean,
        height: h,
        rotationRad: baseRot + (ent.rotation || 0)
      });
      recordSample(tx, ty);
      if (depth > 0) expandObjectBounds(rootHandle, tx, ty);
      layerCounts.set(style.layer, (layerCounts.get(style.layer) ?? 0) + 1);
      return;
    }

    if (ent instanceof Dimension) {
      if (ent.block) {
        for (const sub of ent.block.entities) {
          visitEntity(sub, matrix, style.layer, ent.color, depth + 1, rootHandle);
        }
      }
      return;
    }

    if (ent instanceof Insert) {
      const blk = ent.block;
      if (!blk) return;
      const cols = Math.max(1, Math.min(50, ent.columnCount || 1));
      const rows = Math.max(1, Math.min(50, ent.rowCount || 1));
      const cos = Math.cos(ent.rotation || 0);
      const sin = Math.sin(ent.rotation || 0);
      const sx = ent.xScale || 1;
      const sy = ent.yScale || 1;
      const ox = blk.blockEntity?.basePoint?.x || 0;
      const oy = blk.blockEntity?.basePoint?.y || 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dx = c * (ent.columnSpacing || 0);
          const dy = r * (ent.rowSpacing || 0);
          const px = ent.insertPoint.x + dx * cos - dy * sin;
          const py = ent.insertPoint.y + dx * sin + dy * cos;

          const localM: Affine2D = {
            a: cos * sx,
            b: sin * sx,
            c: -sin * sy,
            d: cos * sy,
            tx: px - (cos * sx * ox - sin * sy * oy),
            ty: py - (sin * sx * ox + cos * sy * oy)
          };
          const combined = multiplyAffine(matrix, localM);
          for (const sub of blk.entities) {
            visitEntity(sub, combined, style.layer, ent.color, depth + 1, rootHandle);
          }
        }
      }
      // Atributos visibles del bloque
      if (ent.hasAttributes) {
        const mScale = getMatrixScale(matrix);
        const baseRot = Math.atan2(matrix.b, matrix.a);
        for (const attr of ent.attributes) {
          if (!attr.isInvisible && attr.value?.trim()) {
            const basePt =
              attr.horizontalAlignment !== TextHorizontalAlignment.Left &&
              (attr.alignmentPoint.x !== 0 || attr.alignmentPoint.y !== 0)
                ? attr.alignmentPoint
                : attr.insertPoint;
            const [ax, ay] = applyAffine(matrix, basePt.x, basePt.y);
            texts.push({
              id: `dwgtxt_${attr.handle}_${textSeq++}`,
              rootHandle: 0,
              isNestedInBlock: false,
              entityHandle: attr.handle,
              invMatrix: invertAffine(matrix),
              matrixScale: mScale,
              baseRotationRad: baseRot,
              hAlign:
                attr.horizontalAlignment === TextHorizontalAlignment.Center ||
                attr.horizontalAlignment === TextHorizontalAlignment.Middle
                  ? 'center'
                  : attr.horizontalAlignment === TextHorizontalAlignment.Right
                  ? 'right'
                  : 'left',
              layer: style.layer,
              rgb: style.rgb,
              isDefaultWhiteBlack: style.isDefaultWhiteBlack,
              x: ax,
              y: ay,
              text: attr.value.trim(),
              height: Math.max(0.0001, attr.height * mScale),
              rotationRad: baseRot + (attr.rotation || 0)
            });
          }
        }
      }
    }
  };

  if (targetBlock) {
    for (const ent of targetBlock.entities) {
      const isTopLevelText = ent instanceof TextEntity || ent instanceof MText;
      const topHandle = isTopLevelText ? 0 : ent.handle;
      if (topHandle) {
        const typeLabel =
          ent instanceof Insert
            ? `Bloque (${ent.block?.name || 'CAD'})`
            : ent instanceof Circle
            ? ent instanceof Arc
              ? 'Arco CAD'
              : 'Círculo CAD'
            : ent instanceof LwPolyline || ent instanceof Polyline
            ? 'Polilínea CAD'
            : ent instanceof Line
            ? 'Línea CAD'
            : ent instanceof Dimension
            ? 'Cota CAD'
            : 'Objeto DWG';
        baseObjects[topHandle] = {
          handle: topHandle,
          label: typeLabel,
          layer: ent.layer?.name || '0',
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity,
          cx: 0,
          cy: 0
        };
      }
      visitEntity(ent, IDENTITY_MATRIX, ent.layer?.name || '0', null, 0, topHandle);
      if (topHandle) {
        const meta = baseObjects[topHandle];
        if (!Number.isFinite(meta.minX) || !Number.isFinite(meta.maxX)) {
          delete baseObjects[topHandle];
        } else {
          meta.cx = (meta.minX + meta.maxX) * 0.5;
          meta.cy = (meta.minY + meta.maxY) * 0.5;
        }
      }
    }
  }

  const bounds = computeSmartBounds(sampleXs, sampleYs);
  const spanX = Math.max(1e-3, bounds.maxX - bounds.minX);
  const spanY = Math.max(1e-3, bounds.maxY - bounds.minY);
  const diag = Math.hypot(spanX, spanY);
  // Radio base ergonómico (~1.35% de la diagonal principal del edificio)
  const baseSymbolRadius = Number((diag * 0.0135).toPrecision(4)) || 1;

  const layers: CadLayerSummary[] = [];
  if (doc.layers) {
    for (const lyr of doc.layers) {
      const cnt = layerCounts.get(lyr.name) ?? 0;
      if (cnt === 0 && lyr.name !== '0') continue;
      const rgb = lyr.color?.getRgb?.() ?? [180, 180, 180];
      const hex = `#${[rgb[0] ?? 180, rgb[1] ?? 180, rgb[2] ?? 180]
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
        .join('')}`;
      layers.push({
        name: lyr.name,
        visible: lyr.isOn !== false,
        colorHex: hex,
        entityCount: cnt
      });
    }
  }
  layers.sort((a, b) => b.entityCount - a.entityCount);

  return {
    fileName,
    isDxf,
    versionLabel: formatVersionLabel(doc.header?.version, isDxf),
    activeBlockName: targetBlock?.name || '*Model_Space',
    availableSpaces,
    layers,
    polylines,
    circles,
    solids,
    texts,
    baseObjects,
    bounds,
    baseSymbolRadius,
    totalEntities: polylines.length + circles.length + solids.length + texts.length,
    warnings
  };
}

function computeSmartBounds(xs: number[], ys: number[]): CadBounds {
  if (xs.length === 0 || ys.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 70 };
  }
  const sortedX = [...xs].sort((a, b) => a - b);
  const sortedY = [...ys].sort((a, b) => a - b);

  const fullMinX = sortedX[0];
  const fullMaxX = sortedX[sortedX.length - 1];
  const fullMinY = sortedY[0];
  const fullMaxY = sortedY[sortedY.length - 1];

  if (sortedX.length < 24) {
    return ensureNonZeroBounds(fullMinX, fullMinY, fullMaxX, fullMaxY);
  }

  // Filtrado de puntos espurios lejanos (ej. marca en 0,0 en planos con coordenadas UTM)
  const p02X = sortedX[Math.floor(sortedX.length * 0.02)];
  const p98X = sortedX[Math.floor(sortedX.length * 0.98)];
  const p02Y = sortedY[Math.floor(sortedY.length * 0.02)];
  const p98Y = sortedY[Math.floor(sortedY.length * 0.98)];

  const coreSpanX = Math.max(1e-6, p98X - p02X);
  const coreSpanY = Math.max(1e-6, p98Y - p02Y);
  const fullSpanX = fullMaxX - fullMinX;
  const fullSpanY = fullMaxY - fullMinY;

  const useTrimX = fullSpanX > coreSpanX * 6;
  const useTrimY = fullSpanY > coreSpanY * 6;

  return ensureNonZeroBounds(
    useTrimX ? p02X - coreSpanX * 0.08 : fullMinX,
    useTrimY ? p02Y - coreSpanY * 0.08 : fullMinY,
    useTrimX ? p98X + coreSpanX * 0.08 : fullMaxX,
    useTrimY ? p98Y + coreSpanY * 0.08 : fullMaxY
  );
}

function ensureNonZeroBounds(minX: number, minY: number, maxX: number, maxY: number): CadBounds {
  if (maxX - minX < 1e-4) {
    minX -= 10;
    maxX += 10;
  }
  if (maxY - minY < 1e-4) {
    minY -= 10;
    maxY += 10;
  }
  return { minX, minY, maxX, maxY };
}

// ============================================================================
// ESCRITURA Y GUARDADO DE ELEMENTOS PCI EN EL ARCHIVO .DWG ORIGINAL
// ============================================================================

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  return [220, 38, 38];
}

function makeCadColor(hex: string, aciFallback: number): Color {
  try {
    const [r, g, b] = hexToRgb(hex);
    return new Color(r, g, b);
  } catch {
    return new Color(aciFallback || 1);
  }
}

function getOrCreateLayer(doc: CadDocument, name: string, aciColor: number): Layer {
  const existing = doc.layers?.tryGetValue(name);
  if (existing) return existing;
  const layer = new Layer(name);
  layer.color = new Color(aciColor);
  layer.isOn = true;
  if (doc.layers) {
    return doc.layers.tryAdd(layer);
  }
  return layer;
}

function getOrCreateDashedLineType(doc: CadDocument, dashLength: number): LineType {
  const name = 'PCI_TRAZOS';
  const existing = doc.lineTypes?.tryGetValue(name);
  if (existing) return existing;

  const lt = new LineType(name);
  lt.description = 'Linea discontinua cableado PCI';
  const segDash = new LineTypeSegment();
  segDash.length = Math.max(0.05, dashLength);
  const segGap = new LineTypeSegment();
  segGap.length = -Math.max(0.03, dashLength * 0.6);
  lt.addSegment(segDash);
  lt.addSegment(segGap);

  if (doc.lineTypes) {
    return doc.lineTypes.tryAdd(lt);
  }
  return lt;
}

function getOrCreatePciBlock(doc: CadDocument, def: PciSymbolDefinition): BlockRecord {
  // Usar un nombre limpio garantizado libre de colisiones previas
  const blockName = def.blockName;
  const existing = doc.blockRecords?.tryGetValue(blockName);
  if (existing) return existing;

  const blk = new BlockRecord(blockName);
  const primitives = getSymbolLocalPrimitives(def.kind);

  for (const prim of primitives) {
    if (prim.kind === 'line') {
      const ln = new Line(new XYZ(prim.x1, prim.y1, 0), new XYZ(prim.x2, prim.y2, 0));
      ln.color = Color.byBlock;
      blk.entities.add(ln);
    } else if (prim.kind === 'circle') {
      const c = new Circle(new XYZ(prim.cx, prim.cy, 0), prim.r);
      c.color = Color.byBlock;
      blk.entities.add(c);
    } else if (prim.kind === 'filled_circle') {
      const c = new Circle(new XYZ(prim.cx, prim.cy, 0), prim.r);
      c.color = Color.byBlock;
      blk.entities.add(c);
      const sectors = 16;
      for (let i = 0; i < sectors; i++) {
        const a1 = (i * Math.PI * 2) / sectors;
        const a2 = ((i + 1) * Math.PI * 2) / sectors;
        const x1 = prim.cx + Math.cos(a1) * prim.r;
        const y1 = prim.cy + Math.sin(a1) * prim.r;
        const x2 = prim.cx + Math.cos(a2) * prim.r;
        const y2 = prim.cy + Math.sin(a2) * prim.r;
        const tri = new Solid(
          new XYZ(prim.cx, prim.cy, 0),
          new XYZ(x1, y1, 0),
          new XYZ(x2, y2, 0),
          new XYZ(x2, y2, 0)
        );
        tri.color = Color.byBlock;
        blk.entities.add(tri);
      }
    } else if (prim.kind === 'arc') {
      const start = prim.startRad < 0 ? prim.startRad + Math.PI * 2 : prim.startRad;
      const end = prim.endRad < 0 ? prim.endRad + Math.PI * 2 : prim.endRad;
      const a = new Arc(new XYZ(prim.cx, prim.cy, 0), prim.r, start, end);
      a.color = Color.byBlock;
      blk.entities.add(a);
    } else if (prim.kind === 'poly') {
      const poly = new LwPolyline();
      poly.isClosed = prim.closed;
      poly.color = Color.byBlock;
      for (const pt of prim.points) {
        poly.vertices.push(new LwPolylineVertex(new XY(pt.x, pt.y)));
      }
      blk.entities.add(poly);
    } else if (prim.kind === 'solid') {
      const p = prim.points;
      if (p.length >= 3) {
        const fourth = p.length >= 4 ? p[3] : p[2];
        // En AutoCAD SOLID el orden de 4 esquinas es (0, 1, 3, 2) para cuadriláteros convexos
        const s = new Solid(
          new XYZ(p[0].x, p[0].y, 0),
          new XYZ(p[1].x, p[1].y, 0),
          p.length >= 4 ? new XYZ(fourth.x, fourth.y, 0) : new XYZ(p[2].x, p[2].y, 0),
          p.length >= 4 ? new XYZ(p[2].x, p[2].y, 0) : new XYZ(p[2].x, p[2].y, 0)
        );
        s.color = Color.byBlock;
        blk.entities.add(s);
      }
    } else if (prim.kind === 'text') {
      const t = new TextEntity(prim.text);
      t.color = Color.byBlock;
      t.height = prim.height;
      t.horizontalAlignment = TextHorizontalAlignment.Center;
      t.verticalAlignment = TextVerticalAlignmentType.Middle;
      t.insertPoint = new XYZ(prim.x, prim.y, 0);
      t.alignmentPoint = new XYZ(prim.x, prim.y, 0);
      blk.entities.add(t);
    }
  }

  if (doc.blockRecords) {
    return doc.blockRecords.tryAdd(blk);
  }
  return blk;
}

/**
 * Inyecta todos los símbolos y cableados PCI añadidos en una copia fresca del DWG original
 * y devuelve el archivo binario .dwg listo para guardar/descargar.
 */
export function exportModifiedDwgBuffer(
  originalBuffer: ArrayBuffer,
  wasDxf: boolean,
  activeBlockName: string,
  baseSymbolRadius: number,
  items: PciOverlayItem[],
  baseTextEdits: BaseDwgTextEdit[] = [],
  baseObjectEdits: BaseDwgObjectEdit[] = [],
  outputFormat: 'dwg' | 'dxf' = 'dwg'
): Uint8Array {
  const warnings: string[] = [];
  const doc = readCadDocumentFromBuffer(originalBuffer, wasDxf, warnings);

  // Asegurar versión compatible con bloques modernos, colores RGB y polilíneas ligeras si venía de R12 o sin cabecera
  if (
    !doc.header ||
    doc.header.version === ACadVersion.Unknown ||
    doc.header.version === ACadVersion.AC1009 ||
    doc.header.version === ACadVersion.AC1012 ||
    doc.header.version === ACadVersion.AC1014
  ) {
    if (doc.header) {
      doc.header.version = ACadVersion.AC1024;
    }
  }

  let targetBlock: BlockRecord | null = doc.modelSpace;
  if (activeBlockName && doc.blockRecords?.contains(activeBlockName)) {
    targetBlock = doc.blockRecords.get(activeBlockName);
  }
  if (!targetBlock) {
    throw new Error('No se encontró el bloque de modelo en el archivo DWG.');
  }

  // 0a. Aplicar escalado, traslación o borrado sobre objetos geométricos/bloques existentes del DWG
  for (const objEdit of baseObjectEdits) {
    if (!objEdit.handle) continue;
    const cadObj = doc.getCadObject(objEdit.handle);
    if (!(cadObj instanceof Entity)) continue;

    if (objEdit.deleted) {
      if (cadObj.owner instanceof BlockRecord) {
        cadObj.owner.entities.remove(cadObj);
      }
      continue;
    }

    try {
      if (Math.abs(objEdit.scale - 1) > 1e-4) {
        cadObj.applyScaling(
          new XYZ(objEdit.scale, objEdit.scale, 1),
          new XYZ(objEdit.origCx, objEdit.origCy, 0)
        );
      }
      if (Math.abs(objEdit.dx) > 1e-6 || Math.abs(objEdit.dy) > 1e-6) {
        cadObj.applyTranslation(new XYZ(objEdit.dx, objEdit.dy, 0));
      }
    } catch {
      // Ignorar si algún objeto exótico no admite matriz afín
    }
  }

  // 0. Aplicar ediciones, movimientos o borrados sobre textos existentes del propio DWG
  for (const edit of baseTextEdits) {
    if (!edit.entityHandle) continue;
    const obj = doc.getCadObject(edit.entityHandle);
    if (!obj) continue;

    if (edit.deleted) {
      if (obj instanceof AttributeEntity) {
        obj.value = '';
        obj.isInvisible = true;
      } else if (obj instanceof Entity && obj.owner instanceof BlockRecord) {
        obj.owner.entities.remove(obj);
      }
      continue;
    }

    const [lx, ly] = applyAffine(edit.invMatrix, edit.x, edit.y);
    const localScale = edit.matrixScale || 1;
    const localH = Math.max(0.0001, edit.height / localScale);
    const worldRotRad = (edit.rotationDeg * Math.PI) / 180;
    const localRotRad = worldRotRad - (edit.baseRotationRad || 0);

    const resolveEditColor = (): Color | null => {
      if (edit.isDefaultWhiteBlack) return new Color(7);
      if (edit.colorHex) return makeCadColor(edit.colorHex, edit.aciColor || 7);
      return null;
    };
    const nextColor = resolveEditColor();

    if (obj instanceof AttributeEntity) {
      obj.value = edit.text.replace(/\r?\n/g, ' ');
      obj.height = localH;
      obj.rotation = localRotRad;
      obj.insertPoint = new XYZ(lx, ly, 0);
      obj.alignmentPoint = new XYZ(lx, ly, 0);
      if (nextColor) obj.color = nextColor;
    } else if (obj instanceof MText) {
      obj.value = edit.text.replace(/\r?\n/g, '\\P');
      obj.height = localH;
      obj.rotation = localRotRad;
      obj.insertPoint = new XYZ(lx, ly, 0);
      if (nextColor) obj.color = nextColor;
    } else if (obj instanceof TextEntity) {
      if (edit.text.includes('\n') && obj.owner instanceof BlockRecord) {
        const mt = new MText(edit.text.replace(/\r?\n/g, '\\P'));
        mt.layer = obj.layer;
        mt.color = nextColor ?? obj.color;
        mt.height = localH;
        mt.rotation = localRotRad;
        mt.attachmentPoint =
          obj.horizontalAlignment === TextHorizontalAlignment.Center ||
          obj.horizontalAlignment === TextHorizontalAlignment.Middle
            ? AttachmentPointType.MiddleCenter
            : obj.horizontalAlignment === TextHorizontalAlignment.Right
            ? AttachmentPointType.MiddleRight
            : AttachmentPointType.BottomLeft;
        mt.insertPoint = new XYZ(lx, ly, 0);
        const ownerBlk = obj.owner;
        ownerBlk.entities.remove(obj);
        ownerBlk.entities.add(mt);
      } else {
        obj.value = edit.text;
        obj.height = localH;
        obj.rotation = localRotRad;
        obj.insertPoint = new XYZ(lx, ly, 0);
        obj.alignmentPoint = new XYZ(lx, ly, 0);
        if (nextColor) obj.color = nextColor;
      }
    }
  }

  const dashedLineType = getOrCreateDashedLineType(doc, baseSymbolRadius * 1.1);

  // 1a. Insertar paredes, formas y trazos a mano alzada creados por el usuario
  for (const item of items) {
    if (item.type !== 'shape') continue;
    const shapeDef =
      SHAPE_DRAW_CATALOG.find((s) => s.kind === item.shapeKind) ?? SHAPE_DRAW_CATALOG[0];
    const shapeLayer = getOrCreateLayer(doc, shapeDef.layerName, item.aciColor || 7);
    const cadColor = item.isDefaultWhiteBlack
      ? new Color(7)
      : makeCadColor(item.colorHex, item.aciColor || 7);

    const { scaledPoints, scaledRadius } = getShapeBoundsAndScaledPoints(item);

    if (item.shapeKind === 'circle_shape') {
      if (scaledPoints.length >= 1 && scaledRadius > 0) {
        const cir = new Circle(new XYZ(scaledPoints[0].x, scaledPoints[0].y, 0), scaledRadius);
        cir.layer = shapeLayer;
        cir.color = cadColor;
        if (item.dashed) cir.lineType = dashedLineType;
        targetBlock.entities.add(cir);
      }
      continue;
    }

    if (scaledPoints.length < 2) continue;

    if (item.shapeKind === 'wall') {
      const halfThick = Math.max(
        0.0001,
        baseSymbolRadius * 0.22 * (item.thicknessFactor || 1) * (item.scale || 1)
      );
      const wallOutline = computeWallPolygonPoints(scaledPoints, halfThick);
      const poly = new LwPolyline();
      poly.layer = shapeLayer;
      poly.isClosed = true;
      poly.color = cadColor;
      for (const pt of wallOutline) {
        poly.vertices.push(new LwPolylineVertex(new XY(pt.x, pt.y)));
      }
      targetBlock.entities.add(poly);
      continue;
    }

    if (item.shapeKind === 'rect_shape') {
      const p1 = scaledPoints[0];
      const p2 = scaledPoints[scaledPoints.length - 1];
      const poly = new LwPolyline();
      poly.layer = shapeLayer;
      poly.isClosed = true;
      poly.color = cadColor;
      if (item.dashed) poly.lineType = dashedLineType;
      poly.vertices.push(
        new LwPolylineVertex(new XY(p1.x, p1.y)),
        new LwPolylineVertex(new XY(p2.x, p1.y)),
        new LwPolylineVertex(new XY(p2.x, p2.y)),
        new LwPolylineVertex(new XY(p1.x, p2.y))
      );
      targetBlock.entities.add(poly);
      continue;
    }

    // freehand o line_shape
    const poly = new LwPolyline();
    poly.layer = shapeLayer;
    poly.isClosed = false;
    poly.color = cadColor;
    if (item.dashed) poly.lineType = dashedLineType;
    for (const pt of scaledPoints) {
      poly.vertices.push(new LwPolylineVertex(new XY(pt.x, pt.y)));
    }
    targetBlock.entities.add(poly);
  }

  // 1b. Insertar el cableado para que quede limpio por debajo de los símbolos
  for (const item of items) {
    if (item.type !== 'cable' || item.points.length < 2) continue;
    const circuitDef =
      PCI_CIRCUIT_CATALOG.find((c) => c.kind === item.circuit) ?? PCI_CIRCUIT_CATALOG[0];
    const layer = getOrCreateLayer(doc, circuitDef.layerName, item.aciColor || circuitDef.defaultAci);

    const poly = new LwPolyline();
    poly.layer = layer;
    poly.isClosed = false;
    poly.color = makeCadColor(item.colorHex, item.aciColor || circuitDef.defaultAci);
    poly.constantWidth = Math.max(0, baseSymbolRadius * 0.06 * (item.widthFactor || 1));
    if (item.dashed) {
      poly.lineType = dashedLineType;
    }

    for (const pt of item.points) {
      poly.vertices.push(new LwPolylineVertex(new XY(pt.x, pt.y)));
    }
    targetBlock.entities.add(poly);

    if (item.label.trim()) {
      const midIdx = Math.floor((item.points.length - 1) / 2);
      const p1 = item.points[midIdx];
      const p2 = item.points[midIdx + 1] ?? p1;
      const mx = (p1.x + p2.x) * 0.5;
      const my = (p1.y + p2.y) * 0.5 + baseSymbolRadius * 0.35;
      const txt = new TextEntity(item.label.trim());
      txt.layer = layer;
      txt.color = makeCadColor(item.colorHex, item.aciColor || circuitDef.defaultAci);
      txt.height = Math.max(0.01, baseSymbolRadius * 0.36);
      txt.horizontalAlignment = TextHorizontalAlignment.Center;
      txt.verticalAlignment = TextVerticalAlignmentType.Bottom;
      txt.insertPoint = new XYZ(mx, my, 0);
      txt.alignmentPoint = new XYZ(mx, my, 0);
      targetBlock.entities.add(txt);
    }
  }

  // 2. Insertar los bloques normativos de símbolos PCI, carpintería y mobiliario
  for (const item of items) {
    if (item.type !== 'symbol') continue;
    const def = ALL_SYMBOL_CATALOG.find((s) => s.kind === item.kind) ?? ALL_SYMBOL_CATALOG[0];
    const layer = getOrCreateLayer(doc, def.layerName, item.aciColor || def.defaultAci);
    const blk = getOrCreatePciBlock(doc, def);

    const worldScale = Math.max(0.0001, baseSymbolRadius * item.scale);
    const ins = new Insert(blk);
    ins.layer = layer;
    ins.color = item.isDefaultWhiteBlack
      ? new Color(7)
      : makeCadColor(item.colorHex, item.aciColor || def.defaultAci);
    ins.insertPoint = new XYZ(item.x, item.y, 0);
    ins.xScale = item.mirrorX ? -worldScale : worldScale;
    ins.yScale = worldScale;
    ins.zScale = worldScale;
    ins.rotation = (item.rotationDeg * Math.PI) / 180;
    targetBlock.entities.add(ins);

    if (item.label.trim()) {
      const labelYOffset = worldScale * (item.kind === 'centralita' ? 1.32 : 1.42);
      const txt = new TextEntity(item.label.trim());
      txt.layer = layer;
      txt.color = item.isDefaultWhiteBlack
        ? new Color(7)
        : makeCadColor(item.colorHex, item.aciColor || def.defaultAci);
      txt.height = Math.max(0.0001, worldScale * 0.38);
      txt.horizontalAlignment = TextHorizontalAlignment.Center;
      txt.verticalAlignment = TextVerticalAlignmentType.Top;
      txt.insertPoint = new XYZ(item.x, item.y - labelYOffset, 0);
      txt.alignmentPoint = new XYZ(item.x, item.y - labelYOffset, 0);
      targetBlock.entities.add(txt);
    }
  }

  // 3. Insertar textos libres nuevos creados por el usuario
  for (const item of items) {
    if (item.type !== 'text' || !item.text.trim()) continue;
    const textLayer = getOrCreateLayer(doc, 'PCI-TEXTOS', item.aciColor || 7);
    const cadColor = item.isDefaultWhiteBlack
      ? new Color(7)
      : makeCadColor(item.colorHex, item.aciColor || 1);
    const worldH = Math.max(0.0001, baseSymbolRadius * 0.55 * item.scale);
    const rotRad = (item.rotationDeg * Math.PI) / 180;

    if (item.text.includes('\n')) {
      const mt = new MText(item.text.replace(/\r?\n/g, '\\P'));
      mt.layer = textLayer;
      mt.color = cadColor;
      mt.height = worldH;
      mt.rotation = rotRad;
      mt.attachmentPoint = AttachmentPointType.MiddleCenter;
      mt.insertPoint = new XYZ(item.x, item.y, 0);
      targetBlock.entities.add(mt);
    } else {
      const txt = new TextEntity(item.text);
      txt.layer = textLayer;
      txt.color = cadColor;
      txt.height = worldH;
      txt.rotation = rotRad;
      txt.horizontalAlignment = TextHorizontalAlignment.Center;
      txt.verticalAlignment = TextVerticalAlignmentType.Middle;
      txt.insertPoint = new XYZ(item.x, item.y, 0);
      txt.alignmentPoint = new XYZ(item.x, item.y, 0);
      targetBlock.entities.add(txt);
    }
  }

  // 4. Serializar en formato .dxf o .dwg según se solicite
  if (outputFormat === 'dxf') {
    if (doc.header && doc.header.version < ACadVersion.AC1021) {
      doc.header.version = ACadVersion.AC1024;
    }
    const chunks: string[] = [];
    const sink = {
      write(val: string) {
        chunks.push(val);
      }
    };
    try {
      const dxfWriter = new DxfWriter(sink, doc, false);
      dxfWriter.write();
      dxfWriter.dispose();
    } catch {
      chunks.length = 0;
      const safeDxfCfg = new DxfWriterConfiguration();
      safeDxfCfg.writeDynamicBlockData = false;
      safeDxfCfg.writeXData = false;
      safeDxfCfg.updateDimensionsInModel = false;
      safeDxfCfg.updateDimensionsInBlocks = false;
      DxfWriter.writeToStream(sink, doc, false, safeDxfCfg);
    }
    return new TextEncoder().encode(chunks.join(''));
  }

  try {
    return DwgWriter.writeToBuffer(doc);
  } catch {
    const safeCfg = new DwgWriterConfiguration();
    safeCfg.writeDynamicBlockData = false;
    safeCfg.writeXData = false;
    safeCfg.updateDimensionsInModel = false;
    safeCfg.updateDimensionsInBlocks = false;
    try {
      return DwgWriter.writeToBuffer(doc, safeCfg);
    } catch {
      if (doc.header) {
        doc.header.version = ACadVersion.AC1024;
      }
      return DwgWriter.writeToBuffer(doc, safeCfg);
    }
  }
}

/**
 * Genera un plano arquitectónico .dwg de demostración (nave + oficinas + sala técnica)
 * por si el usuario quiere probar inmediatamente la colocación y guardado DWG.
 */
export function createSampleArchitecturalDwg(): ArrayBuffer {
  const doc = new CadDocument(ACadVersion.AC1024, true);

  const lyrMuros = new Layer('ARQ-MUROS');
  lyrMuros.color = new Color(7);
  doc.layers?.tryAdd(lyrMuros);

  const lyrPuertas = new Layer('ARQ-CARPINTERIA');
  lyrPuertas.color = new Color(8);
  doc.layers?.tryAdd(lyrPuertas);

  const lyrTextos = new Layer('ARQ-COTAS-TEXTOS');
  lyrTextos.color = new Color(9);
  doc.layers?.tryAdd(lyrTextos);

  const ms = doc.modelSpace;
  if (ms) {
    const addRect = (x1: number, y1: number, x2: number, y2: number, lyr: Layer) => {
      const p = new LwPolyline();
      p.layer = lyr;
      p.isClosed = true;
      p.vertices.push(
        new LwPolylineVertex(new XY(x1, y1)),
        new LwPolylineVertex(new XY(x2, y1)),
        new LwPolylineVertex(new XY(x2, y2)),
        new LwPolylineVertex(new XY(x1, y2))
      );
      ms.entities.add(p);
    };

    const addLine = (x1: number, y1: number, x2: number, y2: number, lyr: Layer) => {
      const l = new Line(new XYZ(x1, y1, 0), new XYZ(x2, y2, 0));
      l.layer = lyr;
      ms.entities.add(l);
    };

    const addDoor = (hingeX: number, hingeY: number, radius: number, startDeg: number, lyr: Layer) => {
      const startRad = (startDeg * Math.PI) / 180;
      const endRad = ((startDeg + 90) * Math.PI) / 180;
      const leafX = hingeX + Math.cos(startRad) * radius;
      const leafY = hingeY + Math.sin(startRad) * radius;
      addLine(hingeX, hingeY, leafX, leafY, lyr);
      const arc = new Arc(new XYZ(hingeX, hingeY, 0), radius, startRad, endRad);
      arc.layer = lyr;
      ms.entities.add(arc);
    };

    const addLabel = (x: number, y: number, label: string, h: number) => {
      const t = new TextEntity(label);
      t.layer = lyrTextos;
      t.height = h;
      t.horizontalAlignment = TextHorizontalAlignment.Center;
      t.verticalAlignment = TextVerticalAlignmentType.Middle;
      t.insertPoint = new XYZ(x, y, 0);
      t.alignmentPoint = new XYZ(x, y, 0);
      ms.entities.add(t);
    };

    // Perímetro exterior (24.00 m x 14.00 m) y doble línea de cerramiento
    addRect(0, 0, 24, 14, lyrMuros);
    addRect(-0.25, -0.25, 24.25, 14.25, lyrMuros);

    // Tabiquería interior: Vestíbulo / Recepción, Sala CPD / Cuadro Eléctrico, Oficinas y Almacén
    addLine(8, 0, 8, 5.2, lyrMuros);
    addLine(8, 6.4, 8, 14, lyrMuros);
    addLine(0, 8.5, 3.2, 8.5, lyrMuros);
    addLine(4.2, 8.5, 8, 8.5, lyrMuros);
    addLine(8, 9.5, 15.2, 9.5, lyrMuros);
    addLine(16.4, 9.5, 24, 9.5, lyrMuros);
    addLine(16, 9.5, 16, 14, lyrMuros);

    // Pilares interiores en nave/almacén
    addRect(12.8, 4.3, 13.2, 4.7, lyrMuros);
    addRect(18.8, 4.3, 19.2, 4.7, lyrMuros);

    // Puertas abatibles
    addDoor(8, 5.2, 1.2, 0, lyrPuertas);
    addDoor(3.2, 8.5, 1.0, 90, lyrPuertas);
    addDoor(15.2, 9.5, 1.2, 90, lyrPuertas);

    // Textos de estancias
    addLabel(4, 4.2, 'VESTIBULO / RECEPCION', 0.36);
    addLabel(4, 11.3, 'SALA TECNICA / CPD', 0.34);
    addLabel(12, 11.8, 'OFICINA TECNICA', 0.34);
    addLabel(20, 11.8, 'SALA SERVIDORES', 0.34);
    addLabel(16, 4.8, 'NAVE PRINCIPAL / ALMACEN', 0.44);
  }

  const bytes = DwgWriter.writeToBuffer(doc);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
