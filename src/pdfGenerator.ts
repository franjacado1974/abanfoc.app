import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { extintorBase64 } from './icono_extintor';
import { biesBase64 } from './icono_bies';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Helper para formatear moneda en español (punto para miles, coma para decimales)
const formatM = (valor: any) => {
  const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : Number(valor);
  if (isNaN(num)) return '0,00 €';
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${parts.join(',')} €`;
};

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

const fetchImageToBase64 = async (urlOrBase64: string | null | undefined): Promise<string | null> => {
  if (!urlOrBase64) return null;
  if (urlOrBase64.startsWith('http')) {
    try {
      const response = await fetch(urlOrBase64);
      if (response.ok) {
        const blob = await response.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.error("Error fetching image via fetch():", e);
    }
    // Fallback si falla el fetch (ej. CORS)
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch(err) {
            resolve(urlOrBase64);
          }
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(urlOrBase64);
      img.src = urlOrBase64;
    });
  }
  return urlOrBase64;
};

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
  checklistItemsPorSistema?: Record<string, { key: string; label: string; tipoRespuesta?: string }[]>,
  empresa?: Record<string, any>,
  noSave?: boolean
) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const empData = empresa || cargaDatosEmpresa() || {};

  const firmaIngenieroBase64 = await fetchImageToBase64(empData?.ingenieroFirmaUrl);
  const logoData = await fetchImageToBase64(empData?.logoUrl) || await fetchImageToBase64(localStorage.getItem('firecheck_db_logo'));
  const selloEmpresaBase64 = await fetchImageToBase64(empData?.selloUrl);

  // ============ FIRST PAGE: INFO PAGE (REDISEÑO ELEGANTE) ============
  const drawInfoPage = async () => {
    // ── Logo (esquina superior derecha) ──
    if (logoData) {
      const logoProps = doc.getImageProperties(logoData);
      const maxLogoWidth = 65;
      const maxLogoHeight = 16;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoData, 'PNG', pageWidth - 14 - logoWidth, 12, logoWidth, logoHeight);
    }

    // ── Título principal ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('ACTA DE REVISIÓN', pageWidth / 2, 22, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.0);
    doc.setTextColor(100, 100, 100);
    const subtitleText = 'Mantenimientos realizados según el programa de mantenimiento preventivo establecido por la norma en el reglamento de instalaciones contra incendios aprobado por el Real Decreto 513/2017 del 22 de mayo.';
    doc.text(subtitleText, pageWidth / 2, 32, { align: 'center' });

    // ── Línea decorativa doble ──
    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.6);
    doc.line(14, 36, pageWidth - 14, 36);
    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.2);
    doc.line(14, 37.5, pageWidth - 14, 37.5);

    // ── Número de acta y fecha (barra superior centrada) ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`N.º Acta: ${numeroMantenimiento || '—'}  -  Fecha: ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, 44, { align: 'center' });

    // ── SECCIÓN: DATOS DEL CLIENTE Y CENTRO (dos columnas) ──
    let y = 52;
    const col1X = 14;
    const col2X = pageWidth / 2 + 4;

    // Título de sección
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(50, 50, 50);
    doc.text('DATOS DEL CLIENTE Y CENTRO', 14, y + 3);
    y += 5;

    // Línea sutil bajo el título
    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.2);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    // Columna izquierda: Cliente
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.0);
    doc.setTextColor(50, 50, 50);
    doc.text('DATOS CLIENTE', col1X, y);
    const clientStartY = y;
    y += 5.0;

    const cliData = [
      { label: 'Cliente:', value: cliente?.nombre || '—' },
      { label: 'CIF:', value: cliente?.cif || '—' },
      { label: 'Dirección:', value: cliente?.direccion || '—' },
      { 
        label: 'Población:', 
        value: `${cliente?.poblacion || ''}${cliente?.provincia ? ', ' + cliente.provincia : ''}${cliente?.cp ? ' - ' + cliente.cp : ''}` || '—' 
      },
      { label: 'Teléfono:', value: cliente?.telefono || '—' },
      { label: 'Email:', value: cliente?.correo || '—' },
      { label: 'Contacto:', value: cliente?.contacto || '—' },
    ];

    // Calcular el ancho máximo de las etiquetas para alinearlas a la misma columna
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    const maxLabelW = Math.max(...cliData.map(item => doc.getTextWidth(item.label)));

    cliData.forEach(item => {
      // 1. Dibujar Label en Bold
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(50, 50, 50);
      doc.text(item.label, col1X, y);
      
      // 2. Dibujar Value en Regular/Normal
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      doc.setTextColor(80, 80, 80);
      doc.text(item.value, col1X + maxLabelW + 2, y);
      
      y += 4.4;
    });

    // Columna derecha: Centro
    const cenY = clientStartY; // misma posición Y que cliente
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.0);
    doc.setTextColor(50, 50, 50);
    doc.text('DATOS DEL CENTRO', col2X, cenY);
    let cy = cenY + 5.0;

    const cenData = [
      { label: 'Centro:', value: centro?.nombre || '—' },
      { label: 'Dirección:', value: centro?.direccion || '—' },
      { 
        label: 'Población:', 
        value: `${centro?.poblacion || ''}${centro?.provincia ? ', ' + centro.provincia : ''}${centro?.cp ? ' - ' + centro.cp : ''}` || '—' 
      },
      { label: 'Teléfono:', value: centro?.telefono || '—' },
      { label: 'Email:', value: centro?.correo || '—' },
      { label: 'Contacto:', value: centro?.contacto || '—' },
    ];

    // Calcular el ancho máximo de las etiquetas para alinearlas a la misma columna
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    const maxCenLabelW = Math.max(...cenData.map(item => doc.getTextWidth(item.label)));

    cenData.forEach(item => {
      // 1. Dibujar Label en Bold
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(50, 50, 50);
      doc.text(item.label, col2X, cy);
      
      // 2. Dibujar Value en Regular/Normal
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      doc.setTextColor(80, 80, 80);
      doc.text(item.value, col2X + maxCenLabelW + 2, cy);
      
      cy += 4.4;
    });

    // ── SECCIÓN: INFORMACIÓN DEL MANTENIMIENTO ──
    y = Math.max(y, cy) + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(50, 50, 50);
    doc.text('INFORMACIÓN DEL MANTENIMIENTO', 14, y + 3);
    y += 5;

    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.2);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    const periodicidad: string[] = centro?.periodicidad || [];
    const mesRevision: string = (centro?.mesesRevision && centro.mesesRevision.length > 0) ? centro.mesesRevision[0] : '';

    // Buscar habilitación del técnico en localStorage
    const habilitacionTecnico = (() => {
      try {
        const stored = localStorage.getItem('firecheck_db_tecnicos');
        if (stored && tecnicoNombre) {
          const list: any[] = JSON.parse(stored);
          const match = list.find(t => {
            const full = `${t.nombre ?? ''} ${t.apellidos ?? ''}`.trim();
            return full.toLowerCase() === tecnicoNombre.trim().toLowerCase();
          });
          return match?.habilitacion || match?.numHabilitacion || match?.habilitacionNum || match?.carnet || '';
        }
      } catch (e) {
        console.error("Error looking up technician habilitation:", e);
      }
      return '';
    })();

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

    // Tabla de información en dos columnas (3 filas x 2 columnas)
    const infoFields: [string, string][] = [
      ['N.º de mantenimiento:', numeroMantenimiento || '—'],
      ['Técnico asignado:', tecnicoNombre || 'No asignado'],
      ['Fecha del mantenimiento:', new Date().toLocaleDateString('es-ES')],
      ['N.º Habilitación:', habilitacionTecnico || 'No especificado'],
      ['Periodicidad contratada:', periodicidad.length > 0 ? periodicidad.join(', ') : 'No definida'],
      ['Revisiones programadas:', revList],
    ];

    doc.setFontSize(8.2);
    let iy = y + 2;
    infoFields.forEach(([label, value], i) => {
      const colX = (i % 2 === 0) ? col1X : col2X;
      const rowY = iy + Math.floor(i / 2) * 6.0;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(label, colX, rowY);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(value, colX + 42, rowY);
    });

    // ── SECCIÓN: EMPRESA MANTENEDORA ──
    y = iy + 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(50, 50, 50);
    doc.text('EMPRESA MANTENEDORA', 14, y + 3);
    y += 5;

    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.2);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    const empNombre = empData?.nombre || 'ABANFOC S.L.';
    const empCif = empData?.cif || 'B16794679';
    const empRasic = empData?.rasic || '106001687';
    const empDir = empData?.direccion || 'C/ America 16B Ático';
    const empLoc = `${empData?.poblacion || 'Sta. Coloma de Gramanet'}${empData?.provincia ? ', ' + empData.provincia : ''}${empData?.cp ? ' - ' + empData.cp : ''}`;
    const empTel = empData?.telefono || '651 019 229';
    const empMail = empData?.correo || empData?.email || 'info@abanfoc.com';

    const empLines = [
      { label: 'Empresa:', value: empNombre },
      { label: 'CIF:', value: empCif },
      { label: 'RASIC:', value: empRasic },
      { label: 'Dirección:', value: empDir },
      { label: 'Población:', value: empLoc },
      { label: 'Teléfono:', value: empTel },
      { label: 'Email:', value: empMail }
    ];

    // Calcular el ancho máximo de las etiquetas para alinearlas a la misma columna
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    const maxEmpLabelW = Math.max(...empLines.map(item => doc.getTextWidth(item.label)));

    empLines.forEach(item => {
      // 1. Dibujar Label en Bold
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(50, 50, 50);
      doc.text(item.label, col1X, y);

      // 2. Dibujar Value en Normal
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      doc.setTextColor(80, 80, 80);
      doc.text(item.value, col1X + maxEmpLabelW + 2, y);

      y += 4.3;
    });

    // Bottom logo removed from cover page

    // ── Sello de empresa (esquina inferior derecha, encima del pie de página) ──
    if (selloEmpresaBase64) {
      try {
        const selloProps = doc.getImageProperties(selloEmpresaBase64);
        const maxSelloWidth = 55;
        const maxSelloHeight = 40;
        const selloRatio = selloProps.width / selloProps.height;
        const selloWidth = Math.min(maxSelloWidth, maxSelloHeight * selloRatio);
        const selloHeight = selloWidth / selloRatio;
        doc.addImage(selloEmpresaBase64, 'PNG', pageWidth - 14 - selloWidth, 182 - selloHeight, selloWidth, selloHeight);
      } catch (err) {
        console.error("Error adding company stamp to PDF:", err);
      }
    }

    // ── Sello / firma digital (esquina inferior derecha) ──
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
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

    if (logoData) {
      const logoProps = doc.getImageProperties(logoData);
      const maxLogoWidth = 45;
      const maxLogoHeight = 11;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoData, 'PNG', pageWidth - 14 - logoWidth, 11, logoWidth, logoHeight);
    }

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text('ACTA DE REVISIÓN - SISTEMAS DE PROTECCIÓN CONTRA INCENDIOS', pageWidth / 2, 14, { align: 'center' });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`${cliente?.nombre || ''} | ${centro?.nombre || ''}`, pageWidth / 2, 22, { align: 'center' });
    doc.setLineWidth(0.3);
    doc.line(10, 26, pageWidth - 10, 26);
  };

  const getMark = (val: any) => {
    if (val === true || val === 'true') return 'TICK';
    if (val === false || val === 'false') return 'X';
    if (typeof val === 'string' || typeof val === 'number') {
        const str = val.toString().trim();
        return str !== '' ? str : '-';
    }
    return '-';
  };

  const drawnTablePages = new Set<number>();

  const renderSection = async (title: string, equipos: any[], isBie: boolean, currentY: number, iconoBase64?: string, sistemaId?: string) => {
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

    const headersBase = isBie ?
      ['Nº', 'Nivel planta y ubicación', 'Placa', 'Tipo', 'Longitud', 'Fabricante', 'Fecha\nFabricación', 'Prueba\nHidráulica'] :
      ['Nº', 'Nivel planta y ubicación', 'Placa', 'Tipo', 'Fabricante', 'Fecha\nFabricación', 'Último\nRetimbre'];

    const checkItemsDeSistema = (checklistItemsPorSistema && sistemaId) ? checklistItemsPorSistema[sistemaId] : [];

    const findItem = (keywords: string[]) => checkItemsDeSistema.find(item => {
      const lbl = (item.label || '').toLowerCase();
      return keywords.some(k => lbl.includes(k));
    });

    const itemPlaca = findItem(['placa', 'industria']);
    const itemClase = findItem(['clase']);
    const itemTipo = findItem(['tipo']);
    const itemLongitud = findItem(['longitud']);
    const itemFabricante = findItem(['fabricante', 'marca']);
    const itemFechaFab = findItem(['fabricación', 'fabricacion', 'año', 'fecha fab']);
    const itemRetimbre = findItem(['retimbre']);
    const itemPruebaH = findItem(['prueba hidra', 'prueba hidráulica']);

    const fixedItemsKeys = [
        itemPlaca?.key, itemClase?.key, itemTipo?.key, itemLongitud?.key,
        itemFabricante?.key, itemFechaFab?.key, itemRetimbre?.key, itemPruebaH?.key
    ].filter(Boolean);

    const checkItems = (checkItemsDeSistema || []).filter(item => {
      const lbl = (item.label || '').toLowerCase();
      const isNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
      const isFixed = fixedItemsKeys.includes(item.key);
      const isExcluded = lbl.includes('orden de lista') || 
                         lbl.includes('ubicación') || 
                         lbl.includes('ubicacion') || 
                         lbl.includes('sin uso') || 
                         lbl.includes('imagen') ||
                         lbl.includes('fecha de revisi') || // Exclude from PDF
                         lbl.includes('fecha revisi') ||    // Exclude from PDF
                         item.tipoRespuesta === 'imagen' ||
                         item.tipoRespuesta === 'seccion'; // Excluir campos de imagen y secciones explícitamente

      return !isNotas && !isFixed && !isExcluded;
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

    const checkLabels = checkItems.length > 0
      ? checkItems.map(item => item.label || '')
      : (isBie ? [
          'Acceso al BIE', 'Altura de la válvula y maneta', 'Señalización', 'Estado general del armario',
          'Estado maneta o cerradura', 'Estado de la devanadera', 'Tramo de manguera', 'Dispone del Marcado CE',
          'Etiquetas de uso y manejo', 'Etiquetas de prueba hidráulica', 'Estado de la lanza y posiciones',
          'Distancia entre Bies es < 25 m.', 'Válvula y manómetro', 'Presión de la red (bar)'
        ] : [
          'Acceso al extintor', 'Altura del extintor', 'Soporte correcto', 'Señalización',
          'Difusor - manguera', 'Peso total del aparato', 'Presión manómetro', 'Extintor con Marcado CE',
          'Etiquetas de tipo y manejo', 'Etiqueta último Retimbre', 'Adecuado para su riesgo',
          'Distancia < 15 m. al siguiente', 'Anilla pasador y precinto', 'Si es carro verificar movilidad'
        ]);

    const getVal = (eq: any, item: any, fixedKey: string) => {
        if (item && eq[item.key] !== undefined && eq[item.key] !== '') return eq[item.key];
        return eq[fixedKey] || '-';
    };

    const formatMesAno = (val: any) => {
        if (!val || val === '-') return '-';
        const str = String(val).trim();
        const parts = str.split('-');
        if (parts.length === 3) return `${parts[1]}-${parts[0]}`;
        if (parts.length === 2 && parts[0].length === 4) return `${parts[1]}-${parts[0]}`;
        return str;
    };

    const padCodigo = (val: any) => {
      if (!val || val === '-') return '-';
      const num = parseInt(String(val), 10);
      if (!isNaN(num)) return String(num).padStart(3, '0');
      return String(val);
    };

    const tableData = equipos.map(eq => {
      const baseRow = isBie ? [
        padCodigo(eq.codigo),
        eq.ubicacion || '-',
        getVal(eq, itemPlaca, 'placa'),
        getVal(eq, itemTipo, 'nombre'),
        getVal(eq, itemLongitud, 'longitud'),
        getVal(eq, itemFabricante, 'fabricante'),
        formatMesAno(getVal(eq, itemFechaFab, 'fechaFabricacion')),
        formatMesAno(getVal(eq, itemPruebaH, 'pruebaHidraulica'))
      ] : [
        padCodigo(eq.codigo),
        eq.ubicacion || '-',
        getVal(eq, itemPlaca, 'placa'),
        getVal(eq, itemTipo, 'nombre'),
        getVal(eq, itemFabricante, 'fabricante'),
        formatMesAno(getVal(eq, itemFechaFab, 'fechaFabricacion')),
        formatMesAno(getVal(eq, itemRetimbre, 'ultimoRetimbre'))
      ];

      return [
        ...baseRow,
        ...checkKeys.map(k => getMark(eq[k]))
      ];
    });

    const dynamicColumnStyles: any = { 
      0: { halign: 'center', fillColor: [128, 0, 32], textColor: [255, 255, 255] }, 
      1: { halign: 'left' } 
    };
    checkHeaders.forEach((_, i) => {
      dynamicColumnStyles[headersBase.length + i] = { halign: 'center', cellWidth: 7.5 };
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    let maxLabelWidth = 0;
    checkLabels.forEach(lbl => {
      const cleanLbl = lbl.replace(/^\d+\.\s*/, '');
      const w = doc.getTextWidth(cleanLbl);
      if (w > maxLabelWidth) maxLabelWidth = w;
    });
    const calculatedHeaderHeight = Math.max(20, maxLabelWidth + 1); // 5 puntos más corta

    autoTable(doc, {
      startY: currentY + 4,
      margin: { top: 40 },
      headStyles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontSize: 7, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [255, 255, 255] },
      bodyStyles: { fontSize: 7, halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] },

      columnStyles: dynamicColumnStyles,
      head: [
        [
          { content: '', colSpan: headersBase.length, styles: { fillColor: [255, 255, 255], lineWidth: 0.1, lineColor: [255, 255, 255], minCellHeight: calculatedHeaderHeight } },
          ...checkHeaders.map(h => ({ content: h, rowSpan: 2 }))
        ],
        headersBase
      ],
      body: tableData,
      didDrawPage: function (data: any) {
        if (!drawnTablePages.has(data.pageNumber)) {
          drawTableHeader(data.pageNumber);
          drawnTablePages.add(data.pageNumber);
        }
      },
      didParseCell: function (data: any) {
        if (data.section === 'head') {
          if (data.row.index === 1 && data.column.index < headersBase.length) {
             data.cell.styles.minCellHeight = 10;
             data.cell.styles.valign = 'middle';
          }
          if (data.column.index >= headersBase.length) {
             data.cell.text = [''];
          }
        }
        if (data.section === 'body' && data.column.index >= headersBase.length) {
          if (data.cell.raw === 'X') {
            data.cell.styles.textColor = anomalyTextColor;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 9;
          } else if (data.cell.raw === 'TICK') {
            data.cell.text = [''];
          } else if (data.cell.raw !== '-') {
            // Es un número o texto (ej. presión 15, peso 12.5), lo imprimimos tal cual
            data.cell.styles.textColor = [0,0,0];
            data.cell.styles.fontStyle = 'normal';
          }
        }
      },
      didDrawCell: function (data: any) {
        if (data.section === 'head' && data.row.index === 0 && data.column.index === 0) {
          const cellX = data.cell.x;
          const cellY = data.cell.y;
          const cellH = data.cell.height;
          const centerY = cellY + (cellH / 2);

          if (iconoBase64) {
            doc.addImage(iconoBase64, 'PNG', cellX + 2, centerY - 6, 12, 12);
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          doc.text(title, cellX + (iconoBase64 ? 16 : 2), centerY - 1);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(0, 0, 0);
          const textoAnomalias = 'Las anotaciones en ';
          const textoRojo = 'rojo';
          const textoO = ' o con una ';
          const textoX = 'X';
          const textoFinal = ' indican anomalías que deben corregirse.';
          const totalX = cellX + (iconoBase64 ? 16 : 2);
          doc.text(textoAnomalias, totalX, centerY + 3.5);
          const w1 = doc.getTextWidth(textoAnomalias);
          doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
          doc.text(textoRojo, totalX + w1, centerY + 3.5);
          const w2 = doc.getTextWidth(textoRojo);
          doc.setTextColor(0, 0, 0);
          doc.text(textoO, totalX + w1 + w2, centerY + 3.5);
          const w3 = doc.getTextWidth(textoO);
          doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
          doc.text(textoX, totalX + w1 + w2 + w3, centerY + 3.5);
          const w4 = doc.getTextWidth(textoX);
          doc.setTextColor(0, 0, 0);
          doc.text(textoFinal, totalX + w1 + w2 + w3 + w4, centerY + 3.5);
        }

        if (data.section === 'head' && data.column.index >= headersBase.length && data.row.index === 0) {
          const lbl = checkLabels[data.column.index - headersBase.length];
          if (lbl) {
            const cleanLbl = lbl.replace(/^\d+\.\s*/, '');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6.5);
            const x = data.cell.x + (data.cell.width / 2) + 0.8;
            const y = data.cell.y + data.cell.height - 3;
            doc.text(cleanLbl, x, y, { angle: 90 });
          }
        }
        if (data.section === 'body' && data.column.index >= headersBase.length && data.cell.raw === 'TICK') {
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
      
      const notasItem = checkItemsDeSistema.find(item => {
        const lbl = (item.label || '').toLowerCase();
        return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
      });
      const notasValue = notasItem && eq[notasItem.key] ? String(eq[notasItem.key]).trim() : '';
      const hasNotasText = notasValue !== '';
      
      return hasChecksUnmarked || hasText || hasNotasText;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Anomalías y anomalías:', 14, finalY);
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
          doc.text('Anomalías y anomalías (continuación):', 14, finalY);
          doc.setFont("helvetica", "normal");
          finalY += 7;
          doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
        }

    // Buscar el valor del campo "Observaciones y anomalías del equipo" en los items del checklist
    const notasItem = checkItemsDeSistema.find(item => {
      const lbl = (item.label || '').toLowerCase();
      return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
    });
    const notasValue = notasItem && eq[notasItem.key] ? String(eq[notasItem.key]).trim() : '';
    const textAnomalia = eq.anomalias ? eq.anomalias : (notasValue || 'No supera las comprobaciones visuales.');
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

    tableStartY = await renderSection(nombreSistema.toUpperCase(), equiposSistema, esBie, tableStartY, icono, sist.id);
  }

  // ============ SIGNATURE PAGE (PÁGINA FINAL DEDICADA) ============
  doc.addPage();
  const sigPageNum = (doc.internal as any).getNumberOfPages();
  doc.setPage(sigPageNum);

  // Encabezado de la página de firmas
  if (logoData) {
    const logoProps = doc.getImageProperties(logoData);
    const maxLogoWidth = 45;
    const maxLogoHeight = 11;
    const logoRatio = logoProps.width / logoProps.height;
    const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
    const logoHeight = logoWidth / logoRatio;
    doc.addImage(logoData, 'PNG', pageWidth - 14 - logoWidth, 11, logoWidth, logoHeight);
  }

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

  // Bloques de firma (3 columnas) sin cuadros coloreados
  const blockW = 75;
  const gap = 20;
  const totalBlocksWidth = blockW * 3 + gap * 2;
  const startBlocksX = (pageWidth - totalBlocksWidth) / 2;

  // Subir la sección de firmas 5 puntos respecto al valor anterior (bajado 10 puntos en total)
  sigY -= 5;

  for (let i = 0; i < 3; i++) {
    const bx = startBlocksX + i * (blockW + gap);
    const by = sigY;

    // Título del bloque (Cargo)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    const titles = ['TÉCNICO TITULADO', 'TÉCNICO HABILITADO', 'CLIENTE / TITULAR'];
    doc.text(titles[i], bx + blockW / 2, by + 8, { align: 'center' });

    // Imagen de firma si existe
    if (i === 2 && firmaCliente) {
      try {
        doc.addImage(firmaCliente, 'PNG', bx + 11, by + 10, blockW - 22, 16);
      } catch (_e) { }
    }
    if (i === 1 && firmaTecnico) {
      try {
        doc.addImage(firmaTecnico, 'PNG', bx + 11, by + 10, blockW - 22, 16);
      } catch (_e) { }
    }
    if (i === 0 && firmaIngenieroBase64) {
      try {
        doc.addImage(firmaIngenieroBase64, 'PNG', bx + 11, by + 10, blockW - 22, 16);
      } catch (_e) { }
    }

    // Nombre del firmante debajo de la firma
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    const nombreIngenieroCompleto = (empData?.ingenieroNombre && empData?.ingenieroApellidos) 
      ? `${empData.ingenieroNombre} ${empData.ingenieroApellidos}`
      : (empData?.tecnicoTitulado || 'Técnico Titulado');

    const names = [
      nombreIngenieroCompleto,
      (tecnicoNombre || 'Técnico Habilitado'),
      (nombreFirmante || 'Cliente / Titular')
    ];
    doc.text(names[i], bx + blockW / 2, by + 36, { align: 'center' });

    // Cargo / cualificación
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    const cargoIngeniero = empData?.ingenieroColegiado
      ? `Ingeniero Industrial N.º ${empData.ingenieroColegiado}`
      : (empData?.numTecnicoTitulado ? `Ingeniero Industrial N.º ${empData.numTecnicoTitulado}` : 'Ingeniero Industrial');
      
    const cargos = [
      cargoIngeniero,
      'Técnico Habilitado',
      'Titular / Responsable del centro'
    ];
    doc.text(cargos[i], bx + blockW / 2, by + 40, { align: 'center' });
  }

  sigY += 55;

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

  if (!noSave) doc.save(`Acta_Revision_${centro?.nombre || 'Centro'}_${new Date().toISOString().split('T')[0]}.pdf`);
  return doc;
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
  checklistItemsPorSistema?: Record<string, { key: string; label: string; tipoRespuesta?: string }[]>,
  empresa?: Record<string, any>
): Promise<string> => {
  const doc = await generarActaExtintoresPDF(
    cliente,
    centro,
    sistemas,
    equiposTodos,
    numeroMantenimiento,
    tecnicoNombre,
    anomalyTextColor,
    firmaCliente,
    firmaTecnico,
    nombreFirmante,
    checklistItemsPorSistema,
    empresa,
    true
  );
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
  titulo?: string,
  periodicidad?: string,
  sistemas?: Record<string, any>[]
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Datos de empresa: usar la empresa pasada como parámetro, o cargar de localStorage
  const empData = empresa || cargaDatosEmpresa() || {};

  // ── CABECERA: Logo + Datos empresa ──
  let headerY = 12;

  // Logo a la derecha - cargar desde URL si es necesario
  try {
    const logoData = await fetchImageToBase64(empData?.logoUrl || localStorage.getItem('firecheck_db_logo'));
    if (logoData) {
      const logoProps = doc.getImageProperties(logoData);
      const maxLogoWidth = 55;
      const maxLogoHeight = 18;
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
    tableData = items.map(item => {
      const desc = (item.descripcion || '').trim();
      const formattedDesc = desc ? desc.charAt(0).toUpperCase() + desc.slice(1).toLowerCase() : '';
      return [
        String(item.cantidad),
        item.concepto || '',
        formattedDesc,
        formatM(item.precioUnidad),
        formatM(item.subtotal)
      ];
    });
    subtotalTotal = items.reduce((acc, item) => acc + (item.subtotal || 0), 0);
  } else {
    const conteoPorSistema: Record<string, { cantidad: number, nombre: string }> = {};
    equiposTodos.forEach(eq => {
      const sistId = eq.sistemaId || 'sin-sistema';
      if (!conteoPorSistema[sistId]) {
        const sist = sistemas?.find(s => s.id === sistId);
        conteoPorSistema[sistId] = {
           cantidad: 0,
           nombre: sist?.nombre || sist?.tipo || sist?.familia || eq.nombre || eq.clase || 'Equipos varios'
        };
      }
      conteoPorSistema[sistId].cantidad += 1;
    });

    const per = periodicidad || 'Revisión';
    const conceptoStr = per.toLowerCase().includes('revisión') || per.toLowerCase().includes('revision') ? per : `Revisión ${per}`;

    tableData = Object.values(conteoPorSistema).map((sys) => {
      const desc = (sys.nombre || '').trim();
      const formattedDesc = desc ? desc.charAt(0).toUpperCase() + desc.slice(1).toLowerCase() : '';
      return [
        `${sys.cantidad} und.`,
        conceptoStr,
        formattedDesc,
        '',
        ''
      ];
    });
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
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);

  // Firma del Técnico
  doc.text('Firma del Técnico:', 14, finalY);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, finalY + 3, 56, 30, 2, 2);
  if (firmaTecnico) {
    doc.addImage(firmaTecnico, 'PNG', 15, finalY + 4, 54, 28);
  }
  doc.text(`Nombre: ${tecnicoNombre || 'N/A'}`, 14, finalY + 37);

  // Conformidad Cliente
  doc.text('Conformidad del Cliente:', 80, finalY);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.roundedRect(80, finalY + 3, 56, 30, 2, 2);
  if (firmaCliente) {
    doc.addImage(firmaCliente, 'PNG', 81, finalY + 4, 54, 28);
  }
  doc.text(`Nombre: ${nombreFirmante || 'N/A'}`, 80, finalY + 37);

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
  return doc;
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
  titulo?: string,
  periodicidad?: string
): Promise<string> => {
  const doc = await generarAlbaranPDF(cliente, centro, equiposTodos, numeroMantenimiento, tecnicoNombre, firmaCliente, firmaTecnico, nombreFirmante, items, empresa, true, titulo, periodicidad);
  return doc.output('bloburl').toString();
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
  noSave?: boolean,
  empresa?: Record<string, any>
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const empData = empresa || cargaDatosEmpresa() || {};
  const margen = 14;

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
  doc.text(`Revisión de instalaciones y sistemas de protección contra incendios - ${parte?.numeroMantenimiento || parte?.id || '—'}`, pageWidth / 2, y + 9, { align: 'center' });

  // Línea decorativa bajo la cabecera
  y += 16;
  doc.setDrawColor(128, 0, 32);
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
  const empTel = empData?.telefono || '651 019 229';
  const empMail = empData?.correo || empData?.email || 'info@abanfoc.com';
  const empRasic = empData?.rasic || '106001687';

  const cardEmpH = 39;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 251, 252);
  doc.roundedRect(margen, y, pageWidth - margen * 2, cardEmpH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('EMPRESA MANTENEDORA', margen + 4, y + 6);

  const empLines = [
    { label: 'Empresa:', value: empNombre },
    { label: 'CIF:', value: empCif },
    { label: 'RASIC:', value: empRasic },
    { label: 'Dirección:', value: empDir },
    { label: 'Población:', value: empLoc },
    { label: 'Teléfono:', value: empTel },
    { label: 'Email:', value: empMail }
  ];

  // Calcular el ancho máximo de las etiquetas para alinearlas a la misma columna
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const maxEmpLabelW = Math.max(...empLines.map(item => doc.getTextWidth(item.label)));

  let ey = y + 11;
  empLines.forEach(item => {
    // 1. Dibujar Label en Regular/Normal
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, margen + 4, ey);

    // 2. Dibujar Value en Bold alineado a la derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text(item.value, margen + 4 + maxEmpLabelW + 2, ey, { maxWidth: pageWidth - margen * 2 - 80 });

    ey += 4;
  });

  // Logo a la derecha dentro de la tarjeta
  try {
    const logoData = await fetchImageToBase64(empData?.logoUrl || localStorage.getItem('firecheck_db_logo'));
    if (logoData) {
      const logoProps = doc.getImageProperties(logoData);
      const maxLogoWidth = 70;
      const maxLogoHeight = 15;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoData, 'PNG', pageWidth - margen - 4 - logoWidth, y + 6, logoWidth, logoHeight);
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
    doc.setFont('helvetica', i === 6 ? 'bold' : 'normal');
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
  let tieneAlgunaAnomalia = false;
  if (equiposTodos && equiposTodos.length > 0) {
    tieneAlgunaAnomalia = equiposTodos.some(eq => {
      // 1. Un check en rojo/falso
      const hasChecksUnmarked = Object.keys(eq).some(k => k.toLowerCase().startsWith('check') && eq[k] === false);
      // 2. Campo .anomalias con texto
      const hasText = eq.anomalias && typeof eq.anomalias === 'string' && eq.anomalias.trim() !== '';
      // 3. Cualquier campo de notas/observaciones/anomalía con texto
      const hasNotesText = Object.keys(eq).some(k => {
        const keyLower = k.toLowerCase();
        if (keyLower.includes('nota') || keyLower.includes('observaci') || keyLower.includes('anomal')) {
          const val = eq[k];
          return typeof val === 'string' && val.trim() !== '';
        }
        return false;
      });
      return hasChecksUnmarked || hasText || hasNotesText;
    });
  }

  const rawEstado = (estadoCertificado || 'Favorable').toLowerCase();
  const esNegativo = rawEstado.includes('negativo') || rawEstado.includes('no') || tieneAlgunaAnomalia;
  const estadoLimpio = esNegativo ? 'NO favorable' : 'Favorable';

  // Texto de certificación formal
  const nombreCentro = centro?.nombre || 'el centro indicado';
  const tecnicoTitulado = (empData?.ingenieroNombre && empData?.ingenieroApellidos) 
      ? `${empData.ingenieroNombre} ${empData.ingenieroApellidos}`
      : (empData?.tecnicoTitulado || 'Técnico Titulado de la Empresa');
  const nifTecnico = empData?.ingenieroNif || empData?.nifTecnico || 'N.I.F. no especificado';
  const numTecnico = empData?.ingenieroColegiado || empData?.numTecnicoTitulado || 'N.º de colegiado no especificado';

  const textoCertificacion = 
    `Don ${tecnicoTitulado}, con N.I.F. ${nifTecnico}, Técnico titulado n.º ${numTecnico} y en calidad de responsable técnico ` +
    `de la empresa instaladora y mantenedora de sistemas de protección contra incendios ${empNombre} con N.I.F. ` +
    `${empCif}, autorizada por la Generalitat de Catalunya con n.º de RASIC ${empData?.rasic || '106001687'}, ` +
    `CERTIFICA que se ha efectuado la revisión de los equipos y sistemas contra incendios en "${nombreCentro}" ` +
    `según REAL DECRETO 513/2017 del Reglamento de Instalaciones de Protección Contra Incendios.`;

  // Establecer el formato de la fuente antes de medir con splitTextToSize para que el wrap sea correcto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // Usar splitTextToSize para un word-wrap más robusto
  // Dejamos un margen interno de 5 mm a cada lado del texto dentro de la tarjeta
  const textLines = doc.splitTextToSize(textoCertificacion, pageWidth - margen * 2 - 10);

  const lineSpacing = 4.2;
  const cardResultH = 11 + (textLines.length * lineSpacing) + 7;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 251, 252);
  doc.roundedRect(margen, y, pageWidth - margen * 2, cardResultH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('RESULTADO DE LA REVISIÓN', margen + 5, y + 6);

  let ly = y + 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  textLines.forEach((line: string) => {
    doc.text(line, margen + 5, ly);
    ly += lineSpacing;
  });

  // Estado del resultado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const colorRes: [number, number, number] = esNegativo ? [220, 38, 38] : [22, 163, 74];
  doc.setTextColor(colorRes[0], colorRes[1], colorRes[2]);
  doc.text(`Resultado: ${estadoLimpio}`, margen + 5, ly + 1);

  y += cardResultH + 8;

  // ── FIRMAS (Certificado) ──
  const firmaIngenieroBase64 = await fetchImageToBase64(empData?.ingenieroFirmaUrl);
  if (firmaIngenieroBase64 || _firmaTecnico || _firmaCliente) {
    const firmasY = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);

    // Buscar habilitación del técnico en localStorage
    const habilitacionTecnico = (() => {
      try {
        const stored = localStorage.getItem('firecheck_db_tecnicos');
        if (stored && tecnicoNombre) {
          const list: any[] = JSON.parse(stored);
          const match = list.find(t => {
            const full = `${t.nombre ?? ''} ${t.apellidos ?? ''}`.trim();
            return full.toLowerCase() === tecnicoNombre.trim().toLowerCase();
          });
          return match?.habilitacion || match?.numHabilitacion || match?.habilitacionNum || match?.carnet || '';
        }
      } catch (e) {
        console.error("Error looking up technician habilitation:", e);
      }
      return '';
    })();
    
    // Firma Ingeniero
    doc.text('El Técnico Titulado', 20, firmasY);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(20, firmasY + 3, 50, 25, 2, 2);
    if (firmaIngenieroBase64) {
      doc.addImage(firmaIngenieroBase64, 'PNG', 22, firmasY + 4, 46, 23);
    }
    
    // Firma Técnico
    doc.text('Técnico mantenedor', 80, firmasY);
    doc.roundedRect(80, firmasY + 3, 50, 25, 2, 2);
    if (_firmaTecnico) {
      doc.addImage(_firmaTecnico, 'PNG', 82, firmasY + 4, 46, 23);
    }
    
    // Firma Cliente
    doc.text('Conformidad Cliente', 140, firmasY);
    doc.roundedRect(140, firmasY + 3, 50, 25, 2, 2);
    if (_firmaCliente) {
      doc.addImage(_firmaCliente, 'PNG', 142, firmasY + 4, 46, 23);
    }

    // Nombres y cargos debajo de las firmas
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);

    // Nombre Ingeniero
    const nombreIngeniero = (empData?.ingenieroNombre && empData?.ingenieroApellidos) 
      ? `${empData.ingenieroNombre} ${empData.ingenieroApellidos}`
      : (empData?.tecnicoTitulado || 'Técnico Titulado');
    doc.text(nombreIngeniero, 20, firmasY + 32);

    // Nombre Técnico
    doc.text(tecnicoNombre || 'Técnico mantenedor', 80, firmasY + 32);

    // Nombre Cliente
    doc.text(_nombreFirmante || 'Cliente / Titular', 140, firmasY + 32);

    // Cargos y números
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);

    // Cargo e Ingeniero nº
    const numColegiado = empData?.ingenieroColegiado || empData?.numTecnicoTitulado || '—';
    doc.text(`Ingeniero nº: ${numColegiado}`, 20, firmasY + 36);

    // Cargo Técnico
    const numHab = habilitacionTecnico || '—';
    doc.text(`Habilitación nº: ${numHab}`, 80, firmasY + 36);

    // Cargo Cliente
    doc.text('Titular del centro', 140, firmasY + 36);
  }

  // Footer (solo número de página alineado a la derecha)
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, 287, { align: 'right' });
  }

  if (!noSave) doc.save(`Certificado_${centro?.nombre || 'Centro'}_${parte?.numeroMantenimiento || parte?.id || 'N-A'}.pdf`);
  return doc;
};

/**
 * Versión para visualizar el PDF del Certificado en el navegador sin descargar
 */
export const generarCertificadoPDFView = async (
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
  _noSave?: boolean,
  empresa?: Record<string, any>
): Promise<string> => {
  const doc = await generarCertificadoPDF(
    cliente,
    centro,
    parte,
    tecnicoNombre,
    estadoCertificado,
    sistemas,
    equiposTodos,
    _firmaCliente,
    _firmaTecnico,
    _nombreFirmante,
    true, // Force noSave to true for viewing in browser
    empresa
  );
  return doc.output('bloburl').toString();
};

// ─────────────────────────────────────────────────────────────────────────────
// PRESUPUESTO PDF
// ─────────────────────────────────────────────────────────────────────────────
export const generarPresupuestoPDF = async (
  presupuesto: {
    titulo: string;
    numeroPresupuesto?: string;
    nombreCliente: string;
    fechaCreacion: string;
    fechaValidez?: string;
    estado: string;
    lineas: { concepto: string; codigo?: string; fotoUrl?: string; cantidad: number; precioUnidad: number; subtotal: number }[];
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

  // Tarjeta de empresa más grande con logo incluido
  const cardEmpH = 32;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margen, y, pageWidth - margen * 2, cardEmpH, 3, 3, 'FD');
  
  // Logo dentro de la tarjeta (esquina superior derecha)
  try {
    // Intentar obtener el logo de varias fuentes
    let logoData: string | null = null;
    
    // 1º Intentar desde localStorage directamente (suele ser base64)
    const storedLogo = localStorage.getItem('firecheck_db_logo');
    if (storedLogo) {
      logoData = storedLogo;
    }
    
    // 2º Intentar desde datos de empresa
    if (!logoData && empData?.logoUrl) {
      logoData = await fetchImageToBase64(empData.logoUrl);
    }
    
    if (logoData) {
      const logoProps = doc.getImageProperties(logoData);
      const maxLogoWidth = 55;
      const maxLogoHeight = 14;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoData, 'PNG', pageWidth - margen - 4 - logoWidth, y + 3, logoWidth, logoHeight);
    }
  } catch (e) { console.error('Error cargando logo en presupuesto:', e); }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('EMPRESA', margen + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(`${empNombre}  |  CIF: ${empCif}`, margen + 4, y + 13);
  doc.text(`${empDir}  |  ${empLoc}`, margen + 4, y + 19);
  doc.text(`Tel: ${empTel}  |  RASIC: ${empData?.rasic || '106001687'}`, margen + 4, y + 25);
  y += cardEmpH + 8;

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

  // Cargar imágenes de las líneas que tengan fotoUrl (de forma asíncrona para no bloquear)
  const lineasConFoto = (presupuesto.lineas || []).filter(l => l.fotoUrl);
  const imagenesCargadas: Record<number, string> = {};
  if (lineasConFoto.length > 0) {
    for (const l of lineasConFoto) {
      if (l.fotoUrl) {
        try {
          const base64 = await fetchImageToBase64(l.fotoUrl);
          if (base64) {
            imagenesCargadas[(presupuesto.lineas || []).indexOf(l)] = base64;
          }
        } catch (e) {}
      }
    }
  }

  const tableBody = (presupuesto.lineas || []).map(l => [
    '', // Columna para imagen (se dibujará con didDrawCell)
    l.concepto + (l.codigo ? ` (${l.codigo})` : ''),
    String(l.cantidad),
    formatM(l.precioUnidad || 0),
    formatM(l.subtotal || 0)
  ]);

  autoTable(doc, {
    startY: y,
    head: [['', 'Concepto', 'Cant.', 'Precio Ud.', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margen, right: margen },
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.15,
    columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 25, halign: 'right' }, 4: { cellWidth: 25, halign: 'right' } },
    didDrawCell: (data: any) => {
      // Dibujar imagen en la primera columna si existe para esta fila
      if (data.section === 'body' && data.column.index === 0) {
        const rowIndex = data.row.index;
        const imgBase64 = imagenesCargadas[rowIndex];
        if (imgBase64) {
          try {
            const cellW = data.cell.width;
            const cellH = data.cell.height;
            const padding = 1;
            const imgW = cellW - padding * 2;
            const imgH = cellH - padding * 2;
            doc.addImage(imgBase64, 'PNG', data.cell.x + padding, data.cell.y + padding, imgW, imgH);
          } catch (e) {}
        }
      }
    }
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