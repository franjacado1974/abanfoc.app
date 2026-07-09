import { jsPDF } from 'jspdf';
import { cargaDatosEmpresa, fetchImageToBase64, getImageFormat } from './pdfGenerator';

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
  }
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margen = 12;
  const empData = cargaDatosEmpresa();
  const logoUrl = empData?.logoUrl || 'https://firebasestorage.googleapis.com/v0/b/app-abanfoc-v1.firebasestorage.app/o/empresa%2Flogo_1780000624676?alt=media&token=b92c0cd7-a0bf-4a96-ab0c-2aa124e52683';
  const logoBase64 = await fetchImageToBase64(logoUrl);
  const sealUrl = empData?.selloUrl || 'https://firebasestorage.googleapis.com/v0/b/app-abanfoc-v1.firebasestorage.app/o/empresa%2Fsello_1782150237718?alt=media&token=a9f6f995-9886-426b-b0e3-d3bb523b5d00';
  const sealBase64 = await fetchImageToBase64(sealUrl);

  let y = 12;

  // Cabecera: Título del Documento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('CONTRATO DE MANTENIMIENTO', margen, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Contrato de mantenimiento nº ${centro.id || ''} de instalaciones y sistemas de protección contra incendios.`, pageWidth / 2, y + 18, { align: 'center' });

  // Dibujar Logo junto al título (esquina superior derecha)
  if (logoBase64) {
    try {
      const logoProps = doc.getImageProperties(logoBase64);
      const maxLogoWidth = 45;
      const maxLogoHeight = 12;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      const format = getImageFormat(logoBase64);
      doc.addImage(logoBase64, format, pageWidth - margen - logoWidth, y + 5, logoWidth, logoHeight);
    } catch (e) {
      console.error('Error dibujando logo en cabecera del contrato:', e);
    }
  }

  y += 21;

  // Línea divisoria
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.6);
  doc.line(margen, y, pageWidth - margen, y);
  y += 8;

  // Cargar datos de la empresa mantenedora
  const empNombre = empData?.nombre || 'ABANFOC S.L.';
  const empCif = empData?.cif || 'B16794679';
  const empDir = empData?.direccion || 'C/ America 16B Ático';
  const empLoc = `${empData?.poblacion || 'Sta. Coloma de Gramanet'}, ${empData?.provincia || 'Barcelona'} ${empData?.cp || '08921'}`;
  const empTel = empData?.telefono || '651 019 229';

  // 1. Datos de las Partes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text('DATOS DE LAS PARTES', margen, y + 3);
  y += 6;

  // Caja para el Mantenedor
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margen, y, (pageWidth - margen * 2) / 2 - 2, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('EMPRESA MANTENEDORA:', margen + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(`Nombre: ${empNombre}`, margen + 4, y + 10);
  doc.text(`NIF/CIF: ${empCif}`, margen + 4, y + 14);
  doc.text(`Dirección: ${empDir}`, margen + 4, y + 18);
  doc.text(`Localidad: ${empLoc}`, margen + 4, y + 22);
  doc.text(`Teléfono: ${empTel}`, margen + 4, y + 26);

  // Caja para el Cliente / Centro
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margen + (pageWidth - margen * 2) / 2 + 2, y, (pageWidth - margen * 2) / 2 - 2, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('CLIENTE / TITULAR:', margen + (pageWidth - margen * 2) / 2 + 6, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(`Cliente: ${cliente?.nombre || 'No especificado'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 10);
  doc.text(`CIF/NIF: ${cliente?.cif || 'No especificado'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 14);
  doc.text(`Instalación (Centro): ${centro?.nombre || 'No especificado'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 18);
  doc.text(`Dirección centro: ${centro?.direccion || 'No especificada'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 22);
  doc.text(`Teléfono: ${cliente?.telefono || centro?.telefono || 'No especificado'}`, margen + (pageWidth - margen * 2) / 2 + 6, y + 26);

  y += 37;
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
    'LA EMPRESA MANTENEDORA: ABANFOC S.L. con CIF B16794679 y nº de registro de agente de seguridad industrial de Catalunya 106001687 se compromete y adquiere las siguientes obligaciones en relación con los aparatos, equipos o sistemas cuyo mantenimiento o reparación les sea encomendado.',
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

  // Inciso a)
  const clientAIntro = 'a) Se compromete al pago de las siguientes cuotas acordadas:';
  const introSplit = doc.splitTextToSize(clientAIntro, pageWidth - margen * 2);
  introSplit.forEach((line: string) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 4;
    }
    doc.text(line, margen, y);
    y += 3.5;
  });

  y += 2;

  // Dibujar tabla dinámica (4 columnas)
  const colWidths = [80, 25, 38, 43];
  const colX = [
    margen,
    margen + colWidths[0],
    margen + colWidths[0] + colWidths[1],
    margen + colWidths[0] + colWidths[1] + colWidths[2]
  ];
  const rowHeight = 5.5;

  // Preparar las filas que realmente tienen contenido
  const tableRows: { concepto: string; cantidad: string; unitario: string; subtotal: string }[] = [];

  // Fila Anual
  const cantAnual = isAnual || (!isTrimestral && !isMensual) ? '1' : '0';
  if (cantAnual !== '0' || valorAnualSubtotal > 0) {
    tableRows.push({
      concepto: 'Revisión Anual de Sistemas PCI',
      cantidad: cantAnual,
      unitario: `${valorAnualUnitario.toFixed(2)} € : + i.v.a.`,
      subtotal: `${valorAnualSubtotal.toFixed(2)} € : + i.v.a.`
    });
  }

  // Fila Trimestral
  const cantTrimestral = isTrimestral ? (isAnual ? '3' : '4') : '0';
  if (cantTrimestral !== '0' || valorTrimestralSubtotal > 0) {
    tableRows.push({
      concepto: 'Revisión Trimestral de Sistemas PCI',
      cantidad: cantTrimestral,
      unitario: `${valorTrimestralUnitario.toFixed(2)} € : + i.v.a.`,
      subtotal: `${valorTrimestralSubtotal.toFixed(2)} € : + i.v.a.`
    });
  }

  // Fila Mensual
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

  const numRows = tableRows.length + 1; // +1 de cabecera
  const tableHeight = numRows * rowHeight;

  if (y > pageHeight - 30) {
    doc.addPage();
    y = 4;
  }

  // Dibujar fondo cabecera
  doc.setFillColor(240, 242, 245);
  doc.rect(margen, y, pageWidth - margen * 2, rowHeight, 'F');

  // Bordes y líneas horizontales
  doc.setDrawColor(210, 214, 219);
  doc.setLineWidth(0.2);
  doc.line(margen, y, pageWidth - margen, y); // Línea superior
  for (let i = 1; i <= numRows; i++) {
    doc.line(margen, y + rowHeight * i, pageWidth - margen, y + rowHeight * i);
  }

  // Líneas verticales
  doc.line(margen, y, margen, y + tableHeight); // Izquierda
  doc.line(colX[1], y, colX[1], y + tableHeight);
  doc.line(colX[2], y, colX[2], y + tableHeight);
  doc.line(colX[3], y, colX[3], y + tableHeight);
  doc.line(pageWidth - margen, y, pageWidth - margen, y + tableHeight); // Derecha

  // Escribir cabecera
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(60, 60, 60);
  doc.text('Concepto', colX[0] + 3, y + 3.8);
  doc.text('Cantidad', colX[1] + 3, y + 3.8);
  doc.text('Precio Unitario', colX[2] + 3, y + 3.8);
  doc.text('Subtotal', colX[3] + 3, y + 3.8);

  // Escribir filas de datos
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  tableRows.forEach((row, index) => {
    const rowY = y + rowHeight * (index + 1);
    doc.text(row.concepto, colX[0] + 3, rowY + 3.8);
    doc.text(row.cantidad, colX[1] + 3, rowY + 3.8);
    doc.text(row.unitario, colX[2] + 3, rowY + 3.8);
    doc.text(row.subtotal, colX[3] + 3, rowY + 3.8);
  });

  // Calcular suma de subtotales
  let totalSuma = (valorAnualSubtotal > 0 ? valorAnualSubtotal : 0) + 
                  (valorTrimestralSubtotal > 0 ? valorTrimestralSubtotal : 0) + 
                  (valorMensualSubtotal > 0 ? valorMensualSubtotal : 0);
  if (totalSuma === 0) {
    totalSuma = totalImporte;
  }

  // Dibujar la celda de Total debajo de la columna Subtotal
  const totalCellY = y + tableHeight;
  doc.setFillColor(248, 250, 252);
  doc.rect(colX[3], totalCellY, pageWidth - margen - colX[3], rowHeight, 'F');
  
  doc.setDrawColor(210, 214, 219);
  doc.setLineWidth(0.2);
  doc.line(colX[3], totalCellY, colX[3], totalCellY + rowHeight);
  doc.line(pageWidth - margen, totalCellY, pageWidth - margen, totalCellY + rowHeight);
  doc.line(colX[3], totalCellY + rowHeight, pageWidth - margen, totalCellY + rowHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Total: ${totalSuma.toFixed(2)} € : + i.v.a.`, colX[3] + 3, totalCellY + 3.8);

  y += tableHeight + rowHeight + 3;

  doc.setFont('helvetica', 'normal');
  y += 2;

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

  // Firmas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Por la Empresa Mantenedora', margen + 20, y);
  doc.text('Por el Cliente / Titular', pageWidth - margen - 50, y);

  if (sealBase64) {
    try {
      const sealProps = doc.getImageProperties(sealBase64);
      const maxSealWidth = 45;
      const maxSealHeight = 27;
      const sealRatio = sealProps.width / sealProps.height;
      const sealWidth = Math.min(maxSealWidth, maxSealHeight * sealRatio);
      const sealHeight = sealWidth / sealRatio;
      const format = getImageFormat(sealBase64);
      doc.addImage(sealBase64, format, margen + 18, y + 2, sealWidth, sealHeight);
    } catch (e) {
      console.error('Error dibujando el sello en el contrato:', e);
    }
  }

  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Firma y Sello:', margen + 8, y);
  doc.text('Firma y Sello:', pageWidth - margen - 62, y);

  // Guardar documento
  doc.save(`Contrato_${contrato.numeroContrato || 'Mantenimiento'}_${centro.nombre || 'Centro'}.pdf`);
};
