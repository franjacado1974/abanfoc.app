import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { extintorBase64 } from './icono_extintor';
import { biesBase64 } from './icono_bies';
import { getSistemasCategorias } from './firebase';

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

export function tieneFechaInvalida(eq: any): boolean {
  if (!eq) return false;

  const nombreEq = (eq.nombre && typeof eq.nombre === 'string' ? eq.nombre : '').toLowerCase();
  const claseEq = (eq.clase && typeof eq.clase === 'string' ? eq.clase : '').toLowerCase();
  const tipoEq = (eq.tipo && typeof eq.tipo === 'string' ? eq.tipo : '').toLowerCase();

  const tieneRetimbreKey = Object.keys(eq).some(k => k.toLowerCase().includes('retimbre'));
  const tieneHidraKey = Object.keys(eq).some(k => k.toLowerCase().includes('hidra') || k.toLowerCase().includes('pruebahidra'));

  const esExtintor = nombreEq.includes('extintor') || claseEq.includes('extintor') || tipoEq.includes('extintor') || tieneRetimbreKey;
  const esBie = nombreEq.includes('bie') || nombreEq.includes('boca') || claseEq.includes('bie') || claseEq.includes('boca') || tipoEq.includes('bie') || tipoEq.includes('boca') || (tieneHidraKey && !tieneRetimbreKey);

  // Si no es ninguno de los dos, no hay regla de fecha inválida estándar
  if (!esExtintor && !esBie) {
    return false;
  }

  // Encontrar claves
  let keyFab = '';
  let keyRet = '';
  let keyHidra = '';

  for (const k of Object.keys(eq)) {
    if (k.startsWith('check') || k.startsWith('item_')) {
      continue;
    }
    const kLower = k.toLowerCase();
    if (kLower.includes('revision') || kLower.includes('inspeccion') || kLower.includes('proxim')) {
      continue;
    }
    if (kLower.includes('fabricaci') || kLower.includes('fechafab') || kLower.includes('añofab') || kLower.includes('anofab')) {
      keyFab = k;
    } else if (kLower.includes('retimbre')) {
      keyRet = k;
    } else if (kLower.includes('hidra') || kLower.includes('prueba')) {
      keyHidra = k;
    }
  }

  const valFab = keyFab ? eq[keyFab] : null;
  const valRet = keyRet ? eq[keyRet] : null;
  const valHidra = keyHidra ? eq[keyHidra] : null;

  const parseDate = (val: any) => {
    if (typeof val !== 'string' || !val || val === '-') return null;
    const clean = val.trim();
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(clean)) {
      const d = new Date(clean);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const dateFab = parseDate(valFab);
  const dateRet = parseDate(valRet);
  const dateHidra = parseDate(valHidra);

  const today = new Date();

  // 1. Lógica de Extintores
  if (esExtintor && dateFab) {
    const monthsSinceFab = (today.getFullYear() - dateFab.getFullYear()) * 12 + today.getMonth() - dateFab.getMonth();
    if (monthsSinceFab >= 240) {
      return true; // Caducado >= 20 años
    }

    // Retimbre
    let refDate = dateFab;
    if (dateRet) {
      refDate = dateRet;
    }
    const monthsSinceRef = (today.getFullYear() - refDate.getFullYear()) * 12 + today.getMonth() - refDate.getMonth();
    if (monthsSinceRef >= 60 || monthsSinceFab >= 237 || monthsSinceRef >= 57) {
      return true; // Necesita retimbre o se aproxima
    }
  }

  // 2. Lógica de BIEs
  if (esBie) {
    if (dateFab) {
      let diffYears = today.getFullYear() - dateFab.getFullYear();
      if (today.getMonth() < dateFab.getMonth() || (today.getMonth() === dateFab.getMonth() && today.getDate() < dateFab.getDate())) {
        diffYears--;
      }
      if (diffYears >= 20) {
        return true; // Caducado >= 20 años (BIE)
      }
    }

    if (dateHidra) {
      let diffYears = today.getFullYear() - dateHidra.getFullYear();
      if (today.getMonth() < dateHidra.getMonth() || (today.getMonth() === dateHidra.getMonth() && today.getDate() < dateHidra.getDate())) {
        diffYears--;
      }
      if (diffYears >= 5) {
        return true; // Necesita prueba hidráulica >= 5 años (BIE)
      }
    }
  }

  return false;
}

export function equipoTieneAnomalias(eq: any): boolean {
  if (!eq) return false;

  // REGLA 1: El campo directo "anomalias" ("Observaciones y anomalías del equipo:") tiene texto → rojo → NO FAVORABLE
  if (eq.anomalias && typeof eq.anomalias === 'string' && eq.anomalias.trim() !== '') {
    return true;
  }

  // Revisar todos los campos dinámicos del equipo
  for (const k of Object.keys(eq)) {
    const kLower = k.toLowerCase();

    // Ignorar claves de metadatos conocidas
    if (
      kLower === 'id' ||
      kLower === 'centroid' ||
      kLower === 'sistemaid' ||
      kLower === 'codigo' ||
      kLower === 'nombre' ||
      kLower === 'ubicacion' ||
      kLower === 'revisable' ||
      kLower === 'revisado' ||
      kLower === 'placa' ||
      kLower === 'clase' ||
      kLower === 'fabricante' ||
      kLower === 'fechafabricacion' ||
      kLower === 'ultimoretimbre' ||
      kLower === 'pesocapacidad' ||
      kLower === 'longitud' ||
      kLower === 'pruebahidraulica' ||
      kLower === 'foto' ||
      kLower === 'createdat' ||
      kLower === 'updatedat' ||
      kLower === 'capacidad' ||
      kLower === 'peso' ||
      kLower === 'marca' ||
      kLower === 'modelo' ||
      kLower === 'tipo' ||
      kLower === 'preciounidad' ||
      kLower === 'precio' ||
      kLower === 'subtotal' ||
      kLower === 'cantidad' ||
      kLower === 'anomalias' ||
      kLower === 'ordendelista' ||
      kLower === 'ordenlista' ||
      kLower === 'fecharevision' ||
      kLower === 'fechaderevision'
    ) {
      continue;
    }

    const val = eq[k];

    // REGLA 2a: Campo dinámico cuya clave contiene "anomal" ("Observaciones y anomalías del equipo:" con clave dinámica) tiene texto → rojo → NO FAVORABLE
    if (kLower.includes('anomal')) {
      if (typeof val === 'string' && val.trim() !== '') {
        return true;
      }
      // Si no tiene texto, ignorar aunque la clave sea de anomalías
      continue;
    }

    // REGLA 2b: Pregunta de checklist con respuesta boolean false → equivale a "NO CORRECTO" en UI → NO FAVORABLE
    if (val === false || val === 'false') {
      return true;
    }

    // REGLA 2c: Pregunta de checklist con respuesta explícita "NO CORRECTO", "INCORRECTO" o "NO CONFORME" → NO FAVORABLE
    if (typeof val === 'string') {
      const valUpper = val.toUpperCase().trim();
      if (
        valUpper === 'NO CORRECTO' ||
        valUpper.includes('NO CORRECTO') ||
        valUpper === 'INCORRECTO' ||
        valUpper === 'NO CONFORME' ||
        valUpper.includes('NO CONFORME')
      ) {
        return true;
      }
    }
  }

  return false;
}

export function determinarSiFechaEsInvalida(
  eq: any,
  key: string,
  label: string,
  esBie: boolean,
  esExtintor: boolean,
  keyFabOverride?: string,
  keyRetOverride?: string
): boolean {
  if (!eq) return false;
  const val = eq[key];
  const lbl = (label || '').toLowerCase();
  
  // Si es un extintor (o el sistema es Extintores)
  if (esExtintor || lbl.includes('extintor')) {
    const esFab = lbl.includes('fabricaci') || lbl.includes('fecha fab');
    const esRet = lbl.includes('retimbre');
    
    if (esFab || esRet) {
      let keyFab = keyFabOverride || (esFab ? key : '');
      let keyRet = keyRetOverride || (esRet ? key : '');
      
      if (!keyFab) {
        const found = Object.keys(eq).find(k => k.toLowerCase().includes('fabricaci') || k.toLowerCase().includes('fechafab'));
        if (found) keyFab = found;
      }
      if (!keyRet) {
        const found = Object.keys(eq).find(k => k.toLowerCase().includes('retimbre'));
        if (found) keyRet = found;
      }
      
      const valFab = keyFab ? eq[keyFab] : null;
      const valRet = keyRet ? eq[keyRet] : null;
      const today = new Date();
      
      if (esFab) {
        if (!valFab || valFab === '-') return false;
        const dateFab = new Date(valFab);
        if (!isNaN(dateFab.getTime())) {
          const monthsSinceFab = (today.getFullYear() - dateFab.getFullYear()) * 12 + today.getMonth() - dateFab.getMonth();
          if (monthsSinceFab >= 240 || monthsSinceFab >= 237) {
            return true; // Caducado o se aproxima a caducidad >= 20 años (237 meses para aviso)
          }
        }
      } else if (esRet) {
        const dateFab = valFab ? new Date(valFab) : null;
        const dateRet = valRet && valRet !== '-' ? new Date(valRet) : null;
        
        const isFabValid = dateFab && !isNaN(dateFab.getTime());
        const isRetValid = dateRet && !isNaN(dateRet.getTime());
        
        if (isRetValid) {
          const monthsSinceRet = (today.getFullYear() - dateRet!.getFullYear()) * 12 + today.getMonth() - dateRet!.getMonth();
          if (monthsSinceRet >= 60 || monthsSinceRet >= 57) {
            return true; // Necesita retimbre o se aproxima >= 5 años
          }
        } else if (isFabValid) {
          const monthsSinceFab = (today.getFullYear() - dateFab!.getFullYear()) * 12 + today.getMonth() - dateFab!.getMonth();
          if (monthsSinceFab >= 60 || monthsSinceFab >= 57) {
            return true; // Necesita retimbre desde fabricación >= 5 años
          }
        }
      }
    }
  }

  // Si es una BIE (o el sistema es BIEs / Bocas de Incendio)
  if (esBie || lbl.includes('bie') || lbl.includes('boca')) {
    if (!val || val === '-') return false;
    const esFabBie = lbl.includes('fabricaci') || lbl.includes('fecha fab');
    const esHidraBie = lbl.includes('hidra') || lbl.includes('prueba') || lbl.includes('manguera');
    
    if (esFabBie) {
      const dateFab = new Date(val);
      if (!isNaN(dateFab.getTime())) {
        const today = new Date();
        let diffYears = today.getFullYear() - dateFab.getFullYear();
        if (today.getMonth() < dateFab.getMonth() || (today.getMonth() === dateFab.getMonth() && today.getDate() < dateFab.getDate())) {
          diffYears--;
        }
        if (diffYears >= 20) {
          return true; // Caducado >= 20 años
        }
      }
    }
    
    if (esHidraBie) {
      const dateHidra = new Date(val);
      if (!isNaN(dateHidra.getTime())) {
        const today = new Date();
        let diffYears = today.getFullYear() - dateHidra.getFullYear();
        if (today.getMonth() < dateHidra.getMonth() || (today.getMonth() === dateHidra.getMonth() && today.getDate() < dateHidra.getDate())) {
          diffYears--;
        }
        if (diffYears >= 5) {
          return true; // Necesita prueba hidráulica >= 5 años
        }
      }
    }
  }

  return false;
}


export const fetchImageToBase64 = async (urlOrBase64: string | null | undefined): Promise<string | null> => {
  if (!urlOrBase64) return null;
  if (urlOrBase64.startsWith('data:')) {
    return urlOrBase64;
  }
  if (urlOrBase64.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(urlOrBase64, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const blob = await response.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              resolve(null);
            }
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.error("Error fetching image via fetch():", e);
    }
    // Fallback si falla el fetch (ej. CORS)
    try {
      return await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        const timeoutId = setTimeout(() => {
          img.src = '';
          resolve(null);
        }, 4000);
        img.onload = () => {
          clearTimeout(timeoutId);
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            try {
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            } catch (err) {
              console.error("Error converting canvas to base64:", err);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        img.onerror = () => {
          clearTimeout(timeoutId);
          resolve(null);
        };
        img.src = urlOrBase64;
      });
    } catch (fallbackErr) {
      console.error("Error in fallback image loading:", fallbackErr);
      return null;
    }
  }
  return urlOrBase64;
};

export const getImageFormat = (base64: string | null | undefined): string => {
  if (!base64) return 'PNG';
  if (base64.startsWith('data:image/png')) return 'PNG';
  if (base64.startsWith('data:image/jpeg') || base64.startsWith('data:image/jpg')) return 'JPEG';
  if (base64.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
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
  noSave?: boolean,
  observacionesTecnico?: string
) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const empData = empresa || cargaDatosEmpresa() || {};

  const firmaIngenieroBase64 = await fetchImageToBase64(empData?.ingenieroFirmaUrl);
  const logoData = await fetchImageToBase64(empData?.logoUrl) || await fetchImageToBase64(localStorage.getItem('firecheck_db_logo'));
  const selloEmpresaBase64 = await fetchImageToBase64(empData?.selloUrl);

  // Cargar categorías de sistemas para obtener iconos correctos
  let categoriasSistema: any[] = [];
  try {
    const dbCats = await getSistemasCategorias();
    if (dbCats && dbCats.length > 0) {
      categoriasSistema = dbCats;
    }
  } catch (err) {
    console.error("Error fetching system categories from Firestore in pdfGenerator:", err);
  }
  if (categoriasSistema.length === 0) {
    try {
      const savedCats = typeof localStorage !== 'undefined' ? localStorage.getItem('firecheck_db_sistemas_categorias') : null;
      if (savedCats) {
        categoriasSistema = JSON.parse(savedCats);
      }
    } catch (err) {
      console.error("Error loading system categories from localStorage in pdfGenerator:", err);
    }
  }

  // ============ FIRST PAGE: INFO PAGE (REDISEÑO ELEGANTE) ============
  const drawInfoPage = async () => {
    // ── Logo (esquina superior derecha) ──
    if (logoData) {
      try {
        const logoProps = doc.getImageProperties(logoData);
        const maxLogoWidth = 65;
        const maxLogoHeight = 16;
        const logoRatio = logoProps.width / logoProps.height;
        const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
        const logoHeight = logoWidth / logoRatio;
        const format = getImageFormat(logoData);
        doc.addImage(logoData, format, pageWidth - 14 - logoWidth, 12, logoWidth, logoHeight);
      } catch (err) {
        console.error("Error drawing logo on cover page:", err);
      }
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
        const format = getImageFormat(selloEmpresaBase64);
        doc.addImage(selloEmpresaBase64, format, pageWidth - 14 - selloWidth, 182 - selloHeight, selloWidth, selloHeight);
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

    const originalPage = (doc.internal as any).getCurrentPageInfo().pageNumber;
    doc.setPage(pageNum);

    if (logoData) {
      try {
        const logoProps = doc.getImageProperties(logoData);
        const maxLogoWidth = 45;
        const maxLogoHeight = 11;
        const logoRatio = logoProps.width / logoProps.height;
        const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
        const logoHeight = logoWidth / logoRatio;
        const format = getImageFormat(logoData);
        doc.addImage(logoData, format, pageWidth - 14 - logoWidth, 11, logoWidth, logoHeight);
      } catch (err) {
        console.error("Error drawing logo in header:", err);
      }
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
    doc.line(14, 26, pageWidth - 14, 26);

    doc.setPage(originalPage);
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

    const titleUpper = title.toUpperCase();
    const esPuertasRF = titleUpper.includes('PUERTA') || 
                        titleUpper.includes('CORTAFUEGO') || 
                        titleUpper.includes('RF');
    const esCasetas = titleUpper.includes('CASETA') || 
                      titleUpper.includes('DOTACION') ||
                      titleUpper.includes('DOTACIÓN');
    const esHidrante = titleUpper.includes('HIDRANTE') && !esCasetas;

    const checkItemsDeSistema = (checklistItemsPorSistema && sistemaId && checklistItemsPorSistema[sistemaId]) ? checklistItemsPorSistema[sistemaId] : [];

    const normalize = (str: string) => {
      return (str || '')
        .toLowerCase()
        .replace(/[áäàâ]/g, 'a')
        .replace(/[éëèê]/g, 'e')
        .replace(/[íïìî]/g, 'i')
        .replace(/[óöòô]/g, 'o')
        .replace(/[úüùû]/g, 'u')
        .replace(/ñ/g, 'n')
        .trim();
    };

    const findItem = (keywords: string[]) => checkItemsDeSistema.find(item => {
      const lbl = normalize(item.label || '');
      return keywords.some(k => {
        const normK = normalize(k);
        // Usar regex con límite de palabra (\b) para evitar coincidencias parciales como "normalizado" con "marca"
        const regex = new RegExp('\\b' + normK.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
        return regex.test(lbl);
      });
    });

    const itemPlaca = findItem(['placa', 'industria']);
    const itemClase = findItem(['clase']);
    const itemTipo = findItem(['tipo']);
    const itemLongitud = findItem(['longitud']);
    const itemFabricante = findItem(['fabricante', 'marca']);
    const itemFechaFab = findItem(['fabricacion', 'ano', 'fecha fab']);
    const itemRetimbre = findItem(['retimbre']);
    const itemPruebaH = findItem(['prueba hidra', 'prueba hidraulica', 'hidraulica']);
    const itemSalidaBocas = findItem(['salida bocas', 'salida', 'bocas']);
    const itemDiametro = findItem(['diametro', 'diam', 'ø']);

    // Casetas
    const findItemByCond = (cond: (lbl: string) => boolean) => checkItemsDeSistema.find(item => cond(normalize(item.label || '')));

    const itemTipoCaseta = findItemByCond(lbl => lbl.includes('tipo de caseta') || lbl.includes('tipo caseta') || lbl.includes('tipo de armario') || lbl.includes('tipo armario'));
    const item70Fab = findItemByCond(lbl => lbl.includes('tramo 70') || (lbl.includes('70 mm') && lbl.includes('fabricaci')));
    const item70PH = findItemByCond(lbl => (lbl.includes('70 mm') || lbl.includes('tramo 70')) && (lbl.includes('p.h') || lbl.includes('prueba') || lbl.includes('ultima') || lbl.includes('ultimo')));
    
    const item45FabA = findItemByCond(lbl => lbl.includes('45 mm') && lbl.includes('fabricaci') && (lbl.includes('(a)') || lbl.includes('tramo a') || lbl.includes('tramo (a)')));
    const item45PHA = findItemByCond(lbl => lbl.includes('45 mm') && (lbl.includes('p.h') || lbl.includes('prueba') || lbl.includes('ultima') || lbl.includes('ultimo')) && (lbl.includes('(a)') || lbl.includes('tramo a') || lbl.includes('tramo (a)')));

    const item45FabB = findItemByCond(lbl => lbl.includes('45 mm') && lbl.includes('fabricaci') && (lbl.includes('(b)') || lbl.includes('tramo b') || lbl.includes('tramo (b)')));
    const item45PHB = findItemByCond(lbl => lbl.includes('45 mm') && (lbl.includes('p.h') || lbl.includes('prueba') || lbl.includes('ultima') || lbl.includes('ultimo')) && (lbl.includes('(b)') || lbl.includes('tramo b') || lbl.includes('tramo (b)')));

    const item45Fab = item45FabA || findItemByCond(lbl => lbl.includes('tramo 45') || (lbl.includes('45 mm') && lbl.includes('fabricaci')));
    const item45PH = item45PHA || findItemByCond(lbl => (lbl.includes('45 mm') || lbl.includes('tramo 45')) && (lbl.includes('p.h') || lbl.includes('prueba') || lbl.includes('ultima') || lbl.includes('ultimo')));

    const headersBase = isBie ?
      ['Nº', 'Nivel planta y ubicación', 'Placa', 'Tipo', 'Longitud', 'Fabricante', 'Fecha\nFabricación', 'Prueba\nHidráulica'] :
      (esPuertasRF ?
        ['Nº', 'Nivel planta y ubicación', 'Clase', 'Tipo de puerta'] :
        (esHidrante ?
          ['Nº', 'Ubicación', 'Tipo', 'Salida Bocas', 'Diámetro', 'Fabricante', 'Fecha\nFabricación'] :
          (esCasetas ?
            [
              'Nº',
              'Ubicación',
              'Tipo',
              item70Fab?.label ? item70Fab.label.replace('Tramo', '\nTramo') : 'Fecha fabricación\nTramo 70 mm.',
              item70PH?.label ? item70PH.label.replace('Tramo', '\nTramo') : 'Última P.H.\nTramo 70 mm.',
              item45FabA?.label ? item45FabA.label.replace('Tramo', '\nTramo') : 'Fecha fabricación\nTramo (A) 45 mm.',
              item45PHA?.label ? item45PHA.label.replace('Tramo', '\nTramo') : 'Última P.H\nTramo (A) 45 mm.',
              item45FabB?.label ? item45FabB.label.replace('Tramo', '\nTramo') : 'Fecha fabricación\nTramo (B) 45 mm.',
              item45PHB?.label ? item45PHB.label.replace('Tramo', '\nTramo') : 'Última P.H\nTramo (B) 45 mm.'
            ] :
            ['Nº', 'Nivel planta y ubicación', 'Placa', 'Tipo', 'Fabricante', 'Fecha\nFabricación', 'Último\nRetimbre']
          )
        )
      );

    const fixedItemsKeys = [
        itemPlaca?.key, itemClase?.key, itemTipo?.key, itemLongitud?.key,
        itemFabricante?.key, itemFechaFab?.key, itemRetimbre?.key, itemPruebaH?.key,
        itemSalidaBocas?.key, itemDiametro?.key,
        itemTipoCaseta?.key, item70Fab?.key, item70PH?.key,
        item45FabA?.key, item45PHA?.key, item45FabB?.key, item45PHB?.key,
        item45Fab?.key, item45PH?.key
    ].filter(Boolean);

    const checkItems = (checkItemsDeSistema || []).filter(item => {
      const lbl = normalize(item.label || '');
      const isNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
      const isFixed = fixedItemsKeys.includes(item.key);
      const isExcluded = lbl.includes('orden de lista') || 
                         lbl.includes('ubicacion') || 
                         lbl.includes('sin uso') || 
                         lbl.includes('imagen') ||
                         lbl.includes('fecha de revision') || // Exclude from PDF
                         lbl.includes('fecha revision') ||    // Exclude from PDF
                         item.tipoRespuesta === 'imagen' ||
                         item.tipoRespuesta === 'seccion' ||
                         item.tipoRespuesta === 'titulo'; // Excluir campos de imagen y secciones explícitamente

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
      let baseRow: any[] = [];
      if (isBie) {
        baseRow = [
          padCodigo(eq.codigo),
          eq.ubicacion || '-',
          getVal(eq, itemPlaca, 'placa'),
          getVal(eq, itemTipo, 'nombre'),
          getVal(eq, itemLongitud, 'longitud'),
          getVal(eq, itemFabricante, 'fabricante'),
          formatMesAno(getVal(eq, itemFechaFab, 'fechaFabricacion')),
          formatMesAno(getVal(eq, itemPruebaH, 'pruebaHidraulica'))
        ];
      } else if (esPuertasRF) {
        baseRow = [
          padCodigo(eq.codigo),
          eq.ubicacion || '-',
          getVal(eq, itemClase, 'clase'),
          getVal(eq, itemTipo, 'tipo')
        ];
      } else if (esHidrante) {
        baseRow = [
          padCodigo(eq.codigo),
          eq.ubicacion || '-',
          getVal(eq, itemTipo, 'tipo'),
          getVal(eq, itemSalidaBocas, 'salidaBocas'),
          getVal(eq, itemDiametro, 'diametro'),
          getVal(eq, itemFabricante, 'fabricante'),
          formatMesAno(getVal(eq, itemFechaFab, 'fechaFabricacion'))
        ];
      } else if (esCasetas) {
        baseRow = [
          padCodigo(eq.codigo),
          eq.ubicacion || '-',
          getVal(eq, itemTipoCaseta, 'tipo'),
          formatMesAno(getVal(eq, item70Fab, 'fechaFabricacion70')),
          formatMesAno(getVal(eq, item70PH, 'fechaPH70')),
          formatMesAno(getVal(eq, item45FabA, 'fechaFabricacion45A') !== '-' ? getVal(eq, item45FabA, 'fechaFabricacion45A') : getVal(eq, item45Fab, 'fechaFabricacion45')),
          formatMesAno(getVal(eq, item45PHA, 'fechaPH45A') !== '-' ? getVal(eq, item45PHA, 'fechaPH45A') : getVal(eq, item45PH, 'fechaPH45')),
          formatMesAno(getVal(eq, item45FabB, 'fechaFabricacion45B')),
          formatMesAno(getVal(eq, item45PHB, 'fechaPH45B'))
        ];
      } else {
        baseRow = [
          padCodigo(eq.codigo),
          eq.ubicacion || '-',
          getVal(eq, itemPlaca, 'placa'),
          getVal(eq, itemTipo, 'nombre'),
          getVal(eq, itemFabricante, 'fabricante'),
          formatMesAno(getVal(eq, itemFechaFab, 'fechaFabricacion')),
          formatMesAno(getVal(eq, itemRetimbre, 'ultimoRetimbre'))
        ];
      }

      return [
        ...baseRow,
        ...checkKeys.map(k => getMark(eq[k]))
      ];
    });

    const nombreSistema = title.toUpperCase();
    const esExtintor = nombreSistema.includes('EXTINTOR');
    const esBie = nombreSistema.includes('BIE') || nombreSistema.includes('BOCA');
    const usarLayoutVertical = (!esExtintor && !esBie && !esPuertasRF && !esHidrante && !esCasetas) || checkKeys.length > 22;

    let finalY = currentY;

    if (usarLayoutVertical) {
      // 1. Cabecera de la sección con título e icono
      if (currentY > 140) {
        doc.addPage();
        const newPageNum = (doc.internal as any).getNumberOfPages();
        if (!drawnTablePages.has(newPageNum)) {
          drawTableHeader(newPageNum);
          drawnTablePages.add(newPageNum);
        }
        currentY = 34;
      }

      if (iconoBase64) {
        try {
          const imgProps = doc.getImageProperties(iconoBase64);
          const maxWidth = 12;
          const maxHeight = 12;
          const imgRatio = imgProps.width / imgProps.height;
          let imgWidth = maxWidth;
          let imgHeight = imgWidth / imgRatio;
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * imgRatio;
          }
          const xOffset = 14 + (maxWidth - imgWidth) / 2;
          const yOffset = (currentY + 2) + (maxHeight - imgHeight) / 2;
          doc.addImage(iconoBase64, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
        } catch (err) {
          console.error("Error rendering section icon:", err);
        }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(title, iconoBase64 ? 30 : 14, currentY + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      const textoAnomalias = 'Las anotaciones en ';
      const textoRojo = 'rojo';
      const textoO = ' o con una ';
      const textoX = 'X';
      const textoFinal = ' indican anomalías que deben corregirse.';
      const subX = iconoBase64 ? 30 : 14;
      const subY = currentY + 12;
      doc.text(textoAnomalias, subX, subY);
      const w1 = doc.getTextWidth(textoAnomalias);
      doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
      doc.text(textoRojo, subX + w1, subY);
      const w2 = doc.getTextWidth(textoRojo);
      doc.setTextColor(0, 0, 0);
      doc.text(textoO, subX + w1 + w2, subY);
      const w3 = doc.getTextWidth(textoO);
      doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
      doc.text(textoX, subX + w1 + w2 + w3, subY);
      const w4 = doc.getTextWidth(textoX);
      doc.setTextColor(0, 0, 0);
      doc.text(textoFinal, subX + w1 + w2 + w3 + w4, subY);

      currentY += 16;

      // Paso 1: Agrupar checkItemsDeSistema en secciones
      interface SectionData {
        title: string;
        items: any[];
        key: string;
      }

      const sectionsList: SectionData[] = [];
      let currentSection: SectionData | null = null;

      for (const item of checkItemsDeSistema) {
        if (item.tipoRespuesta === 'seccion' || item.tipoRespuesta === 'titulo') {
          currentSection = {
            title: item.label || 'Sección',
            items: [],
            key: item.key
          };
          sectionsList.push(currentSection);
        } else {
          if (!currentSection) {
            currentSection = {
              title: 'General',
              items: [],
              key: 'default_sec'
            };
            sectionsList.push(currentSection);
          }
          currentSection.items.push(item);
        }
      }

      // Definir valor de visualización genérico
      const getDisplayValue = (val: any) => {
        if (val === true || val === 'true') return 'SÍ';
        if (val === false || val === 'false') return 'NO';
        if (val === undefined || val === null || val === '') return '-';
        return String(val);
      };

      // 2. Tablas por cada equipo
      for (const eq of equipos) {
        if (currentY > 150) {
          doc.addPage();
          const newPageNum = (doc.internal as any).getNumberOfPages();
          if (!drawnTablePages.has(newPageNum)) {
            drawTableHeader(newPageNum);
            drawnTablePages.add(newPageNum);
          }
          currentY = 34;
        }

        // Renderizar las secciones de este equipo
        for (const sec of sectionsList) {
          // Filtrar items fijos y excluidos de esta sección
          const filteredSecItems = sec.items.filter(item => {
            const lbl = normalize(item.label || '');
            const isNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
            const isFixed = fixedItemsKeys.includes(item.key);
            const isExcluded = lbl.includes('orden de lista') || 
                               lbl.includes('ubicacion') || 
                               lbl.includes('sin uso') || 
                               lbl.includes('imagen') ||
                               lbl.includes('fecha de revision') ||
                               lbl.includes('fecha revision') ||
                               item.tipoRespuesta === 'imagen';
            const isDeteccion = title.toUpperCase().includes('DETECCIÓN') || title.toUpperCase().includes('DETECCION');
            return !isNotas && !(isFixed && !isDeteccion) && !isExcluded;
          });

          if (filteredSecItems.length === 0) continue;

          // Verificar si hay espacio suficiente para la sección, si no, salto de página
          if (currentY > 175) {
            doc.addPage();
            const newPageNum = (doc.internal as any).getNumberOfPages();
            if (!drawnTablePages.has(newPageNum)) {
              drawTableHeader(newPageNum);
              drawnTablePages.add(newPageNum);
            }
            currentY = 34;
          }

          const secTitleNorm = sec.title.toUpperCase();

          if (secTitleNorm.includes('DATOS INSTALACIÓN') || secTitleNorm.includes('DATOS INSTALACION')) {
            // Renderizar Sección 1: Datos de instalación en 6 columnas (3 pares de datos)
            const datosRows: any[] = [];
            for (let i = 0; i < filteredSecItems.length; i += 3) {
              const item1 = filteredSecItems[i];
              const val1 = getDisplayValue(eq[item1.key]);
              
              let label2 = '';
              let val2 = '';
              if (i + 1 < filteredSecItems.length) {
                const item2 = filteredSecItems[i + 1];
                label2 = item2.label || '';
                val2 = getDisplayValue(eq[item2.key]);
              }
              
              let label3 = '';
              let val3 = '';
              if (i + 2 < filteredSecItems.length) {
                const item3 = filteredSecItems[i + 2];
                label3 = item3.label || '';
                val3 = getDisplayValue(eq[item3.key]);
              }
              
              datosRows.push([
                item1.label || '',
                val1,
                label2,
                val2,
                label3,
                val3
              ]);
            }

            autoTable(doc, {
              startY: currentY,
              margin: { top: 40, left: 14, right: 14 },
              headStyles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontSize: 7.5, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [255, 255, 255] },
              bodyStyles: { fontSize: 7, halign: 'left', valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] },
              columnStyles: {
                0: { halign: 'left', cellWidth: 'auto' },
                1: { halign: 'center', cellWidth: 18 },
                2: { halign: 'left', cellWidth: 'auto' },
                3: { halign: 'center', cellWidth: 18 },
                4: { halign: 'left', cellWidth: 'auto' },
                5: { halign: 'center', cellWidth: 21 }
              },
                head: [
                  [{ content: sec.title, colSpan: 6, styles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, halign: 'left' } }]
                ],
              body: datosRows,
              didDrawPage: function (_data: any) {
                const absolutePageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                if (!drawnTablePages.has(absolutePageNum)) {
                  drawTableHeader(absolutePageNum);
                  drawnTablePages.add(absolutePageNum);
                }
              },
              didParseCell: function (data: any) {
                if (data.section === 'body') {
                  const idx = data.row.index * 3;
                  const item1 = filteredSecItems[idx];
                  const item2 = filteredSecItems[idx + 1];
                  const item3 = filteredSecItems[idx + 2];

                  const esExtintor = title.toUpperCase().includes('EXTINTOR') || (typeof eq.nombre === 'string' ? eq.nombre : '').toUpperCase().includes('EXTINTOR') || (typeof eq.clase === 'string' ? eq.clase : '').toUpperCase().includes('EXTINTOR');
                  const esBie = title.toUpperCase().includes('BIE') || title.toUpperCase().includes('BOCA') || (typeof eq.nombre === 'string' ? eq.nombre : '').toUpperCase().includes('BIE') || (typeof eq.clase === 'string' ? eq.clase : '').toUpperCase().includes('BIE');

                  if (data.column.index === 1 && item1 && item1.tipoRespuesta === 'fecha') {
                    if (determinarSiFechaEsInvalida(eq, item1.key, item1.label || '', esBie, esExtintor, itemFechaFab?.key, itemRetimbre?.key || itemPruebaH?.key)) {
                      data.cell.styles.textColor = [200, 0, 0];
                      data.cell.styles.fontStyle = 'bold';
                    }
                  }
                  if (data.column.index === 3 && item2 && item2.tipoRespuesta === 'fecha') {
                    if (determinarSiFechaEsInvalida(eq, item2.key, item2.label || '', esBie, esExtintor, itemFechaFab?.key, itemRetimbre?.key || itemPruebaH?.key)) {
                      data.cell.styles.textColor = [200, 0, 0];
                      data.cell.styles.fontStyle = 'bold';
                    }
                  }
                  if (data.column.index === 5 && item3 && item3.tipoRespuesta === 'fecha') {
                    if (determinarSiFechaEsInvalida(eq, item3.key, item3.label || '', esBie, esExtintor, itemFechaFab?.key, itemRetimbre?.key || itemPruebaH?.key)) {
                      data.cell.styles.textColor = [200, 0, 0];
                      data.cell.styles.fontStyle = 'bold';
                    }
                  }

                  if (data.column.index === 0 || data.column.index === 2 || data.column.index === 4) {
                    data.cell.styles.fontStyle = 'bold';
                    if (title.toUpperCase().includes('DETECCIÓN') || title.toUpperCase().includes('DETECCION')) {
                      data.cell.styles.fillColor = [70, 80, 95];
                      data.cell.styles.textColor = [255, 255, 255];
                      data.cell.styles.lineColor = [255, 255, 255];
                    } else {
                      data.cell.styles.fillColor = [245, 247, 250];
                    }
                  }
                  if (data.column.index === 1 || data.column.index === 3 || data.column.index === 5) {
                    const rawStr = String(data.cell.raw || '').toUpperCase().trim();
                    if (rawStr.includes('NO CORRECTO') || rawStr.includes('NO CONFORME')) {
                      data.cell.styles.textColor = [200, 0, 0];
                      data.cell.styles.fontStyle = 'bold';
                    } else if (rawStr.includes('CORRECTO') || rawStr.includes('CONFORME')) {
                      data.cell.styles.textColor = [0, 128, 0];
                      data.cell.styles.fontStyle = 'bold';
                    }
                  }
                }
              }
            });
            currentY = (doc as any).lastAutoTable.finalY || currentY;

          } else {
            const normalItems = filteredSecItems.filter(item => item.tipoRespuesta !== 'tabla');
            const tableItem = filteredSecItems.find(item => item.tipoRespuesta === 'tabla');

            if (normalItems.length > 0) {
              // Cuestionarios normales (Secciones 2 a 9, 11, etc.): Tabla de 2 columnas por filas
              const checkRows: any[] = [];
              for (const item of normalItems) {
                let rawVal = eq[item.key];
                const itemOpciones = (item as any).opciones || [];
                if (rawVal === undefined || rawVal === '') {
                  if (itemOpciones.includes('CORRECTO')) {
                    rawVal = 'CORRECTO';
                  } else if (itemOpciones.includes('CONFORME')) {
                    rawVal = 'CONFORME';
                  }
                }
                const val = getMark(rawVal);
                checkRows.push([
                  item.label || '',
                  val
                ]);
              }

              autoTable(doc, {
                startY: currentY,
                margin: { top: 40, left: 14, right: 14 },
                headStyles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontSize: 7.5, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [255, 255, 255] },
                bodyStyles: { fontSize: 7.5, halign: 'left', valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] },
                columnStyles: (sec.title && (sec.title.toUpperCase().includes('CONCLUSIONES') || sec.title.toUpperCase().includes('CONCLUSIO') || sec.title.includes('11'))) ? {
                  0: { halign: 'left' },
                  1: { halign: 'center', cellWidth: 'wrap' }
                } : {
                  0: { halign: 'left', cellWidth: 229 },
                  1: { halign: 'center', cellWidth: 40 }
                },
                head: [[
                  { content: sec.title, styles: { halign: 'left', fontStyle: 'bold', fontSize: 8.5 } },
                  { content: 'ESTADO', styles: { halign: 'center', fontStyle: 'bold', fontSize: 8.5 } }
                ]],
                body: checkRows,
                didDrawPage: function (_data: any) {
                  const absolutePageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                  if (!drawnTablePages.has(absolutePageNum)) {
                    drawTableHeader(absolutePageNum);
                    drawnTablePages.add(absolutePageNum);
                  }
                },
                didParseCell: function (data: any) {
                  if (data.section === 'body' && data.column.index === 1) {
                    const item = normalItems[data.row.index];
                    if (item && item.tipoRespuesta === 'fecha') {
                      const esExtintor = title.toUpperCase().includes('EXTINTOR') || (typeof eq.nombre === 'string' ? eq.nombre : '').toUpperCase().includes('EXTINTOR') || (typeof eq.clase === 'string' ? eq.clase : '').toUpperCase().includes('EXTINTOR');
                      const esBie = title.toUpperCase().includes('BIE') || title.toUpperCase().includes('BOCA') || (typeof eq.nombre === 'string' ? eq.nombre : '').toUpperCase().includes('BIE') || (typeof eq.clase === 'string' ? eq.clase : '').toUpperCase().includes('BIE');
                      if (determinarSiFechaEsInvalida(eq, item.key, item.label || '', esBie, esExtintor, itemFechaFab?.key, itemRetimbre?.key || itemPruebaH?.key)) {
                        data.cell.styles.textColor = [200, 0, 0];
                        data.cell.styles.fontStyle = 'bold';
                        return;
                      }
                    }
                    if (data.cell.raw === 'X') {
                      data.cell.styles.textColor = anomalyTextColor;
                      data.cell.styles.fontStyle = 'bold';
                      data.cell.styles.fontSize = 8.5;
                    } else if (data.cell.raw === 'TICK') {
                      data.cell.text = [''];
                    } else if (data.cell.raw !== '-') {
                      const rawStr = String(data.cell.raw || '').toUpperCase().trim();
                      if (rawStr.includes('NO CORRECTO') || rawStr.includes('NO CONFORME')) {
                        data.cell.styles.textColor = [200, 0, 0];
                        data.cell.styles.fontStyle = 'bold';
                      } else if (rawStr.includes('CORRECTO') || rawStr.includes('CONFORME')) {
                        data.cell.styles.textColor = [0, 128, 0];
                        data.cell.styles.fontStyle = 'bold';
                      } else {
                        data.cell.styles.textColor = [0, 0, 0];
                        data.cell.styles.fontStyle = 'normal';
                      }
                    }
                  }
                },
                didDrawCell: function (data: any) {
                  if (data.section === 'body' && data.column.index === 1 && data.cell.raw === 'TICK') {
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
              currentY = (doc as any).lastAutoTable.finalY || currentY;
            }

            if (tableItem) {
              if (normalItems.length > 0) {
                currentY += 6; // Espacio entre el cuestionario y la tabla
              }
              const tableVal = eq[tableItem.key];
              let tableHeaders: string[] = tableItem.opciones || [];
              let tableRows: string[][] = [];
              try {
                if (tableVal && typeof tableVal === 'string') {
                  const parsed = JSON.parse(tableVal);
                  if (Array.isArray(parsed)) {
                    tableRows = parsed;
                  }
                }
              } catch (err) {
                console.error("Error parsing table input value:", err);
              }

              if (tableHeaders.length === 0) {
                tableHeaders = ['Detalle'];
              }
              if (tableRows.length === 0) {
                tableRows = [Array(tableHeaders.length).fill('-')];
              }

              const formatHeader = (h: string) => {
                const norm = String(h || '').trim();
                
                if (norm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('ubicacion')) {
                  return norm;
                }
                
                return norm.replace(/\s+/g, '\n');
              };

              const colStyles: any = {};
              tableHeaders.forEach((h, index) => {
                const norm = String(h || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (norm.includes('ubicacion')) {
                  colStyles[index] = { cellWidth: 'auto', halign: 'left' };
                } else {
                  colStyles[index] = { cellWidth: 'wrap' };
                }
              });

              autoTable(doc, {
                startY: currentY,
                margin: { top: 40, left: 14, right: 14 },
                headStyles: { 
                  fillColor: [70, 80, 95], 
                  textColor: [255, 255, 255], 
                  fontSize: 7, 
                  halign: 'center', 
                  valign: 'middle', 
                  lineWidth: 0.1, 
                  lineColor: [255, 255, 255],
                  cellPadding: 2
                },
                bodyStyles: { 
                  fontSize: 7, 
                  halign: 'center', 
                  valign: 'middle', 
                  lineWidth: 0.1, 
                  lineColor: [200, 200, 200],
                  cellPadding: 2
                },
                columnStyles: colStyles,
                head: [
                  [{ content: normalItems.length > 0 ? tableItem.label : sec.title, colSpan: tableHeaders.length, styles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, halign: 'left' } }],
                  tableHeaders.map(formatHeader)
                ],
                body: tableRows,
                didDrawPage: function (_data: any) {
                  const absolutePageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                  if (!drawnTablePages.has(absolutePageNum)) {
                    drawTableHeader(absolutePageNum);
                    drawnTablePages.add(absolutePageNum);
                  }
                }
              });
              currentY = (doc as any).lastAutoTable.finalY || currentY;
            }
          }
        }
        currentY += 6;
      }
      finalY = currentY;

    } else {
      // Layout Horizontal Clásico
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
        margin: { top: 40, left: 14, right: 14 },
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
        didDrawPage: function (_data: any) {
          const absolutePageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
          if (!drawnTablePages.has(absolutePageNum)) {
            drawTableHeader(absolutePageNum);
            drawnTablePages.add(absolutePageNum);
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
          if (data.section === 'body') {
            if (data.column.index < headersBase.length) {
              const eq = equipos[data.row.index];
              if (eq) {
                let isDateAnomaly = false;
                if (isBie) {
                  if (data.column.index === 6 && itemFechaFab) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, itemFechaFab.key, itemFechaFab.label || 'Fabricación', true, false, itemFechaFab.key, itemPruebaH?.key);
                  } else if (data.column.index === 7 && itemPruebaH) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, itemPruebaH.key, itemPruebaH.label || 'Prueba Hidráulica', true, false, itemFechaFab?.key, itemPruebaH.key);
                  }
                } else if (esHidrante) {
                  if (data.column.index === 6 && itemFechaFab) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, itemFechaFab.key, itemFechaFab.label || 'Fabricación', false, false, itemFechaFab.key);
                  }
                } else if (esCasetas) {
                  if (data.column.index === 3 && item70Fab) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, item70Fab.key, item70Fab.label || 'Fabricación 70', true, false, item70Fab.key, item70PH?.key);
                  } else if (data.column.index === 4 && item70PH) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, item70PH.key, item70PH.label || 'Prueba 70', true, false, item70Fab?.key, item70PH.key);
                  } else if (data.column.index === 5) {
                    const activeItem = item45FabA || item45Fab;
                    const activePH = item45PHA || item45PH;
                    if (activeItem) {
                      isDateAnomaly = determinarSiFechaEsInvalida(eq, activeItem.key, activeItem.label || 'Fabricación 45 (A)', true, false, activeItem.key, activePH?.key);
                    }
                  } else if (data.column.index === 6) {
                    const activeItem = item45FabA || item45Fab;
                    const activePH = item45PHA || item45PH;
                    if (activePH) {
                      isDateAnomaly = determinarSiFechaEsInvalida(eq, activePH.key, activePH.label || 'Prueba 45 (A)', true, false, activeItem?.key, activePH.key);
                    }
                  } else if (data.column.index === 7 && item45FabB) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, item45FabB.key, item45FabB.label || 'Fabricación 45 (B)', true, false, item45FabB.key, item45PHB?.key);
                  } else if (data.column.index === 8 && item45PHB) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, item45PHB.key, item45PHB.label || 'Prueba 45 (B)', true, false, item45FabB?.key, item45PHB.key);
                  }
                } else if (!esPuertasRF) {
                  const esExtintor = title.toUpperCase().includes('EXTINTOR');
                  if (data.column.index === 5 && itemFechaFab) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, itemFechaFab.key, itemFechaFab.label || 'Fabricación', false, esExtintor, itemFechaFab.key, itemRetimbre?.key);
                  } else if (data.column.index === 6 && itemRetimbre) {
                    isDateAnomaly = determinarSiFechaEsInvalida(eq, itemRetimbre.key, itemRetimbre.label || 'Retimbre', false, esExtintor, itemFechaFab?.key, itemRetimbre.key);
                  }
                }
                if (isDateAnomaly) {
                  data.cell.styles.textColor = [200, 0, 0];
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            } else if (data.column.index >= headersBase.length) {
              const item = checkItems[data.column.index - headersBase.length];
              if (item && item.tipoRespuesta === 'fecha') {
                const val = data.cell.raw;
                if (val && val !== '-') {
                  const str = String(val).trim();
                  const isRevision = (item.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('revision');
                  if (isRevision) {
                    const parts = str.split('-');
                    if (parts.length === 3) {
                      data.cell.text = [`${parts[2]}/${parts[1]}/${parts[0]}`];
                    }
                  } else {
                    const parts = str.split('-');
                    if (parts.length === 3) {
                      data.cell.text = [`${parts[1]}-${parts[0]}`];
                    } else if (parts.length === 2) {
                      data.cell.text = [`${parts[1]}-${parts[0]}`];
                    }
                  }
                }
              }
              if (data.cell.raw === 'X') {
                data.cell.styles.textColor = anomalyTextColor;
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = 9;
              } else if (data.cell.raw === 'TICK') {
                data.cell.text = [''];
              } else if (data.cell.raw !== '-') {
                const rawStr = String(data.cell.raw || '').toUpperCase().trim();
                if (rawStr.includes('NO CORRECTO') || rawStr.includes('NO CONFORME')) {
                  data.cell.styles.textColor = [200, 0, 0];
                  data.cell.styles.fontStyle = 'bold';
                } else if (rawStr.includes('CORRECTO') || rawStr.includes('CONFORME')) {
                  data.cell.styles.textColor = [0, 128, 0];
                  data.cell.styles.fontStyle = 'bold';
                } else {
                  data.cell.styles.textColor = [0,0,0];
                  data.cell.styles.fontStyle = 'normal';
                }
              }
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
              try {
                const imgProps = doc.getImageProperties(iconoBase64);
                const maxWidth = 12;
                const maxHeight = 12;
                const imgRatio = imgProps.width / imgProps.height;
                let imgWidth = maxWidth;
                let imgHeight = imgWidth / imgRatio;
                if (imgHeight > maxHeight) {
                  imgHeight = maxHeight;
                  imgWidth = imgHeight * imgRatio;
                }
                const xOffset = (cellX + 2) + (maxWidth - imgWidth) / 2;
                const yOffset = (centerY - 6) + (maxHeight - imgHeight) / 2;
                doc.addImage(iconoBase64, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
              } catch (err) {
                console.error("Error rendering header system icon:", err);
              }
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

      finalY = (doc as any).lastAutoTable.finalY || currentY;
    }

    finalY += 8;
    const anomalias = equipos.filter(eq => equipoTieneAnomalias(eq));

    // 1. Si es Casetas, pintar primero el listado de material obligatorio requerido
    if (esCasetas) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      
      if (finalY > 275) {
        doc.addPage();
        const newPageNum = (doc.internal as any).getNumberOfPages();
        if (!drawnTablePages.has(newPageNum)) {
          drawTableHeader(newPageNum);
          drawnTablePages.add(newPageNum);
        }
        finalY = 34;
      }
      doc.text("Las casetas de intemperie deben estar dotadas del siguiente material en su interior y de forma ordenada:", 14, finalY);
      finalY += 4.5;

      doc.setFont("helvetica", "normal");
      const textoCaseta = [
        "• 1 und. Tramo de manguera de 70 mm (15 metros de longitud).",
        "• 2 und. Tramo de manguera de 45 mm (15 metros de longitud).",
        "• 1 und. Lanza de 70 mm. con Sistema de cierre, apertura y doble efecto.",
        "• 2 und. Lanza de 45 mm. con Sistema de cierre, apertura y doble efecto.",
        "• 1 und. De Bifurcación de 70 mm. con 2 salidas de 45 mm. con válvulas en ambas salidas.",
        "• 1 und. De reducción de 70 mm. x 45 mm.",
        "• 1 und. Llave de apertura del hidrante."
      ];

      for (const linea of textoCaseta) {
        if (finalY > 275) {
          doc.addPage();
          const newPageNum = (doc.internal as any).getNumberOfPages();
          if (!drawnTablePages.has(newPageNum)) {
            drawTableHeader(newPageNum);
            drawnTablePages.add(newPageNum);
          }
          finalY = 34;
          doc.setFont("helvetica", "normal");
        }
        doc.text(linea, 14, finalY);
        finalY += 4.5;
      }
      finalY += 3;
    }

    // 2. Pintar el título "Anomalías y observaciones:" (debajo de la lista en casetas)
    if (finalY > 275) {
      doc.addPage();
      const newPageNum = (doc.internal as any).getNumberOfPages();
      if (!drawnTablePages.has(newPageNum)) {
        drawTableHeader(newPageNum);
        drawnTablePages.add(newPageNum);
      }
      finalY = 34;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Anomalías y observaciones:', 14, finalY);
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
          doc.text('Anomalías y observaciones (continuación):', 14, finalY);
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
        
        // Identificar qué comprobaciones específicas fallaron
        const checksFallados = checkItems
          .filter(item => eq[item.key] === false || eq[item.key] === 'false')
          .map(item => item.label || '');
        
        let textAnomalia = '';
        if (eq.anomalias && eq.anomalias.trim() !== '') {
          textAnomalia = eq.anomalias;
        } else {
          const fallosStr = checksFallados.length > 0 ? `Falló en: ${checksFallados.join(', ')}.` : '';
          const dateWarning = tieneFechaInvalida(eq) ? 'Fecha de fabricación/retimbrado caducada o próxima a caducar.' : '';
          if (notasValue) {
            textAnomalia = fallosStr 
              ? `${fallosStr} Observaciones: ${notasValue}` 
              : (dateWarning ? `${dateWarning} Observaciones: ${notasValue}` : notasValue);
          } else {
            textAnomalia = fallosStr || dateWarning || '';
          }
        }

        if (textAnomalia.trim() === '') {
          continue; // Si no hay anomalía real descrita, no pintar nada para este equipo
        }

        doc.text(`Nº ${eq.codigo} ${eq.placa ? `(${eq.placa})` : ''} — Anomalías: ${textAnomalia}`, 14, finalY);
        finalY += 5.5;

        // Si hay fotos, añadirlas todas (hasta 4 en la misma línea)
        const currentFotos = (Array.isArray(eq.fotos) ? eq.fotos : (eq.foto && typeof eq.foto === 'string' && eq.foto.trim() !== '' ? [eq.foto] : [])).filter(Boolean);

        if (currentFotos.length > 0) {
          const fitImage = (imageData: string, xStart: number) => {
            try {
              const imgProps = doc.getImageProperties(imageData);
              const maxWidth = 40;
              const maxHeight = 30;
              const imgRatio = imgProps.width / imgProps.height;
              let imgWidth = maxWidth;
              let imgHeight = imgWidth / imgRatio;
              
              if (imgHeight > maxHeight) {
                imgHeight = maxHeight;
                imgWidth = imgHeight * imgRatio;
              }
              
              const xOffset = xStart + (maxWidth - imgWidth) / 2;
              doc.addImage(imageData, 'JPEG', xOffset, finalY, imgWidth, imgHeight);
              return imgHeight;
            } catch (err) {
              console.error("Error rendering image:", err);
              return 0;
            }
          };

          for (let idx = 0; idx < currentFotos.length; idx += 4) {
            // Verificar si necesitamos espacio para la fila de imágenes
            if (finalY > 150) {
              doc.addPage();
              const newPageNum = (doc.internal as any).getNumberOfPages();
              if (!drawnTablePages.has(newPageNum)) {
                drawTableHeader(newPageNum);
                drawnTablePages.add(newPageNum);
              }
              finalY = 34;
            }

            let rowHeight = 0;
            const imagesInRow = currentFotos.slice(idx, idx + 4);

            for (let i = 0; i < imagesInRow.length; i++) {
              const foto = imagesInRow[i];
              try {
                const imageData = await fetchImageToBase64(foto);
                if (imageData && imageData.startsWith('data:')) {
                  const xPos = 14 + i * (40 + 2);
                  const h = fitImage(imageData, xPos);
                  if (h > rowHeight) rowHeight = h;
                }
              } catch (err) {
                console.error(`Error adding image ${i} in row to PDF:`, err);
              }
            }

            finalY += (rowHeight > 0 ? rowHeight : 30) + 4;
          }
        }
      }
      doc.setTextColor(0, 0, 0);
      finalY += 3;
    }

    return finalY + 5;
  };

  let tableStartY = 34;
  let hasRenderedAnySystem = false;

  // Ordenar: EXTINTOR primero (10), luego HIDRANTE (20) y CASETA (21) juntos, luego BIE (30), luego el resto (100)
  const sistemasOrdenados = [...sistemas].sort((a, b) => {
    const getWeight = (s: any) => {
      const familyOrType = (s.familia || s.tipo || '').toUpperCase();
      if (familyOrType.includes('EXTINTOR')) return 10;
      if (familyOrType.includes('CASETA') || familyOrType.includes('DOTACION') || familyOrType.includes('DOTACIÓN')) return 21;
      if (familyOrType.includes('HIDRANTE')) return 20;
      if (familyOrType.includes('BIE') || familyOrType.includes('BOCA')) return 30;
      return 100;
    };
    const wA = getWeight(a);
    const wB = getWeight(b);
    if (wA !== wB) return wA - wB;
    
    const nameA = (a.tipo || a.nombre || '').toUpperCase();
    const nameB = (b.tipo || b.nombre || '').toUpperCase();
    return nameA.localeCompare(nameB);
  });

  // Renderizar cada sistema en una página separada
  for (let index = 0; index < sistemasOrdenados.length; index++) {
    const sist = sistemasOrdenados[index];
    const equiposSistema = equiposTodos.filter(eq => eq.sistemaId === sist.id);
    if (equiposSistema.length === 0) continue;

    const nombreSistema = sist.familia || sist.tipo || 'Sistema';
    const esBie = nombreSistema.toUpperCase().includes('BIE') || nombreSistema.toUpperCase().includes('BOCA');
    
    // Buscar si hay una imagen personalizada guardada en localStorage o en el sistema
    let customIconUrl: string | null = sist.imagenUrl || sist.imagen || null;
    if (!customIconUrl && categoriasSistema && categoriasSistema.length > 0) {
      try {
        const normalizarParaIcono = (nombre: string) => {
          return (nombre || '')
            .toLowerCase()
            .trim()
            .replace(/[áàäâ]/g, 'a')
            .replace(/[éèëê]/g, 'e')
            .replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o')
            .replace(/[úùüû]/g, 'u')
            .replace(/ñ/g, 'n');
        };

        const coincidenSistemas = (nombreA: string, nombreB: string) => {
          const a = normalizarParaIcono(nombreA);
          const b = normalizarParaIcono(nombreB);
          if (a === b) return true;
          // Reglas específicas por tipo de sistema (orden importante: más específicas primero)
          if (a.includes('rociador') && b.includes('rociador')) return true;
          if (a.includes('deteccion') && b.includes('deteccion')) return true;
          if (a.includes('extintor') && b.includes('extintor')) return true;
          if ((a.includes('bie') || a.includes('boca de incendio') || a.includes('boca de equipamiento')) && 
              (b.includes('bie') || b.includes('boca de incendio') || b.includes('boca de equipamiento'))) return true;
          // Coincidencia por substring solo si el nombre de categoría tiene suficiente longitud (>=5 chars)
          // para evitar falsos positivos con nombres cortos como "BIE", "RED", etc.
          if (b.length >= 5 && a.includes(b)) return true;
          if (a.length >= 5 && b.includes(a)) return true;
          const stopWords = ['incendio', 'incendios', 'sistema', 'sistemas', 'proteccion', 'equipo', 'equipos', 'automatica', 'automatico', 'manual', 'manuales', 'red', 'puesto', 'control'];
          const palabrasA = a.split(/\s+/).filter(w => w.length > 4 && !stopWords.includes(w));
          const palabrasB = b.split(/\s+/).filter(w => w.length > 4 && !stopWords.includes(w));
          return palabrasA.length > 0 && palabrasB.length > 0 && palabrasA.some(wa => palabrasB.some(wb => wa === wb));
        };

        const cat = categoriasSistema.find((c: any) => coincidenSistemas(c.nombre, nombreSistema));
        if (cat && cat.imagenUrl) {
          customIconUrl = cat.imagenUrl;
        }
      } catch (err) {
        console.error("Error matching custom system image:", err);
      }
    }

    let icono = esBie ? biesBase64 : extintorBase64;
    if (customIconUrl) {
      try {
        const base64Icon = await fetchImageToBase64(customIconUrl);
        if (base64Icon && base64Icon.startsWith('data:')) {
          icono = base64Icon;
        }
      } catch (err) {
        console.error("Error loading custom system icon to base64:", err);
      }
    }

    if (!hasRenderedAnySystem) {
      // First system with equipment: use page 2
      drawTableHeader(2);
      drawnTablePages.add(2);
      tableStartY = 34;
      hasRenderedAnySystem = true;
    } else {
      // Subsequent systems: add a new page
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

  // Dibujar cabecera estándar en la página de firmas
  drawTableHeader(sigPageNum);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('FIRMAS', pageWidth / 2, 34, { align: 'center' });

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
  const obsTexto = (centro?.comentariosTecnico || observacionesTecnico || centro?.observaciones || 'Sin observaciones adicionales por parte del técnico actuante.');
  const lines = doc.splitTextToSize(obsTexto, pageWidth - 40);
  doc.text(lines, 20, sigY);
  sigY += (lines.length * 4) + 6;

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
  empresa?: Record<string, any>,
  observacionesTecnico?: string
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
    true,
    observacionesTecnico
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
  sistemas?: Record<string, any>[],
  numeroPedido?: string,
  fechaCreacion?: string
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
  let rightSideY = headerY + 42;
  if (titulo) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(`${titulo}`, pageWidth - 14, rightSideY, { align: 'right' });
    rightSideY += 5.5;
  }

  // Mostrar el número de pedido si existe
  if (numeroPedido) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(`N. Pedido: ${numeroPedido}`, pageWidth - 14, rightSideY, { align: 'right' });
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
  const dateStr = fechaCreacion ? new Date(fechaCreacion).toLocaleDateString() : new Date().toLocaleDateString();
  doc.text(dateStr, 14 + doc.getTextWidth('Fecha: '), headerY + 14);

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
  doc.text('Datos del cliente:', 14, headerY + 32);
  doc.setFont("helvetica", "normal");
  doc.text(`${cliente?.nombre || 'Cliente'}`, 14, headerY + 37.5);

  doc.setFont("helvetica", "bold");
  doc.text('Datos del centro:', 14, headerY + 44.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${centro?.nombre || 'Centro'}`, 14, headerY + 50);
  doc.text(`${centro?.direccion || ''}`, 14, headerY + 55.5);
  doc.text(`${[centro?.poblacion, centro?.provincia].filter(Boolean).join(', ')}`, 14, headerY + 61);

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
    startY: headerY + 65,
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
  periodicidad?: string,
  numeroPedido?: string,
  fechaCreacion?: string
): Promise<string> => {
  const doc = await generarAlbaranPDF(cliente, centro, equiposTodos, numeroMantenimiento, tecnicoNombre, firmaCliente, firmaTecnico, nombreFirmante, items, empresa, true, titulo, periodicidad, undefined, numeroPedido, fechaCreacion);
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

    interface SystemWithHeight {
      sistId: string;
      nombreSistema: string;
      conteoPorTipo: Record<string, number>;
      height: number;
    }

    const entries = Object.entries(equiposPorSistema);
    const systemsWithHeight: SystemWithHeight[] = entries.map(([sistId, eqs]) => {
      const sist = sistemas.find(s => s.id === sistId);
      const nombreSistema = sist?.nombre || sist?.tipo || 'Sistema sin nombre';
      
      const conteoPorTipo: Record<string, number> = {};
      eqs.forEach(eq => {
        let fallbackName = 'Equipo';
        const nsUpper = nombreSistema.toUpperCase();
        if (nsUpper.includes('EXTINTOR')) {
          fallbackName = 'Extintor';
        } else if (nsUpper.includes('BIE') || nsUpper.includes('BOCA')) {
          fallbackName = 'BIE';
        } else if (nsUpper.includes('DETEC') || nsUpper.includes('HUMO')) {
          fallbackName = 'Detector';
        } else if (nsUpper.includes('PUERTA')) {
          fallbackName = 'Puerta RF';
        }

        // Escanear todas las claves de eq para detectar agente o capacidad implícitos
        let detectedAgente = '';
        let detectedCapacidad = '';
        for (const k of Object.keys(eq)) {
          if (k.toLowerCase() === 'id' || k.toLowerCase() === 'centroid' || k.toLowerCase() === 'sistemaid') continue;
          const val = eq[k];
          if (typeof val === 'string') {
            const valUpper = val.toUpperCase().trim();
            if (!detectedAgente) {
              if (valUpper.includes('POLVO ABC') || valUpper === 'POLVO') {
                detectedAgente = 'Polvo ABC';
              } else if (valUpper.includes('CO2')) {
                detectedAgente = 'CO2';
              } else if (valUpper.includes('AGUA')) {
                detectedAgente = 'Agua';
              } else if (valUpper.includes('ESPUMA')) {
                detectedAgente = 'Espuma';
              }
            }
            if (!detectedCapacidad) {
              const match = valUpper.match(/(\d+\s*KG)/) || valUpper.match(/(\d+\s*L)/);
              if (match) {
                detectedCapacidad = match[1].toLowerCase().replace(/\s+/g, ' ');
              }
            }
          }
        }

        const valName = (val: any) => typeof val === 'string' && val.trim() !== '' && val.toLowerCase() !== 'true' && val.toLowerCase() !== 'false' ? val.trim() : null;
        const tipoEquipo = valName(eq.nombre) || valName(eq.clase) || valName(eq.agente) || valName(eq.tipo) || valName(eq.marca) || detectedAgente || fallbackName;

        let capacidad = '';
        if (eq.capacidad && typeof eq.capacidad === 'string' && eq.capacidad.toLowerCase() !== 'true' && eq.capacidad.toLowerCase() !== 'false') {
          capacidad = eq.capacidad;
        } else if (eq.peso && typeof eq.peso === 'string' && eq.peso.toLowerCase() !== 'true' && eq.peso.toLowerCase() !== 'false') {
          capacidad = eq.peso;
        } else {
          capacidad = detectedCapacidad;
        }

        // Normalizar tipo y capacidad para agrupar exactamente igual
        let cleanTipo = tipoEquipo.trim();
        let cleanCap = capacidad.trim();

        // Evitar duplicar la capacidad en el tipo
        if (cleanCap && cleanTipo.toLowerCase().includes(cleanCap.toLowerCase())) {
          cleanCap = '';
        }

        let clave = cleanCap ? `${cleanTipo} ${cleanCap}.` : `${cleanTipo}.`;
        
        // Unificar formato de "kg" y "l" (casing y puntos) para evitar separaciones
        clave = clave.replace(/\s+kg\.?/gi, ' Kg.');
        clave = clave.replace(/\s+l\.?/gi, ' L.');
        
        // Limpiar puntos duplicados
        clave = clave.replace(/\.\.+$/, '.');

        conteoPorTipo[clave] = (conteoPorTipo[clave] || 0) + 1;
      });

      const linesCount = Object.keys(conteoPorTipo).length;
      const height = 5 + linesCount * 4.5 + 2;

      return {
        sistId,
        nombreSistema,
        conteoPorTipo,
        height
      };
    });

    // Agrupar en bloques de hasta 8 sistemas (4 por columna)
    const blocks: { col0: SystemWithHeight[]; col1: SystemWithHeight[]; height: number }[] = [];
    let cardSistemasH = 12; // Margen superior y título
    for (let b = 0; b < systemsWithHeight.length; b += 8) {
      const col0 = systemsWithHeight.slice(b, b + 4);
      const col1 = systemsWithHeight.slice(b + 4, b + 8);
      const h0 = col0.reduce((sum, s) => sum + s.height, 0);
      const h1 = col1.reduce((sum, s) => sum + s.height, 0);
      const maxHeight = Math.max(h0, h1);
      blocks.push({ col0, col1, height: maxHeight });
      cardSistemasH += maxHeight;
    }

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 251, 252);
    doc.roundedRect(margen, y, pageWidth - margen * 2, cardSistemasH, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('SISTEMAS Y EQUIPOS REVISADOS', pageWidth / 2, y + 6, { align: 'center' });

    let currentBlockY = y + 11;
    blocks.forEach(block => {
      // Dibujar Columna 0 (Izquierda)
      let col0_Y = currentBlockY;
      block.col0.forEach(s => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(50, 70, 120);
        doc.text(s.nombreSistema, margen + 8, col0_Y);
        col0_Y += 5;

        Object.entries(s.conteoPorTipo).forEach(([clave, cantidad]) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(80, 80, 80);
          doc.text(`• ${clave} — ${cantidad} unidad${cantidad > 1 ? 'es' : ''}`, margen + 14, col0_Y, { maxWidth: (pageWidth / 2) - margen - 12 });
          col0_Y += 4.5;
        });
        col0_Y += 2;
      });

      // Dibujar Columna 1 (Derecha)
      let col1_Y = currentBlockY;
      block.col1.forEach(s => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(50, 70, 120);
        doc.text(s.nombreSistema, pageWidth / 2 + 4, col1_Y);
        col1_Y += 5;

        Object.entries(s.conteoPorTipo).forEach(([clave, cantidad]) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(80, 80, 80);
          doc.text(`• ${clave} — ${cantidad} unidad${cantidad > 1 ? 'es' : ''}`, pageWidth / 2 + 10, col1_Y, { maxWidth: (pageWidth / 2) - margen - 12 });
          col1_Y += 4.5;
        });
        col1_Y += 2;
      });

      currentBlockY += block.height;
    });

    y += cardSistemasH + 8;
  }

  // ── RESULTADO DE LA REVISIÓN ──
  // Confiamos en el estadoCertificado calculado en RevisionChecklist (ya tiene la lógica correcta)
  const rawEstado = (estadoCertificado || 'Favorable').toLowerCase();
  const esNegativo = rawEstado.includes('no favorable') || rawEstado.includes('negativo') || rawEstado.includes('no favorabl');
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