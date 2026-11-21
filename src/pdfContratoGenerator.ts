import { jsPDF } from 'jspdf';
import { fetchImageToBase64, normalizarDatosEmpresa, optimizarImagenParaPDF } from './pdfGenerator';

export const generarContratoPDF = async (
  cliente: any,
  centro: any,
  _sistemas: any[],
  contrato: {
    numeroContrato: string;
    fechaInicio: string;
    fechaFin: string;
    importeAnual: string;
    observaciones: string;
    formaPago?: string;
  },
  empresa?: Record<string, any>
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margen = 12;
  const empData = normalizarDatosEmpresa(empresa, centro?.empresaId);
  const logoUrl = empData?.logoUrl;
  const logoBase64 = logoUrl ? await fetchImageToBase64(logoUrl) : null;
  const sealUrl = empData?.selloUrl;
  const sealBase64 = sealUrl ? await fetchImageToBase64(sealUrl) : null;

  const dibujarCabeceraContrato = async (tituloCabecera: string): Promise<number> => {
    const startY = 12;
    // Título del Documento
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text(tituloCabecera, margen, startY + 11);

    // Dibujar Logo junto al título (esquina superior derecha)
    if (logoBase64) {
      try {
        const { base64: logoOpt, format } = await optimizarImagenParaPDF(logoBase64, 800, 0.75);
        const logoProps = doc.getImageProperties(logoOpt);
        const maxLogoWidth = 45;
        const maxLogoHeight = 12;
        const logoRatio = logoProps.width / logoProps.height;
        const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
        const logoHeight = logoWidth / logoRatio;
        doc.addImage(logoOpt, format, pageWidth - margen - logoWidth, startY + 2, logoWidth, logoHeight);
      } catch (e) {
        console.error('Error dibujando logo en cabecera del contrato:', e);
      }
    }

    const lineY = startY + 16;
    // Línea divisoria debajo del título
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.6);
    doc.line(margen, lineY, pageWidth - margen, lineY);

    // Subtítulo debajo de la línea divisoria
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Contrato de mantenimiento nº ${centro.id || contrato.numeroContrato || ''} de instalaciones y sistemas de protección contra incendios.`,
      pageWidth / 2,
      lineY + 5,
      { align: 'center' }
    );

    return lineY + 11;
  };

  let y = await dibujarCabeceraContrato('CONTRATO DE MANTENIMIENTO');

  // Cargar datos de la empresa mantenedora
  const empNombre = empData?.nombre || 'ABANFOC S.L.';
  const empCif = empData?.cif || '-';
  const empDir = empData?.direccion || '-';
  const empLocParts = [empData?.poblacion, empData?.provincia, empData?.cp].filter(p => p && p !== '-');
  const empLoc = empLocParts.length > 0 ? empLocParts.join(', ') : '-';
  const empTel = empData?.telefono || '-';
  const empRasic = empData?.rasic || '-';

  // 1. Datos de las Partes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text('DATOS DE LAS PARTES', margen, y + 3);
  y += 6;

  const boxHeight = 36;

  // Caja para el Mantenedor
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margen, y, (pageWidth - margen * 2) / 2 - 2, boxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('EMPRESA MANTENEDORA:', margen + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(`Nombre: ${empNombre}`, margen + 4, y + 9.5);
  doc.text(`NIF/CIF: ${empCif}`, margen + 4, y + 13.5);
  doc.text(`Dirección: ${empDir}`, margen + 4, y + 17.5);
  doc.text(`Localidad: ${empLoc}`, margen + 4, y + 21.5);
  doc.text(`Teléfono: ${empTel}`, margen + 4, y + 25.5);
  if (empRasic && empRasic !== '-') {
    doc.text(`Nº RASIC: ${empRasic}`, margen + 4, y + 29.5);
  }

  // Preparar dirección y ubicación completa del centro / cliente
  const dirCentroText = centro?.direccion || cliente?.direccion || 'No especificada';
  const locCentroParts = [centro?.poblacion || cliente?.poblacion, centro?.cp ? `CP: ${centro?.cp}` : (cliente?.cp ? `CP: ${cliente?.cp}` : ''), centro?.provincia || cliente?.provincia].filter(Boolean);
  const locCentroText = locCentroParts.length > 0 ? locCentroParts.join(', ') : 'No especificada';

  // Caja para el Cliente / Centro
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margen + (pageWidth - margen * 2) / 2 + 2, y, (pageWidth - margen * 2) / 2 - 2, boxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('CLIENTE / TITULAR:', margen + (pageWidth - margen * 2) / 2 + 6, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(`Cliente: ${cliente?.nombre || 'No especificado'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 9.5);
  doc.text(`CIF/NIF: ${cliente?.cif || 'No especificado'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 13.5);
  doc.text(`Instalación (Centro): ${centro?.nombre || 'No especificado'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 17.5);
  doc.text(`Dirección centro: ${dirCentroText}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 21.5);
  doc.text(`Ubicación centro: ${locCentroText}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 25.5);
  doc.text(`Teléfono: ${cliente?.telefono || centro?.telefono || 'No especificado'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 29.5);

  y += boxHeight + 5;
  // --- OBLIGACIONES DE LA EMPRESA MANTENEDORA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(40, 40, 40);
  doc.text('OBLIGACIONES DE LA EMPRESA MANTENEDORA', margen, y + 3);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(70, 70, 70);

  const obligacionesEmpresa = [
    `LA EMPRESA MANTENEDORA: ${empNombre} con CIF ${empCif} y nº de registro de agente de seguridad industrial de Catalunya ${empRasic} se compromete y adquiere las siguientes obligaciones en relación con los aparatos, equipos o sistemas cuyo mantenimiento o reparación les sea encomendado.`,
    'a) Revisar, mantener y comprobar los aparatos, equipos o instalaciones de acuerdo con los plazos reglamentarios, utilizando recambios y piezas originales o similares homologados.',
    'b) Facilitar personal competente y suficiente cuando sea requerido para corregir las deficiencias o averías que se produzcan en los aparatos, equipos o sistemas cuyo mantenimiento tiene encomendado.',
    'c) Informar por escrito al titular de los aparatos o sistemas que no ofrezcan garantía de correcto funcionamiento, presenten deficiencias que no puedan ser corregidas durante el mantenimiento o no cumplan las disposiciones vigentes que les sean aplicables. Dicho informe será razonado técnicamente.',
    'd) Conservar la documentación justificativa de las operaciones de mantenimiento que realicen, sus fechas de ejecución e incidencias, y los elementos sustituidos y cuando se considere digno de mención para conocer el estado de operatividad del aparato, equipo o sistema cuya conservación se realice. Una copia de dicha documentación se entregará al titular de los aparatos, equipos o sistemas.',
    'e) Comunicar al titular de los aparatos, equipos o sistemas, las fechas en que corresponden efectuar las operaciones de mantenimiento periódico y de las anomalías detectadas en los trabajos, la empresa no se hará responsable de aquellos equipos que hayan sido informados como defectuosos o con anomalías. Se entregará un informe detallado de las anomalías y una valoración para sus reparaciones.'
  ];

  obligacionesEmpresa.forEach(cl => {
    const clSplit = doc.splitTextToSize(cl, pageWidth - margen * 2);
    clSplit.forEach((line: string) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 4;
      }
      doc.text(line, margen, y);
      y += 3.5;
    });
    y += 0.5;
  });

  y += 3;

  // --- OBLIGACIONES DEL CLIENTE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  const obligClientePrefix = 'OBLIGACIONES DEL CLIENTE: ';
  doc.text(obligClientePrefix, margen, y);
  const obligClientePrefixWidth = doc.getTextWidth(obligClientePrefix);
  doc.setFont('helvetica', 'normal');
  doc.text(cliente?.nombre || 'TITULAR', margen + obligClientePrefixWidth, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);

  const totalImporte = parseFloat(contrato.importeAnual) || 0;
  const esPorSistema = (centro as any)?.tipoModalidadContrato === 'por_sistema';

  const periodicidad = centro.periodicidad || [];
  const isMensual = periodicidad.includes('Mensual');
  const isTrimestral = periodicidad.includes('Trimestral');
  const isAnual = periodicidad.includes('Anual');

  const precioAnual = parseFloat((centro as any).precioAnualContrato) || 0;
  const precioTrimestral = parseFloat((centro as any).precioTrimestralContrato) || 0;
  const precioMensual = parseFloat((centro as any).precioMensualContrato) || 0;

  let valorAnualUnitario = 0;
  let valorAnualSubtotal = 0;
  let valorTrimestralUnitario = 0;
  let valorTrimestralSubtotal = 0;
  let valorMensualUnitario = 0;
  let valorMensualSubtotal = 0;

  if (isAnual && isTrimestral && isMensual) {
    valorAnualUnitario = precioAnual;
    valorAnualSubtotal = precioAnual;
    valorTrimestralUnitario = precioTrimestral;
    valorTrimestralSubtotal = precioTrimestral * 3;
    valorMensualUnitario = precioMensual;
    valorMensualSubtotal = precioMensual * 8;
  } else if (isAnual && isTrimestral) {
    valorAnualUnitario = precioAnual;
    valorAnualSubtotal = precioAnual;
    valorTrimestralUnitario = precioTrimestral;
    valorTrimestralSubtotal = precioTrimestral * 3;
  } else if (isAnual && isMensual) {
    valorAnualUnitario = precioAnual;
    valorAnualSubtotal = precioAnual;
    valorMensualUnitario = precioMensual;
    valorMensualSubtotal = precioMensual * 11;
  } else if (isTrimestral && isMensual) {
    valorTrimestralUnitario = precioTrimestral;
    valorTrimestralSubtotal = precioTrimestral * 4;
    valorMensualUnitario = precioMensual;
    valorMensualSubtotal = precioMensual * 8;
  } else if (isAnual) {
    valorAnualUnitario = precioAnual;
    valorAnualSubtotal = precioAnual;
  } else if (isTrimestral) {
    valorAnualUnitario = precioTrimestral;
    valorAnualSubtotal = precioTrimestral;
    valorTrimestralUnitario = precioTrimestral;
    valorTrimestralSubtotal = precioTrimestral * 3;
  } else if (isMensual) {
    valorAnualUnitario = precioMensual;
    valorAnualSubtotal = precioMensual;
    valorMensualUnitario = precioMensual;
    valorMensualSubtotal = precioMensual * 11;
  } else {
    valorAnualUnitario = totalImporte;
    valorAnualSubtotal = totalImporte;
  }

  // Inciso a) - referencia al anexo INVENTARIO DE SISTEMAS Y CUOTAS en hoja aparte
  const clientAIntro = esPorSistema
    ? 'a) Se compromete al pago de las tarifas acordadas por sistema y equipo detalladas en el anexo "INVENTARIO DE SISTEMAS Y CUOTAS" adjunto al presente contrato.'
    : 'a) Se compromete al pago de las cuotas acordadas detalladas en el anexo "INVENTARIO DE SISTEMAS Y CUOTAS" adjunto al presente contrato.';
  const introSplit = doc.splitTextToSize(clientAIntro, pageWidth - margen * 2);
  introSplit.forEach((line: string) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 4;
    }
    doc.text(line, margen, y);
    y += 3.5;
  });

  y += 1.5;

  // Preparar las filas de la tabla dinámica para dibujarlas en la hoja anexa "INVENTARIO DE SISTEMAS Y CUOTAS"
  const colWidths = esPorSistema
    ? [66, 18, 32, 34, 36]
    : [80, 25, 38, 43];

  const colX = [
    margen,
    margen + colWidths[0],
    margen + colWidths[0] + colWidths[1],
    margen + colWidths[0] + colWidths[1] + colWidths[2],
    ...(esPorSistema ? [margen + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]] : [])
  ];
  const rowHeight = 5.5;

  const tableRows: { concepto: string; cantidad: string; unitarioAnual?: string; unitarioTrim?: string; unitario?: string; subtotal: string }[] = [];
  let totalSuma = 0;

  if (esPorSistema) {
    const numTrimestrales = isTrimestral ? (isAnual ? 3 : 4) : 0;
    if (_sistemas && _sistemas.length > 0) {
      _sistemas.forEach((s: any) => {
        const nombre = s.descripcion || s.tipo || s.familia || s.nombre || 'Sistema PCI';
        const cant = Number(s.cantidadEquipos) || 0;
        const pAnual = Number(s.precioUnitarioAnual !== undefined ? s.precioUnitarioAnual : s.precioUnitario) || 0;
        const pTrim = isTrimestral ? (Number(s.precioUnitarioTrimestral || 0) || 0) : 0;
        const subAnual = Math.round(cant * pAnual * 100) / 100;
        const subTrimTotal = Math.round(cant * pTrim * numTrimestrales * 100) / 100;
        const subTotalLinea = Math.round((subAnual + subTrimTotal) * 100) / 100;
        totalSuma += subTotalLinea;
        tableRows.push({
          concepto: nombre,
          cantidad: String(cant),
          unitarioAnual: `${pAnual.toFixed(2)} €/ud`,
          unitarioTrim: isTrimestral && pTrim > 0 ? `${pTrim.toFixed(2)} €/ud` : '—',
          subtotal: `${subTotalLinea.toFixed(2)} € : + i.v.a.`
        });
      });
    }

    if (tableRows.length === 0) {
      tableRows.push({
        concepto: 'Sistemas PCI del Centro',
        cantidad: '1',
        unitarioAnual: `${totalImporte.toFixed(2)} €/ud`,
        unitarioTrim: isTrimestral ? `${totalImporte.toFixed(2)} €/ud` : '—',
        subtotal: `${totalImporte.toFixed(2)} € : + i.v.a.`
      });
      totalSuma = totalImporte;
    }
  } else {
    const cantAnual = isAnual || (!isTrimestral && !isMensual) ? '1' : '0';
    if (cantAnual !== '0' || valorAnualSubtotal > 0) {
      tableRows.push({
        concepto: 'Revisión Anual de Sistemas PCI',
        cantidad: cantAnual,
        unitario: `${valorAnualUnitario.toFixed(2)} € : + i.v.a.`,
        subtotal: `${valorAnualSubtotal.toFixed(2)} € : + i.v.a.`
      });
    }

    const cantTrimestral = isTrimestral ? (isAnual ? '3' : '4') : '0';
    if (cantTrimestral !== '0' || valorTrimestralSubtotal > 0) {
      tableRows.push({
        concepto: 'Revisión Trimestral de Sistemas PCI',
        cantidad: cantTrimestral,
        unitario: `${valorTrimestralUnitario.toFixed(2)} € : + i.v.a.`,
        subtotal: `${valorTrimestralSubtotal.toFixed(2)} € : + i.v.a.`
      });
    }

    const cantMensual = isMensual ? (isAnual ? '11' : (isTrimestral ? '8' : '12')) : '0';
    if (cantMensual !== '0' || valorMensualSubtotal > 0) {
      tableRows.push({
        concepto: 'Revisión Mensual de Sistemas PCI',
        cantidad: cantMensual,
        unitario: `${valorMensualUnitario.toFixed(2)} € : + i.v.a.`,
        subtotal: `${valorMensualSubtotal.toFixed(2)} € : + i.v.a.`
      });
    }

    if (tableRows.length === 0) {
      tableRows.push({
        concepto: 'Revisión Anual de Sistemas PCI',
        cantidad: '1',
        unitario: `${totalImporte.toFixed(2)} € : + i.v.a.`,
        subtotal: `${totalImporte.toFixed(2)} € : + i.v.a.`
      });
    }

    totalSuma = (valorAnualSubtotal > 0 ? valorAnualSubtotal : 0) +
                (valorTrimestralSubtotal > 0 ? valorTrimestralSubtotal : 0) +
                (valorMensualSubtotal > 0 ? valorMensualSubtotal : 0);
    if (totalSuma === 0) {
      totalSuma = totalImporte;
    }
  }

  const formaPagoTxt = contrato.formaPago || 'Transferencia bancaria';
  
  // Render clause (b) with payment method in bold and uppercase
  const part1 = "b) Las cuotas mencionadas serán abonadas una vez realizados los trabajos según condiciones acordadas: ";
  const part2 = ` ${formaPagoTxt.toUpperCase()}`;
  
  const part1Lines = doc.splitTextToSize(part1, pageWidth - margen * 2);
  part1Lines.forEach((line: string, idx: number) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 4;
    }
    
    if (idx === part1Lines.length - 1) {
      doc.setFont('helvetica', 'normal');
      doc.text(line, margen, y);
      
      const widthOfLine = doc.getTextWidth(line);
      doc.setFont('helvetica', 'bold');
      doc.text(part2, margen + widthOfLine, y);
      doc.setFont('helvetica', 'normal');
    } else {
      doc.setFont('helvetica', 'normal');
      doc.text(line, margen, y);
    }
    y += 3.5;
  });
  y += 0.5;

  const obligacionesClienteResto = [
    'c) El cliente entiende que este importe se debe a la revisión del sistema y que no van incluidos los suministros ni recambios o accesorios que se necesiten, tampoco incluye recargas ni retimbres de extintores los cuales se facturarán aparte.',
    'd) El cliente mantendrá informada a la empresa mantenedora de todo tipo de incidencias que tengan relación con las instalaciones y/o los servicios encomendados.'
  ];

  obligacionesClienteResto.forEach(cl => {
    const clSplit = doc.splitTextToSize(cl, pageWidth - margen * 2);
    clSplit.forEach((line: string) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 4;
      }
      doc.text(line, margen, y);
      y += 3.5;
    });
    y += 0.5;
  });

  y += 1.5;

  // --- VIGENCIA DEL CONTRATO ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(40, 40, 40);
  doc.text('VIGENCIA DEL CONTRATO', margen, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(70, 70, 70);
  const vigenciaTxt = 'La duración del presente contrato se estipula por UN AÑO prorrogable de forma indefinida, salvo rescisión del mismo por una de las partes, siempre y cuando sea comunicado por escrito y de forma fehaciente con 1 mes de antelación a la caducidad del contrato.';
  const vigenciaSplit = doc.splitTextToSize(vigenciaTxt, pageWidth - margen * 2);
  vigenciaSplit.forEach((line: string) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 4;
    }
    doc.text(line, margen, y);
    y += 3.5;
  });

  const formatFecha = (fechaStr: string) => {
    if (!fechaStr) return '';
    try {
      const date = new Date(fechaStr);
      if (isNaN(date.getTime())) return fechaStr;
      return date.toLocaleDateString('es-ES');
    } catch (e) {
      return fechaStr;
    }
  };

  const formatFechaFin = (fechaStr: string) => {
    if (!fechaStr) return 'Indefinida';
    try {
      const date = new Date(fechaStr);
      if (isNaN(date.getTime())) return fechaStr;
      return date.toLocaleDateString('es-ES');
    } catch (e) {
      return fechaStr;
    }
  };

  y += 1.0;
  if (y > pageHeight - 20) {
    doc.addPage();
    y = 4;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(40, 40, 40);
  const fechaHoy = new Date().toLocaleDateString('es-ES');
  doc.text(`Fecha de inicio: ${formatFecha(contrato.fechaInicio)}      Fecha de finalización: ${formatFechaFin(contrato.fechaFin)}   (Documento realizado en Barcelona a ${fechaHoy})`, margen, y);
  y += 5.0;

  // --- DOCUMENTACIÓN Y GARANTÍAS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(40, 40, 40);
  doc.text('DOCUMENTACIÓN Y GARANTÍAS', margen, y);
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(70, 70, 70);
  const garantiasTxt = 'Se entregará un listado anexo con la relación de equipos instalados incluidos en el mantenimiento y se realizarán todos los trabajos de acuerdo con la normativa vigente al real decreto 513/2017 del 22 de mayo (BOE nº 139 de 12 de junio del 2017). La garantía de los equipos nuevos y trabajos de mantenimiento, reparaciones o instalaciones nuevas tienen una garantía válida de un año siempre que no se haya hecho mal uso de las instalaciones y/o equipos y estos mantengan su precinto en perfectas condiciones.';
  const garantiasSplit = doc.splitTextToSize(garantiasTxt, pageWidth - margen * 2);
  garantiasSplit.forEach((line: string) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 4;
    }
    doc.text(line, margen, y);
    y += 3.5;
  });

  if (_sistemas && _sistemas.length > 0) {
    y += 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.0);
    doc.setTextColor(40, 40, 40);
    doc.text('SISTEMAS A REVISAR EN EL CENTRO', margen, y);
    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);

    const formattedSistemas = _sistemas
      .filter((s: any) => s.tipo || s.familia)
      .map((s: any) => {
        const name = s.tipo || s.familia || '';
        const count = s.cantidadEquipos || 0;
        const countStr = String(count).padStart(2, '0');
        return `${countStr} und. ${name}`;
      });

    const fullText = formattedSistemas.join(', ');
    const textLines = doc.splitTextToSize(fullText, pageWidth - margen * 2);
    
    textLines.forEach((line: string) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 12;
      }
      doc.text(line, margen, y);
      y += 4.5;
    });
  }

  y += 2;
  if (y > pageHeight - 20) {
    doc.addPage();
    y = 12;
  }

  // Fecha y lugar de firma
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);


  y += 1;

  const dibujarFirmasContrato = async (startY: number) => {
    let fY = startY;
    if (fY > pageHeight - 36) {
      doc.addPage();
      fY = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text('Por la Empresa Mantenedora', margen + 20, fY);
    doc.text('Por el Cliente / Titular', pageWidth - margen - 50, fY);

    if (sealBase64) {
      try {
        const { base64: sealOpt, format } = await optimizarImagenParaPDF(sealBase64, 800, 0.75);
        const sealProps = doc.getImageProperties(sealOpt);
        const maxSealWidth = 45;
        const maxSealHeight = 27;
        const sealRatio = sealProps.width / sealProps.height;
        const sealWidth = Math.min(maxSealWidth, maxSealHeight * sealRatio);
        const sealHeight = sealWidth / sealRatio;
        doc.addImage(sealOpt, format, margen + 18, fY + 2, sealWidth, sealHeight);
      } catch (e) {
        console.error('Error dibujando el sello en el contrato:', e);
      }
    }

    fY += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(40, 40, 40);
    doc.text('Firma y Sello:', margen + 8, fY);
    doc.text('Firma y Sello:', pageWidth - margen - 62, fY);
  };

  // Firmas en primera hoja (condiciones)
  await dibujarFirmasContrato(y);

  // ============================================================================
  // HOJA ANEXA: INVENTARIO DE SISTEMAS Y CUOTAS + FIRMAS
  // ============================================================================
  doc.addPage();
  let yAnexo = await dibujarCabeceraContrato('INVENTARIO DE SISTEMAS Y CUOTAS');
  yAnexo += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 95, 105);
  doc.text(`Cliente: ${cliente?.nombre || 'TITULAR'}  |  Centro: ${centro?.nombre || 'Centro'}`, margen, yAnexo);
  yAnexo += 6;

  const colCenter = (idx: number) => colX[idx] + colWidths[idx] / 2;

  const dibujarCabeceraTabla = (yCab: number) => {
    doc.setFillColor(240, 242, 245);
    doc.rect(margen, yCab, pageWidth - margen * 2, rowHeight, 'F');
    doc.setDrawColor(210, 214, 219);
    doc.setLineWidth(0.2);
    doc.line(margen, yCab, pageWidth - margen, yCab);
    doc.line(margen, yCab + rowHeight, pageWidth - margen, yCab + rowHeight);
    doc.line(margen, yCab, margen, yCab + rowHeight);
    colX.slice(1).forEach(cx => doc.line(cx, yCab, cx, yCab + rowHeight));
    doc.line(pageWidth - margen, yCab, pageWidth - margen, yCab + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    if (esPorSistema) {
      doc.text('Sistema / Elemento PCI', colX[0] + 3, yCab + 3.8);
      doc.text('Equipos', colCenter(1), yCab + 3.8, { align: 'center' });
      doc.text('P. Unit. Anual', colCenter(2), yCab + 3.8, { align: 'center' });
      doc.text('P. Unit. Trim.', colCenter(3), yCab + 3.8, { align: 'center' });
      doc.text('Subtotal Anual', colCenter(4), yCab + 3.8, { align: 'center' });
    } else {
      doc.text('Concepto', colX[0] + 3, yCab + 3.8);
      doc.text('Cantidad', colCenter(1), yCab + 3.8, { align: 'center' });
      doc.text('Precio Unitario', colCenter(2), yCab + 3.8, { align: 'center' });
      doc.text('Subtotal', colCenter(3), yCab + 3.8, { align: 'center' });
    }
  };

  dibujarCabeceraTabla(yAnexo);
  yAnexo += rowHeight;

  tableRows.forEach((row) => {
    if (yAnexo > pageHeight - 42) {
      doc.addPage();
      yAnexo = 16;
      dibujarCabeceraTabla(yAnexo);
      yAnexo += rowHeight;
    }

    doc.setDrawColor(210, 214, 219);
    doc.setLineWidth(0.2);
    doc.line(margen, yAnexo + rowHeight, pageWidth - margen, yAnexo + rowHeight);
    doc.line(margen, yAnexo, margen, yAnexo + rowHeight);
    colX.slice(1).forEach(cx => doc.line(cx, yAnexo, cx, yAnexo + rowHeight));
    doc.line(pageWidth - margen, yAnexo, pageWidth - margen, yAnexo + rowHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    if (esPorSistema) {
      doc.text(row.concepto, colX[0] + 3, yAnexo + 3.8);
      doc.text(row.cantidad, colCenter(1), yAnexo + 3.8, { align: 'center' });
      doc.text(row.unitarioAnual || '', colCenter(2), yAnexo + 3.8, { align: 'center' });
      doc.text(row.unitarioTrim || '', colCenter(3), yAnexo + 3.8, { align: 'center' });
      doc.text(row.subtotal, colCenter(4), yAnexo + 3.8, { align: 'center' });
    } else {
      doc.text(row.concepto, colX[0] + 3, yAnexo + 3.8);
      doc.text(row.cantidad, colCenter(1), yAnexo + 3.8, { align: 'center' });
      doc.text(row.unitario || '', colCenter(2), yAnexo + 3.8, { align: 'center' });
      doc.text(row.subtotal, colCenter(3), yAnexo + 3.8, { align: 'center' });
    }
    yAnexo += rowHeight;
  });

  // Celda de Total debajo de la columna Subtotal
  const totalColIndex = esPorSistema ? 4 : 3;
  doc.setFillColor(248, 250, 252);
  doc.rect(colX[totalColIndex], yAnexo, pageWidth - margen - colX[totalColIndex], rowHeight, 'F');
  doc.setDrawColor(210, 214, 219);
  doc.setLineWidth(0.2);
  doc.line(colX[totalColIndex], yAnexo, colX[totalColIndex], yAnexo + rowHeight);
  doc.line(pageWidth - margen, yAnexo, pageWidth - margen, yAnexo + rowHeight);
  doc.line(colX[totalColIndex], yAnexo + rowHeight, pageWidth - margen, yAnexo + rowHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 40, 40);
  doc.text(esPorSistema ? `Total Anual: ${totalSuma.toFixed(2)} € : + i.v.a.` : `Total: ${totalSuma.toFixed(2)} € : + i.v.a.`, colCenter(totalColIndex), yAnexo + 3.8, { align: 'center' });

  yAnexo += rowHeight + 12;

  // Firmas debajo de la tabla en la hoja anexa
  await dibujarFirmasContrato(yAnexo);

  // Guardar documento
  doc.save(`Contrato_${contrato.numeroContrato || 'Mantenimiento'}_${centro.nombre || 'Centro'}.pdf`);
};
