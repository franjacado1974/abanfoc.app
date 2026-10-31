import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowLeft, Receipt, Download, Search, CheckCircle2, Clock, AlertCircle,
  FileText, Trash2, Plus, Building2, Save, Edit, Copy, X,
  ArrowUp, ArrowDown, ArrowUpDown, Signature, CreditCard, Check,
  Wand2, Calendar, MapPin
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  subscribeFacturas, addFactura, updateFactura, deleteFactura,
  subscribeAlbaranes, updateAlbaran,
  subscribeClientes, subscribeCentros, subscribeEmpresas,
  subscribeArticulos,
  updateParte, updateReparacion, updateInstalacion, updateUrgencia,
  type Factura, type FacturaLinea, type Albaran, type Cliente, type Centro, type Empresa, type Articulo
} from './firebase';

const formatMoneda = (valor: number | string | undefined) => {
  const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : Number(valor || 0);
  if (isNaN(num)) return '0,00 €';
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${parts.join(',')} €`;
};

const formatFecha = (iso: string | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const isFirmaValida = (firma: string | undefined): boolean => {
  if (!firma) return false;
  if (firma.length <= 4400) return false;
  if (firma.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAADICAYAAAA0n5+2')) return false;
  return true;
};

const ESTADOS_FACTURA = [
  { valor: 'Pendiente' as const, etiqueta: 'Pendiente', color: 'bg-amber-100 text-amber-800 border-amber-300', icono: Clock },
  { valor: 'Cobrada' as const, etiqueta: 'Cobrada', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icono: CheckCircle2 },
  { valor: 'Vencida' as const, etiqueta: 'Vencida', color: 'bg-red-100 text-red-800 border-red-300', icono: AlertCircle },
  { valor: 'Borrador' as const, etiqueta: 'Borrador', color: 'bg-zinc-100 text-zinc-700 border-zinc-300', icono: FileText },
];

const FORMAS_PAGO = [
  'Transferencia bancaria',
  'Giro domiciliado',
  'Contado / Efectivo',
  'Tarjeta bancaria',
  'Confirming / Pagaré'
];

// Cargar imagen y optimizarla antes de incrustar en el PDF (Regla 5)
const cargarImagenOptimizadaPDF = async (url: string, maxWidth = 800, quality = 0.75): Promise<string | null> => {
  if (!url) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load error'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    let w = img.naturalWidth || img.width || 400;
    let h = img.naturalHeight || img.height || 200;
    if (w > maxWidth) {
      h = Math.round((h * maxWidth) / w);
      w = maxWidth;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
};

// Generador nativo en local de código QR escaneable (Versión 2-L, 25x25 módulos) optimizado para PDF
const generarQRVerifactuDataUrl = (urlText = 'https://www.abanfoc.es'): string => {
  const size = 25;
  const matrix: (number | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        matrix[r][c] = (inOuter || inInner) ? 1 : 0;
        isFunc[r][c] = true;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, 18);
  placeFinder(18, 0);

  // Patrón de alineamiento en (16..20, 16..20)
  for (let dr = 0; dr < 5; dr++) {
    for (let dc = 0; dc < 5; dc++) {
      const r = 16 + dr;
      const c = 16 + dc;
      const dark = dr === 0 || dr === 4 || dc === 0 || dc === 4 || (dr === 2 && dc === 2);
      matrix[r][c] = dark ? 1 : 0;
      isFunc[r][c] = true;
    }
  }

  // Patrones de sincronismo (fila 6 y columna 6)
  for (let i = 8; i < size - 8; i++) {
    if (!isFunc[6][i]) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0;
      isFunc[6][i] = true;
    }
    if (!isFunc[i][6]) {
      matrix[i][6] = i % 2 === 0 ? 1 : 0;
      isFunc[i][6] = true;
    }
  }

  // Módulo oscuro fijo y reserva de áreas de formato
  matrix[17][8] = 1;
  isFunc[17][8] = true;
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunc[8][i] = true;
      isFunc[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunc[8][size - 1 - i] = true;
    if (i < 7) isFunc[size - 1 - i][8] = true;
  }

  // Codificación Byte Mode (capacidad 34 bytes datos + 10 bytes ECC Reed-Solomon en GF(256))
  const bytes = Array.from(new TextEncoder().encode(urlText)).slice(0, 32);
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  pushBits(0b0100, 4); // Modo Byte
  pushBits(bytes.length, 8);
  bytes.forEach(b => pushBits(b, 8));
  pushBits(0, Math.min(4, 34 * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataWords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let w = 0;
    for (let j = 0; j < 8; j++) w = (w << 1) | bits[i + j];
    dataWords.push(w);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataWords.length < 34) {
    dataWords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Reed-Solomon GF(256) con polinomio primitivo 0x11d para 10 bytes ECC
  const gfExp = new Uint8Array(512);
  const gfLog = new Uint8Array(256);
  let v = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = v;
    gfLog[v] = i;
    v = (v << 1) ^ (v & 0x80 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
  const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]]);

  let gen = [1];
  for (let i = 0; i < 10; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], gfExp[i]);
    }
    gen = next;
  }

  const ecc = new Array(10).fill(0);
  for (const b of dataWords) {
    const factor = b ^ ecc[0];
    ecc.shift();
    ecc.push(0);
    for (let i = 0; i < 10; i++) {
      ecc[i] ^= gfMul(gen[i + 1], factor);
    }
  }

  const allWords = [...dataWords, ...ecc];
  const allBits: number[] = [];
  allWords.forEach(w => {
    for (let i = 7; i >= 0; i--) allBits.push((w >>> i) & 1);
  });

  // Colocación en zigzag de 2 columnas con Máscara 0 ((r + c) % 2 === 0)
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunc[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          const mask = (r + c) % 2 === 0 ? 1 : 0;
          matrix[r][c] = bit ^ mask;
        }
      }
    }
    upward = !upward;
  }

  // Información de formato para Nivel L (01) + Máscara 0 (000) -> 0x77c4
  const formatBits = 0x77c4;
  const fBit = (i: number) => (formatBits >>> i) & 1;
  const row8Cols = [0, 1, 2, 3, 4, 5, 7, 8];
  for (let i = 0; i < 8; i++) matrix[8][row8Cols[i]] = fBit(14 - i);
  const col8Rows = [7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 7; i++) matrix[col8Rows[i]][8] = fBit(6 - i);
  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = fBit(14 - i);
  for (let i = 0; i < 8; i++) matrix[8][size - 8 + i] = fBit(7 - i);

  // Renderizado en Canvas (cumpliendo Regla 5 de optimización JPEG para PDF)
  const scale = 8;
  const quietZone = 2;
  const canvasSize = (size + quietZone * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = '#111827';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        ctx.fillRect((c + quietZone) * scale, (r + quietZone) * scale, scale, scale);
      }
    }
  }
  return canvas.toDataURL('image/jpeg', 0.85);
};

// Función para sanear y formatear las observaciones de factura, garantizando que solo haga referencia al Albarán
export const limpiarNotasFactura = (notas?: string, albaranId?: string): string => {
  if (!notas && !albaranId) return '';
  let txt = (notas || '').trim();

  // 1. Eliminar referencias a pedido / pedido de venta entre paréntesis: (Pedido ...), (Ref. Pedido ...), (Pedido de Venta ...)
  txt = txt.replace(/\s*\(\s*(?:Ref\.?\s*)?(?:N[ºo°]\s*)?[Pp]edido(?:\s+de\s+[Vv]enta)?(?:\s*[:\-]?\s*[^)]*)?\)/gi, '');

  // 2. Eliminar conectores como ' y pedido de venta ...', ' y pedido ...', ', pedido de venta ...', ', pedido ...'
  txt = txt.replace(/(?:[\s,]+y|\s*,)\s*(?:el\s*)?(?:ref\.?\s*)?(?:n[ºo°]\s*)?pedido(?:\s+de\s+venta)?(?:\s*[:\-]?\s*[A-Z0-9.\-\/]+)?/gi, '');

  // 3. Eliminar oraciones o fragmentos independientes que hablen de Pedido de venta o Pedido
  txt = txt.replace(/(?:^|\n|\.\s+)(?:[-–•]\s*)?(?:Ref\.?\s*)?(?:N[ºo°]\s*)?[Pp]edido(?:\s+de\s+[Vv]enta)?(?:\s*[:\-]?\s*[A-Z0-9.\-\/]+)?\.?/gi, (match) => {
    return match.startsWith('\n') ? '\n' : (match.startsWith('.') ? '.' : '');
  });

  // 4. Limpiar espacios duplicados o puntos repetidos
  txt = txt.replace(/\s+\./g, '.').replace(/\.{2,}/g, '.').replace(/[ \t]+/g, ' ').trim();

  // 5. Si después de limpiar el texto queda vacío pero tenemos albaranId
  if (!txt && albaranId) {
    return `Factura emitida conforme al Albarán firmado ${albaranId}.`;
  }

  // 6. Asegurar punto final
  if (txt && !txt.endsWith('.')) {
    txt += '.';
  }

  return txt;
};

// Generador de PDF oficial de Factura con estética corporativa ABANFOC S.L.
async function generarFacturaOficialPDF(
  factura: Factura,
  clienteObj?: Cliente,
  centroObj?: Centro,
  empresaObj?: Empresa
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margen = 14;

  // 1. CABECERA OFICIAL ABANFOC S.L.
  const logoSrc = '/logo.png';
  const logoBase64 = await cargarImagenOptimizadaPDF(logoSrc, 800, 0.75);

  const lineRedTopY = 9.5;
  const lineRedBottomY = 25.5;

  if (logoBase64) {
    try {
      const props = doc.getImageProperties(logoBase64);
      const maxW = 56;
      const maxH = 18;
      const ratio = (props.width && props.height) ? props.width / props.height : 2.8;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      const logoYCalculado = lineRedTopY + ((lineRedBottomY - lineRedTopY) - h) / 2;
      const logoY = Math.max(3, logoYCalculado - 2);
      doc.addImage(logoBase64, 'JPEG', margen, logoY, w, h);
    } catch {}
  }

  // 1ª Línea roja vertical
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.45);
  doc.line(78, lineRedTopY, 78, lineRedBottomY);

  // Datos de la Empresa en el centro
  const empCif = 'B16794679';
  const empDir = 'C/ America 16 B Ático (08921)';
  const empLoc = 'Sta. Coloma Gramanet, Barcelona';
  const empRasic = '10600168';

  const colEmpresaX = 82;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(25, 30, 40);
  doc.text(`ABANFOC S.L. - CIF: ${empCif}`, colEmpresaX, 12.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(70, 75, 85);
  doc.text(empDir, colEmpresaX, 16.3);
  doc.text(empLoc, colEmpresaX, 20.1);
  doc.text(`RASIC: ${empRasic}`, colEmpresaX, 23.9);

  // 2ª Línea roja vertical
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.45);
  doc.line(146, lineRedTopY, 146, lineRedBottomY);

  // Contacto a la derecha
  const colContactoX = 150;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(70, 75, 85);
  doc.text('www.abanfoc.es', colContactoX, 12.5);
  doc.text('Oficina: 930108917', colContactoX, 16.3);
  doc.text('Técnicos: 615864999', colContactoX, 20.1);
  doc.text('abanfoc@abanfoc.es', colContactoX, 23.9);

  // TÍTULO CENTRAL: FACTURA
  let y = 37;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 25);
  doc.text('FACTURA', pageWidth / 2, y, { align: 'center' });

  const subtitulo = (factura.titulo || '').trim();
  if (subtitulo) {
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 65, 75);
    doc.text(subtitulo.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  }

  y += 7;

  // 2. BLOQUE DE DATOS DE FACTURA (IZQUIERDA) Y CLIENTE (DERECHA)
  const colStartY = y;
  const colMidX = 104;

  const numFacturaStr = factura.numeroFactura || factura.id || 'FAC-001';
  const fechaEmisionStr = formatFecha(factura.fechaCreacion);
  const fechaVencStr = factura.fechaVencimiento ? formatFecha(factura.fechaVencimiento) : 'A la recepción';
  const formaPagoStr = factura.formaPago || 'Transferencia bancaria';
  const ibanStr = factura.iban || (empresaObj as any)?.iban || (empresaObj as any)?.cuenta || 'ES2800810039810001554059';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(220, 38, 38);
  doc.text('DATOS DE LA FACTURA', margen, colStartY);

  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.line(margen, colStartY + 1.5, margen + 46, colStartY + 1.5);

  let leftY = colStartY + 5.5;
  const drawLeftRow = (label: string, val: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 75, 85);
    doc.text(label, margen, leftY);
    const labelW = doc.getTextWidth(label);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(val, margen + labelW + 1, leftY);
    leftY += 4;
  };

  drawLeftRow('Nº Factura: ', numFacturaStr);
  drawLeftRow('Fecha emisión: ', fechaEmisionStr);
  drawLeftRow('Vencimiento: ', fechaVencStr);
  if (factura.albaranId) {
    drawLeftRow('Ref. Albarán: ', factura.albaranId);
  }
  drawLeftRow('Forma de pago: ', formaPagoStr);
  drawLeftRow('Cuenta IBAN: ', ibanStr);

  // Barra vertical roja separadora
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.45);
  doc.line(colMidX, colStartY + 2.5, colMidX, Math.max(colStartY + 25.5, leftY - 2));

  // Columna Derecha: DATOS FISCALES DEL CLIENTE
  const cliNombre = factura.nombreCliente || factura.clienteNombreLibre || clienteObj?.nombre || 'Cliente';
  const cliCif = factura.cifCliente || clienteObj?.cif || '—';
  const cliDir = factura.direccionCliente || clienteObj?.direccion || centroObj?.direccion || '';
  const cliLocParts = [
    factura.cpCliente || clienteObj?.cp,
    factura.poblacionCliente || clienteObj?.poblacion || centroObj?.poblacion,
    factura.provinciaCliente || clienteObj?.provincia || centroObj?.provincia
  ].filter(Boolean);
  const cliLoc = cliLocParts.join(', ');
  const cenNombre = centroObj?.nombre || factura.centroNombreLibre || '';

  const colCliX = colMidX + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(220, 38, 38);
  doc.text('DATOS FISCALES DEL CLIENTE', colCliX, colStartY);

  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.line(colCliX, colStartY + 1.5, colCliX + 52, colStartY + 1.5);

  let rightY = colStartY + 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  const cliNombreLines = doc.splitTextToSize(cliNombre, pageWidth - margen - colCliX);
  cliNombreLines.forEach((ln: string) => {
    doc.text(ln, colCliX, rightY);
    rightY += 4;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 60, 70);
  doc.text(`CIF / NIF: ${cliCif}`, colCliX, rightY);
  rightY += 4;
  if (cliDir) {
    doc.text(cliDir, colCliX, rightY);
    rightY += 4;
  }
  if (cliLoc) {
    doc.text(cliLoc, colCliX, rightY);
    rightY += 4;
  }
  if (cenNombre && cenNombre.toLowerCase() !== cliNombre.toLowerCase()) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Centro: ${cenNombre}`, colCliX, rightY);
    rightY += 4;
  }

  // 3. TABLA DE CONCEPTOS FACTURADOS
  const tableStartY = Math.max(leftY, rightY) + 4;
  const tableBody = (factura.items || []).map((item) => {
    const fam = (item.familia || item.concepto || '').trim();
    const desc = (item.descripcion || '').trim();
    let textoConcepto = '';
    if (fam && desc && fam.toLowerCase() !== desc.toLowerCase()) {
      textoConcepto = `${fam.toUpperCase()}\n${desc}`;
    } else {
      textoConcepto = (fam || desc || 'Concepto').toUpperCase();
    }

    return [
      item.codigo || '-',
      textoConcepto,
      formatMoneda(item.precioUnidad || 0),
      String(item.cantidad || 1),
      formatMoneda(item.subtotal || ((item.cantidad || 1) * (item.precioUnidad || 0)))
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      'Código',
      'Concepto / Descripción',
      { content: 'Precio', styles: { halign: 'right' } },
      { content: 'Und.', styles: { halign: 'center' } },
      { content: 'Subtotal', styles: { halign: 'right' } }
    ]],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [25, 30, 40],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2.5, left: 2, right: 2 },
      lineWidth: { bottom: 0.8, top: 0, left: 0, right: 0 },
      lineColor: [100, 110, 125],
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [75, 80, 90],
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      valign: 'middle',
      minCellHeight: 9,
      lineWidth: { bottom: 0.25, top: 0, left: 0, right: 0 },
      lineColor: [225, 228, 235],
      fillColor: [255, 255, 255],
    },
    margin: { left: margen, right: margen },
    columnStyles: {
      0: { cellWidth: 20, halign: 'left', fontStyle: 'bold', fontSize: 6.8, textColor: [110, 115, 125] },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [25, 30, 40] }
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1) {
        const linea = (factura.items || [])[data.row.index];
        const fam = (linea?.familia || linea?.concepto || '').trim();
        const desc = (linea?.descripcion || '').trim();
        let numFamLines = 0;
        if (fam && desc && fam.toLowerCase() !== desc.toLowerCase()) {
          const usableW = (data.cell.width && data.cell.width > 5) ? (data.cell.width - 4) : 95;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          const fLines = doc.splitTextToSize(fam.toUpperCase(), usableW);
          numFamLines = fLines.length;
        }
        data.cell._customFamLines = numFamLines;
      }
    },
    willDrawCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1 && data.cell._customFamLines > 0) {
        data.cell._savedText = data.cell.text;
        data.cell.text = [];
      }
    },
    didDrawCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 1 && data.cell._savedText) {
        const cell = data.cell;
        const lines: string[] = Array.isArray(cell._savedText) ? cell._savedText : [String(cell._savedText)];
        const numFamLines: number = cell._customFamLines || 0;
        const leftX = cell.x + 2;
        const lineH = 3.3;
        const totalTextH = lines.length * lineH;
        let startY = cell.y + (cell.height - totalTextH) / 2 + 2.5;
        if (startY < cell.y + 4.2) startY = cell.y + 4.2;

        lines.forEach((lineText: string, idx: number) => {
          if (idx < numFamLines) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(25, 30, 40);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(95, 100, 110);
          }
          doc.text(lineText, leftX, startY + (idx * lineH));
        });
      }
    }
  });

  // 4. BLOQUE DE TOTALES (BASE IMPONIBLE, DESCUENTO, IVA Y TOTAL FACTURA)
  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 15;
  const totalX = pageWidth - margen;
  let currentTotY = finalY + 5;

  const subtotalBruto = Number(factura.subtotal) || 0;
  const descPorc = Number(factura.descuentoPorcentaje) || 0;
  const descImp = Number(factura.descuentoImporte) || (subtotalBruto * descPorc / 100);
  const baseImponible = Math.max(0, subtotalBruto - descImp);
  const ivaPorc = factura.iva !== undefined ? Number(factura.iva) : 21;
  const cuotaIva = baseImponible * (ivaPorc / 100);
  const totalFactura = Number(factura.total) || (baseImponible + cuotaIva);

  const firmaBoxH = 34;
  const footerSafeZone = 30 + firmaBoxH + 8;
  if (currentTotY + 42 > pageHeight - footerSafeZone) {
    doc.addPage();
    currentTotY = 20;
  }

  // BLOQUE IZQUIERDO DEBAJO DE LA ÚLTIMA LÍNEA: QR TRIBUTARIO (VERI*FACTU - PRUEBA www.abanfoc.es)
  const qrTopY = currentTotY + 1;
  const qrSizeMm = 21;
  const qrBoxX = margen + 2;
  const qrCenterX = qrBoxX + qrSizeMm / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(25, 30, 40);
  doc.text('QR tributario:', qrCenterX, qrTopY, { align: 'center' });

  const qrImgData = generarQRVerifactuDataUrl('https://www.abanfoc.es');
  const qrImgY = qrTopY + 1.5;
  if (qrImgData) {
    try {
      doc.setDrawColor(215, 220, 228);
      doc.setLineWidth(0.2);
      doc.rect(qrBoxX, qrImgY, qrSizeMm, qrSizeMm);
      doc.addImage(qrImgData, 'JPEG', qrBoxX + 0.4, qrImgY + 0.4, qrSizeMm - 0.8, qrSizeMm - 0.8);
    } catch {}
  }

  const qrFooterY = qrImgY + qrSizeMm + 3.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(25, 30, 40);
  doc.text('VERI*FACTU', qrCenterX, qrFooterY, { align: 'center' });

  if (descPorc > 0) {
    currentTotY += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(220, 38, 38);
    doc.text(`Descuento (${descPorc.toFixed(2).replace('.', ',')}%):`, totalX - 52, currentTotY, { align: 'right' });
    doc.text(`-${formatMoneda(descImp)}`, totalX, currentTotY, { align: 'right' });
    currentTotY += 5.5;
  } else {
    currentTotY += 3;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(75, 80, 90);
  doc.text('Base Imponible:', totalX - 52, currentTotY, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 35, 45);
  doc.text(formatMoneda(baseImponible), totalX, currentTotY, { align: 'right' });

  currentTotY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 80, 90);
  if (ivaPorc === 0) {
    doc.text('IVA (0% Exento):', totalX - 52, currentTotY, { align: 'right' });
    doc.text('0,00 €', totalX, currentTotY, { align: 'right' });
  } else {
    doc.text(`IVA (${ivaPorc}%):`, totalX - 52, currentTotY, { align: 'right' });
    doc.text(formatMoneda(cuotaIva), totalX, currentTotY, { align: 'right' });
  }

  currentTotY += 3.8;
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.45);
  doc.line(totalX - 60, currentTotY, totalX, currentTotY);

  currentTotY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 25);
  doc.text('TOTAL FACTURA:', totalX - 52, currentTotY, { align: 'right' });
  doc.setTextColor(220, 38, 38);
  doc.text(formatMoneda(totalFactura), totalX, currentTotY, { align: 'right' });

  let currentBottomY = Math.max(currentTotY + 7, qrFooterY + 5);
  if (ivaPorc === 0) {
    doc.setDrawColor(230, 220, 200);
    doc.setFillColor(255, 250, 243);
    const textoExencion = 'Factura exenta de IVA por inversión del sujeto pasivo de acuerdo con el artículo 84 letra f-Uno. 2º - Ley 37/1992 - art. 5 Ley 7/2012';
    const exencionSplit = doc.splitTextToSize(textoExencion, pageWidth - margen * 2 - 8);
    const exencionH = 8 + exencionSplit.length * 4;
    doc.roundedRect(margen, currentBottomY, pageWidth - margen * 2, exencionH, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(170, 110, 30);
    let exy = currentBottomY + 5;
    exencionSplit.forEach((line: string) => { doc.text(line, margen + 4, exy); exy += 4; });
    currentBottomY += exencionH + 6;
  }

  // 5. RECUADROS INFERIORES: CONDICIONES DE PAGO Y OBSERVACIONES
  const boxW = 84;
  const boxH = 32;
  const boxX = margen;
  const boxY = pageHeight - 30 - boxH;

  if (currentBottomY > boxY - 4) {
    doc.addPage();
  }

  doc.setDrawColor(228, 231, 238);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(220, 38, 38);
  doc.text('CONDICIONES DE PAGO Y DATOS BANCARIOS', boxX + 4, boxY + 5);

  doc.setDrawColor(235, 238, 245);
  doc.setLineWidth(0.2);
  doc.line(boxX + 4, boxY + 6.5, boxX + boxW - 4, boxY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(80, 85, 95);
  doc.text(`Forma de pago: ${formaPagoStr}`, boxX + 4, boxY + 11.5);
  doc.text(`Fecha vencimiento: ${fechaVencStr}`, boxX + 4, boxY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(25, 30, 40);
  doc.text(`IBAN: ${ibanStr}`, boxX + 4, boxY + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(110, 115, 125);
  doc.text('Por favor, indique el Nº de Factura en el concepto del pago.', boxX + 4, boxY + 26.5);

  const notasX = margen + boxW + 6;
  const notasW = pageWidth - margen - notasX;
  doc.setDrawColor(228, 231, 238);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(notasX, boxY, notasW, boxH, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(60, 65, 75);
  doc.text('OBSERVACIONES', notasX + 4, boxY + 5);
  doc.setDrawColor(235, 238, 245);
  doc.setLineWidth(0.2);
  doc.line(notasX + 4, boxY + 6.5, notasX + notasW - 4, boxY + 6.5);

  const notasParaPDF = limpiarNotasFactura(factura.notas, factura.albaranId);
  if (notasParaPDF) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(85, 90, 100);
    const notasSplit = doc.splitTextToSize(notasParaPDF, notasW - 8);
    let nty = boxY + 11;
    notasSplit.forEach((line: string) => {
      if (nty < boxY + boxH - 2) {
        doc.text(line, notasX + 4, nty);
        nty += 3.8;
      }
    });
  }

  // 6. PIE DE PÁGINA LEGAL RGPD Y REGISTRO MERCANTIL
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const textoRgpd = 'De acuerdo a lo establecido en la normativa de protección de datos, ABANFOC SL con CIF B16794679, le informa que tratará sus datos con la finalidad de llevar a cabo la gestión administrativa, facturación, contabilidad y obligaciones legales. Podrá ejercer sus derechos dirigiéndose a la dirección postal C/AMERICA, 16 B 08921 SANTA COLOMA DE GRAMENET (BARCELONA) o a través de abanfoc@abanfoc.es. Para información adicional podrá diríjase a abanfoc@abanfoc.es.';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(140, 145, 155);
    const anchoRgpd = pageWidth - margen * 2 - 22;
    const rgpdSplit = doc.splitTextToSize(textoRgpd, anchoRgpd);
    const footerTopY = pageHeight - 16;
    let rgpdY = footerTopY;
    rgpdSplit.forEach((line: string) => {
      doc.text(line, margen, rgpdY);
      rgpdY += 2.2;
    });

    const separatorX = pageWidth - margen - 18;
    doc.setDrawColor(210, 215, 225);
    doc.setLineWidth(0.35);
    doc.line(separatorX, footerTopY - 1, separatorX, footerTopY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(120, 125, 135);
    doc.text(`Pág. ${i} / ${totalPages}`, pageWidth - margen, footerTopY + 5, { align: 'right' });

    const textoRegistro = 'ABANFOC S.L. Empresa inscrita en el registro mercantil de Barcelona, Tomo 48030, Folio 80 , Hoja 570011, Sección general Inscripción 1';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(115, 120, 130);
    doc.text(textoRegistro, 5.5, 220, { angle: 90 });
  }

  doc.save(`Factura_${numFacturaStr.replace(/\s+/g, '_')}.pdf`);
}

export default function Facturas() {
  const location = useLocation();

  const [facturas, setFacturas] = useState<Factura[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_facturas') || '[]'); } catch { return []; }
  });
  const [albaranes, setAlbaranes] = useState<Albaran[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]'); } catch { return []; }
  });
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'); } catch { return []; }
  });
  const [centros, setCentros] = useState<Centro[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; }
  });
  const [empresas, setEmpresas] = useState<Empresa[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]'); } catch { return []; }
  });
  const [articulos, setArticulos] = useState<Articulo[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_articulos') || '[]'); } catch { return []; }
  });

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'numero' | 'fecha' | 'estado' | 'total'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showCatalogoModal, setShowCatalogoModal] = useState(false);
  const [catalogoSearch, setCatalogoSearch] = useState('');
  const [limiteFacturas, setLimiteFacturas] = useState<number | 'todos'>(10);
  const [showModalAlbaranesPendientes, setShowModalAlbaranesPendientes] = useState(false);
  const [accionesModalItem, setAccionesModalItem] = useState<Factura | null>(null);

  const calcularSiguienteNumeroFactura = (lista: Factura[]) => {
    const yy = new Date().getFullYear().toString().slice(-2);
    let maxNum = 0;
    lista.forEach(f => {
      const m = (f.numeroFactura || f.id || '').match(/(\d+)$/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val > 0 && val < 900000) {
          const suffix = val > 20000 ? val % 1000 : val;
          if (suffix > maxNum) maxNum = suffix;
        }
      }
    });
    return `FAC ${yy}${String(maxNum + 1).padStart(3, '0')}`;
  };

  const [form, setForm] = useState<Factura>({
    id: '',
    numeroFactura: '',
    empresaId: '',
    clienteId: '',
    centroId: '',
    clienteNombreLibre: '',
    centroNombreLibre: '',
    nombreCliente: '',
    cifCliente: '',
    direccionCliente: '',
    cpCliente: '',
    poblacionCliente: '',
    provinciaCliente: '',
    albaranId: '',
    numeroPedido: '',
    titulo: '',
    fechaCreacion: new Date().toISOString().slice(0, 10),
    fechaVencimiento: '',
    formaPago: 'Transferencia bancaria',
    iban: 'ES2800810039810001554059',
    estado: 'Pendiente',
    items: [{ codigo: '', familia: '', concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0, subtotal: 0 }],
    descuentoPorcentaje: 0,
    descuentoImporte: 0,
    subtotal: 0,
    iva: 21,
    total: 0,
    notas: ''
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    const uFac = subscribeFacturas(items => {
      const sanitized = items.map(f => ({
        ...f,
        numeroPedido: '',
        notas: f.notas ? limpiarNotasFactura(f.notas, f.albaranId) : (f.albaranId ? `Factura emitida conforme al Albarán firmado ${f.albaranId}.` : f.notas)
      }));
      setFacturas(sanitized);
    });
    const uAlb = subscribeAlbaranes(setAlbaranes);
    const uCli = subscribeClientes(setClientes);
    const uCen = subscribeCentros(setCentros);
    const uEmp = subscribeEmpresas(setEmpresas);
    const uArt = subscribeArticulos(setArticulos);
    return () => {
      uFac();
      uAlb();
      uCli();
      uCen();
      uEmp();
      uArt();
    };
  }, []);

  // Preparar formulario desde un Albarán ("lo que va a misa")
  const iniciarFacturaDesdeAlbaran = (albData: any) => {
    const cli = clientes.find(c => c.id === albData.clienteId || (c as any)._docId === albData.clienteId);
    const cen = centros.find(c => c._docId === albData.centroId || c.id === albData.centroId);
    const emp = empresas.find(e => e._docId === albData.empresaId || e.id === albData.empresaId) || empresas[0];

    const hoy = new Date();
    const venc = new Date(hoy);
    venc.setDate(venc.getDate() + 30);

    const lineas: FacturaLinea[] = (albData.items && albData.items.length > 0)
      ? albData.items.map((it: any) => {
          const cant = Number(it.cantidad) || 1;
          const precio = Number(it.precioUnidad) || 0;
          return {
            codigo: it.codigo || '',
            familia: it.familia || it.concepto || 'Trabajo realizado',
            concepto: it.concepto || 'Trabajo realizado',
            descripcion: it.descripcion || it.concepto || '',
            cantidad: cant,
            precioUnidad: precio,
            subtotal: Number(it.subtotal) || (cant * precio)
          };
        })
      : [{ codigo: '', familia: 'Mantenimiento / Servicio', concepto: 'Mantenimiento / Servicio', descripcion: albData.titulo || '', cantidad: 1, precioUnidad: 0, subtotal: 0 }];

    const sub = lineas.reduce((acc, l) => acc + (Number(l.subtotal) || 0), 0);
    const ivaPorc = 21;
    const tot = sub + (sub * ivaPorc / 100);
    const nextNum = calcularSiguienteNumeroFactura(facturas);

    setEditingId(null);
    setForm({
      id: nextNum,
      numeroFactura: nextNum,
      empresaId: albData.empresaId || emp?._docId || emp?.id || '',
      clienteId: cli?.id || albData.clienteId || '',
      centroId: cen?._docId || cen?.id || albData.centroId || '',
      clienteNombreLibre: albData.clienteNombreLibre || '',
      centroNombreLibre: albData.centroNombreLibre || '',
      nombreCliente: cli?.nombre || albData.clienteNombreLibre || '',
      cifCliente: cli?.cif || '',
      direccionCliente: cli?.direccion || cen?.direccion || '',
      cpCliente: cli?.cp || '',
      poblacionCliente: cli?.poblacion || cen?.poblacion || '',
      provinciaCliente: cli?.provincia || cen?.provincia || '',
      albaranId: albData.albaranId || albData.id || '',
      numeroPedido: '',
      titulo: albData.titulo || `Trabajos realizados según Albarán ${albData.albaranId || albData.id || ''}`,
      fechaCreacion: hoy.toISOString().slice(0, 10),
      fechaVencimiento: venc.toISOString().slice(0, 10),
      formaPago: cen?.formaPago || 'Transferencia bancaria',
      iban: cen?.iban || 'ES2800810039810001554059',
      estado: 'Pendiente',
      items: lineas,
      descuentoPorcentaje: 0,
      descuentoImporte: 0,
      subtotal: sub,
      iva: ivaPorc,
      total: tot,
      notas: limpiarNotasFactura(albData.notas, albData.albaranId || albData.id) || `Factura emitida conforme al Albarán firmado ${albData.albaranId || albData.id || ''}.`
    });
    setView('form');
  };

  // Detectar si venimos desde el icono "F" del menú Albaranes
  useEffect(() => {
    const prefill = (location.state as any)?.prefillFactura;
    if (prefill) {
      iniciarFacturaDesdeAlbaran(prefill);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Albaranes pendientes de facturar (para la bandeja rápida superior)
  const albaranesPendientesFacturar = useMemo(() => {
    return albaranes
      .filter(a => !a.facturado && !facturas.some(f => f.albaranId === a.id))
      .sort((a, b) => {
        const firmaA = isFirmaValida(a.firmaCliente) ? 1 : 0;
        const firmaB = isFirmaValida(b.firmaCliente) ? 1 : 0;
        if (firmaA !== firmaB) return firmaB - firmaA;
        return new Date(b.fechaCreacion || 0).getTime() - new Date(a.fechaCreacion || 0).getTime();
      });
  }, [albaranes, facturas]);

  // Métricas / KPIs financieros
  const kpis = useMemo(() => {
    const validas = facturas.filter(f => f.estado !== 'Borrador');
    const totalFacturado = validas.reduce((s, f) => s + (Number(f.total) || 0), 0);
    const totalCobrado = facturas.filter(f => f.estado === 'Cobrada').reduce((s, f) => s + (Number(f.total) || 0), 0);
    const totalPendiente = facturas.filter(f => f.estado === 'Pendiente').reduce((s, f) => s + (Number(f.total) || 0), 0);
    const totalVencido = facturas.filter(f => f.estado === 'Vencida').reduce((s, f) => s + (Number(f.total) || 0), 0);
    return { totalFacturado, totalCobrado, totalPendiente, totalVencido };
  }, [facturas]);

  const handleSort = (field: 'numero' | 'fecha' | 'estado' | 'total') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'fecha' ? 'desc' : 'asc');
    }
  };

  const filteredFacturas = useMemo(() => {
    let list = [...facturas];
    if (statusFilter !== 'Todos') {
      list = list.filter(f => f.estado === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(f => {
        const cli = clientes.find(c => c.id === f.clienteId || (c as any)._docId === f.clienteId);
        const cen = centros.find(c => c._docId === f.centroId || c.id === f.centroId);
        return (
          (f.numeroFactura || '').toLowerCase().includes(q) ||
          (f.titulo || '').toLowerCase().includes(q) ||
          (f.albaranId || '').toLowerCase().includes(q) ||
          (f.numeroPedido || '').toLowerCase().includes(q) ||
          (f.nombreCliente || cli?.nombre || f.clienteNombreLibre || '').toLowerCase().includes(q) ||
          (cen?.nombre || f.centroNombreLibre || '').toLowerCase().includes(q)
        );
      });
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'numero') {
        cmp = (a.numeroFactura || a.id || '').localeCompare(b.numeroFactura || b.id || '', 'es', { numeric: true });
      } else if (sortField === 'estado') {
        cmp = (a.estado || '').localeCompare(b.estado || '', 'es');
      } else if (sortField === 'total') {
        cmp = (Number(a.total) || 0) - (Number(b.total) || 0);
      } else {
        cmp = new Date(a.fechaCreacion || 0).getTime() - new Date(b.fechaCreacion || 0).getTime();
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [facturas, statusFilter, searchTerm, clientes, centros, sortField, sortOrder]);

  const facturasAMostrar = useMemo(() => {
    if (limiteFacturas === 'todos') return filteredFacturas;
    return filteredFacturas.slice(0, Number(limiteFacturas));
  }, [filteredFacturas, limiteFacturas]);

  // Recalcular totales del formulario
  const recalcularFormulario = (
    items: FacturaLinea[],
    descuentoPorcentaje = form.descuentoPorcentaje || 0,
    iva = form.iva !== undefined ? form.iva : 21
  ) => {
    const subtotal = items.reduce((acc, it) => acc + ((Number(it.cantidad) || 0) * (Number(it.precioUnidad) || 0)), 0);
    const descuentoImporte = subtotal * (Number(descuentoPorcentaje) / 100);
    const base = Math.max(0, subtotal - descuentoImporte);
    const total = base + (base * (Number(iva) / 100));
    setForm(prev => ({
      ...prev,
      items,
      subtotal,
      descuentoPorcentaje: Number(descuentoPorcentaje) || 0,
      descuentoImporte,
      iva: Number(iva),
      total
    }));
  };

  const handleNuevaFactura = () => {
    const hoy = new Date();
    const venc = new Date(hoy);
    venc.setDate(venc.getDate() + 30);
    const nextNum = calcularSiguienteNumeroFactura(facturas);
    setEditingId(null);
    setForm({
      id: nextNum,
      numeroFactura: nextNum,
      empresaId: empresas[0]?._docId || empresas[0]?.id || '',
      clienteId: '',
      centroId: '',
      clienteNombreLibre: '',
      centroNombreLibre: '',
      nombreCliente: '',
      cifCliente: '',
      direccionCliente: '',
      cpCliente: '',
      poblacionCliente: '',
      provinciaCliente: '',
      albaranId: '',
      numeroPedido: '',
      titulo: '',
      fechaCreacion: hoy.toISOString().slice(0, 10),
      fechaVencimiento: venc.toISOString().slice(0, 10),
      formaPago: 'Transferencia bancaria',
      iban: 'ES2800810039810001554059',
      estado: 'Pendiente',
      items: [{ codigo: '', familia: '', concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0, subtotal: 0 }],
      descuentoPorcentaje: 0,
      descuentoImporte: 0,
      subtotal: 0,
      iva: 21,
      total: 0,
      notas: ''
    });
    setView('form');
  };

  const handleSelectClienteForm = (clienteId: string) => {
    const cli = clientes.find(c => c.id === clienteId || (c as any)._docId === clienteId);
    setForm(prev => ({
      ...prev,
      clienteId,
      centroId: '',
      nombreCliente: cli?.nombre || '',
      cifCliente: cli?.cif || '',
      direccionCliente: cli?.direccion || '',
      cpCliente: cli?.cp || '',
      poblacionCliente: cli?.poblacion || '',
      provinciaCliente: cli?.provincia || ''
    }));
  };

  const handleUpdateItem = (index: number, field: keyof FacturaLinea, value: string | number) => {
    const nextItems = form.items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'familia') {
        updated.concepto = String(value);
      }
      const cant = Number(updated.cantidad) || 0;
      const precio = Number(updated.precioUnidad) || 0;
      updated.subtotal = cant * precio;
      return updated;
    });
    recalcularFormulario(nextItems, form.descuentoPorcentaje, form.iva);
  };

  const handleAddItemManual = () => {
    const nextItems = [
      ...form.items,
      { codigo: '', familia: '', concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0, subtotal: 0 }
    ];
    recalcularFormulario(nextItems, form.descuentoPorcentaje, form.iva);
  };

  const handleAddArticuloCatalogo = (art: Articulo) => {
    const nextItems = [
      ...form.items.filter(i => i.concepto.trim() !== '' || i.descripcion.trim() !== '' || i.precioUnidad > 0),
      {
        codigo: art.codigo || '',
        familia: art.familia || art.nombre || '',
        concepto: art.familia || art.nombre || '',
        descripcion: art.nombre || '',
        cantidad: 1,
        precioUnidad: Number(art.precioVenta) || 0,
        subtotal: Number(art.precioVenta) || 0
      }
    ];
    recalcularFormulario(nextItems, form.descuentoPorcentaje, form.iva);
    setShowCatalogoModal(false);
  };

  const handleRemoveItem = (index: number) => {
    if (form.items.length <= 1) return;
    const nextItems = form.items.filter((_, i) => i !== index);
    recalcularFormulario(nextItems, form.descuentoPorcentaje, form.iva);
  };

  const handlePlazoVencimiento = (dias: number) => {
    const base = form.fechaCreacion ? new Date(form.fechaCreacion) : new Date();
    base.setDate(base.getDate() + dias);
    setForm(prev => ({ ...prev, fechaVencimiento: base.toISOString().slice(0, 10) }));
  };

  const handleSaveFactura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId && !form.nombreCliente?.trim() && !form.clienteNombreLibre?.trim()) {
      alert('Selecciona un cliente o indica su Razón Social.');
      return;
    }

    try {
      const cli = clientes.find(c => c.id === form.clienteId || (c as any)._docId === form.clienteId);
      const dataToSave: Factura = {
        ...form,
        id: form.numeroFactura || form.id || calcularSiguienteNumeroFactura(facturas),
        numeroFactura: form.numeroFactura || form.id || calcularSiguienteNumeroFactura(facturas),
        numeroPedido: '',
        notas: limpiarNotasFactura(form.notas, form.albaranId),
        nombreCliente: form.nombreCliente || cli?.nombre || form.clienteNombreLibre || 'Cliente',
      };

      if (editingId) {
        await updateFactura(editingId, dataToSave);
      } else {
        await addFactura(dataToSave);
      }

      // Si proviene de un Albarán, marcar el Albarán como Facturado ("va a misa")
      if (dataToSave.albaranId) {
        const albOrig = albaranes.find(a => a.id === dataToSave.albaranId || (a as any)._docId === dataToSave.albaranId);
        if (albOrig && !albOrig.facturado) {
          await updateAlbaran({ ...albOrig, facturado: true });
          if (albOrig.parteId) {
            try { await updateParte(albOrig.parteId, { estado: 'Cerrado' } as any); } catch {}
          }
          if (albOrig.reparacionId) {
            try { await updateReparacion(albOrig.reparacionId, { facturado: true }); } catch {}
          }
          if (albOrig.instalacionId) {
            try { await updateInstalacion(albOrig.instalacionId, { facturado: true }); } catch {}
          }
          if (albOrig.urgenciaId) {
            try { await updateUrgencia(albOrig.urgenciaId, { facturado: true }); } catch {}
          }
        }
      }

      setView('list');
      setEditingId(null);
    } catch (err) {
      console.error('Error guardando factura:', err);
      alert('Error al guardar la factura.');
    }
  };

  const handleEditFactura = (fac: Factura) => {
    setEditingId(fac._docId || fac.id);
    setForm({
      ...fac,
      numeroPedido: '',
      notas: limpiarNotasFactura(fac.notas, fac.albaranId),
      fechaCreacion: (fac.fechaCreacion || '').slice(0, 10),
      fechaVencimiento: (fac.fechaVencimiento || '').slice(0, 10)
    });
    setView('form');
  };

  const handleDuplicateFactura = (fac: Factura) => {
    const nextNum = calcularSiguienteNumeroFactura(facturas);
    setEditingId(null);
    setForm({
      ...fac,
      _docId: undefined,
      id: nextNum,
      numeroFactura: nextNum,
      numeroPedido: '',
      notas: limpiarNotasFactura(fac.notas, fac.albaranId),
      estado: 'Pendiente',
      fechaCreacion: new Date().toISOString().slice(0, 10)
    });
    setView('form');
  };

  const handleDeleteFactura = async (fac: Factura) => {
    if (!confirm(`¿Mover la factura ${fac.numeroFactura || fac.id} a la papelera?`)) return;
    const docId = fac._docId || fac.id;
    try {
      await deleteFactura(docId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCambiarEstado = async (fac: Factura, nuevoEstado: Factura['estado']) => {
    const docId = fac._docId || fac.id;
    try {
      await updateFactura(docId, { estado: nuevoEstado });
    } catch (e) {
      console.error(e);
    }
  };

  const getEstadoInfo = (estado: string) =>
    ESTADOS_FACTURA.find(e => e.valor === estado) || ESTADOS_FACTURA[0];

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA PRINCIPAL: LISTADO Y BANDEJA DE FACTURACIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="w-full">
          {/* Header con Título a la izquierda y 4 casillas KPI ampliadas a la derecha */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
            <div className="text-center sm:text-left shrink-0">
              <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Facturación</h1>
              <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                Emisión de facturas a partir de albaranes finalizados
              </p>
            </div>

            {/* 4 Casillas KPI Adaptadas y Ampliadas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full xl:w-auto flex-1 xl:ml-8">
              <div className="bg-white rounded-2xl border border-zinc-200/90 px-4 sm:px-5 py-3.5 shadow-xs flex items-center gap-3.5 min-w-[160px] sm:min-w-[185px]">
                <div className="w-11 h-11 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Receipt className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider leading-none">Facturado</p>
                  <p className="text-base sm:text-lg lg:text-xl font-black text-zinc-950 leading-tight mt-1 truncate" title={formatMoneda(kpis.totalFacturado)}>
                    {formatMoneda(kpis.totalFacturado)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-emerald-200/90 px-4 sm:px-5 py-3.5 shadow-xs flex items-center gap-3.5 min-w-[160px] sm:min-w-[185px]">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider leading-none">Cobrado</p>
                  <p className="text-base sm:text-lg lg:text-xl font-black text-emerald-700 leading-tight mt-1 truncate" title={formatMoneda(kpis.totalCobrado)}>
                    {formatMoneda(kpis.totalCobrado)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-amber-200/90 px-4 sm:px-5 py-3.5 shadow-xs flex items-center gap-3.5 min-w-[160px] sm:min-w-[185px]">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
                  <Clock className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider leading-none">Pendiente</p>
                  <p className="text-base sm:text-lg lg:text-xl font-black text-amber-700 leading-tight mt-1 truncate" title={formatMoneda(kpis.totalPendiente)}>
                    {formatMoneda(kpis.totalPendiente)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-red-200/90 px-4 sm:px-5 py-3.5 shadow-xs flex items-center gap-3.5 min-w-[160px] sm:min-w-[185px]">
                <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs">
                  <AlertCircle className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider leading-none">Vencido</p>
                  <p className="text-base sm:text-lg lg:text-xl font-black text-red-600 leading-tight mt-1 truncate" title={formatMoneda(kpis.totalVencido)}>
                    {formatMoneda(kpis.totalVencido)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pestañas + Botón Albaranes Pendientes + Buscador + Botón Nueva Factura */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Pestañas de estado */}
              <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl w-fit border border-zinc-200/40">
                {(['Todos', 'Pendiente', 'Cobrada', 'Vencida', 'Borrador'] as const).map(tab => {
                  const count = tab === 'Todos' ? facturas.length : facturas.filter(f => f.estado === tab).length;
                  const active = statusFilter === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setStatusFilter(tab)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                          : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
                      }`}
                    >
                      <span>{tab === 'Todos' ? 'Todas' : `${tab}s`}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                        active ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Botón Listado de Albaranes Firmados */}
              <button
                type="button"
                onClick={() => setShowModalAlbaranesPendientes(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs hover:shadow transition-all cursor-pointer"
                title="Ver albaranes listos para facturar"
              >
                <Signature className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="whitespace-nowrap">Lista de albaranes para facturar</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs shrink-0">
                  {albaranesPendientesFacturar.length}
                </span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nº factura, albarán, cliente..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 text-zinc-950 shadow-sm"
                />
              </div>
              <button
                onClick={handleNuevaFactura}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-500/10 hover:shadow-lg active:scale-95 transition-all text-xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva Factura
              </button>
            </div>
          </div>

          {/* TABLA DE FACTURAS */}
          {filteredFacturas.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 border-dashed p-16 text-center">
              <Receipt className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 mb-2">
                {searchTerm ? 'Sin resultados' : 'No hay facturas emitidas todavía'}
              </h3>
              <p className="text-zinc-500 text-sm max-w-md mx-auto">
                Pulsa el icono de la hoja con la <strong>"F"</strong> en cualquier Albarán o selecciona un albarán pendiente arriba para generar tu primera factura oficial.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="bg-zinc-200/90 text-zinc-700 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-300">
                      <th
                        onClick={() => handleSort('numero')}
                        className="w-px whitespace-nowrap px-4 py-3 text-left cursor-pointer hover:bg-zinc-300/80 transition-colors select-none group"
                        title="Ordenar por número de factura"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>Nº Factura</span>
                          {sortField === 'numero' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('fecha')}
                        className="w-px whitespace-nowrap px-4 py-3 text-left cursor-pointer hover:bg-zinc-300/80 transition-colors select-none group"
                        title="Ordenar por fecha"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>Fecha</span>
                          {sortField === 'fecha' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Centro / Concepto</th>
                      <th
                        onClick={() => handleSort('estado')}
                        className="w-px whitespace-nowrap px-4 py-3 text-left cursor-pointer hover:bg-zinc-300/80 transition-colors select-none group"
                        title="Ordenar por estado"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>Estado</span>
                          {sortField === 'estado' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('total')}
                        className="w-px whitespace-nowrap px-4 py-3 text-right cursor-pointer hover:bg-zinc-300/80 transition-colors select-none group"
                        title="Ordenar por importe total"
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span>Importe Total</span>
                          {sortField === 'total' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600" />
                          )}
                        </div>
                      </th>
                      <th className="w-px whitespace-nowrap px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {facturasAMostrar.map((fac, index) => {
                      const cli = clientes.find(c => c.id === fac.clienteId || (c as any)._docId === fac.clienteId);
                      const cen = centros.find(c => c._docId === fac.centroId || c.id === fac.centroId);
                      const estadoInfo = getEstadoInfo(fac.estado);
                      const EstadoIcon = estadoInfo.icono;
                      const rowKey = fac._docId || fac.id;

                      return (
                        <tr 
                          key={rowKey} 
                          className={`transition-all duration-150 group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'} hover:bg-amber-100/90 hover:shadow-xs`}
                        >
                          {/* Nº Factura */}
                          <td className="w-px whitespace-nowrap px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-medium text-zinc-800 bg-zinc-100 px-2.5 py-0.5 rounded-md border border-zinc-300">
                                {fac.numeroFactura || fac.id}
                              </span>
                              {fac.albaranId && (
                                <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80">
                                  Alb: {fac.albaranId}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Fecha */}
                          <td className="w-px whitespace-nowrap px-4 py-2.5 text-xs text-slate-600 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-red-500" />
                              {formatFecha(fac.fechaCreacion)}
                            </span>
                          </td>

                          {/* Cliente */}
                          <td className="px-4 py-2.5 text-xs text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate max-w-[180px]" title={fac.nombreCliente || cli?.nombre || fac.clienteNombreLibre || 'Cliente'}>
                                {fac.nombreCliente || cli?.nombre || fac.clienteNombreLibre || 'Cliente'}
                              </span>
                            </div>
                          </td>

                          {/* Centro y Título */}
                          <td className="px-4 py-2.5 text-xs text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate max-w-xs lg:max-w-md" title={fac.titulo || cen?.nombre || 'Factura de servicios'}>
                                {fac.titulo || cen?.nombre || 'Factura de servicios'}
                              </span>
                            </div>
                          </td>

                          {/* Estado con selector rápido */}
                          <td className="w-px whitespace-nowrap px-4 py-2.5">
                            <div className="relative inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setOpenStatusMenuId(openStatusMenuId === rowKey ? null : rowKey);
                                }}
                                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer ${estadoInfo.color}`}
                              >
                                <EstadoIcon className="w-3 h-3" />
                                {estadoInfo.etiqueta}
                              </button>
                              {openStatusMenuId === rowKey && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenuId(null)} />
                                  <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-zinc-200 py-1 min-w-[140px] z-50">
                                    {ESTADOS_FACTURA.map(est => {
                                      const Icono = est.icono;
                                      return (
                                        <button
                                          key={est.valor}
                                          type="button"
                                          onClick={() => {
                                            handleCambiarEstado(fac, est.valor);
                                            setOpenStatusMenuId(null);
                                          }}
                                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 text-left cursor-pointer"
                                        >
                                          <Icono className="w-3.5 h-3.5" /> {est.etiqueta}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Importe Total */}
                          <td className="w-px whitespace-nowrap px-4 py-2.5 text-right">
                            <span className="text-sm font-semibold text-slate-900">{formatMoneda(fac.total)}</span>
                          </td>

                          {/* Acciones */}
                          <td className="w-px whitespace-nowrap px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setAccionesModalItem(fac)}
                              className="inline-flex items-center justify-center p-2 rounded-xl text-amber-600 hover:text-amber-700 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/80 transition-all cursor-pointer shadow-2xs group"
                              title="Abrir acciones de la factura"
                            >
                              <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform text-amber-600" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal flotante de Acciones de Factura */}
          {accionesModalItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
              <div 
                className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabecera oscura moderna */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Wand2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base truncate">
                        Acciones de la Factura
                      </h3>
                      <p className="text-xs text-slate-300 truncate">
                        {accionesModalItem.numeroFactura || accionesModalItem.id} — {accionesModalItem.titulo || 'Factura de servicios'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccionesModalItem(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Subcabecera con información resumida */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 flex-wrap text-xs">
                  {accionesModalItem.fechaCreacion && (
                    <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      <Calendar className="w-3.5 h-3.5 text-red-500" />
                      {formatFecha(accionesModalItem.fechaCreacion)}
                    </span>
                  )}
                  <span className="font-mono font-medium text-zinc-800 bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-300">
                    {accionesModalItem.numeroFactura || accionesModalItem.id}
                  </span>
                  {accionesModalItem.albaranId && (
                    <span className="font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Alb: {accionesModalItem.albaranId}
                    </span>
                  )}
                  {accionesModalItem.fechaVencimiento && (
                    <span className="text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      Venc: <strong className="font-semibold text-slate-700">{formatFecha(accionesModalItem.fechaVencimiento)}</strong>
                    </span>
                  )}
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 ml-auto">
                    {formatMoneda(accionesModalItem.total)}
                  </span>
                </div>

                {/* Listado de acciones */}
                <div className="p-6 flex flex-col gap-3">
                  {/* Acción 1: Descargar Factura Oficial PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      const fac = accionesModalItem;
                      setAccionesModalItem(null);
                      const c = clientes.find(cl => cl.id === fac.clienteId || (cl as any)._docId === fac.clienteId);
                      const ce = centros.find(cn => cn._docId === fac.centroId || cn.id === fac.centroId);
                      const em = empresas.find(ep => ep._docId === fac.empresaId || ep.id === fac.empresaId);
                      generarFacturaOficialPDF(fac, c, ce, em);
                    }}
                    className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-red-100 bg-red-50/40 hover:bg-red-50 text-red-950 transition-all text-left cursor-pointer group hover:shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-red-950">
                          Descargar Factura Oficial PDF
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-200/80 text-red-900 px-1.5 py-0.5 rounded-md">
                          VERI*FACTU
                        </span>
                      </div>
                      <div className="text-xs text-red-600/80 truncate">
                        Documento oficial con código QR tributario y datos mercantiles de ABANFOC
                      </div>
                    </div>
                  </button>

                  {/* Acción 2: Editar Factura */}
                  <button
                    type="button"
                    onClick={() => {
                      const fac = accionesModalItem;
                      setAccionesModalItem(null);
                      handleEditFactura(fac);
                    }}
                    className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-800 transition-all text-left cursor-pointer group hover:shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Edit className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-slate-800 block">
                        Editar Factura
                      </span>
                      <span className="text-xs text-slate-500 truncate block">
                        Modificar partidas, conceptos, fechas o condiciones fiscales
                      </span>
                    </div>
                  </button>

                  {/* Acción 3: Duplicar Factura */}
                  <button
                    type="button"
                    onClick={() => {
                      const fac = accionesModalItem;
                      setAccionesModalItem(null);
                      handleDuplicateFactura(fac);
                    }}
                    className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-violet-200/80 bg-violet-50/40 hover:bg-violet-50 text-violet-950 transition-all text-left cursor-pointer group hover:shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Copy className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-violet-950 block">
                        Duplicar Factura
                      </span>
                      <span className="text-xs text-violet-600/80 truncate block">
                        Generar una nueva factura con numeración correlativa
                      </span>
                    </div>
                  </button>

                  {/* Acción 4: Eliminar Factura */}
                  <button
                    type="button"
                    onClick={() => {
                      const fac = accionesModalItem;
                      setAccionesModalItem(null);
                      handleDeleteFactura(fac);
                    }}
                    className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-red-200/80 bg-red-50/40 hover:bg-red-50 text-red-700 transition-all text-left cursor-pointer group hover:shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-red-700 block">
                        Mover a la Papelera
                      </span>
                      <span className="text-xs text-red-500/80 truncate block">
                        Eliminar factura y restaurar el albarán vinculado a pendiente
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredFacturas.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 bg-white px-5 py-3.5 rounded-2xl border border-zinc-200/80 shadow-xs">
              <div className="font-bold text-zinc-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                {limiteFacturas === 'todos' ? (
                  <span>Mostrando todas las facturas ({filteredFacturas.length} en total)</span>
                ) : (
                  <span>
                    Mostrando las {Math.min(Number(limiteFacturas), filteredFacturas.length)} últimas facturas
                    {filteredFacturas.length > Number(limiteFacturas) && (
                      <span className="text-zinc-400 font-normal ml-1">
                        (de {filteredFacturas.length} facturas en total)
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 font-semibold uppercase text-[11px] tracking-wider">Mostrar:</span>
                <select
                  value={limiteFacturas}
                  onChange={(e) => setLimiteFacturas(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                  className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-xl px-3.5 py-1.5 outline-none focus:border-red-500 focus:bg-white cursor-pointer transition-colors shadow-2xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value="todos">Mostrar todas</option>
                </select>
              </div>
            </div>
          )}

          {/* MODAL: Albaranes firmados listos para facturar */}
          {showModalAlbaranesPendientes && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-white shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Signature className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-zinc-900 leading-tight">
                        Albaranes firmados listos para facturar
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Haz clic en cualquier albarán para generar su factura oficial correspondiente.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModalAlbaranesPendientes(false)}
                    className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Contenedor desplazable de albaranes pendientes: max-h-[142px] overflow-y-auto optimizado en lista de 1 sola linea con scroll */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                  {albaranesPendientesFacturar.length === 0 ? (
                    <div className="py-12 text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-zinc-800">No hay albaranes pendientes de facturar</p>
                      <p className="text-xs text-zinc-500 mt-1">Todos los albaranes registrados ya han sido facturados.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {albaranesPendientesFacturar.map(alb => {
                        const cli = clientes.find(c => c.id === alb.clienteId || (c as any)._docId === alb.clienteId);
                        const cen = centros.find(c => c._docId === alb.centroId || c.id === alb.centroId);
                        const firmado = isFirmaValida(alb.firmaCliente);
                        const baseAlb = (alb.items || []).reduce((s, i) => s + (Number(i.subtotal) || ((Number(i.cantidad) || 1) * (Number(i.precioUnidad) || 0))), 0);
                        const clienteNombre = cli?.nombre || alb.clienteNombreLibre || cen?.nombre || 'Cliente';
                        const conceptoNombre = alb.titulo || cen?.nombre || 'Albarán';

                        return (
                          <button
                            key={alb.id}
                            type="button"
                            onClick={() => {
                              setShowModalAlbaranesPendientes(false);
                              iniciarFacturaDesdeAlbaran(alb);
                            }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-zinc-50/70 hover:bg-emerald-50/60 rounded-2xl border border-zinc-200 hover:border-emerald-400 hover:shadow-xs transition-all text-left group cursor-pointer whitespace-nowrap"
                          >
                            {/* 1. Código y Fecha */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono font-bold text-zinc-800 bg-white px-2.5 py-1 rounded-lg border border-zinc-200 shadow-2xs">
                                {alb.id}
                              </span>
                              {alb.fecha && (
                                <span className="text-xs font-medium text-zinc-500 hidden sm:inline-flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                                  {alb.fecha}
                                </span>
                              )}
                            </div>

                            {/* 2. Cliente y Concepto / Centro en una sola línea */}
                            <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden px-2">
                              <span className="text-xs sm:text-sm font-bold text-zinc-900 truncate" title={clienteNombre}>
                                {clienteNombre}
                              </span>
                              {conceptoNombre && (
                                <>
                                  <span className="text-zinc-300 hidden md:inline shrink-0">•</span>
                                  <span className="text-xs text-zinc-500 truncate hidden md:inline" title={conceptoNombre}>
                                    {conceptoNombre}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* 3. Insignia de Firma */}
                            <div className="shrink-0 hidden sm:flex items-center">
                              {firmado ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" /> Firmado
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                                  Sin firma
                                </span>
                              )}
                            </div>

                            {/* 4. Importe Base */}
                            <div className="shrink-0 text-right">
                              <span className="text-xs sm:text-sm font-black text-zinc-900">
                                {formatMoneda(baseAlb)}
                              </span>
                              <span className="text-[10px] font-semibold text-zinc-400 ml-1">+ IVA</span>
                            </div>

                            {/* 5. Botón Acción Facturar */}
                            <div className="shrink-0">
                              <div className="px-3 py-1.5 rounded-xl bg-white group-hover:bg-emerald-600 text-emerald-700 group-hover:text-white border border-emerald-200 group-hover:border-emerald-600 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all">
                                <Plus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Facturar</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between shrink-0">
                  <span className="text-xs font-semibold text-zinc-500">
                    Total: {albaranesPendientesFacturar.length} albarán(es) listo(s) para facturar
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowModalAlbaranesPendientes(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA FORMULARIO: CREACIÓN / EDICIÓN DE FACTURA
  // ═══════════════════════════════════════════════════════════════════════════
  const selectedClienteObj = clientes.find(c => c.id === form.clienteId || (c as any)._docId === form.clienteId);
  const filteredCentrosForm = centros.filter(c =>
    c.clienteId === form.clienteId ||
    (selectedClienteObj && (c.clienteId === selectedClienteObj.id || c.clienteId === (selectedClienteObj as any)._docId))
  );
  const baseTrasDescuento = Math.max(0, (Number(form.subtotal) || 0) - (Number(form.descuentoImporte) || 0));
  const cuotaIvaForm = baseTrasDescuento * ((Number(form.iva) || 0) / 100);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => { setView('list'); setEditingId(null); }}
            className="flex items-center gap-2 text-sm font-bold text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al listado de Facturas
          </button>

          <button
            type="button"
            onClick={() => {
              const cli = clientes.find(c => c.id === form.clienteId || (c as any)._docId === form.clienteId);
              const cen = centros.find(c => c._docId === form.centroId || c.id === form.centroId);
              const emp = empresas.find(e => e._docId === form.empresaId || e.id === form.empresaId);
              generarFacturaOficialPDF(form, cli, cen, emp);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Vista Previa / Descargar PDF
          </button>
        </div>

        <form onSubmit={handleSaveFactura} className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          {/* Cabecera elegante de la Factura */}
          <div className="p-6 md:p-8 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-800 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-red-600/30">
                F
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black tracking-tight">
                    {editingId ? `Editar Factura ${form.numeroFactura}` : 'Nueva Factura Oficial'}
                  </h2>
                  {form.albaranId && (
                    <span className="text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                      Albarán: {form.albaranId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-300 mt-0.5">
                  ABANFOC S.L. &bull; Facturación directa desde el albarán firmado por el cliente
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase">Nº Factura</label>
                <input
                  type="text"
                  value={form.numeroFactura}
                  onChange={e => setForm({ ...form, numeroFactura: e.target.value, id: e.target.value })}
                  className="mt-1 px-3.5 py-2 bg-white/10 border border-white/20 rounded-xl text-sm font-mono font-black text-white w-36 outline-none focus:border-red-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase">Estado</label>
                <select
                  value={form.estado}
                  onChange={e => setForm({ ...form, estado: e.target.value as Factura['estado'] })}
                  className="mt-1 px-3.5 py-2 bg-zinc-800 border border-white/20 rounded-xl text-sm font-bold text-white outline-none focus:border-red-400"
                >
                  {ESTADOS_FACTURA.map(e => (
                    <option key={e.valor} value={e.valor} className="text-zinc-900 bg-white">{e.etiqueta}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            {/* Banner si proviene de un Albarán */}
            {form.albaranId && (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Datos y partidas importados del Albarán <strong>{form.albaranId}</strong>. Al guardar, el albarán quedará marcado como Facturado.
                  </span>
                </div>
              </div>
            )}

            {/* 1. DATOS DEL CLIENTE Y DOCUMENTO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bloque Izquierdo: Cliente y Datos Fiscales */}
              <div className="p-5 bg-zinc-50/70 rounded-2xl border border-zinc-200/80 space-y-4">
                <h3 className="text-xs font-black text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Datos Fiscales del Cliente
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Seleccionar Cliente de Base de Datos</label>
                    <select
                      value={form.clienteId}
                      onChange={e => handleSelectClienteForm(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:border-red-500"
                    >
                      <option value="">-- Seleccionar cliente registrado o escribir abajo --</option>
                      {[...clientes].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')).map(c => (
                        <option key={c.id} value={c.id}>{c.nombre} {c.cif ? `(${c.cif})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Razón Social / Nombre Fiscal *</label>
                    <input
                      type="text"
                      required
                      value={form.nombreCliente || form.clienteNombreLibre || ''}
                      onChange={e => setForm({ ...form, nombreCliente: e.target.value, clienteNombreLibre: e.target.value })}
                      placeholder="Nombre o Razón Social del cliente"
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">CIF / NIF</label>
                    <input
                      type="text"
                      value={form.cifCliente || ''}
                      onChange={e => setForm({ ...form, cifCliente: e.target.value.toUpperCase() })}
                      placeholder="Ej: B12345678"
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-mono outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Centro de trabajo</label>
                    {form.clienteId && filteredCentrosForm.length > 0 ? (
                      <select
                        value={form.centroId || ''}
                        onChange={e => setForm({ ...form, centroId: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-red-500"
                      >
                        <option value="">Sin centro específico</option>
                        {filteredCentrosForm.map(c => (
                          <option key={c._docId || c.id} value={c._docId || c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.centroNombreLibre || ''}
                        onChange={e => setForm({ ...form, centroNombreLibre: e.target.value })}
                        placeholder="Nombre del centro (opcional)"
                        className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-red-500"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Dirección Fiscal</label>
                    <input
                      type="text"
                      value={form.direccionCliente || ''}
                      onChange={e => setForm({ ...form, direccionCliente: e.target.value })}
                      placeholder="Calle, número, piso..."
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Código Postal y Población</label>
                    <input
                      type="text"
                      value={form.poblacionCliente || ''}
                      onChange={e => setForm({ ...form, poblacionCliente: e.target.value })}
                      placeholder="Ej: 08921 Santa Coloma"
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Provincia</label>
                    <input
                      type="text"
                      value={form.provinciaCliente || ''}
                      onChange={e => setForm({ ...form, provinciaCliente: e.target.value })}
                      placeholder="Ej: Barcelona"
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque Derecho: Fechas, Vencimiento, Forma de Pago y Referencias */}
              <div className="p-5 bg-zinc-50/70 rounded-2xl border border-zinc-200/80 space-y-4">
                <h3 className="text-xs font-black text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" /> Condiciones de Pago y Referencias
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Título / Concepto General de la Factura *</label>
                    <input
                      type="text"
                      required
                      value={form.titulo}
                      onChange={e => setForm({ ...form, titulo: e.target.value })}
                      placeholder="Ej: MANTENIMIENTO SISTEMA CONTRA INCENDIOS"
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Fecha de Emisión</label>
                    <input
                      type="date"
                      value={form.fechaCreacion}
                      onChange={e => setForm({ ...form, fechaCreacion: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-zinc-500 uppercase">Vencimiento</label>
                      <div className="flex items-center gap-1">
                        {[0, 30, 60].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handlePlazoVencimiento(d)}
                            className="text-[9px] font-bold px-1.5 py-0.5 bg-zinc-200/80 hover:bg-zinc-300 text-zinc-700 rounded cursor-pointer"
                          >
                            {d === 0 ? 'Hoy' : `+${d}d`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="date"
                      value={form.fechaVencimiento || ''}
                      onChange={e => setForm({ ...form, fechaVencimiento: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Ref. Nº Albarán</label>
                    <input
                      type="text"
                      value={form.albaranId || ''}
                      onChange={e => setForm({ ...form, albaranId: e.target.value })}
                      placeholder="Ej: ALB-26-001"
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-mono font-bold text-emerald-700 outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Forma de Pago</label>
                    <select
                      value={form.formaPago || 'Transferencia bancaria'}
                      onChange={e => setForm({ ...form, formaPago: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:border-red-500"
                    >
                      {FORMAS_PAGO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Cuenta Bancaria / IBAN</label>
                    <input
                      type="text"
                      value={form.iban || ''}
                      onChange={e => setForm({ ...form, iban: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. PARTIDAS / LÍNEAS DE LA FACTURA */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <label className="text-xs font-black text-zinc-800 uppercase tracking-wider">
                  Conceptos y Partidas Facturadas (según Albarán)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCatalogoModal(true)}
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir del Catálogo
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItemManual}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir Línea Libre
                  </button>
                </div>
              </div>

              <div className="border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead>
                      <tr className="bg-zinc-900 text-white uppercase font-bold tracking-wider">
                        <th className="px-3 py-2.5 text-left w-24">Código</th>
                        <th className="px-3 py-2.5 text-left w-52">Familia / Concepto</th>
                        <th className="px-3 py-2.5 text-left">Descripción detallada</th>
                        <th className="px-3 py-2.5 text-center w-20">Cant.</th>
                        <th className="px-3 py-2.5 text-right w-28">Precio (€)</th>
                        <th className="px-3 py-2.5 text-right w-28">Subtotal</th>
                        <th className="px-2 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {form.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/60">
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.codigo || ''}
                              onChange={e => handleUpdateItem(idx, 'codigo', e.target.value)}
                              placeholder="Cód."
                              className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg font-mono text-xs outline-none focus:bg-white focus:border-red-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.familia || item.concepto || ''}
                              onChange={e => handleUpdateItem(idx, 'familia', e.target.value)}
                              placeholder="Concepto principal"
                              className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg font-bold text-zinc-900 outline-none focus:border-red-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.descripcion || ''}
                              onChange={e => handleUpdateItem(idx, 'descripcion', e.target.value)}
                              placeholder="Descripción del trabajo o material..."
                              className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-700 outline-none focus:border-red-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.cantidad}
                              onChange={e => handleUpdateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-center font-bold outline-none focus:border-red-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.precioUnidad}
                              onChange={e => handleUpdateItem(idx, 'precioUnidad', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-right font-semibold outline-none focus:border-red-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-black text-zinc-900">
                            {formatMoneda(item.subtotal)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar línea"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 3. QR TRIBUTARIO (VERI*FACTU), NOTAS Y CUADRO DE TOTALES */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex flex-col items-center justify-center bg-white border border-zinc-200 rounded-2xl p-3.5 shadow-2xs shrink-0 mx-auto sm:mx-0">
                  <span className="text-[10px] font-black text-zinc-900 tracking-tight mb-1.5">QR tributario:</span>
                  <img
                    src={generarQRVerifactuDataUrl('https://www.abanfoc.es')}
                    alt="QR tributario VERI*FACTU"
                    className="w-24 h-24 rounded border border-zinc-200"
                  />
                  <span className="text-[10px] font-black text-zinc-900 tracking-wider mt-1.5">VERI*FACTU</span>
                  <span className="text-[9px] text-zinc-400 font-medium mt-0.5">www.abanfoc.es (Prueba)</span>
                </div>

                <div className="flex-1 w-full space-y-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase">Observaciones / Notas en Factura</label>
                  <textarea
                    rows={4}
                    value={form.notas || ''}
                    onChange={e => setForm({ ...form, notas: e.target.value })}
                    placeholder="Observaciones adicionales, número de obra o referencias de facturación..."
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm outline-none focus:bg-white focus:border-red-500 resize-y"
                  />
                </div>
              </div>

              <div className="lg:col-span-5 bg-zinc-50 rounded-2xl border border-zinc-200 p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-500 uppercase">Subtotal Bruto</span>
                  <span className="font-bold text-zinc-800">{formatMoneda(form.subtotal)}</span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-zinc-500 uppercase">Descuento (%)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.descuentoPorcentaje || 0}
                      onChange={e => recalcularFormulario(form.items, parseFloat(e.target.value) || 0, form.iva)}
                      className="w-20 px-2.5 py-1 bg-white border border-zinc-200 rounded-lg text-right font-bold outline-none focus:border-red-500"
                    />
                    <span className="text-red-600 font-bold min-w-[70px] text-right">
                      -{formatMoneda(form.descuentoImporte || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-200">
                  <span className="font-extrabold text-zinc-700 uppercase">Base Imponible</span>
                  <span className="font-black text-zinc-900">{formatMoneda(baseTrasDescuento)}</span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-zinc-500 uppercase">Tipo de IVA</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={form.iva}
                      onChange={e => recalcularFormulario(form.items, form.descuentoPorcentaje || 0, Number(e.target.value))}
                      className="px-2.5 py-1 bg-white border border-zinc-200 rounded-lg font-bold text-zinc-800 outline-none focus:border-red-500"
                    >
                      <option value={21}>21% General</option>
                      <option value={10}>10% Reducido</option>
                      <option value={4}>4% Superreducido</option>
                      <option value={0}>0% Exento (Inv. Sujeto Pasivo)</option>
                    </select>
                    <span className="font-bold text-zinc-800 min-w-[70px] text-right">
                      {formatMoneda(cuotaIvaForm)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t-2 border-zinc-900 flex items-center justify-between">
                  <span className="text-sm font-black text-zinc-950 uppercase">Total Factura</span>
                  <span className="text-xl font-black text-red-600">{formatMoneda(form.total)}</span>
                </div>
              </div>
            </div>

            {/* Botones de Guardado */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => { setView('list'); setEditingId(null); }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold text-xs shadow-lg shadow-red-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Guardar Cambios en Factura' : 'Emitir y Guardar Factura'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal selector de artículos del catálogo */}
      {showCatalogoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-900 text-white">
              <h3 className="text-sm font-black uppercase tracking-wider">Seleccionar Artículo o Servicio del Catálogo</h3>
              <button type="button" onClick={() => setShowCatalogoModal(false)} className="p-1 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-zinc-100">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={catalogoSearch}
                  onChange={e => setCatalogoSearch(e.target.value)}
                  placeholder="Buscar por código, familia o nombre..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:bg-white focus:border-red-500"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {articulos
                .filter(a => {
                  if (!catalogoSearch.trim()) return true;
                  const q = catalogoSearch.toLowerCase();
                  return (
                    (a.nombre || '').toLowerCase().includes(q) ||
                    (a.codigo || '').toLowerCase().includes(q) ||
                    (a.familia || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 40)
                .map(art => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => handleAddArticuloCatalogo(art)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 hover:border-red-400 hover:bg-red-50/30 text-left transition-all cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-bold text-zinc-900 truncate">
                        {art.codigo ? `[${art.codigo}] ` : ''}{art.familia || 'Artículo'}
                      </p>
                      <p className="text-xs text-zinc-600 truncate">{art.nombre}</p>
                    </div>
                    <span className="text-xs font-black text-red-600 shrink-0">{formatMoneda(art.precioVenta)}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
