import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { extintorBase64 } from './icono_extintor';
import { biesBase64 } from './icono_bies';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Helper para formatear moneda en español (punto para miles, coma para decimales)
const formatM = (valor: number) => new Intl.NumberFormat('es-ES', { 
  style: 'currency', currency: 'EUR' 
}).format(valor || 0);

// ============ DATOS DE EMPRESA MANTENEDORA (guardados en localStorage) ============
export function cargaDatosEmpresa(): Record<string, any> | null {
  try {
    const saved = localStorage.getItem('firecheck_db_empresa');
    if (saved) return JSON.parse(saved) as Record<string, any>;
  } catch (e) { console.error("Error loading company data from localStorage:", e); }
  return null;
}

export const guardarDatosEmpresa = (data: any) => {
  localStorage.setItem('firecheck_db_empresa', JSON.stringify(data));
};

export const obtenerDatosEmpresa = () => cargaDatosEmpresa();

// ============ ACTA DE REVISIÓN ============
export const generarActaExtintoresPDF = async (
  cliente: Record<string, any>,
  centro: Record<string, any>,
  sistemas: Record<string, any>[],
  equiposTodos: Record<string, any>[],
  numeroMantenimiento?: string,
  tecnicoNombre?: string,
  anomalyTextColor: [number, number, number] = [200, 0, 0],
  firmaCliente?: string,
  firmaTecnico?: string,
  nombreFirmante?: string,
  checklistItems?: { key: string; label: string; tipoRespuesta?: string }[]
) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const empData = cargaDatosEmpresa();

  // ============ FIRST PAGE: INFO PAGE (REDISEÑO ELEGANTE) ============
  const drawInfoPage = async () => {
    // ── Borde decorativo exterior ──
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.roundedRect(8, 8, pageWidth - 16, 190, 4, 4, 'D');

    // ── Logo (esquina superior derecha) ──
    try {
      const logoBase64 = localStorage.getItem('firecheck_db_logo');
      if (logoBase64) {
        const logoProps = doc.getImageProperties(logoBase64);
        const maxLogoWidth = 65;
        const maxLogoHeight = 16;
        const logoRatio = logoProps.width / logoProps.height;
        const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
        const logoHeight = logoWidth / logoRatio;
        doc.addImage(logoBase64, 'PNG', pageWidth - 14 - logoWidth, 12, logoWidth, logoHeight);
      }
    } catch (e) { console.error("Error loading logo for Acta PDF:", e); }

    // ── Título principal ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('ACTA DE REVISIÓN', pageWidth / 2, 22, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Sistemas de Protección Contra Incendios — RIPCI (RD 513/2017)', pageWidth / 2, 28, { align: 'center' });

    // ── Línea decorativa doble ──
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.6);
    doc.line(14, 32, pageWidth - 14, 32);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(14, 33.5, pageWidth - 14, 33.5);

    // ── Número de acta y fecha (barra superior) ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`N.º Acta: ${numeroMantenimiento || '—'}`, 14, 40);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 14, 40, { align: 'right' });

    // ── SECCIÓN: DATOS DEL CLIENTE Y CENTRO (dos columnas) ──
    let y = 48;
    const col1X = 14;
    const col2X = pageWidth / 2 + 4;

    // Título de sección
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text('DATOS DEL CLIENTE Y CENTRO', pageWidth / 2, y, { align: 'center' });
    y += 5;

    // Línea sutil bajo el título
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    // Columna izquierda: Cliente
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text('CLIENTE', col1X, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(50, 50, 50);
    const cliLines = [
      cliente?.nombre || '—',
      cliente?.direccion || '',
      `${cliente?.poblacion || ''}${cliente?.provincia ? ', ' + cliente.provincia : ''}${cliente?.cp ? ' - ' + cliente.cp : ''}`,
      `Tel: ${cliente?.telefono || '—'}  |  ${cliente?.correo || ''}`,
      `Contacto: ${cliente?.contacto || '—'}`,
    ];
    cliLines.forEach(line => {
      if (line.trim()) { doc.text(line, col1X, y); y += 4.2; }
    });

    // Columna derecha: Centro
    const cenY = 48 + 5 + 5; // misma posición Y que cliente
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text('CENTRO', col2X, cenY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(50, 50, 50);
    let cy = cenY + 4;
    const cenLines = [
      centro?.nombre || '—',
      centro?.direccion || '',
      `${centro?.poblacion || ''}${centro?.provincia ? ', ' + centro.provincia : ''}${centro?.cp ? ' - ' + centro.cp : ''}`,
      `Tel: ${centro?.telefono || '—'}  |  ${centro?.correo || ''}`,
      `Contacto: ${centro?.contacto || '—'}`,
    ];
    cenLines.forEach(line => {
      if (line.trim()) { doc.text(line, col2X, cy); cy += 4.2; }
    });

    // ── SECCIÓN: INFORMACIÓN DEL MANTENIMIENTO ──
    y = Math.max(y, cy) + 6;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text('INFORMACIÓN DEL MANTENIMIENTO', pageWidth / 2, y, { align: 'center' });
    y += 5;

    const periodicidad: string[] = centro?.periodicidad || [];
    const mesRevision: string = (centro?.mesesRevision && centro.mesesRevision.length > 0) ? centro.mesesRevision[0] : '';

    // Tabla de información en dos columnas
    const infoLeft: [string, string][] = [
      ['N.º de mantenimiento:', numeroMantenimiento || '—'],
      ['Fecha del mantenimiento:', new Date().toLocaleDateString('es-ES')],
      ['Técnico actuante:', tecnicoNombre || 'No asignado'],
      ['N.I.F. Técnico:', empData?.nifTecnico || 'No especificado'],
    ];
    const infoRight: [string, string][] = [
      ['RASIC:', empData?.rasic || 'No especificado'],
      ['Periodicidad contratada:', periodicidad.length > 0 ? periodicidad.join(', ') : 'No definida'],
      ['Revisiones programadas:', ''],
    ];

    // Calcular revisiones programadas
    let revList = '';
    if (mesRevision) {
      const idx = MESES.indexOf(mesRevision);
      if (idx >= 0) {
        if (periodicidad.includes('Anual')) revList += mesRevision;
        if (periodicidad.includes('Trimestral')) {
          if (revList) revList += ' | ';
          revList += [3, 6, 9].map(offset => MESES[(idx + offset) % 12]).join(', ');
        }
        if (periodicidad.includes('Mensual')) {
          if (revList) revList += ' | ';
          revList += 'Mensual';
        }
      }
    }
    if (!revList) revList = periodicidad.join(', ') || 'No definidas';
    infoRight[2] = ['Revisiones programadas:', revList];

    doc.setFontSize(7.5);
    let iy = y + 2;
    infoLeft.forEach(([label, value], i) => {
      const colX = i < 2 ? col1X : col2X;
      const rowY = iy + (i % 2) * 5.5;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(label, colX, rowY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(value, colX + 42, rowY);
    });
    infoRight.forEach(([label, value], i) => {
      const colX = i < 2 ? col1X : col2X;
      const rowY = iy + 11 + (i % 2) * 5.5;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(label, colX, rowY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(value, colX + 42, rowY);
    });

    // ── SECCIÓN: EMPRESA MANTENEDORA ──
    y = iy + 24;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text('EMPRESA MANTENEDORA', pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(50, 50, 50);
    const empNombre = empData?.nombre || 'ABANFOC S.L.';
    const empCif = empData?.cif || 'B16794679';
    const empRasic = empData?.rasic || '106001687';
    const empDir = empData?.direccion || 'C/ America 16B Ático';
    const empLoc = `${empData?.poblacion || 'Sta. Coloma de Gramanet'}, ${empData?.provincia || 'Barcelona'} ${empData?.cp || '08921'}`;
    const empTel = empData?.telefono || '651 019 229';

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(empNombre, col1X, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(`CIF: ${empCif}  |  RASIC: ${empRasic}`, col1X, y + 5);
    doc.text(empDir, col1X, y + 10);
    doc.text(empLoc, col1X, y + 15);
    doc.text(`Tel: ${empTel}`, col1X, y + 20);

    // Logo de la empresa mantenedora (esquina inferior derecha)
    // Cargar logo de la empresa mantenedora (esquina inferior derecha)
    try {
      // Intentar primero desde localStorage (base64)
      let logoData = localStorage.getItem('firecheck_db_logo');
      
      // Si no hay en localStorage, intentar desde la URL de Firebase Storage
      if (!logoData && empData?.logoUrl) {
        try {
          const response = await fetch(empData.logoUrl);
          if (response.ok) {
            const blob = await response.blob();
            logoData = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
        } catch (fetchErr) {
          console.error("Error fetching logo from Firebase Storage:", fetchErr);
        }
      }
      
      if (logoData) {
        const logoProps = doc.getImageProperties(logoData);
        const maxLogoWidth = 55;
        const maxLogoHeight = 20;
        const logoRatio = logoProps.width / logoProps.height;
        const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
        const logoHeight = logoWidth / logoRatio;
        doc.addImage(logoData, 'PNG', pageWidth - 14 - logoWidth, y - 2, logoWidth, logoHeight);
      }
    } catch (e) { console.error("Error loading logo for Acta PDF:", e); }

    // ── Sello / firma digital (esquina inferior derecha) ──
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Documento generado electrónicamente', pageWidth - 14, 185, { align: 'right' });
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 14, 189, { align: 'right' });
  };

  await drawInfoPage();

  // ============ SECOND PAGE ONWARDS: TABLES ============
//@ts-ignore
  const infoPageEndY = 125;
  doc.addPage();
  doc.setPage(2);

  const drawTableHeader = (pageNum: number) => {
    if (pageNum <= 1) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text('ACTA DE REVISIÓN - SISTEMAS DE PROTECCIÓN CONTRA INCENDIOS', pageWidth / 2, 14, { align: 'center' });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`${cliente?.nombre || ''} | ${centro?.nombre || ''}`, pageWidth / 2, 22, { align: 'center' });
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(10, 26, pageWidth - 10, 26);
  };

  const getMark = (isChecked: boolean) => isChecked ? 'TICK' : 'X';

  const drawnTablePages = new Set<number>();

  const renderSection = async (title: string, equipos: any[], isBie: boolean, currentY: number, iconoBase64?: string) => {
    if (equipos.length === 0) return currentY;

    if (currentY > 130) {
      doc.addPage();
      const newPageNum = (doc.internal as any).getNumberOfPages();
      if (!drawnTablePages.has(newPageNum)) {
        drawTableHeader(newPageNum);
        drawnTablePages.add(newPageNum);
      }
      currentY = 34;
    }

    if (iconoBase64) {
      doc.addImage(iconoBase64, 'PNG', 14, currentY - 1, 8, 8);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(title, iconoBase64 ? 26 : 14, currentY + 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
    doc.text('Las anotaciones en rojo o con una X indican anomalías que deben corregirse.', iconoBase64 ? 26 : 14, currentY + 7);
    doc.setTextColor(0, 0, 0);

    currentY += 12;

    const headersBase = isBie ?
      ['Nº', 'Nivel planta y ubicación', 'Placa', 'Tipo', 'Longitud', 'Fabricante', 'Fecha\nFabricación', 'Prueba\nHidráulica'] :
      ['Nº', 'Nivel planta y ubicación', 'Placa', 'Clase', 'Tipo', 'Fabricante', 'Fecha\nFabricación', 'Último\nRetimbre'];

    // Usar los items del checklist dinámico si están disponibles
    const checkItems = (checklistItems || []).filter(item => {
      const lbl = (item.label || '').toLowerCase();
      return !lbl.includes('notas') && !lbl.includes('observaciones') && !lbl.includes('anomal');
    });

    const checkKeys = checkItems.length > 0 
      ? checkItems.map(item => item.key)
      : ['checkAcceso', 'checkAltura', 'checkSoporte', 'checkSenalizacion',
         'checkManguera', 'checkPeso', 'checkManometro', 'checkMarcado',
         'checkEtiquetas', 'checkRetimbre', 'checkRiesgo', 'checkDistancia',
         'checkPasador', 'checkMovilidad'];

    // Cabeceras de los checks: usar labels de los items o números por defecto
    const checkHeaders = checkItems.length > 0
      ? checkItems.map((_, idx) => String(idx + 1))
      : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'];

    const tableData = equipos.map(eq => {
      return [
        eq.codigo || '-',
        eq.ubicacion || '-',
        eq.placa || '-',
        isBie ? (eq.clase || '-') : (eq.clase || '-'),
        isBie ? (eq.longitud || '-') : (eq.nombre || '-'),
        eq.fabricante || '-',
        eq.fechaFabricacion || '-',
        isBie ? (eq.pruebaHidraulica || '-') : (eq.ultimoRetimbre || '-'),
        ...checkKeys.map(k => getMark(eq[k]))
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { top: 40 },
      headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255], fontSize: 7, halign: 'center', lineWidth: 0.1, lineColor: [0, 0, 0] },
      bodyStyles: { fontSize: 7, halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] },

      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
      head: [[...headersBase, ...checkHeaders]],
      body: tableData,
      didDrawPage: function (data: any) {
        if (!drawnTablePages.has(data.pageNumber)) {
          drawTableHeader(data.pageNumber);
          drawnTablePages.add(data.pageNumber);
        }
      },
      didParseCell: function (data: any) {
        if (data.section === 'body' && data.column.index >= 8) {
          if (data.cell.raw === 'X') {
            data.cell.styles.textColor = anomalyTextColor;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 9;
          } else if (data.cell.raw === 'TICK') {
            data.cell.text = [''];
          }
        }
      },
      didDrawCell: function (data: any) {
        if (data.section === 'body' && data.column.index >= 8 && data.cell.raw === 'TICK') {
          const { x, y, width, height } = data.cell;
          const cx = x + width / 2;
          const cy = y + height / 2;
          doc.setDrawColor(34, 197, 94);
          doc.setLineWidth(0.6);
          doc.line(cx - 1, cy + 0.2, cx - 0.2, cy + 1);
          doc.line(cx - 0.2, cy + 1, cx + 1.2, cy - 1.2);
        }
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY || currentY;

    finalY += 8;
    const anomalias = equipos.filter(eq => {
      const hasChecksUnmarked = Object.keys(eq).some(k => k.startsWith('check') && eq[k] === false);
      const hasText = eq.anomalias && eq.anomalias.trim() !== '';
      return hasChecksUnmarked || hasText;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(title.includes('OBSERV') ? 'OBSERVACIONES TÉCNICAS Y ANOMALÍAS:' : 'CONCLUSIONES Y OBSERVACIONES:', 14, finalY);
    doc.setFont("helvetica", "normal");
    finalY += 7;

    if (anomalias.length === 0) {
      doc.setTextColor(5, 150, 105);
      doc.text('Sin anomalías. Los equipos se encuentran en correcto estado de funcionamiento.', 14, finalY);
      doc.setTextColor(0, 0, 0);
      finalY += 6;
    } else {
      doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
      for (const eq of anomalias) {
        // Verificar si necesitamos una nueva página
        if (finalY > 170) {
          doc.addPage();
          const newPageNum = (doc.internal as any).getNumberOfPages();
          if (!drawnTablePages.has(newPageNum)) {
            drawTableHeader(newPageNum);
            drawnTablePages.add(newPageNum);
          }
          finalY = 34;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.text('OBSERVACIONES TÉCNICAS Y ANOMALÍAS (continuación):', 14, finalY);
          doc.setFont("helvetica", "normal");
          finalY += 7;
          doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
        }

        const textAnomalia = eq.anomalias ? eq.anomalias : 'No supera las comprobaciones visuales.';
        doc.text(`Nº ${eq.codigo} ${eq.placa ? `(${eq.placa})` : ''} — Anomalías: ${textAnomalia}`, 14, finalY);
        finalY += 5.5;

        // Si hay foto, añadirla
        if (eq.foto && typeof eq.foto === 'string' && eq.foto.trim() !== '') {
          try {
            // Verificar si necesitamos espacio para la imagen
            if (finalY > 140) {
              doc.addPage();
              const newPageNum = (doc.internal as any).getNumberOfPages();
              if (!drawnTablePages.has(newPageNum)) {
                drawTableHeader(newPageNum);
                drawnTablePages.add(newPageNum);
              }
              finalY = 34;
            }

            // Cargar la imagen
            let imageData = eq.foto;
            
            // Si es una URL de Firebase Storage, convertirla a base64
            if (imageData.startsWith('http')) {
              try {
                const response = await fetch(imageData);
                if (response.ok) {
                  const blob = await response.blob();
                  imageData = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                  });
                }
              } catch (fetchErr) {
                console.error("Error fetching image from URL:", fetchErr);
                continue;
              }
            }

            // Añadir la imagen al PDF
            const imgProps = doc.getImageProperties(imageData);
            const maxWidth = 80;
            const maxHeight = 60;
            const imgRatio = imgProps.width / imgProps.height;
            let imgWidth = maxWidth;
            let imgHeight = imgWidth / imgRatio;
            
            if (imgHeight > maxHeight) {
              imgHeight = maxHeight;
              imgWidth = imgHeight * imgRatio;
            }

            doc.addImage(imageData, 'JPEG', 14, finalY, imgWidth, imgHeight);
            finalY += imgHeight + 5;
          } catch (imgErr) {
            console.error("Error adding image to PDF:", imgErr);
            // Continuar sin la imagen si hay error
          }
        }
      }
      doc.setTextColor(0, 0, 0);
      finalY += 3;
    }

    // Leyenda
    finalY += 6;
    const legendQuestions = isBie ? [
      '1. Acceso al BIE', '2. Altura de la válvula y maneta', '3. Señalización', '4. Estado general del armario',
      '5. Estado maneta o cerradura', '6. Estado de la devanadera', '7. Tramo de manguera', '8. Dispone del Marcado CE',
      '9. Etiquetas de uso y manejo', '10. Etiquetas de prueba hidráulica', '11. Estado de la lanza y posiciones',
      '12. Distancia entre Bies es < 25 m.', '13. Válvula y manómetro', '14. Presión de la red (bar)'
    ] : [
      '1. Acceso al extintor', '2. Altura del extintor', '3. Soporte correcto', '4. Señalización',
      '5. Difusor - manguera', '6. Peso total del aparato', '7. Presión manómetro', '8. Extintor con Marcado CE',
      '9. Etiquetas de tipo y manejo', '10. Etiqueta último Retimbre', '11. Adecuado para su riesgo',
      '12. Distancia < 15 m. al siguiente', '13. Anilla pasador y precinto', '14. Si es carro verificar movilidad'
    ];

    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    const firstColumnX = pageWidth / 2 + 40;
    const secondColumnX = firstColumnX + 52;
    const legendStartY = finalY - 24;


    legendQuestions.forEach((q, index) => {
      const columnX = index < 7 ? firstColumnX : secondColumnX;
      const rowY = legendStartY + (index % 7) * 4;
      doc.text(q, columnX, rowY);
    });
    doc.setTextColor(0, 0, 0);

    return finalY + 5;
  };

  let tableStartY = 34;

  // Dibujar cabecera en la primera página de tablas
  drawTableHeader(2);

  // Ordenar: sistemas con "EXTINTOR" primero, luego el resto
  const sistemasOrdenados = [...sistemas].sort((a, b) => {
    const aEsExtintor = (a.familia || a.tipo || '').toUpperCase().includes('EXTINTOR');
    const bEsExtintor = (b.familia || b.tipo || '').toUpperCase().includes('EXTINTOR');
    if (aEsExtintor && !bEsExtintor) return -1;
    if (!aEsExtintor && bEsExtintor) return 1;
    return 0;
  });

  // Renderizar cada sistema en una página separada
  for (let index = 0; index < sistemasOrdenados.length; index++) {
    const sist = sistemasOrdenados[index];
    const equiposSistema = equiposTodos.filter(eq => eq.sistemaId === sist.id);
    if (equiposSistema.length === 0) continue;

    const nombreSistema = sist.familia || sist.tipo || 'Sistema';
    const esBie = nombreSistema.toUpperCase().includes('BIE') || nombreSistema.toUpperCase().includes('BOCA');
    const icono = esBie ? biesBase64 : extintorBase64;

    // Si no es el primer sistema, añadir nueva página
    if (index > 0) {
      doc.addPage();
      const newPageNum = (doc.internal as any).getNumberOfPages();
      drawnTablePages.add(newPageNum);
      drawTableHeader(newPageNum);
      tableStartY = 34;
    }

    tableStartY = await renderSection(nombreSistema.toUpperCase(), equiposSistema, esBie, tableStartY, icono);
  }

  // ============ SIGNATURE PAGE (PÁGINA FINAL DEDICADA) ============
  doc.addPage();
  const sigPageNum = (doc.internal as any).getNumberOfPages();
  doc.setPage(sigPageNum);

  // Encabezado de la página de firmas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('FIRMAS', pageWidth / 2, 20, { align: 'center' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(10, 26, pageWidth - 10, 26);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Acta de revisión de sistemas de protección contra incendios', pageWidth / 2, 33, { align: 'center' });

  // Información del acta
  let sigY = 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  const fechaHora = `${new Date().toLocaleDateString()} - [${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]`;

  const infoFields: [string, string][] = [
    ['Cliente:', cliente?.nombre || 'No especificado'],
    ['Centro:', centro?.nombre || 'No especificado'],
    ['N.º de mantenimiento:', numeroMantenimiento || 'No especificado'],
    ['Fecha de revisión:', fechaHora],
    ['Técnico actuante:', tecnicoNombre || 'No asignado'],
    ['Firmante del cliente:', nombreFirmante || 'No especificado'],
  ];

  const col1X = 20;
  const col2X = pageWidth / 2 + 10;

  infoFields.forEach(([label, value], index) => {
    const colX = index < 3 ? col1X : col2X;
    const rowY = sigY + (index % 3) * 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, colX, rowY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(value, colX + 42, rowY);
  });

  sigY += 32;

  // Línea separadora
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(10, sigY, pageWidth - 10, sigY);
  sigY += 12;

  // Observaciones del técnico
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('OBSERVACIONES DEL TÉCNICO', 20, sigY);
  sigY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const obsTexto = (centro?.observaciones || 'Sin observaciones adicionales por parte del técnico actuante.');
  doc.text(obsTexto.length > 150 ? obsTexto.substring(0, 147) + '...' : obsTexto, 20, sigY);
  sigY += 12;

  sigY += 10;

  // Título de la sección de firmas
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(10, sigY, pageWidth - 10, sigY);
  sigY += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('FIRMAS DE CONFORMIDAD', pageWidth / 2, sigY, { align: 'center' });
  sigY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Los abajo firmantes certifican la conformidad con el mantenimiento realizado y los resultados reflejados en la presente acta.',
    pageWidth / 2, sigY, { align: 'center' });
  sigY += 16;

  // Bloques de firma (3 columnas)
  const blockW = 75;
  const blockH = 55;
  const gap = 20;
  const totalBlocksWidth = blockW * 3 + gap * 2;
  const startBlocksX = (pageWidth - totalBlocksWidth) / 2;

  const blockColors = [
    [235, 245, 255],  // Azul claro - técnico titulado
    [240, 253, 244],  // Verde claro - técnico habilitado
    [255, 243, 235],  // Naranja claro - cliente
  ];

  const blockBorderColors = [
    [59, 130, 246],
    [34, 197, 94],
    [249, 115, 22],
  ];

  for (let i = 0; i < 3; i++) {
    const bx = startBlocksX + i * (blockW + gap);
    const by = sigY;

    // Sombra/fondo del bloque
    doc.setFillColor(blockColors[i][0], blockColors[i][1], blockColors[i][2]);
    doc.setDrawColor(blockBorderColors[i][0], blockBorderColors[i][1], blockBorderColors[i][2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(bx, by, blockW, blockH, 4, 4, 'FD');

    // Título del bloque
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(blockBorderColors[i][0], blockBorderColors[i][1], blockBorderColors[i][2]);
    const titles = ['TÉCNICO TITULADO', 'TÉCNICO HABILITADO', 'CLIENTE / TITULAR'];
    doc.text(titles[i], bx + blockW / 2, by + 8, { align: 'center' });

    // Línea decorativa bajo el título
    doc.setDrawColor(blockBorderColors[i][0], blockBorderColors[i][1], blockBorderColors[i][2]);
    doc.setLineWidth(0.3);
    doc.line(bx + 8, by + 11, bx + blockW - 8, by + 11);

    // Espacio para firma (recuadro de puntos)
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(bx + 10, by + 16, blockW - 20, 18, 2, 2, 'FD');
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(170, 170, 170);
    doc.text('Firma', bx + blockW / 2, by + 26, { align: 'center' });

    // Imagen de firma si existe
    if (i === 2 && firmaCliente) {
      try {
        doc.addImage(firmaCliente, 'PNG', bx + 11, by + 17, blockW - 22, 16);
      } catch (_e) { }
    }
    if (i === 1 && firmaTecnico) {
      try {
        doc.addImage(firmaTecnico, 'PNG', bx + 11, by + 17, blockW - 22, 16);
      } catch (_e) { }
    }

    // Nombre del firmante
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    const names = [
    (empData?.tecnicoTitulado || 'Técnico Titulado'),
    (tecnicoNombre || 'Técnico Habilitado'),
    (nombreFirmante || 'Cliente / Titular')
    ];
    doc.text(names[i], bx + blockW / 2, by + blockH - 18, { align: 'center' });

    // Cargo / cualificación
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    const cargos = [
    (empData?.numTecnicoTitulado ? `Ingeniero Industrial N.º ${empData.numTecnicoTitulado}` : 'Ingeniero Industrial'),
    'Técnico Habilitado',
      'Titular / Responsable del centro'
    ];
    doc.text(cargos[i], bx + blockW / 2, by + blockH - 9, { align: 'center' });

    // Fecha pequeña debajo
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(130, 130, 130);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, bx + blockW / 2, by + blockH - 3, { align: 'center' });
  }

  sigY += blockH + 15;

  // Nota legal al pie
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 130);
  doc.text('Documento generado electrónicamente. La firma del presente acta implica la aceptación de los trabajos realizados y',
    20, sigY);
  doc.text('la conformidad con el estado reflejado de los equipos e instalaciones revisadas según normativa vigente (RIPCI).',
    20, sigY + 5);

  // Footer en todas las páginas
  const totalPages = (doc.internal as any).getNumberOfPages();
  const footerDate = new Date().toLocaleDateString();
  const footerCentro = centro?.nombre || '';

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    const text = `${footerDate} - Centro: ${footerCentro} - (página ${i} de ${totalPages})`;
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, 200);
  }

  doc.save(`Acta_Revision_${centro?.nombre || 'Centro'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/** 
 * Versión para visualizar el PDF del Acta en el navegador sin descargar
 */
export const generarActaExtintoresPDFView = async (
  cliente: Record<string, any>,
  centro: Record<string, any>,
  sistemas: Record<string, any>[],
  equiposTodos: Record<string, any>[],
  numeroMantenimiento?: string,
  tecnicoNombre?: string,
  anomalyTextColor: [number, number, number] = [200, 0, 0],
  firmaCliente?: string,
  firmaTecnico?: string,
  nombreFirmante?: string,
  checklistItems?: { key: string; label: string; tipoRespuesta?: string }[]
): Promise<string> => {
  const doc = new jsPDF('landscape');
  await generarActaExtintoresPDF(cliente, centro, sistemas, equiposTodos, numeroMantenimiento, tecnicoNombre, anomalyTextColor, firmaCliente, firmaTecnico, nombreFirmante, checklistItems);
  return doc.output('bloburl').toString();
};

// ============ ALBARÁN ============
export const generarAlbaranPDF = async (
  cliente: Record<string, any>,
  centro: Record<string, any>,
  equiposTodos: Record<string, any>[],
  numeroMantenimiento?: string,
  tecnicoNombre?: string,
  firmaCliente?: string,
  firmaTecnico?: string,
  nombreFirmante?: string,
  items?: { cantidad: number; concepto: string; descripcion: string; precioUnidad: number; subtotal: number }[],
  empresa?: Record<string, any>,
  noSave?: boolean,
  titulo?: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Datos de empresa: usar la empresa pasada como parámetro, o cargar de localStorage
  const empData = empresa || cargaDatosEmpresa() || {};

  // ── CABECERA: Logo + Datos empresa ──
  let headerY = 12;

  // Logo a la derecha - cargar desde URL si es necesario
  try {
    const logoUrl = empData?.logoUrl || localStorage.getItem('firecheck_db_logo');
    if (logoUrl) {
      let logoData = logoUrl;
      // Si es una URL externa (no base64), convertir a base64
      if (logoUrl.startsWith('http')) {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        logoData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
      const logoProps = doc.getImageProperties(logoData);
      const maxLogoWidth = 70;
      const maxLogoHeight = 25;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoData, 'PNG', pageWidth - 10 - logoWidth, headerY, logoWidth, logoHeight);
    }
  } catch (_e) { }

  // Título del documento
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text('ALBARÁN DE TRABAJO', pageWidth - 14, headerY + 35.5, { align: 'right' });

  // Mostrar el título del albarán si existe
  if (titulo) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(`${titulo}`, pageWidth - 14, headerY + 42, { align: 'right' });
  }

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "normal");
  doc.text('Referencia: ', 14, headerY + 8);
  doc.setFont("helvetica", "bold");
  doc.text(numeroMantenimiento || 'S/R', 14 + doc.getTextWidth('Referencia: '), headerY + 8);

  doc.setFont("helvetica", "normal");
  doc.text('Fecha: ', 14, headerY + 14);
  doc.setFont("helvetica", "bold");
  doc.text(new Date().toLocaleDateString(), 14 + doc.getTextWidth('Fecha: '), headerY + 14);

  doc.setFont("helvetica", "normal");
  doc.text('Técnico: ', 14, headerY + 20);
  doc.setFont("helvetica", "bold");
  doc.text(tecnicoNombre || 'N/A', 14 + doc.getTextWidth('Técnico: '), headerY + 20);

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, headerY + 26, pageWidth - 14, headerY + 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('DATOS DE LA INSTALACIÓN:', 14, headerY + 34);
  doc.setFont("helvetica", "normal");
  doc.text(`${cliente?.nombre || 'Cliente'}`, 14, headerY + 40);
  doc.text(`${centro?.nombre || 'Centro'}`, 14, headerY + 46);
  doc.text(`${centro?.direccion || ''}`, 14, headerY + 52);
  doc.text(`${[centro?.poblacion, centro?.provincia].filter(Boolean).join(', ')}`, 14, headerY + 58);

  // Si hay items del albarán, usarlos; si no, agrupar equipos por modelo
  let tableData: string[][];
  let subtotalTotal = 0;

  if (items && items.length > 0) {
    tableData = items.map(item => [
      String(item.cantidad),
      item.concepto || '',
      (item.descripcion ? item.descripcion.charAt(0).toUpperCase() + item.descripcion.slice(1) : ''),
      formatM(item.precioUnidad),
      formatM(item.subtotal)
    ]);
    subtotalTotal = items.reduce((acc, item) => acc + (item.subtotal || 0), 0);
  } else {
    const conteoPorModelo: Record<string, number> = {};
    equiposTodos.forEach(eq => {
      const modelo = eq.nombre?.trim() || eq.clase?.trim() || 'Equipo';
      conteoPorModelo[modelo] = (conteoPorModelo[modelo] || 0) + 1;
    });
    tableData = Object.entries(conteoPorModelo).map(([modelo, cantidad]) => [
      `${cantidad} und.`, modelo, '', '', ''
    ]);
    subtotalTotal = equiposTodos.reduce((acc, eq) => acc + (parseFloat(eq.precioUnidad || eq.precio || 0) || 0), 0);
  }

  const ivaPorc = 21;
  const ivaImporte = subtotalTotal * ivaPorc / 100;
  const totalConIva = subtotalTotal + ivaImporte;
  const totalRows = tableData.length;

  const tableDataConTotales = [
    ...tableData,
    ['', '', '', 'Total:', formatM(subtotalTotal)],
    ['', '', '', `IVA (${ivaPorc}%):`, formatM(ivaImporte)],
    ['', '', '', 'Total + IVA:', formatM(totalConIva)],
  ];

  autoTable(doc, {
    startY: headerY + 61,
    head: [['Cant.', 'Concepto', 'Descripción', 'Precio ud.', 'Subtotal']],
    body: tableDataConTotales,
    theme: 'grid',
    headStyles: { fillColor: [128, 0, 32], halign: 'center', lineColor: [255, 255, 255], lineWidth: 0.3 },
    bodyStyles: { lineColor: [255, 255, 255], lineWidth: 0.3 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { cellWidth: 40 },
      2: { cellWidth: 'auto' },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 25 }
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.row.index >= totalRows) {
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (data: any) => {
      if (data.section === 'body' && data.row.index === totalRows) {
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.4);
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "bold");
  doc.text('Firma del Técnico:', 14, finalY);
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, finalY + 3, 60, 35, 3, 3);
  if (firmaTecnico) {
    doc.addImage(firmaTecnico, 'PNG', 15, finalY + 4, 58, 33);
  }
  doc.text(`Nombre: ${tecnicoNombre || 'N/A'}`, 14, finalY + 42);

  doc.text('Conformidad del Cliente:', 100, finalY);
  doc.roundedRect(100, finalY + 3, 60, 35, 3, 3);
  if (firmaCliente) {
    doc.addImage(firmaCliente, 'PNG', 101, finalY + 4, 58, 33);
  }
  doc.text(`Nombre: ${nombreFirmante || 'N/A'}`, 100, finalY + 42);

  // ── PIE DE PÁGINA: Datos de la empresa (todas las páginas) ──
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPagesAlb = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPagesAlb; i++) {
    doc.setPage(i);
    // Línea separadora del pie
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);
    // Línea 1: Nombre empresa en negrita + CIF + RASIC
    const rasic = empData?.rasic ? `  |  RASIC: ${empData.rasic}` : '';
    const cifText = empData?.cif ? `CIF: ${empData.cif}` : '';
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    const line1 = `${empData?.nombre || ''}`;
    doc.text(line1, 14, pageHeight - 13);
    // Nombre en negrita, luego CIF y RASIC sin negrita en la misma línea
    const nombreWidth = doc.getTextWidth(line1);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const cifRasic = `  ${cifText}${rasic}`;
    doc.text(cifRasic, 14 + nombreWidth, pageHeight - 13);
    // Línea 2: Dirección y teléfono
    const dirParts = [empData?.direccion, empData?.localidad, empData?.provincia, empData?.codigoPostal].filter(Boolean).join(', ');
    const telPart = empData?.telefono ? `  |  Tel: ${empData.telefono}` : '';
    doc.setFontSize(7);
    doc.text(`${dirParts}${telPart}`, 14, pageHeight - 8);
  }

  if (!noSave) doc.save(`Albaran_${centro?.nombre || 'Centro'}_${numeroMantenimiento}.pdf`);
};

/**
 * Versión para visualizar el PDF del Albarán en el navegador sin descargar
 */
export const generarAlbaranPDFView = async (
  cliente: Record<string, any>,
  centro: Record<string, any>,
  equiposTodos: Record<string, any>[],
  numeroMantenimiento?: string,
  tecnicoNombre?: string,
  firmaCliente?: string,
  firmaTecnico?: string,
  nombreFirmante?: string,
  items?: { cantidad: number; concepto: string; descripcion: string; precioUnidad: number; subtotal: number }[],
  empresa?: Record<string, any>,
  titulo?: string
): Promise<string> => {
  const tempDoc = new jsPDF('p', 'mm', 'a4');
  await generarAlbaranPDF(cliente, centro, equiposTodos, numeroMantenimiento, tecnicoNombre, firmaCliente, firmaTecnico, nombreFirmante, items, empresa, true, titulo);
  return tempDoc.output('bloburl').toString();
};

// ============ CERTIFICADO ============
export const generarCertificadoPDF = async (
  cliente: Record<string, any>,
  centro: Record<string, any>,
  parte: Record<string, any>,
  tecnicoNombre?: string,
  estadoCertificado?: string,
  sistemas?: Record<string, any>[],
  equiposTodos?: Record<string, any>[],
  _firmaCliente?: string,
  _firmaTecnico?: string,
  _nombreFirmante?: string,
  noSave?: boolean
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const empData = cargaDatosEmpresa();
  const margen = 20;

  // ── FONDO: Borde decorativo sutil ──
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(8, 8, pageWidth - 16, 281, 4, 4, 'D');

  // ── CABECERA: TÍTULO CENTRADO ──
  let y = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('CERTIFICADO DE REVISIÓN', pageWidth / 2, y + 3, { align: 'center' });

  // Subtítulo y Nº certificado en una línea
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Sistemas de Protección Contra Incendios  —  Nº ${parte?.id || 'N/A'}`, pageWidth / 2, y + 9, { align: 'center' });

  // Línea decorativa bajo la cabecera
  y += 16;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.8);
  doc.line(margen, y, pageWidth - margen, y);
  doc.setLineWidth(0.2);
  doc.line(margen, y + 1.5, pageWidth - margen, y + 1.5);
  y += 8;

  // ── DATOS DE LA EMPRESA MANTENEDORA (tarjeta con logo a la derecha) ──
  const empNombre = empData?.nombre || 'ABANFOC S.L.';
  const empCif = empData?.cif || 'B16794679';
  const empDir = empData?.direccion || 'C/ America 16B Ático';
  const empLoc = `${empData?.poblacion || 'Sta. Coloma de Gramanet'}, ${empData?.provincia || 'Barcelona'} ${empData?.cp || '08921'}`;

  const cardEmpH = 26;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 251, 252);
  doc.roundedRect(margen, y, pageWidth - margen * 2, cardEmpH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('EMPRESA MANTENEDORA', margen + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`${empNombre}  |  CIF: ${empCif}`, margen + 4, y + 11, { maxWidth: pageWidth - margen * 2 - 60 });
  doc.text(`${empDir} — ${empLoc}`, margen + 4, y + 16, { maxWidth: pageWidth - margen * 2 - 60 });
  doc.text(`Tel: ${empData?.telefono || '651 019 229'}  |  RASIC: ${empData?.rasic || '106001687'}`, margen + 4, y + 21, { maxWidth: pageWidth - margen * 2 - 60 });

  // Logo a la derecha dentro de la tarjeta
  try {
    const logoBase64 = localStorage.getItem('firecheck_db_logo');
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', pageWidth - margen - 58, y + 7, 52, 10);
      const logoProps = doc.getImageProperties(logoBase64);
      const maxLogoWidth = 70;
      const maxLogoHeight = 15;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoBase64, 'PNG', pageWidth - margen - 4 - logoWidth, y + 6, logoWidth, logoHeight);
    }
  } catch (e) { console.error("Error loading logo for Certificado PDF:", e); }

  y += cardEmpH + 8;

  // ── DATOS DE LA INSTALACIÓN (tarjeta) ──
  const cardInstalacionH = 32;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 251, 252);
  doc.roundedRect(margen, y, pageWidth - margen * 2, cardInstalacionH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('DATOS DE LA INSTALACIÓN', margen + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);

  const colA = margen + 4;
  const colB = pageWidth / 2 + 5;
  const rowH = 5;

  const datosInstalacion: [string, string][] = [
    ['Cliente:', cliente?.nombre || 'No especificado'],
    ['Centro:', centro?.nombre || 'No especificado'],
    ['Dirección:', centro?.direccion || 'No especificada'],
    ['Población:', centro?.poblacion || 'No especificada'],
    ['Provincia:', centro?.provincia || 'No especificada'],
    ['N.º Mantenimiento:', parte?.numeroMantenimiento || 'No especificado'],
    ['Fecha de emisión:', new Date().toLocaleDateString()],
    ['Técnico actuante:', tecnicoNombre || 'No asignado'],
  ];

  datosInstalacion.forEach(([label, value], i) => {
    const col = i < 4 ? colA : colB;
    const ry = y + 11 + (i % 4) * rowH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(label, col, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(value, col + 28, ry, { maxWidth: i < 4 ? 60 : 50 });
  });

  y += cardInstalacionH + 8;

  // ── SISTEMAS Y EQUIPOS REVISADOS ──
  if (sistemas && sistemas.length > 0 && equiposTodos && equiposTodos.length > 0) {
    const equiposPorSistema: Record<string, any[]> = {};
    equiposTodos.forEach(eq => {
      const sistId = eq.sistemaId || 'sin-sistema';
      if (!equiposPorSistema[sistId]) equiposPorSistema[sistId] = [];
      equiposPorSistema[sistId].push(eq);
    });

    // Pre-calcular la altura de la tarjeta de sistemas
    let cardSistemasH = 12; // Margen superior y título
    Object.entries(equiposPorSistema).forEach(([, eqs]) => {
      cardSistemasH += 5; // Título del sistema
      const conteoPorTipo: Record<string, number> = {};
      eqs.forEach(eq => {
        const tipoEquipo = eq.nombre || eq.clase || 'Equipo';
        const capacidad = eq.capacidad || eq.peso || '';
        const clave = capacidad ? `${tipoEquipo} ${capacidad}` : tipoEquipo;
        conteoPorTipo[clave] = 1;
      });
      cardSistemasH += Object.keys(conteoPorTipo).length * 4.5;
      cardSistemasH += 2; // Espaciado entre sistemas
    });

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 251, 252);
    doc.roundedRect(margen, y, pageWidth - margen * 2, cardSistemasH, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('SISTEMAS Y EQUIPOS REVISADOS', margen + 4, y + 6);

    let sy = y + 11;
    Object.entries(equiposPorSistema).forEach(([sistId, eqs]) => {
      const sist = sistemas.find(s => s.id === sistId);
      const nombreSistema = sist?.nombre || sist?.tipo || 'Sistema sin nombre';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(50, 70, 120);
      doc.text(nombreSistema, margen + 8, sy);
      sy += 5;

      const conteoPorTipo: Record<string, number> = {};
      eqs.forEach(eq => {
        const tipoEquipo = eq.nombre || eq.clase || 'Equipo';
        const capacidad = eq.capacidad || eq.peso || '';
        const clave = capacidad ? `${tipoEquipo} ${capacidad}` : tipoEquipo;
        conteoPorTipo[clave] = (conteoPorTipo[clave] || 0) + 1;
      });

      Object.entries(conteoPorTipo).forEach(([clave, cantidad]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(`• ${clave} — ${cantidad} unidad${cantidad > 1 ? 'es' : ''}`, margen + 14, sy, { maxWidth: pageWidth - margen * 2 - 20 });
        sy += 4.5;
      });

      sy += 2;
    });

    y += cardSistemasH + 8;
  }

  // ── RESULTADO DE LA REVISIÓN ──
  const rawEstado = (estadoCertificado || 'Favorable').toLowerCase();
  const esNegativo = rawEstado.includes('negativo') || rawEstado.includes('no');
  const estadoLimpio = esNegativo ? 'NO favorable' : 'Favorable';

  // Texto de certificación formal
  const nombreCentro = centro?.nombre || 'el centro indicado';
  const tecnicoTitulado = empData?.tecnicoTitulado || 'Técnico Titulado de la Empresa';
  const nifTecnico = empData?.nifTecnico || 'N.I.F. no especificado';
  const numTecnico = empData?.numTecnicoTitulado || 'N.º de colegiado no especificado';

  const textoCertificacion = 
    `Don ${tecnicoTitulado}, con N.I.F. ${nifTecnico}, Técnico titulado n.º ${numTecnico} y en calidad de responsable técnico ` +
    `de la empresa instaladora y mantenedora de sistemas de protección contra incendios ${empNombre} con N.I.F. ` +
    `${empCif}, autorizada por la Generalitat de Catalunya con n.º de RASIC ${empData?.rasic || '106001687'}, ` +
    `CERTIFICA que se ha efectuado la revisión de los equipos y sistemas contra incendios en "${nombreCentro}" ` +
    `según REAL DECRETO 513/2017 del Reglamento de Instalaciones de Protección Contra Incendios.`;

  // Usar splitTextToSize para un word-wrap más robusto
  const textLines = doc.splitTextToSize(textoCertificacion, pageWidth - margen * 2 - 8);

  const cardResultH = 14 + (textLines.length * 4.5) + 14;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 251, 252);
  doc.roundedRect(margen, y, pageWidth - margen * 2, cardResultH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('RESULTADO DE LA REVISIÓN', margen + 4, y + 6);

  let ly = y + 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  textLines.forEach((line: string) => {
    doc.text(line, margen + 4, ly);
    ly += 4.5;
  });

  // Estado del resultado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const colorRes: [number, number, number] = esNegativo ? [180, 40, 40] : [30, 120, 70];
  doc.setTextColor(colorRes[0], colorRes[1], colorRes[2]);
  doc.text(`Resultado: ${estadoLimpio}`, margen + 4, ly + 4);

  y += cardResultH + 8;

  // Footer
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(170, 170, 170);
    const text = `Certificado de revisión — ${new Date().toLocaleDateString()} — Página ${i} de ${totalPages}`;
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, 287);
  }

  if (!noSave) doc.save(`Certificado_${centro?.nombre || 'Centro'}_${parte?.numeroMantenimiento || parte?.id || 'N-A'}.pdf`);
};

/**
 * Versión para visualizar el PDF del Certificado en el navegador sin descargar
 */
export const generarCertificadoPDFView = async (...args: any[]): Promise<string> => {
  const tempDoc = new jsPDF('p', 'mm', 'a4');
  // @ts-ignore
  await generarCertificadoPDF(...args, true);
  return tempDoc.output('bloburl').toString();
};

// ─────────────────────────────────────────────────────────────────────────────
// PRESUPUESTO PDF
// ─────────────────────────────────────────────────────────────────────────────
export const generarPresupuestoPDF = (
  presupuesto: {
    titulo: string;
    numeroPresupuesto?: string;
    nombreCliente: string;
    fechaCreacion: string;
    fechaValidez?: string;
    estado: string;
    lineas: { concepto: string; codigo?: string; cantidad: number; precioUnidad: number; subtotal: number }[];
    subtotal: number;
    iva: number;
    total: number;
    notas?: string;
  }
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margen = 20;
  const empData = cargaDatosEmpresa();

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(8, 8, pageWidth - 16, 281, 4, 4, 'D');

  let y = 18;

  try {
    const logoBase64 = localStorage.getItem('firecheck_db_logo');
    if (logoBase64) doc.addImage(logoBase64, 'PNG', margen, y, 50, 12);
    if (logoBase64) {
      const logoProps = doc.getImageProperties(logoBase64);
      const maxLogoWidth = 70;
      const maxLogoHeight = 18;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoBase64, 'PNG', margen, y, logoWidth, logoHeight);
    }
  } catch (e) {}

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('PRESUPUESTO', pageWidth - margen, y + 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  if (presupuesto.numeroPresupuesto) doc.text(`Nº ${presupuesto.numeroPresupuesto}`, pageWidth - margen, y + 14, { align: 'right' });
  y += 20;

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.6);
  doc.line(margen, y, pageWidth - margen, y);
  y += 8;

  const empNombre = empData?.nombre || 'ABANFOC S.L.';
  const empCif = empData?.cif || 'B16794679';
  const empDir = empData?.direccion || 'C/ America 16B Ático';
  const empLoc = `${empData?.poblacion || 'Sta. Coloma de Gramanet'}, ${empData?.provincia || 'Barcelona'} ${empData?.cp || '08921'}`;
  const empTel = empData?.telefono || '651 019 229';

  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margen, y, pageWidth - margen * 2, 22, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('EMPRESA', margen + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(`${empNombre}  |  CIF: ${empCif}`, margen + 4, y + 12);
  doc.text(`${empDir}  |  ${empLoc}`, margen + 4, y + 17);
  doc.text(`Tel: ${empTel}`, margen + 4, y + 22);
  y += 28;

  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  const infoH = 28;
  doc.roundedRect(margen, y, pageWidth - margen * 2, infoH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('DATOS DEL PRESUPUESTO', margen + 4, y + 6);

  const col1x = margen + 4;
  const col2x = margen + 35;
  const col3x = pageWidth / 2 + 5;
  const col4x = pageWidth / 2 + 35;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Cliente:', col1x, y + 13);
  doc.text('Referencia:', col3x, y + 13);
  doc.text('Fecha:', col1x, y + 19);
  doc.text('Validez:', col3x, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(presupuesto.nombreCliente || 'Cliente', col2x, y + 13);
  doc.text(presupuesto.numeroPresupuesto || '—', col4x, y + 13);
  doc.text(new Date(presupuesto.fechaCreacion).toLocaleDateString('es-ES'), col2x, y + 19);
  doc.text(presupuesto.fechaValidez ? new Date(presupuesto.fechaValidez).toLocaleDateString('es-ES') : '—', col4x, y + 19);
  y += infoH + 8;

  const tableBody = (presupuesto.lineas || []).map(l => [
    l.concepto + (l.codigo ? ` (${l.codigo})` : ''),
    String(l.cantidad),
    formatM(l.precioUnidad || 0),
    formatM(l.subtotal || 0)
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Cant.', 'Precio Ud.', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margen, right: margen },
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.15,
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 25, halign: 'right' }, 3: { cellWidth: 25, halign: 'right' } },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 10;
  const totalX = pageWidth - margen;
  const totalY = finalY + 10;

  const ivaExento = presupuesto.iva === 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Subtotal:', totalX - 50, totalY, { align: 'right' });
  doc.text(formatM(presupuesto.subtotal), totalX, totalY, { align: 'right' });
  if (ivaExento) {
    doc.text('IVA:', totalX - 50, totalY + 6, { align: 'right' });
    doc.text('Exento (0%)', totalX, totalY + 6, { align: 'right' });
  } else {
    doc.text(`IVA (${presupuesto.iva}%):`, totalX - 50, totalY + 6, { align: 'right' });
    doc.text(formatM(presupuesto.subtotal * presupuesto.iva / 100), totalX, totalY + 6, { align: 'right' });
  }

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.5);
  doc.line(totalX - 55, totalY + 10, totalX, totalY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('TOTAL:', totalX - 50, totalY + 17, { align: 'right' });
  doc.text(formatM(presupuesto.total), totalX, totalY + 17, { align: 'right' });

  // Texto de exención de IVA si aplica
  if (ivaExento) {
    const exencionY = totalY + 25;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(255, 248, 240);
    const textoExencion = 'Factura exenta de IVA por inversión del sujeto pasivo de acuerdo con el artículo 84 letra f-Uno. 2º - Ley 37/1992 - art. 5 Ley 7/2012';
    const exencionSplit = doc.splitTextToSize(textoExencion, pageWidth - margen * 2 - 8);
    const exencionH = 10 + exencionSplit.length * 4.5;
    doc.roundedRect(margen, exencionY, pageWidth - margen * 2, exencionH, 3, 3, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(180, 120, 40);
    let exy = exencionY + 6;
    exencionSplit.forEach((line: string) => { doc.text(line, margen + 4, exy); exy += 4.5; });
  }

  if (presupuesto.notas) {
    const notasY = totalY + 25;
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 251, 252);
    const notasSplit = doc.splitTextToSize(presupuesto.notas, pageWidth - margen * 2 - 8);
    const notasH = 14 + notasSplit.length * 4.5;
    doc.roundedRect(margen, notasY, pageWidth - margen * 2, notasH, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text('NOTAS', margen + 4, notasY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    let nty = notasY + 12;
    notasSplit.forEach((line: string) => { doc.text(line, margen + 4, nty); nty += 4.5; });
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(170, 170, 170);
    const text = `Presupuesto ${presupuesto.numeroPresupuesto || ''} — ${new Date().toLocaleDateString()} — Página ${i} de ${totalPages}`;
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, 287);
  }

  doc.save(`Presupuesto_${presupuesto.numeroPresupuesto || 'N-A'}.pdf`);
};