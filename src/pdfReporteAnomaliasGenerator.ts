import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchImageToBase64, normalizarDatosEmpresa, obtenerUltimaFechaRevision, optimizarImagenParaPDF } from './pdfGenerator';

export interface EquipoAnomaliaReporte {
  sistemaNombre: string;
  codigo: string;
  tipo: string;
  ubicacion: string;
  anomalia: string;
  observacion?: string;
}

function resolverChecklistItemsSistema(
  sist?: any,
  checklistItemsPorSistema?: Record<string, any[]>
): any[] {
  if (Array.isArray(sist?.checklistItems) && sist.checklistItems.length > 0) return sist.checklistItems;
  if (Array.isArray(sist?.items) && sist.items.length > 0) return sist.items;
  if (Array.isArray(sist?.plantilla) && sist.plantilla.length > 0) return sist.plantilla;
  if (!checklistItemsPorSistema) return [];

  const sistId = sist?.id;
  if (sistId && Array.isArray(checklistItemsPorSistema[sistId]) && checklistItemsPorSistema[sistId].length > 0) {
    return checklistItemsPorSistema[sistId];
  }

  const normalizeLocal = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const sistNameNorm = normalizeLocal(sist?.tipo || sist?.familia || sist?.nombre || sist?.descripcion || '');
  for (const k of Object.keys(checklistItemsPorSistema)) {
    const items = checklistItemsPorSistema[k];
    if (!Array.isArray(items) || items.length === 0) continue;
    const first = items[0];
    if (sistId && first?.sistemaId === sistId) return items;
    if (sistNameNorm && first?.sistemaNombre && normalizeLocal(first.sistemaNombre) === sistNameNorm) {
      return items;
    }
  }
  return [];
}

function obtenerUbicacionEquipo(eq: any, sist?: any, checklistItems?: any[]): string {
  if (!eq || typeof eq !== 'object') return 'Sin especificar';
  const candidatos = [
    eq.ubicacion,
    eq.nivelPlanta,
    eq.plantaUbicacion,
    eq.nivelPlantaUbicacion,
    eq.cobertura,
    eq.situacion,
    eq.emplazamiento,
    eq.localizacion,
    eq.zona,
    eq.ubicacionEquipo,
    eq.ubicacionCentral,
    eq.central,
    eq.cuadroControl,
    eq.ubicacionCuadro,
    eq.cuadro,
    eq.lugar,
    eq.areaProtege,
    eq.sistemaAlimentado,
    eq.sistemaAlimenta,
    eq.perteneceSubcuadro,
    eq.item_1781450347606,
    eq.item_1782080105158,
    eq.item_1782812695799,
    eq.item_1783446879754,
    eq.datos?.ubicacion,
    eq.datos?.nivelPlanta,
    eq.datos?.cobertura,
    eq.datos?.situacion,
    eq.datos?.zona,
    eq.datos?.areaProtege
  ];
  for (const val of candidatos) {
    if (typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') return val.trim();
  }
  const tplItems: any[] = Array.isArray(checklistItems) && checklistItems.length > 0
    ? checklistItems
    : resolverChecklistItemsSistema(sist);
  for (const it of tplItems) {
    if (it?.tipoRespuesta === 'check' || it?.tipoRespuesta === 'imagen' || it?.tipoRespuesta === 'seccion' || it?.tipoRespuesta === 'titulo' || it?.tipoRespuesta === 'grafico') {
      continue;
    }
    const lbl = String(it?.label || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const k = String(it?.key || '');
    if (
      k &&
      (lbl.includes('ubicaci') ||
        lbl.includes('cobertura') ||
        lbl.includes('planta') ||
        lbl.includes('situaci') ||
        lbl.includes('emplazam') ||
        lbl.includes('localiz') ||
        lbl.includes('zona') ||
        lbl.includes('nivel') ||
        lbl.includes('protege') ||
        lbl.includes('cuadro') ||
        lbl.includes('central'))
    ) {
      const val = eq[k];
      if (typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') {
        return val.trim();
      }
    }
  }
  for (const k of Object.keys(eq)) {
    const kLower = k.toLowerCase();
    if (
      (kLower.includes('ubicaci') ||
        kLower.includes('planta') ||
        kLower.includes('situaci') ||
        kLower.includes('emplazam') ||
        kLower.includes('cobertura') ||
        kLower.includes('localiz') ||
        kLower.includes('zona') ||
        kLower.includes('areaprotege')) &&
      typeof eq[k] === 'string' &&
      eq[k].trim() !== '' &&
      eq[k].trim() !== '-'
    ) {
      return eq[k].trim();
    }
  }
  return 'Sin especificar';
}

function obtenerTipoEquipo(eq: any, sist?: any, checklistItems?: any[]): string {
  if (!eq || typeof eq !== 'object') return '-';
  const candidatos = [
    eq.tipo,
    eq.clase,
    eq.tipoBie,
    eq.tipoPuerta,
    eq.tipoCaseta,
    eq.modelo,
    eq.pesoCapacidad,
    eq.nombre,
    eq.diametro,
    eq.datos?.tipo,
    eq.datos?.clase,
    eq.datos?.modelo,
    eq.datos?.pesoCapacidad
  ];
  for (const val of candidatos) {
    if (typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') return val.trim();
  }
  const tplItems: any[] = Array.isArray(checklistItems) && checklistItems.length > 0
    ? checklistItems
    : resolverChecklistItemsSistema(sist);
  for (const it of tplItems) {
    if (it?.tipoRespuesta === 'check' || it?.tipoRespuesta === 'imagen' || it?.tipoRespuesta === 'seccion' || it?.tipoRespuesta === 'titulo' || it?.tipoRespuesta === 'grafico') {
      continue;
    }
    const lbl = String(it?.label || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const k = String(it?.key || '');
    if (
      k &&
      (lbl.includes('tipo') ||
        lbl.includes('clase') ||
        lbl.includes('modelo') ||
        lbl.includes('capacidad') ||
        lbl.includes('diametro') ||
        lbl.includes('agente') ||
        lbl.includes('peso'))
    ) {
      const val = eq[k];
      if (typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') {
        return val.trim();
      }
    }
  }
  for (const k of Object.keys(eq)) {
    const kLower = k.toLowerCase();
    if (kLower === 'sistemanombre' || kLower === 'tiporespuesta') continue;
    if (
      (kLower.includes('tipo') ||
        kLower.includes('clase') ||
        kLower.includes('modelo') ||
        kLower.includes('capacidad') ||
        kLower.includes('diametro')) &&
      typeof eq[k] === 'string' &&
      eq[k].trim() !== '' &&
      eq[k].trim() !== '-'
    ) {
      return eq[k].trim();
    }
  }
  return '-';
}

function formatFechaEsReporte(raw: string): string {
  const txt = (raw || '').trim();
  if (!txt || txt === '-') return '-';
  const isoMatch = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return txt;
}

/**
 * Desglosa el texto de anomalías de un equipo en líneas independientes,
 * respetando el formato de viñetas, saltos de línea y numeración de preguntas.
 */
export function desglosarAnomaliasEquipo(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== 'string') return [];
  // Dividir por saltos de línea y por comas que precedan a códigos tipo 3.7
  const trozos = raw.split(/\r?\n|,\s*(?=\d+\.\d+)/);
  const resultado: string[] = [];
  for (const t of trozos) {
    const limpio = t.replace(/^[-•*]\s*/, '').trim();
    if (limpio && limpio.length > 1) {
      resultado.push(limpio);
    }
  }
  return resultado;
}

/**
 * Extrae la lista aplanada de incidencias/anomalías de todos los equipos del centro.
 */
export function extraerReporteAnomalias(
  sistemasDelCentro: any[],
  equiposTodos: any[],
  checklistItemsPorSistema?: Record<string, any[]>
): EquipoAnomaliaReporte[] {
  const reporte: EquipoAnomaliaReporte[] = [];

  for (const sist of sistemasDelCentro) {
    const sistNombre = (sist.tipo || sist.familia || sist.nombre || sist.descripcion || 'SISTEMA GENERAL').toUpperCase();
    const checklistItemsSist = resolverChecklistItemsSistema(sist, checklistItemsPorSistema);
    const equiposDelSist = equiposTodos.filter(e => e.sistemaId === sist.id);

    for (const eq of equiposDelSist) {
      // Buscar anomalías en campo anomalias o campos dinámicos
      let rawAnom = '';
      if (eq.anomalias && typeof eq.anomalias === 'string' && eq.anomalias.trim() !== '') {
        rawAnom = eq.anomalias;
      } else {
        // Fallback a campos dinámicos
        for (const k of Object.keys(eq)) {
          const kLower = k.toLowerCase();
          if ((kLower.includes('anomal') || kLower.includes('nota')) && kLower !== 'observaciones') {
            if (typeof eq[k] === 'string' && eq[k].trim() !== '') {
              rawAnom = rawAnom ? `${rawAnom}\n${eq[k]}` : eq[k];
            }
          }
        }
      }

      let lista = desglosarAnomaliasEquipo(rawAnom);
      if (lista.some(a => a.toLowerCase().includes('extintor caducado'))) {
        lista = lista.filter(a => !a.toLowerCase().includes('extintor necesita retimbr'));
      }
      const obsTxt =
        typeof eq.observaciones === 'string' && eq.observaciones.trim() !== ''
          ? eq.observaciones.trim()
          : undefined;
      const ubicacionEq = obtenerUbicacionEquipo(eq, sist, checklistItemsSist);
      const tipoEq = obtenerTipoEquipo(eq, sist, checklistItemsSist);
      for (const item of lista) {
        reporte.push({
          sistemaNombre: sistNombre,
          codigo: eq.codigo || eq.numero || eq.id || 'S/N',
          tipo: tipoEq,
          ubicacion: ubicacionEq,
          anomalia: item,
          observacion: obsTxt
        });
      }
    }
  }

  return reporte;
}

/**
 * Genera y descarga el PDF Oficial del Reporte de Anomalías.
 */
export const generarReporteAnomaliasPDF = async (
  cliente: any,
  centro: any,
  sistemasDelCentro: any[],
  equiposTodos: any[],
  numeroMantenimiento: string | number,
  fechaRevision: string,
  tecnicoNombre: string,
  empresa?: Record<string, any>,
  checklistItemsPorSistema?: Record<string, any[]>
) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const empData = normalizarDatosEmpresa(empresa, centro?.empresaId);
  const logoUrl = empData?.logoUrl || '/logo.png';
  const logoRaw = await fetchImageToBase64(logoUrl);

  let y = 12;

  // --- CABECERA SUPERIOR ---
  // Título principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(220, 38, 38); // Rojo corporativo
  doc.text('REPORTE DE ANOMALÍAS', margin, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('Informe técnico de incidencias y anomalías detectadas en la revisión de sistemas contra incendios.', margin, y + 13);

  // Logo a la derecha
  if (logoRaw) {
    try {
      const { base64: logoOpt, format } = await optimizarImagenParaPDF(logoRaw, 800, 0.75);
      const props = doc.getImageProperties(logoOpt);
      const maxW = 55;
      const maxH = 15;
      const ratio = props.width / props.height;
      const w = Math.min(maxW, maxH * ratio);
      const h = w / ratio;
      doc.addImage(logoOpt, format, pageWidth - margin - w, y, w, h);
    } catch (e) {
      console.warn('Error dibujando logo en reporte de anomalías:', e);
    }
  }

  y += 18;

  // Línea roja decorativa
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

  y += 4;

  // --- TARJETA DE INFORMACIÓN CLIENTE / CENTRO / MANTENIMIENTO ---
  const boxWidth = pageWidth - (margin * 2);
  const boxHeight = 23;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, 'FD');

  const colWidth = boxWidth / 2;

  // Columna Izquierda: Cliente y Centro
  const leftX = margin + 4;
  let textY = y + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('CLIENTE:', leftX, textY);
  doc.setFont('helvetica', 'normal');
  const clienteNombre = String(cliente?.nombre || cliente?.razonSocial || 'Cliente no especificado').substring(0, 75);
  doc.text(clienteNombre, leftX + 16, textY);

  textY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('CENTRO:', leftX, textY);
  doc.setFont('helvetica', 'normal');
  const centroNombre = String(centro?.nombre || 'Centro no especificado').substring(0, 75);
  doc.text(centroNombre, leftX + 16, textY);

  textY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('DIRECCIÓN:', leftX, textY);
  doc.setFont('helvetica', 'normal');
  const direccion = `${centro?.direccion || ''}${centro?.poblacion ? ', ' + centro.poblacion : ''}`.trim() || '-';
  doc.text(direccion.substring(0, 75), leftX + 18, textY);

  textY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('MANTENEDOR:', leftX, textY);
  doc.setFont('helvetica', 'normal');
  const empNombre = String(empData?.nombre || 'ABANFOC S.L.').substring(0, 75);
  doc.text(empNombre, leftX + 22, textY);

  // Columna Derecha: Datos de la Revisión
  const rightX = margin + colWidth + 4;
  textY = y + 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Nº MANTENIMIENTO:', rightX, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(numeroMantenimiento || '-'), rightX + 34, textY);

  const { fechaStr: fechaRevisionFinal } = obtenerUltimaFechaRevision(
    equiposTodos,
    checklistItemsPorSistema,
    fechaRevision
  );

  textY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA REVISIÓN:', rightX, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatFechaEsReporte(fechaRevisionFinal || String(fechaRevision || '-')), rightX + 34, textY);

  textY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('TÉCNICO ASIGNADO:', rightX, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(tecnicoNombre || 'Técnico'), rightX + 34, textY);

  textY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('CIF CLIENTE:', rightX, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(cliente?.cif || cliente?.nif || '-'), rightX + 34, textY);

  y += boxHeight + 6;

  // Extraer las anomalías
  const anomalias = extraerReporteAnomalias(sistemasDelCentro, equiposTodos, checklistItemsPorSistema);

  if (anomalias.length === 0) {
    // Si no hay anomalías
    doc.setFillColor(240, 253, 244); // green-50
    doc.setDrawColor(187, 247, 208); // green-200
    doc.roundedRect(margin, y, boxWidth, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(22, 101, 52); // green-800
    doc.text('REVISIÓN SIN ANOMALÍAS', margin + 6, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61);
    doc.text('No se han registrado anomalías ni defectos en los sistemas y equipos inspeccionados durante este mantenimiento.', margin + 6, y + 13);
  } else {
    // Agrupar anomalías por equipo para mostrar una sola fila por equipo con cada anomalía en su propia línea
    const gruposPorEquipo = new Map<string, {
      sistemaNombre: string;
      equipoLabel: string;
      tipo: string;
      ubicacion: string;
      anomalias: string[];
      observacion?: string;
    }>();

    for (const item of anomalias) {
      const equipoLabel = `EQUIPO Nº ${String(item.codigo || 'S/N').toUpperCase()}`;
      const tipoLabel = item.tipo && item.tipo.trim() !== '' ? item.tipo.trim() : '-';
      const key = `${item.sistemaNombre}||${equipoLabel}||${tipoLabel}||${item.ubicacion}`;
      const existente = gruposPorEquipo.get(key);
      const textoAnomalia = `- ${item.anomalia}`;
      if (existente) {
        if (!existente.anomalias.includes(textoAnomalia)) {
          existente.anomalias.push(textoAnomalia);
        }
        if (!existente.observacion && item.observacion) {
          existente.observacion = item.observacion;
        }
      } else {
        gruposPorEquipo.set(key, {
          sistemaNombre: item.sistemaNombre,
          equipoLabel,
          tipo: tipoLabel,
          ubicacion: item.ubicacion,
          anomalias: [textoAnomalia],
          observacion: item.observacion
        });
      }
    }

    const gruposList = Array.from(gruposPorEquipo.values());
    const tableBody = gruposList.map((g, idx) => {
      const textoCol = g.observacion
        ? `${g.anomalias.join('\n')}\nObservación: ${g.observacion}`
        : g.anomalias.join('\n');
      return [
        String(idx + 1),
        g.sistemaNombre,
        g.equipoLabel,
        g.tipo,
        g.ubicacion,
        textoCol
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 14 },
      head: [['Nº', 'SISTEMA', 'EQUIPO', 'TIPO', 'UBICACIÓN', 'ANOMALÍA / DEFECTO DETECTADO']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [220, 38, 38], // Rojo corporativo
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
        valign: 'middle',
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 }
      },
      styles: {
        fontSize: 6.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        cellPadding: { top: 1.2, bottom: 1.2, left: 2.5, right: 2.5 },
        valign: 'middle',
        overflow: 'linebreak',
        fontStyle: 'normal'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'normal', textColor: [15, 23, 42] },
        1: { cellWidth: 36, fontStyle: 'normal', textColor: [15, 23, 42] },
        2: { cellWidth: 25, fontStyle: 'normal' },
        3: { cellWidth: 29, fontStyle: 'normal' },
        4: { cellWidth: 58, fontStyle: 'normal' },
        5: { cellWidth: 'auto', textColor: [185, 28, 28], fontStyle: 'normal' } // Rojo para la anomalía, sin negrita
      },
      willDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 5) {
          const grupo = gruposList[data.row.index];
          if (grupo?.observacion) {
            data.cell._savedLines = Array.isArray(data.cell.text) ? [...data.cell.text] : [String(data.cell.text || '')];
            data.cell.text = [];
          }
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 5 && data.cell._savedLines) {
          const lines: string[] = data.cell._savedLines;
          const cell = data.cell;
          const leftPad = typeof cell.padding === 'function' ? cell.padding('left') : 2.5;
          const topPad = typeof cell.padding === 'function' ? cell.padding('top') : 1.2;
          const fontSize = cell.styles?.fontSize || 6.5;
          const lineH = fontSize * 0.42;
          const obsStartIdx = lines.findIndex((ln) => ln.startsWith('Observación:'));

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontSize);

          const totalTextH = lines.length * lineH;
          let curY = cell.y + Math.max(topPad, (cell.height - totalTextH) / 2) + lineH * 0.78;
          lines.forEach((ln, idx) => {
            if (obsStartIdx >= 0 && idx >= obsStartIdx) {
              doc.setTextColor(0, 82, 204); // Azul corporativo para observaciones
            } else {
              doc.setTextColor(185, 28, 28); // Rojo para anomalías
            }
            doc.text(ln, cell.x + leftPad, curY);
            curY += lineH;
          });
        }
      }
    });
  }

  // Pie de página global con el total real de páginas (Página X de N)
  const totalPaginas = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Documento generado automáticamente por Salamandra FireCheck  |  Página ${i} de ${totalPaginas}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Descargar el archivo PDF
  const cleanNum = String(numeroMantenimiento || 'REV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanCentro = String(centro?.nombre || 'Centro').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
  doc.save(`Reporte_Anomalias_${cleanNum}_${cleanCentro}.pdf`);
};
