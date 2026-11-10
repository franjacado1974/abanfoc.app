import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchImageToBase64, normalizarDatosEmpresa, optimizarImagenParaPDF } from './pdfGenerator';

export interface EquipoAnomaliaReporte {
  sistemaNombre: string;
  codigo: string;
  tipo: string;
  ubicacion: string;
  anomalia: string;
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
  equiposTodos: any[]
): EquipoAnomaliaReporte[] {
  const reporte: EquipoAnomaliaReporte[] = [];

  for (const sist of sistemasDelCentro) {
    const sistNombre = (sist.tipo || sist.familia || sist.nombre || sist.descripcion || 'SISTEMA GENERAL').toUpperCase();
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

      const lista = desglosarAnomaliasEquipo(rawAnom);
      for (const item of lista) {
        reporte.push({
          sistemaNombre: sistNombre,
          codigo: eq.codigo || eq.numero || eq.id || 'S/N',
          tipo: eq.tipo || eq.modelo || eq.clase || '-',
          ubicacion: eq.ubicacion || eq.nivelPlanta || eq.cobertura || 'Sin especificar',
          anomalia: item
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
  empresa?: Record<string, any>
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

  textY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA REVISIÓN:', rightX, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(fechaRevision || '-'), rightX + 34, textY);

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
  const anomalias = extraerReporteAnomalias(sistemasDelCentro, equiposTodos);

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
    // Construir filas de la tabla
    const tableBody = anomalias.map(item => [
      item.sistemaNombre,
      `${item.codigo}${item.tipo && item.tipo !== '-' ? ` (${item.tipo})` : ''}`,
      item.ubicacion,
      item.anomalia
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 14 },
      head: [['SISTEMA', 'EQUIPO', 'UBICACIÓN', 'ANOMALÍA / DEFECTO DETECTADO']],
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
        0: { cellWidth: 50, fontStyle: 'normal', textColor: [15, 23, 42] },
        1: { cellWidth: 44, fontStyle: 'normal' },
        2: { cellWidth: 50, fontStyle: 'normal' },
        3: { cellWidth: 'auto', textColor: [185, 28, 28], fontStyle: 'normal' } // Rojo para la anomalía, sin negrita
      },
      didDrawPage: (data) => {
        // Pie de página en cada hoja
        const totalPaginas = (doc as any).internal.getNumberOfPages();
        const pagActual = data.pageNumber;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Documento generado automáticamente por Salamandra FireCheck  |  Página ${pagActual} de ${totalPaginas}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }
    });
  }

  // Descargar el archivo PDF
  const cleanNum = String(numeroMantenimiento || 'REV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanCentro = String(centro?.nombre || 'Centro').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
  doc.save(`Reporte_Anomalias_${cleanNum}_${cleanCentro}.pdf`);
};
