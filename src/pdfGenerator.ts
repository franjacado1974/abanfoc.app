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
export function cargaDatosEmpresa(empresaId?: any): Record<string, any> | null {
  try {
    const savedEmpresas = typeof localStorage !== 'undefined' ? localStorage.getItem('firecheck_db_empresas') : null;
    let parsed: any[] = [];
    if (savedEmpresas) {
      const raw = JSON.parse(savedEmpresas);
      if (Array.isArray(raw)) parsed = raw;
    }

    if (empresaId !== undefined && empresaId !== null && empresaId !== '') {
      if (typeof empresaId === 'object') {
        const targetDocId = empresaId._docId || empresaId.id;
        const targetNombre = empresaId.nombre && typeof empresaId.nombre === 'string' ? empresaId.nombre.trim().toLowerCase() : '';
        const found = parsed.find((e: any) => 
          (targetDocId && (e._docId === targetDocId || e.id === targetDocId)) ||
          (targetNombre && e.nombre && typeof e.nombre === 'string' && e.nombre.trim().toLowerCase() === targetNombre)
        );
        if (found) return found as Record<string, any>;
        return empresaId as Record<string, any>;
      } else if (typeof empresaId === 'string') {
        const targetStr = empresaId.trim().toLowerCase();
        const found = parsed.find((e: any) => 
          e._docId === empresaId || 
          e.id === empresaId || 
          (e.nombre && typeof e.nombre === 'string' && e.nombre.trim().toLowerCase() === targetStr)
        );
        if (found) return found as Record<string, any>;
        return null;
      }
    }

    if (parsed.length > 0) {
      return parsed[0] as Record<string, any>;
    }
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('firecheck_db_empresa') : null;
    if (saved) return JSON.parse(saved) as Record<string, any>;
  } catch (e) { console.error("Error loading company data from localStorage:", e); }
  return null;
}

export function normalizarDatosEmpresa(empresaInput?: any, empresaIdFallback?: string): Record<string, any> {
  let emp = typeof empresaInput === 'string' ? cargaDatosEmpresa(empresaInput) : empresaInput;
  if (!emp && typeof empresaIdFallback === 'string' && empresaIdFallback) {
    emp = cargaDatosEmpresa(empresaIdFallback);
  }

  const targetLookup = (emp && typeof emp === 'object' ? (emp._docId || emp.id || emp.nombre) : null) || empresaIdFallback;
  const fullEmp = targetLookup ? cargaDatosEmpresa(targetLookup) : null;

  const getField = (keys: string[], defaultVal = ''): string => {
    const checkObj = (obj: any): string => {
      if (!obj || typeof obj !== 'object') return '';
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '' && String(obj[k]).trim() !== '-') {
          return String(obj[k]).trim();
        }
      }
      for (const key of Object.keys(obj)) {
        const lower = key.toLowerCase();
        for (const target of keys) {
          if (lower === target.toLowerCase()) {
            const val = obj[key];
            if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-') {
              return String(val).trim();
            }
          }
        }
      }
      return '';
    };

    const fromEmp = checkObj(emp);
    if (fromEmp) return fromEmp;
    const fromFull = checkObj(fullEmp);
    if (fromFull) return fromFull;
    return defaultVal;
  };

  const nombre = getField(['nombre', 'razonSocial', 'empresa'], 'ABANFOC S.L.');
  const isDefaultAbanfoc = !nombre || nombre.toUpperCase().includes('ABANFOC');

  const cif = getField(['cif', 'CIF', 'Cif', 'nif', 'NIF', 'Nif', 'cif_nif', 'cifNif'], isDefaultAbanfoc ? 'B16794679' : '');
  const rasic = getField(['rasic', 'RASIC', 'Rasic', 'num_rasic', 'numRasic', 'rasicNum', 'registro', 'registroIndustrial', 'registro_industrial', 'n_rasic', 'nRasic', 'numero_rasic', 'numeroRasic'], '');
  const direccion = getField(['direccion', 'DIRECCION', 'Direccion', 'dir', 'domicilio', 'calle', 'direccion_empresa'], isDefaultAbanfoc ? 'C/ America 16 B' : '');
  const poblacion = getField(['poblacion', 'POBLACION', 'Poblacion', 'localidad', 'LOCALIDAD', 'Localidad', 'ciudad', 'municipio'], isDefaultAbanfoc ? 'Sta. Coloma Gramanet' : '');
  const provincia = getField(['provincia', 'PROVINCIA', 'Provincia'], isDefaultAbanfoc ? 'Barcelona' : '');
  const cp = getField(['cp', 'CP', 'codigoPostal', 'codigo_postal', 'cod_postal', 'c_p', 'codPostal'], isDefaultAbanfoc ? '08921' : '');
  const telefono = getField(['telefono', 'TELEFONO', 'Telefono', 'tel', 'TEL', 'tlf', 'TLF', 'phone', 'tel1', 'telefono1', 'telf', 'movil', 'movil1', 'contacto_telefono', 'telefonoContacto', 'numeroTelefono'], isDefaultAbanfoc ? '930108917' : '');
  const email = getField(['correo', 'CORREO', 'Correo', 'email', 'EMAIL', 'Email', 'mail', 'correo_electronico', 'correoElectronico', 'emailContacto'], isDefaultAbanfoc ? 'abanfoc@abanfoc.es' : '');
  const web = getField(['web', 'WEB', 'Web', 'pagina_web', 'url', 'sitio_web', 'webEmpresa'], isDefaultAbanfoc ? 'https://abanfoc.es' : '');
  
  const fallbackLogo = isDefaultAbanfoc ? 'https://firebasestorage.googleapis.com/v0/b/app-abanfoc-v1.firebasestorage.app/o/empresa%2Flogo_1780000624676?alt=media&token=b92c0cd7-a0bf-4a96-ab0c-2aa124e52683' : (typeof localStorage !== 'undefined' ? (localStorage.getItem('firecheck_db_logo') || '') : '');
  const logoUrl = getField(['logoUrl', 'logo', 'logo_url', 'logoBase64', 'imagenLogo', 'logo_empresa'], fallbackLogo);
  const selloUrl = getField(['selloUrl', 'sello', 'selloBase64', 'sello_url', 'imagenSello', 'sello_empresa']);

  let fallbackFirma = '';
  try {
    const singleEmpRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('firecheck_db_empresa') : null;
    if (singleEmpRaw) {
      const parsedSingle = JSON.parse(singleEmpRaw);
      fallbackFirma = parsedSingle?.firmaIngenieroBase64 || parsedSingle?.ingenieroFirmaUrl || parsedSingle?.firmaUrl || '';
    }
  } catch (_e) {}

  const ingenieroFirmaUrl = getField(['ingenieroFirmaUrl', 'firmaIngenieroBase64', 'firmaUrl', 'firma_ingeniero_url', 'firmaIngeniero', 'firmaTecnicoTitulado'], fallbackFirma);

  const ingenieroNombre = getField(['ingenieroNombre', 'tecnicoNombre', 'nombreIngeniero', 'ingeniero_nombre', 'tecnico_nombre', 'tecnicoTituladoNombre']);
  const ingenieroApellidos = getField(['ingenieroApellidos', 'tecnicoApellidos', 'apellidosIngeniero', 'ingeniero_apellidos', 'tecnico_apellidos', 'tecnicoTituladoApellidos']);
  const ingenieroNif = getField(['ingenieroNif', 'nifTecnico', 'tecnicoNif', 'ingeniero_nif', 'nif_tecnico', 'dni_tecnico', 'dniIngeniero', 'nifTecnicoTitulado']);
  const ingenieroColegiado = getField(['ingenieroColegiado', 'numTecnicoTitulado', 'numColegiado', 'colegiado', 'num_colegiado', 'n_colegiado', 'numeroColegiado', 'colegiadoNum']);
  
  const rawTecnicoTitulado = getField(['tecnicoTitulado', 'responsableTecnico']);
  const tecnicoTitulado = (ingenieroNombre && ingenieroApellidos)
    ? `${ingenieroNombre} ${ingenieroApellidos}`
    : (rawTecnicoTitulado || ingenieroNombre || 'Técnico Titulado de la Empresa');

  return {
    ...(fullEmp && typeof fullEmp === 'object' ? fullEmp : {}),
    ...(emp && typeof emp === 'object' ? emp : {}),
    _docId: (emp && typeof emp === 'object' ? emp._docId || emp.id : null) || (fullEmp && typeof fullEmp === 'object' ? fullEmp._docId || fullEmp.id : null),
    id: (emp && typeof emp === 'object' ? emp.id || emp._docId : null) || (fullEmp && typeof fullEmp === 'object' ? fullEmp.id || fullEmp._docId : null),
    nombre,
    cif,
    rasic,
    direccion,
    poblacion,
    localidad: poblacion,
    provincia,
    cp,
    codigoPostal: cp,
    telefono,
    correo: email,
    email,
    web,
    logoUrl: logoUrl || null,
    selloUrl: selloUrl || null,
    selloBase64: selloUrl || null,
    ingenieroFirmaUrl: ingenieroFirmaUrl || null,
    firmaIngenieroBase64: ingenieroFirmaUrl || null,
    ingenieroNombre,
    ingenieroApellidos,
    ingenieroNif,
    ingenieroColegiado,
    tecnicoTitulado,
    nifTecnico: ingenieroNif,
    numTecnicoTitulado: ingenieroColegiado,
    isDefaultAbanfoc
  };
}

export const guardarDatosEmpresa = (data: any) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('firecheck_db_empresa', JSON.stringify(data));
  }
};

export const obtenerDatosEmpresa = (id?: string) => cargaDatosEmpresa(id);

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

export function equipoTieneObservaciones(eq: any, checkItemsDeSistema: any[] = []): boolean {
  if (!eq) return false;
  if (eq.observaciones && typeof eq.observaciones === 'string' && eq.observaciones.trim() !== '') {
    return true;
  }
  for (const k of Object.keys(eq)) {
    if (k === 'observaciones' || k === 'anomalias') continue;
    const val = eq[k];
    if (typeof val === 'string' && val.trim() !== '') {
      const item = checkItemsDeSistema.find(it => it.key === k);
      const lbl = (item?.label || k).toLowerCase();
      if (lbl.includes('observaci') && !lbl.includes('anomal')) {
        return true;
      }
    }
  }
  return false;
}

export function equipoTieneAnomalias(eq: any, checkItemsDeSistema: any[] = []): boolean {
  if (!eq) return false;

  // REGLA 1: El campo directo "anomalias" ("Anomalías") tiene texto → rojo → NO FAVORABLE
  if (eq.anomalias && typeof eq.anomalias === 'string' && eq.anomalias.trim() !== '') {
    return true;
  }

  // Revisar todos los campos dinámicos del equipo
  for (const k of Object.keys(eq)) {
    const kLower = k.toLowerCase();
    if (kLower === 'observaciones') continue;

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
    const item = checkItemsDeSistema.find(it => it.key === k);
    const lbl = (item?.label || kLower).toLowerCase();

    // Si es explícitamente el campo de solo Observaciones, NO es una anomalía
    if (lbl.includes('observaci') && !lbl.includes('anomal')) {
      continue;
    }

    // REGLA 2a: Campo dinámico cuya clave contiene "anomal" o "nota" tiene texto → rojo → NO FAVORABLE
    if (lbl.includes('anomal') || lbl.includes('nota')) {
      if (typeof val === 'string' && val.trim() !== '') {
        return true;
      }
      continue;
    }

    // REGLA 2b: Pregunta de checklist con respuesta boolean false → equivale a "NO CORRECTO" en UI → NO FAVORABLE
    if (val === false || (typeof val === 'string' && val.trim().toLowerCase() === 'false')) {
      return true;
    }

    // REGLA 2c: Pregunta de checklist con respuesta explícita "NO CORRECTO", "INCORRECTO", "NO CONFORME", "DEFECTUOSO", "MAL" o "NO" → NO FAVORABLE
    if (typeof val === 'string') {
      const valUpper = val.toUpperCase().trim();
      if (
        valUpper === 'NO CORRECTO' ||
        valUpper.includes('NO CORRECTO') ||
        valUpper === 'INCORRECTO' ||
        valUpper.includes('INCORRECTO') ||
        valUpper === 'NO CONFORME' ||
        valUpper.includes('NO CONFORME') ||
        valUpper === 'DEFECTUOSO' ||
        valUpper === 'MAL' ||
        valUpper === 'NO'
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
  let rawResult: string | null = null;

  if (urlOrBase64.startsWith('data:')) {
    rawResult = urlOrBase64;
  } else if (urlOrBase64.startsWith('http') || urlOrBase64.startsWith('/') || urlOrBase64.startsWith('.')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(urlOrBase64, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const blob = await response.blob();
        rawResult = await new Promise<string | null>((resolve) => {
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
    if (!rawResult) {
      try {
        rawResult = await new Promise<string | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          const timeoutId = setTimeout(() => {
            img.src = '';
            resolve(null);
          }, 4000);
          img.onload = () => {
            clearTimeout(timeoutId);
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            const maxWidth = 800;
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              try {
                resolve(canvas.toDataURL('image/jpeg', 0.75));
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
  } else {
    rawResult = urlOrBase64;
  }

  if (rawResult && rawResult.startsWith('data:')) {
    const opt = await optimizarImagenParaPDF(rawResult, 800, 0.75);
    return opt.base64;
  }
  return rawResult;
};

export const removeWhiteBackground = (base64Img: string, maxWidth: number = 400): Promise<string> => {
  if (typeof window === 'undefined' || !base64Img || !base64Img.startsWith('data:')) {
    return Promise.resolve(base64Img);
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (!width || !height) return resolve(base64Img);

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(base64Img);

          ctx.drawImage(img, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r > 225 && g > 225 && b > 225) {
              data[i + 3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(base64Img);
        }
      };
      img.onerror = () => resolve(base64Img);
      img.src = base64Img;
    } catch {
      resolve(base64Img);
    }
  });
};

export const getImageFormat = (base64: string | null | undefined): string => {
  if (!base64) return 'PNG';
  if (base64.startsWith('data:image/png')) return 'PNG';
  if (base64.startsWith('data:image/jpeg') || base64.startsWith('data:image/jpg')) return 'JPEG';
  if (base64.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
};

export const optimizarImagenParaPDF = async (
  base64Data: string | null | undefined,
  maxWidth: number = 800,
  quality: number = 0.75,
  forceJpegForSignature: boolean = false
): Promise<{ base64: string; format: string }> => {
  if (!base64Data || typeof base64Data !== 'string' || (!base64Data.startsWith('data:image') && !base64Data.startsWith('data:application'))) {
    return { base64: base64Data || '', format: 'PNG' };
  }

  const formatDetectado = getImageFormat(base64Data);

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { base64: base64Data, format: formatDetectado };
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            resolve({ base64: base64Data, format: formatDetectado });
            return;
          }

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve({ base64: base64Data, format: formatDetectado });
            return;
          }

          let outputMime = forceJpegForSignature
            ? 'image/jpeg'
            : (formatDetectado === 'JPEG' ? 'image/jpeg' : 'image/png');
          let outputFormat = forceJpegForSignature ? 'JPEG' : formatDetectado;

          if (outputMime === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL(outputMime, quality);
          resolve({ base64: compressedDataUrl, format: outputFormat });
        } catch (e) {
          resolve({ base64: base64Data, format: formatDetectado });
        }
      };

      img.onerror = () => {
        resolve({ base64: base64Data, format: formatDetectado });
      };

      img.src = base64Data;
    } catch (e) {
      resolve({ base64: base64Data, format: formatDetectado });
    }
  });
};

export const dibujarFirmaAjustada = async (doc: jsPDF, base64Image: string | null | undefined, boxX: number, boxY: number, boxW: number, boxH: number) => {
  if (!base64Image || typeof base64Image !== 'string' || (!base64Image.startsWith('data:image') && !base64Image.startsWith('data:application'))) return;
  try {
    const { base64: firmaOpt, format } = await optimizarImagenParaPDF(base64Image, 600, 0.7, true);
    const props = doc.getImageProperties(firmaOpt);
    if (!props || !props.width || !props.height) return;
    const ratio = props.width / props.height;
    let imgW = boxW;
    let imgH = imgW / ratio;
    if (imgH > boxH) {
      imgH = boxH;
      imgW = imgH * ratio;
    }
    const offsetX = boxX + (boxW - imgW) / 2;
    const offsetY = boxY + (boxH - imgH) / 2;
    doc.addImage(firmaOpt, format, offsetX, offsetY, imgW, imgH);
  } catch (err) {
    console.error("Error dibujando firma ajustada:", err);
  }
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
  checklistItemsPorSistema?: Record<string, any[]>,
  empresa?: Record<string, any>,
  noSave?: boolean,
  observacionesTecnico?: string
) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const empData = normalizarDatosEmpresa(empresa, centro?.empresaId);

  const firmaIngenieroBase64Raw = await fetchImageToBase64(empData?.ingenieroFirmaUrl || empData?.firmaIngenieroBase64 || empData?.firmaUrl);
  const logoDataRaw = await fetchImageToBase64(empData?.logoUrl);
  const selloEmpresaBase64Raw = await fetchImageToBase64(empData?.selloUrl);

  const { base64: logoData } = await optimizarImagenParaPDF(logoDataRaw, 800, 0.75);
  const { base64: firmaIngenieroBase64 } = await optimizarImagenParaPDF(firmaIngenieroBase64Raw, 600, 0.7, true);
  const { base64: selloEmpresaBase64 } = await optimizarImagenParaPDF(selloEmpresaBase64Raw, 800, 0.75);

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
    const empCif = empData?.cif || '-';
    const empRasic = empData?.rasic || '-';
    const empDir = empData?.direccion || '-';
    const empLocParts = [empData?.poblacion, empData?.provincia, empData?.cp].filter(p => p && p !== '-');
    const empLoc = empLocParts.length > 0 ? empLocParts.join(', ') : '-';
    const empTel = empData?.telefono || '-';
    const empMail = empData?.correo || empData?.email || '-';

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
    if (val === true || (typeof val === 'string' && val.trim().toLowerCase() === 'true')) return 'TICK';
    if (val === false || (typeof val === 'string' && val.trim().toLowerCase() === 'false')) return 'X';
    if (typeof val === 'string' || typeof val === 'number') {
        const str = val.toString().trim();
        if (str.toLowerCase() === 'true') return 'TICK';
        if (str.toLowerCase() === 'false') return 'X';
        return str !== '' ? str : '-';
    }
    return '-';
  };

  const drawPumpCurveChart = (
    doc: any,
    x: number,
    y: number,
    width: number,
    height: number,
    points: { x: number; y: number }[],
    currNominalCaudal?: number,
    currNominalPresion?: number
  ) => {
    // Buscar nominales en Abastecimiento
    const eqAbast = equiposTodos.find(e => {
      const sist = sistemas.find(s => s.id === e.sistemaId);
      const name = (sist?.nombre || '').toUpperCase();
      return name.includes('ABAST') || name.includes('SALA DE BOMBAS');
    });

    let nominalCaudal = 0;
    let nominalPresion = 0;

    if (eqAbast) {
      // Buscar claves nominales dinámicamente si tenemos checklistItemsPorSistema
      let caudalNominalKey = '';
      let presionNominalKey = '';

      if (checklistItemsPorSistema) {
        const abastSistId = Object.keys(checklistItemsPorSistema).find(sId => {
          const sist = sistemas.find(s => s.id === sId);
          const sName = (sist?.nombre || '').toUpperCase();
          return sName.includes('ABAST') || sName.includes('SALA DE BOMBAS');
        });

        if (abastSistId) {
          const items = checklistItemsPorSistema[abastSistId];
          const caudalItem = items.find(i => {
            const lbl = (i.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return lbl.includes('caudal') && lbl.includes('nominal');
          });
          if (caudalItem) caudalNominalKey = caudalItem.key;

          const presionItem = items.find(i => {
            const lbl = (i.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return lbl.includes('presion') && lbl.includes('nominal');
          });
          if (presionItem) presionNominalKey = presionItem.key;
        }
      }

      if (caudalNominalKey && eqAbast[caudalNominalKey]) {
        nominalCaudal = parseFloat(String(eqAbast[caudalNominalKey]).replace(',', '.'));
      }
      if (presionNominalKey && eqAbast[presionNominalKey]) {
        nominalPresion = parseFloat(String(eqAbast[presionNominalKey]).replace(',', '.'));
      }

      // Fallback: buscar por texto de clave
      if (!nominalCaudal || isNaN(nominalCaudal)) {
        for (const k of Object.keys(eqAbast)) {
          if (k.toLowerCase().includes('caudal') && !k.toLowerCase().includes('jockey') && !k.toLowerCase().includes('electric')) {
            const val = parseFloat(String(eqAbast[k]).replace(',', '.'));
            if (!isNaN(val) && val > 0) {
              nominalCaudal = val;
              break;
            }
          }
        }
      }
      if (!nominalPresion || isNaN(nominalPresion)) {
        for (const k of Object.keys(eqAbast)) {
          if (k.toLowerCase().includes('presion') && !k.toLowerCase().includes('jockey') && !k.toLowerCase().includes('electric')) {
            const val = parseFloat(String(eqAbast[k]).replace(',', '.'));
            if (!isNaN(val) && val > 0) {
              nominalPresion = val;
              break;
            }
          }
        }
      }
    }

    const refNomCaudal = currNominalCaudal || nominalCaudal;
    const refNomPresion = currNominalPresion || nominalPresion;

    const sortedPoints = [...points].sort((a, b) => a.x - b.x);
    const maxCaudal = Math.max(...sortedPoints.map(p => p.x), 0);
    const referenceCaudal = maxCaudal > 0 ? maxCaudal : (refNomCaudal || 100);
    const maxX = referenceCaudal * 1.25;

    const maxPresion = Math.max(...sortedPoints.map(p => p.y), 0);
    const referencePresion = Math.max(maxPresion, refNomPresion || 10);
    const maxY = referencePresion * 1.5;

    const roundMaxX = Math.ceil(maxX / 10) * 10;
    const roundMaxY = Math.ceil(maxY / 2) * 2;

    const paddingLeft = 14;
    const paddingRight = 14;
    const paddingTop = 7;
    const paddingBottom = 10;

    const chartW = width - paddingLeft - paddingRight; // 269 - 28 = 241
    const chartH = (height - 6.5) - paddingTop - paddingBottom; // height - 23.5

    // 1. Dibujar fondo blanco y borde exterior de todo el bloque
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.rect(x, y, width, height, 'FD');

    // 2. Dibujar la cabecera (rectángulo relleno en color burdeos, altura 6.5mm)
    doc.setFillColor(128, 0, 32);
    doc.rect(x, y, width, 6.5, 'F');

    // Separación de cabecera
    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.3);
    doc.line(x, y + 6.5, x + width, y + 6.5);

    // Texto de la cabecera
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("12.1 GRÁFICO DE LA CURVA DE RENDIMIENTO EN CAUDAL Y PRESIÓN", x + 3, y + 4.3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);

    for (let i = 0; i <= 5; i++) {
      const valY = (roundMaxY / 5) * i;
      const py = y + 6.5 + paddingTop + chartH - (chartH * (valY / roundMaxY));
      if (i > 0 && i < 5) {
        doc.setDrawColor(240, 240, 240);
        doc.line(x + paddingLeft, py, x + paddingLeft + chartW, py);
      }
      doc.text(valY.toFixed(1), x + paddingLeft - 2, py + 1.5, { align: 'right' });
    }

    for (let i = 0; i <= 5; i++) {
      const valX = (roundMaxX / 5) * i;
      const px = x + paddingLeft + (chartW * (valX / roundMaxX));
      if (i > 0 && i < 5) {
        doc.setDrawColor(240, 240, 240);
        doc.line(px, y + 6.5 + paddingTop, px, y + 6.5 + paddingTop + chartH);
      }
      doc.text(valX.toFixed(0), px, y + 6.5 + paddingTop + chartH + 6.5, { align: 'center' });
    }

    // Dibujar punto nominal en verde si existe
    const scaleX = (val: number) => x + paddingLeft + (chartW * (val / roundMaxX));
    const scaleY = (val: number) => y + 6.5 + paddingTop + chartH - (chartH * (val / roundMaxY));

    if (refNomCaudal > 0) {
      const px = scaleX(refNomCaudal);
      doc.setDrawColor(16, 185, 129); // Verde
      doc.setLineWidth(0.4);
      if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([2, 2], 0);
      else if (typeof doc.setLineDash === 'function') doc.setLineDash([2, 2], 0);
      doc.line(px, y + 6.5 + paddingTop, px, y + 6.5 + paddingTop + chartH);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(16, 185, 129);
      doc.text(`Q Nom: ${refNomCaudal} m3/h`, px + 1.5, y + 6.5 + paddingTop + 8);
    }
    if (refNomPresion > 0) {
      const py = scaleY(refNomPresion);
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.4);
      if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([2, 2], 0);
      else if (typeof doc.setLineDash === 'function') doc.setLineDash([2, 2], 0);
      doc.line(x + paddingLeft, py, x + paddingLeft + chartW, py);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(16, 185, 129);
      doc.text(`P Nom: ${refNomPresion} bar`, x + paddingLeft + chartW - 2, py - 1.5, { align: 'right' });
    }
    if (refNomCaudal > 0 && refNomPresion > 0) {
      doc.setFillColor(16, 185, 129);
      doc.circle(scaleX(refNomCaudal), scaleY(refNomPresion), 0.8, 'FD'); // Más discreto
    }
    
    // Restaurar línea sólida
    if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([], 0);
    else if (typeof doc.setLineDash === 'function') doc.setLineDash([], 0);

    doc.setDrawColor(100, 110, 120);
    doc.setLineWidth(0.5);
    doc.line(x + paddingLeft, y + 6.5 + paddingTop, x + paddingLeft, y + 6.5 + paddingTop + chartH);
    doc.line(x + paddingLeft, y + 6.5 + paddingTop + chartH, x + paddingLeft + chartW, y + 6.5 + paddingTop + chartH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text('Presión (bar)', x + 2, y + 6.5 + paddingTop - 2.5);
    doc.text('Q (m³/h)', x + paddingLeft + chartW + 1.5, y + 6.5 + paddingTop + chartH + 1.5, { align: 'left' });

    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.5); // Línea del gráfico más fina

    // Dibujar curva suavizada usando interpolación cúbica de Hermite (segmentos pequeños de línea)
    const nPts = sortedPoints.length;
    const mPts: number[] = Array(nPts).fill(0);
    for (let i = 0; i < nPts; i++) {
      if (i === 0) {
        mPts[i] = (sortedPoints[1].y - sortedPoints[0].y) / (sortedPoints[1].x - sortedPoints[0].x);
      } else if (i === nPts - 1) {
        mPts[i] = (sortedPoints[nPts-1].y - sortedPoints[nPts-2].y) / (sortedPoints[nPts-1].x - sortedPoints[nPts-2].x);
      } else {
        const slopeLeft = (sortedPoints[i].y - sortedPoints[i-1].y) / (sortedPoints[i].x - sortedPoints[i-1].x);
        const slopeRight = (sortedPoints[i+1].y - sortedPoints[i].y) / (sortedPoints[i+1].x - sortedPoints[i].x);
        mPts[i] = (slopeLeft + slopeRight) / 2;
      }
    }

    for (let i = 0; i < nPts - 1; i++) {
      const p0 = sortedPoints[i];
      const p1 = sortedPoints[i + 1];
      const dx = p1.x - p0.x;
      
      let lastX = scaleX(p0.x);
      let lastY = scaleY(p0.y);
      const steps = 30; // 30 segmentos para máxima suavidad
      for (let j = 1; j <= steps; j++) {
        const t = j / steps;
        // Funciones base de Hermite
        const h00 = 2 * Math.pow(t, 3) - 3 * Math.pow(t, 2) + 1;
        const h10 = Math.pow(t, 3) - 2 * Math.pow(t, 2) + t;
        const h01 = -2 * Math.pow(t, 3) + 3 * Math.pow(t, 2);
        const h11 = Math.pow(t, 3) - Math.pow(t, 2);
        
        const interpolatedX = p0.x + t * dx;
        const interpolatedY = h00 * p0.y + h10 * dx * mPts[i] + h01 * p1.y + h11 * dx * mPts[i+1];
        
        const currX = scaleX(interpolatedX);
        const currY = scaleY(interpolatedY);
        doc.line(lastX, lastY, currX, currY);
        lastX = currX;
        lastY = currY;
      }
    }

    doc.setFillColor(128, 0, 32);
    sortedPoints.forEach(p => {
      doc.circle(scaleX(p.x), scaleY(p.y), 0.8, 'FD'); // Puntos más discretos (0.8 en lugar de 1.5)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5); // Texto más discreto (5.5 en lugar de 6.5)
      doc.setTextColor(128, 0, 32);
      doc.text(`${p.y.toFixed(1)}`, scaleX(p.x), scaleY(p.y) - 2.5, { align: 'center' }); // Offset ajustado a 2.5
    });
  };

  const drawnTablePages = new Set<number>();

  const renderSection = async (title: string, equipos: any[], isBie: boolean, currentY: number, iconoBase64?: string, sistemaId?: string) => {
    if (equipos.length === 0) return currentY;
    const nombreSistemaUpper = title.toUpperCase();
    const esExtintor = nombreSistemaUpper.includes('EXTINTOR');
    const esBie = nombreSistemaUpper.includes('BIE') || nombreSistemaUpper.includes('BOCA');
    const esPuertasRF = nombreSistemaUpper.includes('PUERTA') || nombreSistemaUpper.includes('CORTAFUEGO') || nombreSistemaUpper.includes('RF');
    const esCasetas = nombreSistemaUpper.includes('CASETA') || nombreSistemaUpper.includes('DOTACION') || nombreSistemaUpper.includes('DOTACIÓN');
    const esHidrante = nombreSistemaUpper.includes('HIDRANTE') && !esCasetas;
    const esSistemaVerticalPuro = !esExtintor && !esBie && !esPuertasRF && !esHidrante && !esCasetas;

    const repetirHeaderPorEquipo = nombreSistemaUpper.includes('DETECCI') || nombreSistemaUpper.includes('ROCIADOR') || nombreSistemaUpper.includes('PUESTO') || nombreSistemaUpper.includes('SPRINKLER') || nombreSistemaUpper.includes('BOMBA') || nombreSistemaUpper.includes('DIESEL') || nombreSistemaUpper.includes('GASOIL') || nombreSistemaUpper.includes('ELECTRICA') || nombreSistemaUpper.includes('JOCKEY') || nombreSistemaUpper.includes('ABASTECIMIENTO') || esSistemaVerticalPuro;

    const renderAnomaliasParaEquipos = async (eqsToRender: any[], startY: number, showSinAnomalias: boolean = true) => {
      let finalY = startY + 5;
      const equiposConAnotaciones = eqsToRender.filter(eq => equipoTieneAnomalias(eq, checkItemsDeSistema) || equipoTieneObservaciones(eq, checkItemsDeSistema));
      const anomalias = equiposConAnotaciones;

      if (anomalias.length === 0 && !showSinAnomalias) {
        return finalY;
      }

      // Pintar el título de anomalías (se muestran siempre en la siguiente página)
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

      const tituloSeccionAnomalias = `Anomalías y observaciones técnicas detectadas en el sistema: ${title}`;

      const wrappedTituloLines: string[] = doc.splitTextToSize(tituloSeccionAnomalias, pageWidth - 28);
      wrappedTituloLines.forEach(tLine => {
        doc.text(tLine, 14, finalY);
        finalY += 5.5;
      });
      doc.setFont("helvetica", "normal");
      finalY += 1.5;

      if (anomalias.length === 0) {
        doc.setTextColor(5, 150, 105);
        doc.text('Sin anomalías ni observaciones. Los equipos se encuentran en correcto estado de funcionamiento.', 14, finalY);
        doc.setTextColor(0, 0, 0);
        finalY += 6;
      } else {
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
          }

          // 1. Obtener texto de anomalías (en ROJO)
          const anomaliasItem = checkItemsDeSistema.find(item => {
            const lbl = (item.label || '').toLowerCase();
            return lbl.includes('anomal') || ((lbl.includes('notas') || lbl.includes('observaci')) && !checkItemsDeSistema.some(i => (i.label||'').toLowerCase().includes('anomal')));
          });
          const anomaliasValue = anomaliasItem && eq[anomaliasItem.key] ? String(eq[anomaliasItem.key]).trim() : '';
          
          // Identificar qué comprobaciones específicas fallaron
          const checksFallados = checkItems
            .filter(item => eq[item.key] === false || (typeof eq[item.key] === 'string' && String(eq[item.key]).trim().toLowerCase() === 'false'))
            .map(item => item.label || '');
          
          let rawText = '';
          if (eq.anomalias && eq.anomalias.trim() !== '') {
            rawText = eq.anomalias;
          } else {
            const fallosStr = checksFallados.length > 0 ? `Falló en: ${checksFallados.join(', ')}.` : '';
            const dateWarning = tieneFechaInvalida(eq) ? 'Fecha de fabricación/retimbrado caducada o próxima a caducar.' : '';
            if (anomaliasValue) {
              rawText = fallosStr 
                ? `${fallosStr} ${anomaliasValue}` 
                : (dateWarning ? `${dateWarning} ${anomaliasValue}` : anomaliasValue);
            } else {
              rawText = fallosStr || dateWarning || '';
            }
          }

          let anomaliasLines: string[] = [];
          const firstSplit = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          firstSplit.forEach(chunk => {
            const subSplit = chunk.split(/,\s*(?=\d+\.\d+)/).map(s => s.trim()).filter(Boolean);
            anomaliasLines.push(...subSplit);
          });
          
          // 2. Obtener texto de observaciones (en NEGRO / NO ROJO)
          const observacionesItem = checkItemsDeSistema.find(item => {
            const lbl = (item.label || '').toLowerCase();
            return lbl.includes('observaci') && !lbl.includes('anomal');
          });
          const obsDirecto = eq.observaciones && typeof eq.observaciones === 'string' ? eq.observaciones.trim() : '';
          const obsDinamico = observacionesItem && eq[observacionesItem.key] ? String(eq[observacionesItem.key]).trim() : '';
          const textObservacion = obsDirecto || obsDinamico || '';
          const obsLines = textObservacion.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);

          // Si hay anomalías u observaciones para este equipo, imprimir el encabezado EQUIPO Nº X una vez y debajo cada ítem con guión
          if (anomaliasLines.length > 0 || obsLines.length > 0) {
            const pageWidth = (doc.internal.pageSize as any).getWidth ? (doc.internal.pageSize as any).getWidth() : doc.internal.pageSize.width;
            const maxTextWidth = pageWidth - 28;

            // 1) Imprimir número de equipo en MAYÚSCULA como encabezado del bloque
            const numEquipoStr = `EQUIPO Nº ${String(eq.codigo || eq.numero || 'S/N').toUpperCase()}${eq.placa ? ` (${String(eq.placa).toUpperCase()})` : ''}`;
            const headerLines: string[] = doc.splitTextToSize(numEquipoStr, maxTextWidth);

            headerLines.forEach((hLine) => {
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
              }

              doc.setFont("helvetica", "bold");
              doc.setTextColor(0, 0, 0);
              doc.text(hLine, 14, finalY);
              doc.setFont("helvetica", "normal");
              finalY += 5.5;
            });

            // 2) Imprimir todas las anomalías debajo con guión y en ROJO
            if (anomaliasLines.length > 0) {
              doc.setTextColor(anomalyTextColor[0], anomalyTextColor[1], anomalyTextColor[2]);
              anomaliasLines.forEach((lineText, idx) => {
                const cleanLine = lineText.replace(/^anomal[íi]a(?:s)?:\s*/i, '').replace(/^[-\s–—•*]+/g, '').trim();
                const fullString = `- ${cleanLine}`;
                const wrappedLines: string[] = doc.splitTextToSize(fullString, maxTextWidth - 4);

                wrappedLines.forEach((wLine) => {
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

                  doc.text(wLine, 16, finalY);
                  finalY += 5.5;
                });

                if (idx < anomaliasLines.length - 1) {
                  finalY += 1.0;
                }
              });
            }

            // 3) Imprimir todas las observaciones debajo con guión y en AZUL
            if (obsLines.length > 0) {
              doc.setTextColor(0, 82, 204);
              obsLines.forEach((lineText: string, idx: number) => {
                const cleanLine = lineText.replace(/^observaci[óo]n(?:es)?:\s*/i, '').replace(/^[-\s–—•*]+/g, '').trim();
                const fullString = `- ${idx === 0 && anomaliasLines.length === 0 ? 'Observaciones: ' : (idx === 0 && anomaliasLines.length > 0 ? 'Observación: ' : '')}${cleanLine}`;
                const wrappedLines: string[] = doc.splitTextToSize(fullString, maxTextWidth - 4);

                wrappedLines.forEach((wLine) => {
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
                    doc.setTextColor(0, 82, 204);
                  }

                  doc.text(wLine, 16, finalY);
                  finalY += 5.5;
                });

                if (idx < obsLines.length - 1) {
                  finalY += 1.0;
                }
              });
              doc.setTextColor(0, 0, 0);
            }

            // Separación final después de todas las anotaciones de este equipo
            finalY += 3.0;
          }

          // Si hay fotos, añadirlas todas (hasta 4 en la misma línea)
          const currentFotos = (Array.isArray(eq.fotos) ? eq.fotos : (eq.foto && typeof eq.foto === 'string' && eq.foto.trim() !== '' ? [eq.foto] : [])).filter(Boolean);

          if (currentFotos.length > 0) {
            const fitImage = async (rawImg: string, xStart: number) => {
              try {
                const base64Raw = rawImg.startsWith('data:') ? rawImg : await fetchImageToBase64(rawImg);
                if (!base64Raw) return 0;
                const { base64: imageData, format } = await optimizarImagenParaPDF(base64Raw, 800, 0.75);
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
                
                const yPos = finalY;
                doc.addImage(imageData, format, xStart, yPos, imgWidth, imgHeight);
                return imgHeight;
              } catch (err) {
                console.error("Error drawing equipment photo in anomalies section:", err);
                return 0;
              }
            };

            if (finalY + 32 > 275) {
              doc.addPage();
              const newPageNum = (doc.internal as any).getNumberOfPages();
              if (!drawnTablePages.has(newPageNum)) {
                drawTableHeader(newPageNum);
                drawnTablePages.add(newPageNum);
              }
              finalY = 34;
            }

            let maxImgHeight = 0;
            const fotosProcesar = currentFotos.slice(0, 4);
            for (let fIdx = 0; fIdx < fotosProcesar.length; fIdx++) {
              const fotoUrl = fotosProcesar[fIdx];
              const xStart = 14 + fIdx * 45;
              const h = await fitImage(fotoUrl, xStart);
              if (h > maxImgHeight) maxImgHeight = h;
            }
            
            finalY += maxImgHeight + 5;
          }
        }
      }
      return finalY;
    };


    if (currentY > 130) {
      doc.addPage();
      const newPageNum = (doc.internal as any).getNumberOfPages();
      if (!drawnTablePages.has(newPageNum)) {
        drawTableHeader(newPageNum);
        drawnTablePages.add(newPageNum);
      }
      currentY = 34;
    }

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
      if (item.tipoRespuesta === 'check') return false;
      const lbl = normalize(item.label || '');
      return keywords.some(k => {
        const normK = normalize(k);
        // Usar regex con límite de palabra (\b) para evitar coincidencias parciales como "normalizado" con "marca"
        const regex = new RegExp('\\b' + normK.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
        return regex.test(lbl);
      });
    });

    const itemUbicacion = findItem(['ubicacion', 'ubicación', 'cobertura', 'nivel planta', 'planta']);
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
    const findItemByCond = (cond: (lbl: string) => boolean) => checkItemsDeSistema.find(item => {
      if (item.tipoRespuesta === 'check') return false;
      return cond(normalize(item.label || ''));
    });

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
              'Fabricación\nTramo\n70 mm.',
              'Última P.H.\nTramo\n70 mm.',
              'Fabricación\nTramo (A)\n45 mm.',
              'Última P.H.\nTramo (A)\n45 mm.',
              'Fabricación\nTramo (B)\n45 mm.',
              'Última P.H.\nTramo (B)\n45 mm.'
            ] :
            ['Nº', 'Nivel planta y ubicación', 'Placa', 'Tipo', 'Fabricante', 'Fecha\nFabricación', 'Último\nRetimbre']
          )
        )
      );

    const fixedItemsKeys = [
        itemUbicacion?.key,
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
                         item.tipoRespuesta === 'titulo' ||
                         item.tipoRespuesta === 'grafico'; // Excluir campos de imagen, secciones y graficos explícitamente

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
        const isValidTextVal = (v: any) => {
            if (v === undefined || v === null || v === '') return false;
            const s = String(v).trim().toLowerCase();
            return s !== 'true' && s !== 'false' && s !== 'sí' && s !== 'no' && s !== 'ok' && s !== 'correcto' && s !== 'incorrecto';
        };
        let val = '-';
        if (item && isValidTextVal(eq[item.key])) val = eq[item.key];
        else if (isValidTextVal(eq[fixedKey])) val = eq[fixedKey];
        else if (fixedKey === 'nombre' || fixedKey === 'tipo' || fixedKey === 'clase') {
            const validCandidates = [eq.nombre, eq.tipo, eq.clase, eq.modelo, eq.pesoCapacidad, eq.descripcion];
            for (const c of validCandidates) {
                if (isValidTextVal(c)) { val = c; break; }
            }
        }
        const isUbicacion = fixedKey === 'ubicacion' || fixedKey === 'cobertura' ||
            (item && ((item.key && item.key.toLowerCase().includes('ubicacion')) ||
                      (item.label && item.label.toLowerCase().includes('ubicacion')) ||
                      (item.label && item.label.toLowerCase().includes('planta')) ||
                      (item.label && item.label.toLowerCase().includes('nivel'))));
        if (isUbicacion && val && val !== '-') {
            val = String(val).toUpperCase().replace(/[\r\n]+/g, ' ').trim();
            if (val.length > 40) {
                val = val.substring(0, 40);
            }
        } else if (val && val !== '-') {
            val = String(val).replace(/[\r\n]+/g, ' ').trim();
        }
        return val;
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
          getVal(eq, itemUbicacion, 'ubicacion'),
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
          getVal(eq, itemUbicacion, 'ubicacion'),
          getVal(eq, itemClase, 'clase'),
          getVal(eq, itemTipo, 'tipo')
        ];
      } else if (esHidrante) {
        baseRow = [
          padCodigo(eq.codigo),
          getVal(eq, itemUbicacion, 'ubicacion'),
          getVal(eq, itemTipo, 'tipo'),
          getVal(eq, itemSalidaBocas, 'salidaBocas'),
          getVal(eq, itemDiametro, 'diametro'),
          getVal(eq, itemFabricante, 'fabricante'),
          formatMesAno(getVal(eq, itemFechaFab, 'fechaFabricacion'))
        ];
      } else if (esCasetas) {
        baseRow = [
          padCodigo(eq.codigo),
          getVal(eq, itemUbicacion, 'ubicacion'),
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
          getVal(eq, itemUbicacion, 'ubicacion'),
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

    const usarLayoutVertical = (!esExtintor && !esBie && !esPuertasRF && !esHidrante && !esCasetas) || checkKeys.length > 22;

    let finalY = currentY;

    if (usarLayoutVertical) {
      // 1. Cabecera de la sección con título e icono
      const dibujarHeaderDeSistema = () => {
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
      };

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
        if (val === true || (typeof val === 'string' && val.trim().toLowerCase() === 'true')) return 'SÍ';
        if (val === false || (typeof val === 'string' && val.trim().toLowerCase() === 'false')) return 'NO';
        if (val === undefined || val === null || val === '') return '-';
        const str = String(val).trim();
        if (str.toLowerCase() === 'true') return 'SÍ';
        if (str.toLowerCase() === 'false') return 'NO';
        return str;
      };

      // 2. Tablas por cada equipo
      for (let eqIdx = 0; eqIdx < equipos.length; eqIdx++) {
        const eq = equipos[eqIdx];

        if (eqIdx === 0) {
          dibujarHeaderDeSistema();
        } else if (repetirHeaderPorEquipo) {
          doc.addPage();
          const newPageNum = (doc.internal as any).getNumberOfPages();
          if (!drawnTablePages.has(newPageNum)) {
            drawTableHeader(newPageNum);
            drawnTablePages.add(newPageNum);
          }
          currentY = 34;
          dibujarHeaderDeSistema();
        } else if (currentY > 150) {
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
          const nombreSistemaUpper = title.toUpperCase();

          const filteredSecItems = sec.items.filter(item => {
            if (!item.label || item.label.trim() === '') return false;
            // Filtrar ítems que no contengan letras (solo números, puntos, guiones o espacios) ya que son filas vacías/fantasma
            const hasLetters = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(item.label);
            if (!hasLetters) return false;
            const lbl = normalize(item.label || '');
            const isNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
            
            const esExtintor = nombreSistemaUpper.includes('EXTINTOR');
            const esBie = nombreSistemaUpper.includes('BIE') || nombreSistemaUpper.includes('BOCA');
            const esPuertasRF = nombreSistemaUpper.includes('PUERTA') || nombreSistemaUpper.includes('CORTAFUEGO') || nombreSistemaUpper.includes('RF');
            const esCasetas = nombreSistemaUpper.includes('CASETA') || nombreSistemaUpper.includes('DOTACION') || nombreSistemaUpper.includes('DOTACIÓN');
            const esHidrante = nombreSistemaUpper.includes('HIDRANTE') && !esCasetas;
            const esSistemaVerticalPuro = !esExtintor && !esBie && !esPuertasRF && !esHidrante && !esCasetas;

            const isFixed = fixedItemsKeys.includes(item.key);
            
            // Si es un sistema vertical puro (como Bomba Jockey, Detección, Abastecimiento, etc.),
            // no debemos ocultar los campos de ubicación ni los campos fijos como marca/fabricante/fecha_fab,
            // ya que estos sistemas no tienen una tabla horizontal inicial donde se muestren dichos campos.
            const excludeUbicacion = !esSistemaVerticalPuro;
            
            const isExcluded = lbl.includes('orden de lista') || 
                               (excludeUbicacion && lbl.includes('ubicacion')) || 
                               lbl.includes('sin uso') || 
                               lbl.includes('imagen') ||
                               lbl.includes('fecha de revision') ||
                               lbl.includes('fecha revision') ||
                               item.tipoRespuesta === 'imagen';
                               
            const bypassFixed = esSistemaVerticalPuro || nombreSistemaUpper.includes('DETECCIÓN') || nombreSistemaUpper.includes('DETECCION');
            
            return !isNotas && !(isFixed && !bypassFixed) && !isExcluded;
          });

          if (filteredSecItems.length === 0) continue;

          const secTitleNorm = sec.title.toUpperCase();

          // Estimar la altura que requerirá esta sección y saltar de página solo si no cabe (límite 268mm)
          const estimatedSectionHeight = (filteredSecItems.length + 2) * 6.5 + 10;
          if (currentY > 34 && (currentY + estimatedSectionHeight > 268)) {
            doc.addPage();
            const newPageNum = (doc.internal as any).getNumberOfPages();
            if (!drawnTablePages.has(newPageNum)) {
              drawTableHeader(newPageNum);
              drawnTablePages.add(newPageNum);
            }
            currentY = 34;
          }

          if (secTitleNorm.includes('DATOS INSTALACIÓN') || secTitleNorm.includes('DATOS INSTALACION')) {
            // Renderizar Sección 1: Datos de instalación en 6 columnas (3 pares de datos)
            const datosRows: any[] = [];
            let i = 0;
            while (i < filteredSecItems.length) {
              const item1 = filteredSecItems[i];
              const lbl1Norm = (item1.label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const isFullWidthItem = lbl1Norm.includes('tipo de instalacion') || (item1.label || '').trim().startsWith('1.1');

              if (isFullWidthItem) {
                let val1 = getDisplayValue(eq[item1.key]);
                if ((val1 === '-' || !val1) && (item1.key === 'ubicacion' || lbl1Norm.includes('ubicacion') || lbl1Norm.includes('cobertura') || lbl1Norm.includes('planta'))) {
                  val1 = getDisplayValue(eq.ubicacion || eq.cobertura);
                }
                if ((item1.key === 'ubicacion' || lbl1Norm.includes('ubicacion') || lbl1Norm.includes('cobertura') || lbl1Norm.includes('planta')) && val1 && val1 !== '-') {
                  val1 = String(val1).toUpperCase();
                }
                datosRows.push([
                  { content: item1.label || '', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
                  { content: val1, colSpan: 4, styles: { halign: 'left', fontStyle: 'bold' } },
                  '', '', '', ''
                ]);
                i += 1;
                continue;
              }

              let val1 = getDisplayValue(eq[item1.key]);
              if ((val1 === '-' || !val1) && (item1.key === 'ubicacion' || lbl1Norm.includes('ubicacion') || lbl1Norm.includes('cobertura') || lbl1Norm.includes('planta'))) {
                val1 = getDisplayValue(eq.ubicacion || eq.cobertura);
              }
              if ((item1.key === 'ubicacion' || lbl1Norm.includes('ubicacion') || lbl1Norm.includes('cobertura') || lbl1Norm.includes('planta')) && val1 && val1 !== '-') {
                val1 = String(val1).toUpperCase();
              }
              
              let label2 = '';
              let val2 = '';
              let advance = 1;

              if (i + 1 < filteredSecItems.length) {
                const item2 = filteredSecItems[i + 1];
                const lbl2Norm = (item2.label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (!lbl2Norm.includes('tipo de instalacion') && !(item2.label || '').trim().startsWith('1.1')) {
                  label2 = item2.label || '';
                  val2 = getDisplayValue(eq[item2.key]);
                  if ((val2 === '-' || !val2) && (item2.key === 'ubicacion' || lbl2Norm.includes('ubicacion') || lbl2Norm.includes('cobertura') || lbl2Norm.includes('planta'))) {
                    val2 = getDisplayValue(eq.ubicacion || eq.cobertura);
                  }
                  if ((item2.key === 'ubicacion' || lbl2Norm.includes('ubicacion') || lbl2Norm.includes('cobertura') || lbl2Norm.includes('planta')) && val2 && val2 !== '-') {
                    val2 = String(val2).toUpperCase();
                  }
                  advance = 2;
                }
              }
              
              let label3 = '';
              let val3 = '';
              if (advance === 2 && i + 2 < filteredSecItems.length) {
                const item3 = filteredSecItems[i + 2];
                const lbl3Norm = (item3.label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (!lbl3Norm.includes('tipo de instalacion') && !(item3.label || '').trim().startsWith('1.1')) {
                  label3 = item3.label || '';
                  val3 = getDisplayValue(eq[item3.key]);
                  if ((val3 === '-' || !val3) && (item3.key === 'ubicacion' || lbl3Norm.includes('ubicacion') || lbl3Norm.includes('cobertura') || lbl3Norm.includes('planta'))) {
                    val3 = getDisplayValue(eq.ubicacion || eq.cobertura);
                  }
                  if ((item3.key === 'ubicacion' || lbl3Norm.includes('ubicacion') || lbl3Norm.includes('cobertura') || lbl3Norm.includes('planta')) && val3 && val3 !== '-') {
                    val3 = String(val3).toUpperCase();
                  }
                  advance = 3;
                }
              }
              
              datosRows.push([
                item1.label || '',
                val1,
                label2,
                val2,
                label3,
                val3
              ]);
              i += advance;
            }

            autoTable(doc, {
              startY: currentY,
              margin: { top: 40, left: 14, right: 14 },
              tableWidth: 269,
              headStyles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontSize: 7.5, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [255, 255, 255] },
              bodyStyles: { fontSize: 7, halign: 'left', valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] },
              columnStyles: {
                0: { halign: 'left', cellWidth: 55 },
                1: { halign: 'center', cellWidth: 34 },
                2: { halign: 'left', cellWidth: 55 },
                3: { halign: 'center', cellWidth: 34 },
                4: { halign: 'left', cellWidth: 55 },
                5: { halign: 'center', cellWidth: 36 }
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
                  data.cell.styles.overflow = 'hidden';
                  data.cell.styles.valign = 'middle';
                  const rawVal = data.cell.raw !== undefined && data.cell.raw !== null ? data.cell.raw : data.cell.text;
                  const strVal = Array.isArray(rawVal) ? rawVal.join(' ') : String(rawVal);
                  const cleanStr = strVal.replace(/[\r\n]+/g, ' ').trim();
                  if (cleanStr && cleanStr !== 'TICK') {
                    data.cell.text = [cleanStr];
                  }

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

                  const itemForCol = data.column.index < 2 ? item1 : (data.column.index < 4 ? item2 : item3);
                  if (itemForCol) {
                    const lblNorm = (itemForCol.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const esBombaDieselNum = lblNorm.includes('esta es la bomba') && (lblNorm.includes('numero') || lblNorm.includes('nº') || lblNorm.includes('no.'));
                    if (lblNorm.includes('cobertura') || esBombaDieselNum || lblNorm.includes('instalaciones que abastece') || lblNorm.includes('se alimenta')) {
                      data.cell.styles.fillColor = [255, 249, 196]; // amarillo claro #FFF9C4
                      if (data.column.index % 2 === 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = [0, 0, 0];
                      } else {
                        data.cell.styles.textColor = [0, 0, 0];
                      }
                    }
                  }
                }
              }
            });
            currentY = (doc as any).lastAutoTable.finalY || currentY;

          } else {
            const normalItems = filteredSecItems.filter(item => item.tipoRespuesta !== 'tabla' && item.tipoRespuesta !== 'grafico');
            const tableItem = filteredSecItems.find(item => item.tipoRespuesta === 'tabla' || item.tipoRespuesta === 'grafico');

            if (normalItems.length > 0) {
              // Cuestionarios normales (Secciones 2 a 9, 11, etc.): Tabla de 2 columnas por filas
              const checkRows: any[] = [];
              for (const item of normalItems) {
                let rawVal = eq[item.key];
                if ((rawVal === undefined || rawVal === '' || rawVal === '-') && ((item.label || '').toLowerCase().includes('ubicacion') || (item.label || '').toLowerCase().includes('cobertura'))) {
                  rawVal = eq.ubicacion || eq.cobertura || rawVal;
                }
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
                tableWidth: 269,
                headStyles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontSize: 7.5, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [255, 255, 255] },
                bodyStyles: { fontSize: 7.5, halign: 'left', valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] },
                columnStyles: (sec.title && (sec.title.toUpperCase().includes('CONCLUSIONES') || sec.title.toUpperCase().includes('CONCLUSIO'))) ? {
                  0: { halign: 'left', cellWidth: 200 },
                  1: { halign: 'center', cellWidth: 69 }
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
                  if (data.section === 'body') {
                    data.cell.styles.overflow = 'hidden';
                    data.cell.styles.valign = 'middle';
                    const rawVal = data.cell.raw !== undefined && data.cell.raw !== null ? data.cell.raw : data.cell.text;
                    const strVal = Array.isArray(rawVal) ? rawVal.join(' ') : String(rawVal);
                    const cleanStr = strVal.replace(/[\r\n]+/g, ' ').trim();
                    if (cleanStr && cleanStr !== 'TICK') {
                      data.cell.text = [cleanStr];
                    }

                    const itemNorm = normalItems[data.row.index];
                    if (itemNorm) {
                      const lblNorm = (itemNorm.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      const esBombaDieselNum = lblNorm.includes('esta es la bomba') && (lblNorm.includes('numero') || lblNorm.includes('nº') || lblNorm.includes('no.'));
                      const isTipoInstRow = lblNorm.includes('tipo de instalacion') || (itemNorm.label || '').trim().startsWith('1.1');
                      if (isTipoInstRow && data.column.index === 1) {
                        data.cell.styles.halign = 'center';
                        data.cell.styles.fontStyle = 'bold';
                      }
                      if (lblNorm.includes('cobertura') || esBombaDieselNum || lblNorm.includes('instalaciones que abastece') || lblNorm.includes('se alimenta')) {
                        data.cell.styles.fillColor = [255, 249, 196]; // amarillo claro #FFF9C4
                        if (data.column.index === 1) {
                          data.cell.styles.fontStyle = 'bold';
                          data.cell.styles.textColor = [0, 0, 0];
                        } else {
                          data.cell.styles.textColor = [0, 0, 0];
                        }
                      }
                    }
                    if (data.column.index === 1) {
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
                    if (data.cell.raw === 'X' || (typeof data.cell.raw === 'string' && data.cell.raw.trim().toLowerCase() === 'false') || data.cell.raw === false) {
                      data.cell.text = ['X'];
                      data.cell.raw = 'X';
                      data.cell.styles.textColor = anomalyTextColor;
                      data.cell.styles.fontStyle = 'bold';
                      data.cell.styles.fontSize = 8.5;
                    } else if (data.cell.raw === 'TICK' || (typeof data.cell.raw === 'string' && data.cell.raw.trim().toLowerCase() === 'true') || data.cell.raw === true) {
                      data.cell.text = [''];
                      data.cell.raw = 'TICK';
                    } else if (data.cell.raw !== '-') {
                      const rawStr = String(data.cell.raw || '').toUpperCase().trim();
                      if (rawStr.includes('NO CORRECTO') || rawStr.includes('NO CONFORME') || rawStr.includes('PENDIENTES DE CORREGIR') || rawStr.includes('CON LAS ANOMAL')) {
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
                }
                },
                didDrawCell: function (data: any) {
                  if (data.section === 'body' && data.column.index === 1 && (data.cell.raw === 'TICK' || data.cell.raw === true || (typeof data.cell.raw === 'string' && data.cell.raw.trim().toLowerCase() === 'true'))) {
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
              const isGrafico = tableItem.tipoRespuesta === 'grafico';
              let tableHeaders: string[] = isGrafico ? ['Caudal (m³/h)', 'L.P.M.', 'Presión (bar)', 'R.P.M.'] : (tableItem.opciones || []);
              const effectiveFilasNombres = isGrafico ? ['0%', '50%', '100%', '140%'] : (tableItem.filasNombres || []);
              const hasVerticalHeaders = isGrafico || (Array.isArray(tableItem.filasNombres) && tableItem.filasNombres.length > 0);
              let tableRows: string[][] = [];
              let currentNominalCaudal = 0;
              let currentNominalPresion = 0;
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

              // Forzar longitud y etiquetas de fila si es gráfico
              if (isGrafico) {
                const targetRows = effectiveFilasNombres.length;
                const actualCols = tableHeaders.length + 1;
                while (tableRows.length < targetRows) {
                  tableRows.push(Array(actualCols).fill(''));
                }

                // Obtener nominales del equipo actual
                const currentSistItems = (checklistItemsPorSistema && eq.sistemaId) ? checklistItemsPorSistema[eq.sistemaId] : [];
                let currentCaudalNominalKey = '';
                let currentPresionNominalKey = '';

                if (currentSistItems && currentSistItems.length > 0) {
                  const caudalItem = currentSistItems.find((i: any) => {
                    const lbl = (i.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return lbl.includes('caudal') && lbl.includes('nominal');
                  });
                  if (caudalItem) currentCaudalNominalKey = caudalItem.key;

                  const presionItem = currentSistItems.find((i: any) => {
                    const lbl = (i.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return lbl.includes('presion') && lbl.includes('nominal');
                  });
                  if (presionItem) currentPresionNominalKey = presionItem.key;
                }

                if (currentCaudalNominalKey && eq[currentCaudalNominalKey]) {
                  currentNominalCaudal = parseFloat(String(eq[currentCaudalNominalKey]).replace(',', '.'));
                }
                if (currentPresionNominalKey && eq[currentPresionNominalKey]) {
                  currentNominalPresion = parseFloat(String(eq[currentPresionNominalKey]).replace(',', '.'));
                }

                // Encontrar los índices de columna
                let pdfCaudalColIdx = tableHeaders.findIndex(h => {
                  const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  return norm.includes('caudal') || norm.includes('flow') || norm.includes('m3') || norm.trim() === 'q' || norm.includes('(q)');
                });
                let pdfLpmColIdx = tableHeaders.findIndex(h => {
                  const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "");
                  return norm.includes('lpm') || norm.includes('litro');
                });
                let pdfPresionColIdx = tableHeaders.findIndex(h => {
                  const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  return norm.includes('presion') || norm.includes('pressure') || norm.includes('bar') || norm.trim() === 'p' || norm.trim() === 'h' || norm.includes('(p)') || norm.includes('(h)');
                });

                const rowCaudalIdx = pdfCaudalColIdx !== -1 ? pdfCaudalColIdx + 1 : 1;
                const rowLpmIdx = pdfLpmColIdx !== -1 ? pdfLpmColIdx + 1 : 2;
                const rowPresionIdx = pdfPresionColIdx !== -1 ? pdfPresionColIdx + 1 : 3;

                tableRows = tableRows.slice(0, targetRows).map((row, rIdx) => {
                  let newRow = [...row];
                  while (newRow.length < actualCols) {
                    newRow.push('');
                  }
                  newRow = newRow.slice(0, actualCols);
                  newRow[0] = effectiveFilasNombres[rIdx];

                  // Autocalcular Caudal y LPM en base a los nominales actuales
                  if (rIdx === 0) {
                    newRow[rowCaudalIdx] = '0';
                    newRow[rowLpmIdx] = '0';
                  } else if (rIdx === 1) {
                    newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal / 2) * 1000) / 1000).replace('.', ',') : '';
                    newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round(((currentNominalCaudal / 2) / 0.06) * 10) / 10).replace('.', ',') : '';
                  } else if (rIdx === 2) {
                    newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round(currentNominalCaudal * 1000) / 1000).replace('.', ',') : '';
                    newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal / 0.06) * 10) / 10).replace('.', ',') : '';
                    newRow[rowPresionIdx] = currentNominalPresion ? String(Math.round(currentNominalPresion * 1000) / 1000).replace('.', ',') : '';
                  } else if (rIdx === 3) {
                    newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal * 1.4) * 1000) / 1000).replace('.', ',') : '';
                    newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round(((currentNominalCaudal * 1.4) / 0.06) * 10) / 10).replace('.', ',') : '';
                  }

                  return newRow;
                });
              }

              if (tableHeaders.length === 0) {
                tableHeaders = ['Detalle'];
              }
              if (tableRows.length === 0) {
                tableRows = [Array(tableHeaders.length).fill('-')];
              }

              const formatHeader = (h: string) => {
                let norm = String(h || '').trim();
                
                if (norm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('ubicacion')) {
                  return norm;
                }

                norm = norm
                  .replace(/Detector\s+de\s+humo/gi, 'Detector humo')
                  .replace(/Pulsador\s+de\s+paro/gi, 'Pulsador paro')
                  .replace(/Pulsador\s+de\s+disparo/gi, 'Pulsador disparo')
                  .replace(/Retenedor\s+de\s+puerta/gi, 'Retenedor puerta')
                  .replace(/\s+de\s+la\s+/gi, ' ')
                  .replace(/\s+de\s+los\s+/gi, ' ')
                  .replace(/\s+de\s+las\s+/gi, ' ')
                  .replace(/\s+de\s+/gi, ' ')
                  .replace(/\s+del\s+/gi, ' ');

                const words = norm.split(/\s+/).filter(Boolean);
                if (words.length <= 1) {
                  return norm;
                }
                if (words.length === 2) {
                  return words[0] + '\n' + words[1];
                }

                let bestSplitIndex = 1;
                let minDiff = Infinity;
                for (let i = 1; i < words.length; i++) {
                  const line1 = words.slice(0, i).join(' ');
                  const line2 = words.slice(i).join(' ');
                  const diff = Math.abs(line1.length - line2.length);
                  if (diff < minDiff) {
                    minDiff = diff;
                    bestSplitIndex = i;
                  }
                }
                
                return words.slice(0, bestSplitIndex).join(' ') + '\n' + words.slice(bestSplitIndex).join(' ');
              };

              const colStyles: any = {};
              let ubicColIdx = -1;
              
              tableHeaders.forEach((h, index) => {
                const colIdx = hasVerticalHeaders ? index + 1 : index;
                const norm = String(h || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (norm.includes('ubicacion') || norm.includes('planta')) {
                  ubicColIdx = colIdx;
                } else if (norm.includes('tipo') || norm.includes('clase') || norm.includes('modelo')) {
                  colStyles[colIdx] = { cellWidth: 38, halign: 'center' };
                } else if (norm.includes('fecha') || norm.includes('fabricacion') || norm.includes('retimbre')) {
                  colStyles[colIdx] = { cellWidth: 20, halign: 'center' };
                } else if (norm.includes('presion') || norm.includes('tara') || norm.includes('peso') || norm.includes('carga') || norm.includes('bar')) {
                  colStyles[colIdx] = { cellWidth: 22, halign: 'center' };
                } else {
                  colStyles[colIdx] = { halign: 'center' };
                }
              });

              if (hasVerticalHeaders) {
                colStyles[0] = { halign: 'left', fontStyle: 'bold' };
              }

              // Si hay columna de ubicación, se expande a la izquierda; si no, la columna principal (col 0) se expande para llenar los 269 mm
              if (ubicColIdx !== -1) {
                colStyles[ubicColIdx] = { halign: 'left' };
              } else if (!hasVerticalHeaders) {
                colStyles[0] = { halign: 'left' };
              }

              if (isGrafico) {
                doc.addPage();
                const newPageNum = (doc.internal as any).getNumberOfPages();
                if (!drawnTablePages.has(newPageNum)) {
                  drawTableHeader(newPageNum);
                  drawnTablePages.add(newPageNum);
                }
                currentY = 34;
              }

              autoTable(doc, {
                startY: currentY,
                margin: { top: 40, left: 14, right: 14 },
                tableWidth: 269,
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
                  [{ content: normalItems.length > 0 ? tableItem.label : sec.title, colSpan: hasVerticalHeaders ? tableHeaders.length + 1 : tableHeaders.length, styles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, halign: 'left' } }],
                  hasVerticalHeaders 
                    ? [(isGrafico ? 'RENDIMIENTO' : 'Concepto'), ...tableHeaders.map(formatHeader)]
                    : tableHeaders.map(formatHeader)
                ],
                body: tableRows,
                didDrawPage: function (_data: any) {
                  const absolutePageNum = (doc.internal as any).getCurrentPageInfo().pageNumber;
                  if (!drawnTablePages.has(absolutePageNum)) {
                    drawTableHeader(absolutePageNum);
                    drawnTablePages.add(absolutePageNum);
                  }
                },
                didParseCell: function (data: any) {
                  if (isGrafico && data.section === 'body') {
                    if (data.row.index === 2 || (data.row.raw && data.row.raw[0] === '100%')) {
                      data.cell.styles.fontStyle = 'bold';
                    }
                  }
                }
              });
              currentY = (doc as any).lastAutoTable.finalY || currentY;

              try {
                let caudalColIdx = tableHeaders.findIndex(h => {
                  const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  return norm.includes('caudal') || norm.includes('flow') || norm.includes('m3') || norm.trim() === 'q' || norm.includes('(q)');
                });
                let presionColIdx = tableHeaders.findIndex(h => {
                  const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  return norm.includes('presion') || norm.includes('pressure') || norm.includes('bar') || norm.trim() === 'p' || norm.trim() === 'h' || norm.includes('(p)') || norm.includes('(h)');
                });

                if (caudalColIdx === -1 && presionColIdx === -1) {
                  caudalColIdx = tableHeaders.findIndex(h => h.toLowerCase().trim().startsWith('q'));
                  presionColIdx = tableHeaders.findIndex(h => h.toLowerCase().trim().startsWith('p') || h.toLowerCase().trim().startsWith('h'));
                }

                if (caudalColIdx === -1 && presionColIdx !== -1) {
                  caudalColIdx = presionColIdx === 0 ? 1 : 0;
                } else if (presionColIdx === -1 && caudalColIdx !== -1) {
                  presionColIdx = caudalColIdx === 0 ? 1 : 0;
                } else if (caudalColIdx === -1 && presionColIdx === -1) {
                  const firstColLower = (tableHeaders[0] || '').toLowerCase();
                  if (firstColLower.includes('p') || firstColLower.includes('bar') || firstColLower.includes('h') || firstColLower.includes('pres')) {
                    caudalColIdx = 1;
                    presionColIdx = 0;
                  } else {
                    caudalColIdx = 0;
                    presionColIdx = 1;
                  }
                }

                if (caudalColIdx !== -1 && presionColIdx !== -1 && tableHeaders[caudalColIdx] !== undefined) {
                  const rowCaudalIdx = hasVerticalHeaders ? caudalColIdx + 1 : caudalColIdx;
                  const rowPresionIdx = hasVerticalHeaders ? presionColIdx + 1 : presionColIdx;

                  const dataPoints: { x: number; y: number }[] = [];
                  tableRows.forEach(row => {
                    const cVal = parseFloat(String(row[rowCaudalIdx] || '').replace(',', '.'));
                    const pVal = parseFloat(String(row[rowPresionIdx] || '').replace(',', '.'));
                    if (!isNaN(cVal) && !isNaN(pVal)) {
                      dataPoints.push({ x: cVal, y: pVal });
                    }
                  });

                  if (isGrafico && dataPoints.length >= 2) {
                    const chartHeight = 80;
                    // Margen requerido: 15mm para los textos de nominales + chartHeight + 15mm espaciado
                    if (currentY + chartHeight + 30 > 270) {
                      doc.addPage();
                      const newPageNum = (doc.internal as any).getNumberOfPages();
                      if (!drawnTablePages.has(newPageNum)) {
                        drawTableHeader(newPageNum);
                        drawnTablePages.add(newPageNum);
                      }
                      currentY = 48;
                    } else {
                      currentY += 5; // Espacio inicial
                    }

                    // Dibujar los nominales de la sección 1.2 y 1.3
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8);
                    doc.setTextColor(60, 60, 60);

                    const caudalStr = String(currentNominalCaudal || '-').replace('.', ',');
                    const presionStr = String(currentNominalPresion || '-').replace('.', ',');

                    doc.text(`1.2 Caudal nominal (m³/h.): ${caudalStr}`, 14, currentY + 4);
                    doc.text(`1.3 Presión nominal (bar): ${presionStr}`, 14, currentY + 9);

                    currentY += 15; // Espacio antes del gráfico (incluye el hueco de los textos)

                    drawPumpCurveChart(doc, 14, currentY, 269, chartHeight, dataPoints, currentNominalCaudal, currentNominalPresion);
                    currentY += chartHeight + 5;
                  }
                }
              } catch (err) {
                console.error("Error generating pump curve chart:", err);
              }
            }
          }
        }
        if (repetirHeaderPorEquipo) {
          currentY = await renderAnomaliasParaEquipos([eq], currentY, true);
        }
        currentY += 2;
      }
      finalY = currentY;

    } else {
      // Layout Horizontal Clásico
      const dynamicColumnStyles: any = {};
      const maxTableWidth = 269; // Ancho total de tabla idéntico al de extintores (297 - 14 - 14)
      
      let colUbicacionIdx = -1;
      let anchoOtrasColumnas = 0;

      headersBase.forEach((headerText, colIdx) => {
        const normH = String(headerText || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (colIdx === 0) {
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: 9, fillColor: [128, 0, 32], textColor: [255, 255, 255] };
          anchoOtrasColumnas += 9;
        } else if (normH.includes('ubicacion') || normH.includes('planta')) {
          colUbicacionIdx = colIdx;
        } else if (normH.includes('tipo') || normH.includes('clase') || normH.includes('modelo')) {
          const w = esPuertasRF ? 55 : (isBie ? 38 : (esCasetas ? 38 : 42));
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: w };
          anchoOtrasColumnas += w;
        } else if (normH.includes('placa')) {
          const w = isBie ? 14 : 15;
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: w };
          anchoOtrasColumnas += w;
        } else if (normH.includes('longitud')) {
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: 14 };
          anchoOtrasColumnas += 14;
        } else if (normH.includes('fabricante') || normH.includes('marca')) {
          const w = isBie ? 22 : 24;
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: w };
          anchoOtrasColumnas += w;
        } else if (normH.includes('fecha') || normH.includes('fabricacion') || normH.includes('retimbre') || normH.includes('prueba') || normH.includes('hidraulica') || normH.includes('p.h')) {
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: 17 };
          anchoOtrasColumnas += 17;
        } else if (normH.includes('salida') || normH.includes('bocas')) {
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: 20 };
          anchoOtrasColumnas += 20;
        } else if (normH.includes('diametro') || normH.includes('diam')) {
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: 16 };
          anchoOtrasColumnas += 16;
        } else if (normH.includes('tramo')) {
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: 14.5 };
          anchoOtrasColumnas += 14.5;
        } else {
          dynamicColumnStyles[colIdx] = { halign: 'center', cellWidth: 20 };
          anchoOtrasColumnas += 20;
        }
      });

      const checkWidth = (isBie || esExtintor) ? 5.8 : 6.5;
      checkHeaders.forEach((_, i) => {
        dynamicColumnStyles[headersBase.length + i] = { halign: 'center', cellWidth: checkWidth };
        anchoOtrasColumnas += checkWidth;
      });

      // La columna de Ubicación absorbe automáticamente todo el ancho restante para que la tabla sea exactamente de 269 mm
      if (colUbicacionIdx !== -1) {
        const anchoUbic = Math.max(50, Math.round((maxTableWidth - anchoOtrasColumnas) * 10) / 10);
        dynamicColumnStyles[colUbicacionIdx] = { halign: 'left', cellWidth: anchoUbic };
      } else {
        const anchoCol1 = Math.max(50, Math.round((maxTableWidth - (anchoOtrasColumnas - (dynamicColumnStyles[1]?.cellWidth || 0))) * 10) / 10);
        dynamicColumnStyles[1] = { halign: 'left', cellWidth: anchoCol1 };
      }

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
        tableWidth: 269,
        headStyles: { fillColor: [128, 0, 32], textColor: [255, 255, 255], fontSize: 7, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [255, 255, 255] },
        bodyStyles: { fontSize: 6.8, halign: 'center', valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200], cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, overflow: 'ellipsize' },

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
               data.cell.styles.halign = data.column.index === 1 ? 'left' : 'center';
            }
            if (data.column.index >= headersBase.length) {
               data.cell.text = [''];
            }
          }
          if (data.section === 'body') {
            data.cell.styles.overflow = 'hidden';
            data.cell.styles.valign = 'middle';

            // Forzar estrictamente 1 sola línea por celda eliminando cualquier salto de línea
            const rawVal = data.cell.raw !== undefined && data.cell.raw !== null ? data.cell.raw : data.cell.text;
            const strVal = Array.isArray(rawVal) ? rawVal.join(' ') : String(rawVal);
            const cleanStr = strVal.replace(/[\r\n]+/g, ' ').trim();
            if (cleanStr && cleanStr !== 'TICK') {
              data.cell.text = [cleanStr];
            }

            // Auto-fit dinámico de tamaño de fuente para que NUNCA salte a 2 filas
            if (data.column.index < headersBase.length && cleanStr && cleanStr !== '-' && cleanStr !== 'TICK') {
              const colStyleWidth = dynamicColumnStyles[data.column.index]?.cellWidth;
              const cellW = (typeof colStyleWidth === 'number') ? colStyleWidth : 25;
              const availW = Math.max(6, cellW - 2.5);

              doc.setFont("helvetica", data.cell.styles.fontStyle || "normal");
              let fs = data.cell.styles.fontSize || 6.8;
              doc.setFontSize(fs);
              let tw = doc.getTextWidth(cleanStr);
              while (tw > availW && fs > 4.0) {
                fs -= 0.2;
                doc.setFontSize(fs);
                tw = doc.getTextWidth(cleanStr);
              }
              data.cell.styles.fontSize = fs;
            }

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
              if (data.cell.raw === 'X' || (typeof data.cell.raw === 'string' && data.cell.raw.trim().toLowerCase() === 'false') || data.cell.raw === false) {
                data.cell.text = ['X'];
                data.cell.raw = 'X';
                data.cell.styles.textColor = anomalyTextColor;
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = 9;
              } else if (data.cell.raw === 'TICK' || (typeof data.cell.raw === 'string' && data.cell.raw.trim().toLowerCase() === 'true') || data.cell.raw === true) {
                data.cell.text = [''];
                data.cell.raw = 'TICK';
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
          if (data.section === 'body' && data.column.index >= headersBase.length && (data.cell.raw === 'TICK' || data.cell.raw === true || (typeof data.cell.raw === 'string' && data.cell.raw.trim().toLowerCase() === 'true'))) {
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

    if (!repetirHeaderPorEquipo) {
      finalY += 8;
    }

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

    // 2. Pintar el título "Anomalías y observaciones:"
    if (!repetirHeaderPorEquipo) {
      finalY = await renderAnomaliasParaEquipos(equipos, finalY, true);
    }
    
    return finalY + 5;
  };

  let tableStartY = 34;
  let hasRenderedAnySystem = false;

  // Orden de sistemas en Actas: 1º EXTINTORES, 2º BOCAS DE INCENDIO (BIE), 3º HIDRANTES, 4º CASETAS, resto...
  const sistemasOrdenados = [...sistemas].sort((a, b) => {
    const getWeight = (s: any) => {
      const familyOrType = `${s.familia || ''} ${s.tipo || ''} ${s.nombre || ''}`.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // 1º Extintores
      if (familyOrType.includes('EXTINTOR')) return 10;
      // 2º Bocas de Incendios (BIE)
      if (familyOrType.includes('BIE') || familyOrType.includes('BOCA')) return 20;
      // 3º Hidrantes (excluyendo casetas/dotación)
      if (familyOrType.includes('HIDRANTE') && !familyOrType.includes('CASETA') && !familyOrType.includes('DOTACION')) return 30;
      // 4º Casetas
      if (familyOrType.includes('CASETA') || familyOrType.includes('DOTACION')) return 40;
      // Después el resto
      if (familyOrType.includes('ABASTECIMIENTO') || familyOrType.includes('SALA DE BOMBAS')) return 50;
      if (familyOrType.includes('JOCKEY')) return 51;
      if (familyOrType.includes('ELECTRICA')) return 52;
      if (familyOrType.includes('GASOIL') || familyOrType.includes('DIESEL') || familyOrType.includes('MOTOBOMBA')) return 53;
      if (familyOrType.includes('ROCIADOR') || familyOrType.includes('SPRINKLER')) return 60;
      if (familyOrType.includes('DETECCI') && !familyOrType.includes('MONOXIDO') && !familyOrType.includes('ASPIRACI')) return 70;
      if (familyOrType.includes('ASPIRACI')) return 71;
      if (familyOrType.includes('MONOXIDO') || familyOrType.includes('(CO)')) return 72;
      if (familyOrType.includes('COCINA') || familyOrType.includes('CAMPANA')) return 80;
      if (familyOrType.includes('GAS') || familyOrType.includes('EXTINCION')) return 81;
      if (familyOrType.includes('ALUMBRADO') || familyOrType.includes('EMERGENCIA')) return 85;
      if (familyOrType.includes('PUERTA') || familyOrType.includes('CORTAFUEGO') || familyOrType.includes('RF')) return 90;
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

    let nombreSistema = sist.nombre || sist.familia || sist.tipo || 'Sistema';
    const sistNormMonox = nombreSistema.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if ((sistNormMonox.includes('monoxido') || sistNormMonox.includes('monox')) && !nombreSistema.toUpperCase().includes('(CO)')) {
      nombreSistema = `${nombreSistema} (CO)`;
    }
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
          const isMonoxA = a.includes('monoxido') || a.includes('monox') || a.includes('(co)');
          const isMonoxB = b.includes('monoxido') || b.includes('monox') || b.includes('(co)');
          if (isMonoxA || isMonoxB) {
            return isMonoxA && isMonoxB;
          }
          const isAspiracionA = a.includes('aspiraci') || a.includes('aspirac');
          const isAspiracionB = b.includes('aspiraci') || b.includes('aspirac');
          if (isAspiracionA || isAspiracionB) {
            return isAspiracionA && isAspiracionB;
          }
          const isCocinaA = a.includes('cocina') || a.includes('campana');
          const isCocinaB = b.includes('cocina') || b.includes('campana');
          if (isCocinaA || isCocinaB) {
            return isCocinaA && isCocinaB;
          }
          const isGasA = (a.includes('gas') || (a.includes('extinci') && !a.includes('extintor'))) && !isCocinaA;
          const isGasB = (b.includes('gas') || (b.includes('extinci') && !b.includes('extintor'))) && !isCocinaB;
          if (isGasA || isGasB) {
            return isGasA && isGasB;
          }
          if (a.includes('rociador') && b.includes('rociador')) return true;
          if (a.includes('deteccion') && b.includes('deteccion')) return true;
          if (a.includes('extintor') && b.includes('extintor')) return true;
          if ((a.includes('bie') || a.includes('boca de incendio') || a.includes('boca de equipamiento')) && 
              (b.includes('bie') || b.includes('boca de incendio') || b.includes('boca de equipamiento'))) return true;
          // Coincidencia por substring solo si el nombre de categoría tiene suficiente longitud (>=5 chars)
          // para evitar falsos positivos con nombres cortos como "BIE", "RED", etc.
          if (b.length >= 5 && a.includes(b)) return true;
          if (a.length >= 5 && b.includes(a)) return true;
          const stopWords = ['incendio', 'incendios', 'sistema', 'sistemas', 'proteccion', 'equipo', 'equipos', 'automatica', 'automatico', 'manual', 'manuales', 'red', 'puesto', 'control', 'bomba', 'bombas', 'grupo', 'grupos', 'sala', 'salas'];
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
          const { base64: iconoOpt } = await optimizarImagenParaPDF(base64Icon, 800, 0.75);
          icono = await removeWhiteBackground(iconoOpt);
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
  doc.setTextColor(0, 82, 204);
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
        await dibujarFirmaAjustada(doc, firmaCliente, bx + 11, by + 10, blockW - 22, 16);
      } catch (_e) { }
    }
    if (i === 1 && firmaTecnico) {
      try {
        await dibujarFirmaAjustada(doc, firmaTecnico, bx + 11, by + 10, blockW - 22, 16);
      } catch (_e) { }
    }
    if (i === 0 && firmaIngenieroBase64) {
      try {
        await dibujarFirmaAjustada(doc, firmaIngenieroBase64, bx + 11, by + 10, blockW - 22, 16);
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
  checklistItemsPorSistema?: Record<string, any[]>,
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
  const empData = normalizarDatosEmpresa(empresa, centro?.empresaId);

  // ── CABECERA: Logo + Datos empresa ──
  let headerY = 12;

  // Logo a la derecha - cargar desde URL si es necesario
  try {
    const logoRaw = await fetchImageToBase64(empData?.logoUrl);
    if (logoRaw) {
      const { base64: logoData, format } = await optimizarImagenParaPDF(logoRaw, 800, 0.75);
      const logoProps = doc.getImageProperties(logoData);
      const maxLogoWidth = 55;
      const maxLogoHeight = 18;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoData, format, pageWidth - 10 - logoWidth, headerY, logoWidth, logoHeight);
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
      0: { halign: 'center', cellWidth: 22 },
      1: { cellWidth: 40 },
      2: { cellWidth: 'auto' },
      3: { halign: 'right', cellWidth: 22 },
      4: { halign: 'right', cellWidth: 22 }
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
    await dibujarFirmaAjustada(doc, firmaTecnico, 15, finalY + 4, 54, 28);
  }
  doc.text(`Nombre: ${tecnicoNombre || 'N/A'}`, 14, finalY + 37);

  // Conformidad Cliente
  doc.text('Conformidad del Cliente:', 80, finalY);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.roundedRect(80, finalY + 3, 56, 30, 2, 2);
  if (firmaCliente) {
    await dibujarFirmaAjustada(doc, firmaCliente, 81, finalY + 4, 54, 28);
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
    const rasic = empData?.rasic && empData.rasic !== '-' ? `  |  RASIC: ${empData.rasic}` : '';
    const cifText = empData?.cif && empData.cif !== '-' ? `CIF: ${empData.cif}` : '';
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
    const dirParts = [empData?.direccion, empData?.poblacion, empData?.provincia, empData?.cp].filter(p => p && p !== '-').join(', ');
    const telPart = empData?.telefono && empData.telefono !== '-' ? `  |  Tel: ${empData.telefono}` : '';
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
  const empData = normalizarDatosEmpresa(empresa, centro?.empresaId || parte?.empresaId);
  const margen = 14;

  const tipoCert = parte?.tipoCertificado || 'revision';
  const getTituloPorTipo = (t: string) => {
    if (parte?.tituloCertificado && parte.tituloCertificado.trim() !== '') {
      return parte.tituloCertificado.toUpperCase();
    }
    switch (t) {
      case 'instalacion': return 'CERTIFICADO DE INSTALACIÓN';
      case 'reparacion': return 'CERTIFICADO DE REPARACIÓN';
      case 'puesta_en_marcha': return 'CERTIFICADO DE PUESTA EN MARCHA';
      case 'obligacion_salarial': return 'CERTIFICADO DE OBLIGACIÓN SALARIAL';
      case 'generico': return 'CERTIFICADO OFICIAL';
      default: return 'CERTIFICADO DE REVISIÓN';
    }
  };
  const tituloHeader = getTituloPorTipo(tipoCert);
  const subtituloHeader = parte?.subtitulo || `Instalaciones y sistemas de protección contra incendios - ${parte?.numeroMantenimiento || parte?.id || '—'}`;

  // ── CABECERA: TÍTULO CENTRADO (10 ptos más arriba) ──
  let y = 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text(tituloHeader, pageWidth / 2, y + 3, { align: 'center' });

  // Subtítulo y Nº certificado en una línea
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(subtituloHeader, pageWidth / 2, y + 9, { align: 'center' });

  // Línea decorativa bajo la cabecera
  y += 13;
  doc.setDrawColor(128, 0, 32);
  doc.setLineWidth(0.8);
  doc.line(margen, y, pageWidth - margen, y);
  doc.setLineWidth(0.2);
  doc.line(margen, y + 1.5, pageWidth - margen, y + 1.5);
  y += 5;

  // ── DATOS DE LA EMPRESA MANTENEDORA (tarjeta con logo a la derecha) ──
  const empNombre = empData?.nombre || 'ABANFOC S.L.';
  const empCif = empData?.cif || '-';
  const empDir = empData?.direccion || '-';
  const empLocParts = [empData?.poblacion, empData?.provincia, empData?.cp].filter(p => p && p !== '-');
  const empLoc = empLocParts.length > 0 ? empLocParts.join(', ') : '-';
  const empTel = empData?.telefono || '-';
  const empMail = empData?.correo || empData?.email || '-';
  const empRasic = empData?.rasic || '-';

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
    const logoRaw = await fetchImageToBase64(empData?.logoUrl);
    if (logoRaw) {
      const { base64: logoData, format } = await optimizarImagenParaPDF(logoRaw, 800, 0.75);
      const logoProps = doc.getImageProperties(logoData);
      const maxLogoWidth = 70;
      const maxLogoHeight = 15;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoData, format, pageWidth - margen - 4 - logoWidth, y + 6, logoWidth, logoHeight);
    }
  } catch (e) { console.error("Error loading logo for Certificado PDF:", e); }

  y += cardEmpH + 4;

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

  y += cardInstalacionH + 4;

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
        const esExtintor = nsUpper.includes('EXTINTOR');
        const esBie = nsUpper.includes('BIE') || nsUpper.includes('BOCA');
        const esHidrante = nsUpper.includes('HIDRANTE') && !nsUpper.includes('CASETA') && !nsUpper.includes('DOTACION');
        if (esExtintor) {
          fallbackName = 'Extintor';
        } else if (esBie) {
          fallbackName = 'BIE';
        } else if (esHidrante) {
          fallbackName = 'Hidrante';
        } else if (nsUpper.includes('DETEC') || nsUpper.includes('HUMO') || nsUpper.includes('ASPIRAC')) {
          fallbackName = 'Detector';
        } else if (nsUpper.includes('PUERTA') || nsUpper.includes('RF')) {
          fallbackName = 'Puerta RF';
        } else if (nsUpper.includes('CASETA') || nsUpper.includes('DOTACION')) {
          fallbackName = 'Caseta de dotación';
        } else if (nsUpper.includes('ROCIADOR') || nsUpper.includes('SPRINKLER')) {
          fallbackName = 'Rociador';
        } else if (nsUpper.includes('ALUMBRADO') || nsUpper.includes('EMERGENCIA')) {
          fallbackName = 'Luminaria de emergencia';
        }

        // Buscar tipo en campos dinámicos si existe
        let tipoFromItems = '';
        const itemsDeSist = (sist?.items || sist?.checkItems || sist?.plantilla || []) as any[];
        if (Array.isArray(itemsDeSist) && itemsDeSist.length > 0) {
          const itemTipoDef = itemsDeSist.find(it => {
            const lbl = (it.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return lbl.includes('tipo') && it.tipoRespuesta !== 'check' && !lbl.includes('tipo de respuesta');
          });
          if (itemTipoDef && itemTipoDef.key && eq[itemTipoDef.key] !== undefined && eq[itemTipoDef.key] !== null) {
            const v = String(eq[itemTipoDef.key]).trim();
            if (v && v.toLowerCase() !== 'true' && v.toLowerCase() !== 'false') {
              tipoFromItems = v;
            }
          }
        }

        // Escanear todas las claves de eq para detectar agente o capacidad implícitos (SOLO PARA EXTINTORES)
        let detectedAgente = '';
        let detectedCapacidad = '';
        let allValuesString = '';
        for (const k of Object.keys(eq)) {
          const kLower = k.toLowerCase();
          if (
            kLower === 'id' ||
            kLower === 'centroid' ||
            kLower === 'sistemaid' ||
            kLower === 'nombre' ||
            kLower === 'clase' ||
            kLower === 'codigo' ||
            kLower === 'ubicacion'
          ) continue;
          const val = eq[k];
          if (typeof val === 'string' && val.trim() !== '' && val.toLowerCase() !== 'true' && val.toLowerCase() !== 'false') {
            allValuesString += ' ' + val.trim();
            const valUpper = val.toUpperCase().trim();
            if (esExtintor) {
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
                const match = valUpper.match(/(\b\d+\s*KG\b|\b\d+\s*KILOS?\b)/) || valUpper.match(/(\b\d+\s*L\b|\b\d+\s*LITROS?\b)/);
                if (match) {
                  detectedCapacidad = match[1].toLowerCase().replace(/\s+/g, ' ');
                }
              }
            }
          }
        }

        const valName = (val: any) => typeof val === 'string' && val.trim() !== '' && val.toLowerCase() !== 'true' && val.toLowerCase() !== 'false' ? val.trim() : (typeof val === 'number' && !isNaN(val) ? String(val) : null);
        
        let tipoVal = valName(eq.tipo) || tipoFromItems || valName(eq.agente) || detectedAgente || valName(eq.nombre) || valName(eq.clase) || valName(eq.marca) || fallbackName;

        let cleanTipo = tipoVal.trim();
        if (esExtintor) {
          cleanTipo = cleanTipo.replace(/\d+\s*(kg|l|kilos|litros)\.?/gi, '').replace(/\s+/g, ' ').trim();
          cleanTipo = cleanTipo.replace(/\b(kg|l|kilos|litros)\b/gi, '').replace(/\s+/g, ' ').trim();
          
          const ctUpper = cleanTipo.toUpperCase();
          if (ctUpper.includes('POLVO') || ctUpper.includes('ABC')) {
            cleanTipo = 'Polvo ABC';
          } else if (ctUpper.includes('CO2') || ctUpper.includes('ANHIDRIDO')) {
            cleanTipo = 'CO2';
          } else if (ctUpper.includes('AGUA')) {
            cleanTipo = 'Agua';
          } else if (ctUpper.includes('ESPUMA')) {
            cleanTipo = 'Espuma';
          } else if (!cleanTipo || cleanTipo.toLowerCase() === 'extintor') {
            cleanTipo = detectedAgente || 'Polvo ABC';
          }
        } else if (esBie) {
          const fullBieStr = `${cleanTipo} ${allValuesString}`.toUpperCase();
          if (fullBieStr.includes('25')) {
            cleanTipo = 'BIE 25 mm';
          } else if (fullBieStr.includes('45')) {
            cleanTipo = 'BIE 45 mm';
          } else if (fullBieStr.includes('70')) {
            cleanTipo = 'BIE 70 mm';
          } else {
            let formatted = cleanTipo;
            if (!formatted.toUpperCase().startsWith('BIE')) {
              formatted = `BIE ${formatted}`;
            }
            cleanTipo = formatted;
          }
        } else if (esHidrante) {
          if (!cleanTipo || cleanTipo.toLowerCase() === 'equipo') {
            cleanTipo = 'Hidrante';
          }
        }

        let capVal = '';
        if (esExtintor) {
          if (eq.capacidad && typeof eq.capacidad === 'string' && eq.capacidad.toLowerCase() !== 'true' && eq.capacidad.toLowerCase() !== 'false') {
            capVal = eq.capacidad;
          } else if (eq.peso && typeof eq.peso === 'string' && eq.peso.toLowerCase() !== 'true' && eq.peso.toLowerCase() !== 'false') {
            capVal = eq.peso;
          } else {
            capVal = detectedCapacidad;
          }
        }
        let cleanCap = (capVal || '').trim();

        if (cleanCap && cleanTipo.toLowerCase().includes(cleanCap.toLowerCase())) {
          cleanCap = '';
        }

        let clave = cleanCap ? `${cleanTipo} ${cleanCap}.` : `${cleanTipo}.`;
        clave = clave.replace(/\s+kg\.?/gi, ' Kg.');
        clave = clave.replace(/\s+l\.?/gi, ' L.');
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

    // Ordenar de forma estricta: Extintores -> BIEs -> Detección (columna izquierda), Resto a la derecha
    const sistemasExtintores: SystemWithHeight[] = [];
    const sistemasBies: SystemWithHeight[] = [];
    const sistemasDeteccion: SystemWithHeight[] = [];
    const sistemasResto: SystemWithHeight[] = [];

    systemsWithHeight.forEach(s => {
      const nsUpper = s.nombreSistema.toUpperCase();
      if (nsUpper.includes('EXTINTOR')) {
        sistemasExtintores.push(s);
      } else if (nsUpper.includes('BIE') || nsUpper.includes('BOCA')) {
        sistemasBies.push(s);
      } else if (nsUpper.includes('DETEC') || nsUpper.includes('HUMO') || nsUpper.includes('ASPIRAC')) {
        sistemasDeteccion.push(s);
      } else {
        sistemasResto.push(s);
      }
    });

    const col0: SystemWithHeight[] = [...sistemasExtintores, ...sistemasBies, ...sistemasDeteccion];
    const col1: SystemWithHeight[] = sistemasResto;

    const h0 = col0.reduce((sum, s) => sum + s.height, 0);
    const h1 = col1.reduce((sum, s) => sum + s.height, 0);
    const maxHeight = Math.max(h0, h1, 10);
    const cardSistemasH = maxHeight + 10;

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 251, 252);
    doc.roundedRect(margen, y, pageWidth - margen * 2, cardSistemasH, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('SISTEMAS Y EQUIPOS REVISADOS', pageWidth / 2, y + 6, { align: 'center' });

    let currentBlockY = y + 11;

    // Dibujar Columna 0 (Izquierda: Extintores y BIEs)
    let col0_Y = currentBlockY;
    col0.forEach(s => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(50, 70, 120);
      doc.text(s.nombreSistema, margen + 8, col0_Y);
      col0_Y += 5;

      Object.entries(s.conteoPorTipo).forEach(([clave, cantidad]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(`• ${clave} = ${cantidad} unidad${cantidad > 1 ? 'es' : ''}`, margen + 14, col0_Y, { maxWidth: (pageWidth / 2) - margen - 12 });
        col0_Y += 4.5;
      });
      col0_Y += 2;
    });

    // Dibujar Columna 1 (Derecha: Resto de equipos)
    let col1_Y = currentBlockY;
    col1.forEach(s => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(50, 70, 120);
      doc.text(s.nombreSistema, pageWidth / 2 + 4, col1_Y);
      col1_Y += 5;

      Object.entries(s.conteoPorTipo).forEach(([clave, cantidad]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(`• ${clave} = ${cantidad} unidad${cantidad > 1 ? 'es' : ''}`, pageWidth / 2 + 10, col1_Y, { maxWidth: (pageWidth / 2) - margen - 12 });
        col1_Y += 4.5;
      });
      col1_Y += 2;
    });

    y += cardSistemasH + 4;
  }

  // ── RESULTADO DE LA REVISIÓN ──
  // Comprobar si hay anomalías reales en los equipos ("NO CORRECTO", checks en false, o casilla de observaciones en rojo)
  const hayAnomaliasReal = Array.isArray(equiposTodos) && equiposTodos.some(eq => equipoTieneAnomalias(eq));
  const rawEstado = (estadoCertificado || parte?.estadoCertificado || parte?.estado || '').toLowerCase();
  const esNegativo = hayAnomaliasReal || rawEstado.includes('no favorable') || rawEstado.includes('negativo') || rawEstado.includes('no favorabl') || rawEstado.includes('desfavorable') || rawEstado.includes('anomal');
  const estadoLimpio = esNegativo ? 'NO favorable' : 'Favorable';

  // Texto de certificación formal
  const nombreCentro = centro?.nombre || 'el centro indicado';
  const tecnicoTitulado = (empData?.ingenieroNombre && empData?.ingenieroApellidos) 
      ? `${empData.ingenieroNombre} ${empData.ingenieroApellidos}`
      : (empData?.tecnicoTitulado || 'Técnico Titulado de la Empresa');
  const nifTecnico = empData?.ingenieroNif || empData?.nifTecnico || 'N.I.F. no especificado';
  const numTecnico = empData?.ingenieroColegiado || empData?.numTecnicoTitulado || 'N.º de colegiado no especificado';

  const textoCertificacion = parte?.textoCertificado || parte?.observaciones ||
    `Don ${tecnicoTitulado}, con N.I.F. ${nifTecnico}, Técnico titulado n.º ${numTecnico} y en calidad de responsable técnico ` +
    `de la empresa instaladora y mantenedora de sistemas de protección contra incendios ${empNombre} con N.I.F. ` +
    `${empCif}, autorizada por la Generalitat de Catalunya con n.º de RASIC ${empData?.rasic || '106001687'}, ` +
    `CERTIFICA que se ha efectuado la revisión/actuación correspondiente en las instalaciones de "${nombreCentro}" ` +
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

  // ── FIRMAS (Certificado: El Técnico Titulado y Técnico mantenedor) ──
  const firmaTecnicoFinal = _firmaTecnico || parte?.firmaTecnico;
  const firmaIngenieroBase64 = await fetchImageToBase64(empData?.ingenieroFirmaUrl || empData?.firmaIngenieroBase64 || empData?.firmaUrl);
  if (firmaIngenieroBase64 || firmaTecnicoFinal) {
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

    const boxW = 75;
    const boxH = 26;
    const box1X = 22;
    const box2X = 113;
    
    // 1. Firma Ingeniero / Técnico Titulado
    doc.text('El Técnico Titulado', box1X, firmasY);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(box1X, firmasY + 3, boxW, boxH, 2, 2);
    if (firmaIngenieroBase64) {
      await dibujarFirmaAjustada(doc, firmaIngenieroBase64, box1X + 2, firmasY + 4, boxW - 4, boxH - 2);
    }
    
    // 2. Firma Técnico Mantenedor
    doc.text('Técnico mantenedor', box2X, firmasY);
    doc.roundedRect(box2X, firmasY + 3, boxW, boxH, 2, 2);
    if (firmaTecnicoFinal) {
      await dibujarFirmaAjustada(doc, firmaTecnicoFinal, box2X + 2, firmasY + 4, boxW - 4, boxH - 2);
    }

    // Nombres y cargos debajo de las firmas
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);

    // Nombre Ingeniero
    const nombreIngeniero = (empData?.ingenieroNombre && empData?.ingenieroApellidos) 
      ? `${empData.ingenieroNombre} ${empData.ingenieroApellidos}`
      : (empData?.tecnicoTitulado || 'Técnico Titulado');
    doc.text(nombreIngeniero, box1X, firmasY + 33);

    // Nombre Técnico
    doc.text(tecnicoNombre || 'Técnico mantenedor', box2X, firmasY + 33);

    // Cargos y números
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);

    // Cargo e Ingeniero nº
    const numColegiado = empData?.ingenieroColegiado || empData?.numTecnicoTitulado || '—';
    doc.text(`Ingeniero nº: ${numColegiado}`, box1X, firmasY + 37);

    // Cargo Técnico
    const numHab = habilitacionTecnico || '—';
    doc.text(`Habilitación nº: ${numHab}`, box2X, firmasY + 37);
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
  },
  empresa?: Record<string, any>
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margen = 20;
  const empData = normalizarDatosEmpresa(empresa || cargaDatosEmpresa());

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
  const empCif = empData?.cif || '-';
  const empDir = empData?.direccion || '-';
  const empLocParts = [empData?.poblacion, empData?.provincia, empData?.cp].filter(p => p && p !== '-');
  const empLoc = empLocParts.length > 0 ? empLocParts.join(', ') : '-';
  const empTel = empData?.telefono || '-';

  // Tarjeta de empresa más grande con logo incluido
  const cardEmpH = 32;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margen, y, pageWidth - margen * 2, cardEmpH, 3, 3, 'FD');
  
  // Logo dentro de la tarjeta (esquina superior derecha)
  try {
    let logoData: string | null = empData?.logoUrl ? await fetchImageToBase64(empData.logoUrl) : null;
    if (!logoData) {
      const storedLogo = localStorage.getItem('firecheck_db_logo');
      if (storedLogo) logoData = storedLogo;
    }
    
    if (logoData) {
      const { base64: logoDataOpt, format } = await optimizarImagenParaPDF(logoData, 800, 0.75);
      const logoProps = doc.getImageProperties(logoDataOpt);
      const maxLogoWidth = 55;
      const maxLogoHeight = 14;
      const logoRatio = logoProps.width / logoProps.height;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
      const logoHeight = logoWidth / logoRatio;
      doc.addImage(logoDataOpt, format, pageWidth - margen - 4 - logoWidth, y + 3, logoWidth, logoHeight);
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
  doc.text(`Tel: ${empTel}  |  RASIC: ${empData?.rasic || '-'}`, margen + 4, y + 25);
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
            const { base64: base64Opt } = await optimizarImagenParaPDF(base64, 800, 0.75);
            imagenesCargadas[(presupuesto.lineas || []).indexOf(l)] = base64Opt;
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

// ============ PDF LISTADO DE REVISIONES MENSUALES ============
export const generarPDFRevisionesMes = async (
  mes: string,
  items: any[],
  _empresa?: Record<string, any>,
  noSave?: boolean
) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const margen = 14;

  // Obtener datos de la empresa principal configurada en Gestión de Empresa
  const empData = normalizarDatosEmpresa();

  // Logo a la derecha - Logotipo oficial de la empresa configurada
  try {
    let logoRaw = empData.logoUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem('firecheck_db_logo') : null) || '/logo.png';
    if (logoRaw) {
      const fetched = await fetchImageToBase64(logoRaw);
      if (fetched) {
        const { base64: logoData, format } = await optimizarImagenParaPDF(fetched, 800, 0.75);
        const logoProps = doc.getImageProperties(logoData);
        const maxLogoWidth = 55;
        const maxLogoHeight = 18;
        const logoRatio = logoProps.width / logoProps.height;
        const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * logoRatio);
        const logoHeight = logoWidth / logoRatio;
        doc.addImage(logoData, format, pageWidth - margen - logoWidth, 10, logoWidth, logoHeight);
      }
    }
  } catch (_e) { }

  // Datos empresa principal (izquierda)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(empData.nombre || 'ABANFOC S.L.', margen, 15);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  let yEmp = 19;

  const linea1 = [
    empData.cif ? `CIF: ${empData.cif}` : '',
    empData.rasic ? `Nº Registro Industrial / RASIC: ${empData.rasic}` : ''
  ].filter(Boolean).join(' | ');
  if (linea1) { doc.text(linea1, margen, yEmp); yEmp += 3.8; }

  const linea2 = [
    empData.direccion,
    [empData.cp || empData.codigoPostal, empData.poblacion || empData.localidad].filter(Boolean).join(' '),
    empData.provincia ? `(${empData.provincia})` : ''
  ].filter(Boolean).join(' - ');
  if (linea2) { doc.text(linea2, margen, yEmp); yEmp += 3.8; }

  const linea3 = [
    empData.telefono ? `Tel: ${empData.telefono}` : '',
    (empData.email || empData.correo) ? `Email: ${empData.email || empData.correo}` : '',
    empData.web ? `Web: ${empData.web}` : ''
  ].filter(Boolean).join(' | ');
  if (linea3) { doc.text(linea3, margen, yEmp); yEmp += 3.8; }

  // Título del reporte
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 20, 20); // Rojo corporativo
  doc.text(`PLANIFICACIÓN DE REVISIONES - ${mes.toUpperCase()}`, margen, 38);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Total centros planificados: ${items.length} | Fecha de emisión: ${fechaHoy}`, margen, 43);

  // Tabla con autoTable - 1 sola fila plana por centro
  const bodyRows = items.map((item, idx) => [
    (idx + 1).toString().padStart(2, '0'),
    (item.centroNombre || '-').replace(/[\r\n]+/g, ' '),
    (item.codigoCentro || '-').replace(/[\r\n]+/g, ' '),
    item.tipoRevision || 'Anual',
    (item.empresaMantenedora || '-').replace(/[\r\n]+/g, ' '),
    (item.ubicacion || '-').replace(/[\r\n]+/g, ' '),
    (item.observaciones || '-').replace(/[\r\n]+/g, ' ')
  ]);

  autoTable(doc, {
    startY: 47,
    margin: { left: margen, right: margen },
    head: [['Nº', 'NOMBRE DEL CENTRO', 'CÓDIGO CENTRO', 'TIPO REVISIÓN', 'EMPRESA MANTENEDORA', 'POBLACIÓN', 'OBSERVACIONES / NOTAS']],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      valign: 'middle',
      overflow: 'hidden',
      textColor: [40, 40, 40]
    },
    headStyles: {
      fillColor: [20, 20, 20],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 95, fontStyle: 'bold' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 42 },
      5: { cellWidth: 32 },
      6: { cellWidth: 'auto' }
    },
    didDrawPage: (data) => {
      // Pie de página
      const pageCount = (doc.internal as any).getNumberOfPages();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(140, 140, 140);
      doc.text(`Salamandra - Sistema de Gestión Contra Incendios`, margen, pageHeight - 8);
      doc.text(`Página ${data.pageNumber} de ${pageCount}`, pageWidth - margen, pageHeight - 8, { align: 'right' });
    }
  });

  if (!noSave) {
    doc.save(`Revisiones_${mes}_${new Date().getFullYear()}.pdf`);
  }

  return doc;
};
