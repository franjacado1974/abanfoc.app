import { Droplets, BellRing, Wind, FileBox } from 'lucide-react';
import type { SistemaCategoria } from '../types/models';

export const getIconForSistema = (nombre: string): string | React.ElementType => {
  try {
    const savedCats = localStorage.getItem('firecheck_db_sistemas_categorias');
    if (savedCats) {
      const categorias: SistemaCategoria[] = JSON.parse(savedCats);
      const cat = categorias.find(c => {
        const a = (c.nombre || '').toLowerCase().trim();
        const b = (nombre || '').toLowerCase().trim();
        if (a === b) return true;
        const isMonoxA = a.includes('monoxido') || a.includes('monox');
        const isMonoxB = b.includes('monoxido') || b.includes('monox');
        if (isMonoxA || isMonoxB) return isMonoxA && isMonoxB;
        const isAspA = a.includes('aspiraci') || a.includes('aspirac');
        const isAspB = b.includes('aspiraci') || b.includes('aspirac');
        if (isAspA || isAspB) return isAspA && isAspB;
        const isCocinaA = a.includes('cocina') || a.includes('campana');
        const isCocinaB = b.includes('cocina') || b.includes('campana');
        if (isCocinaA || isCocinaB) return isCocinaA && isCocinaB;
        const isGasA = (a.includes('gas') || (a.includes('extinci') && !a.includes('extintor'))) && !isCocinaA;
        const isGasB = (b.includes('gas') || (b.includes('extinci') && !b.includes('extintor'))) && !isCocinaB;
        if (isGasA || isGasB) return isGasA && isGasB;
        return a.includes(b) || b.includes(a);
      });
      if (cat?.imagenUrl) {
        return cat.imagenUrl;
      }
    }
  } catch {}
  const n = nombre.toLowerCase();
  if (n.includes('extintor')) return '/extintor-icon.png';
  if (n.includes('bie')) return '/bie-icon.png';
  if (n.includes('hidrante') || n.includes('agua') || n.includes('rociador')) return Droplets;
  if (n.includes('deteccion') || n.includes('detección') || n.includes('alarma')) return BellRing;
  if (n.includes('gas') || n.includes('co2')) return Wind;
  return FileBox;
};

export interface ExtintorAlertas {
  caducados20: number;
  retimbres5: number;
}

export function parseFechaEquipo(val: any): Date | null {
  if (!val || typeof val !== 'string' || val === '-') return null;
  const clean = val.trim().toLowerCase();

  // 1. Meses en texto español (ej. "enero 2006", "ene 2006", "febrero-2005", etc.)
  const meses: Record<string, number> = {
    enero: 0, ene: 0,
    febrero: 1, feb: 1,
    marzo: 2, mar: 2,
    abril: 3, abr: 3,
    mayo: 4, may: 4,
    junio: 5, jun: 5,
    julio: 6, jul: 6,
    agosto: 7, ago: 7,
    septiembre: 8, sep: 8, setiembre: 8,
    octubre: 9, oct: 9,
    noviembre: 10, nov: 10,
    diciembre: 11, dic: 11
  };

  for (const [mName, mIdx] of Object.entries(meses)) {
    if (clean.includes(mName)) {
      const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        return new Date(Number(yearMatch[1]), mIdx, 1);
      }
    }
  }

  // 2. MM/YYYY o MM-YYYY (ej. 01/2006, 1/2006, 01-2006)
  const myMatch = clean.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (myMatch) {
    const mes = Number(myMatch[1]) - 1;
    const anio = Number(myMatch[2]);
    if (mes >= 0 && mes <= 11) {
      return new Date(anio, mes, 1);
    }
  }

  // 3. YYYY-MM o YYYY/MM (ej. 2006-01, 2006/01, 2006-1)
  const ymMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (ymMatch) {
    const anio = Number(ymMatch[1]);
    const mes = Number(ymMatch[2]) - 1;
    if (mes >= 0 && mes <= 11) {
      return new Date(anio, mes, 1);
    }
  }

  // 4. DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const dia = Number(dmyMatch[1]);
    const mes = Number(dmyMatch[2]) - 1;
    const anio = Number(dmyMatch[3]);
    return new Date(anio, mes, dia);
  }

  // 5. YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    return new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]));
  }

  // 6. MM/YY o MM-YY (ej. 01/06 -> 2006)
  const myShort = clean.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (myShort) {
    const mes = Number(myShort[1]) - 1;
    let anio = Number(myShort[2]);
    anio = anio <= 50 ? 2000 + anio : 1900 + anio;
    if (mes >= 0 && mes <= 11) {
      return new Date(anio, mes, 1);
    }
  }

  // 7. Solo año YYYY (ej. 2006)
  if (/^\d{4}$/.test(clean)) {
    return new Date(Number(clean), 0, 1);
  }

  // 8. Contiene un año de 4 dígitos en cualquier parte
  const anyYear = clean.match(/\b(19\d{2}|20\d{2})\b/);
  if (anyYear) {
    return new Date(Number(anyYear[1]), 0, 1);
  }

  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

export function esSistemaExtintores(sistOrId?: any): boolean {
  if (!sistOrId) return false;
  const str = (
    typeof sistOrId === 'string'
      ? sistOrId
      : ((sistOrId.id || '') + ' ' + (sistOrId.tipo || '') + ' ' + (sistOrId.familia || '') + ' ' + (sistOrId.nombre || ''))
  ).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Excluir cualquier otro sistema
  if (str.includes('bie') || str.includes('boca') || str.includes('hidrante') || 
      str.includes('rociador') || str.includes('sprinkler') || str.includes('deteccion') || 
      str.includes('gas') || str.includes('cocina') || str.includes('campana') || 
      str.includes('puerta') || str.includes('bomba') || str.includes('abastecimiento') || 
      str.includes('alumbrado') || str.includes('exutorio') || str.includes('fuente')) {
    return false;
  }
  return str.includes('extintor');
}

export function esSistemaBies(sistOrId?: any): boolean {
  if (!sistOrId) return false;
  const str = (
    typeof sistOrId === 'string'
      ? sistOrId
      : ((sistOrId.id || '') + ' ' + (sistOrId.tipo || '') + ' ' + (sistOrId.familia || '') + ' ' + (sistOrId.nombre || ''))
  ).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Excluir cualquier otro sistema
  if (str.includes('extintor') || str.includes('hidrante') || 
      str.includes('rociador') || str.includes('sprinkler') || str.includes('deteccion') || 
      str.includes('gas') || str.includes('cocina') || str.includes('campana') || 
      str.includes('puerta') || str.includes('bomba') || str.includes('abastecimiento') || 
      str.includes('alumbrado') || str.includes('exutorio') || str.includes('fuente')) {
    return false;
  }
  return str.includes('bie') || str.includes('boca');
}

export function esEquipoExtintor(eq: any, sist?: any): boolean {
  if (!eq) return false;

  // 1. Si se proporciona sistema explícito, mandar estrictamente por el sistema
  if (sist) {
    if (!esSistemaExtintores(sist)) return false;
    return true;
  }

  // 2. Comprobar identificadores de sistema del equipo
  const sId = (eq.sistemaId || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sNom = (eq.sistemaNombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sTipo = (eq.sistemaTipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sFam = (eq.familia || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sysAll = `${sId} ${sNom} ${sTipo} ${sFam}`;

  // Si el sistema del equipo es BIE u otro sistema, NUNCA es extintor
  if (sysAll.includes('bie') || sysAll.includes('boca') || sysAll.includes('hidrante') || 
      sysAll.includes('rociador') || sysAll.includes('sprinkler') || sysAll.includes('deteccion') || 
      sysAll.includes('gas') || sysAll.includes('cocina') || sysAll.includes('campana') || 
      sysAll.includes('puerta') || sysAll.includes('bomba') || sysAll.includes('abastecimiento') || 
      sysAll.includes('alumbrado') || sysAll.includes('exutorio') || sysAll.includes('fuente')) {
    return false;
  }

  if (sysAll.includes('extintor')) return true;

  // 3. Comprobar nombre/tipo propio del equipo
  const eqTexto = ((eq.nombre || '') + ' ' + (eq.tipo || '') + ' ' + (eq.clase || '') + ' ' + (eq.categoria || '')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (eqTexto.includes('bie') || eqTexto.includes('boca')) return false;
  if (eqTexto.includes('extintor')) return true;

  // Si tiene un sistemaId asignado y no dice extintor, no es extintor
  if (sId && !sId.includes('extintor')) return false;

  // Solo como último recurso si es agente clásico de extintor portátil sin pertenecer a otro sistema
  if (eqTexto.includes('polvo abc') || eqTexto.includes('co2 2') || eqTexto.includes('co2 5') || eqTexto.includes('dioxido de carbono')) {
    return true;
  }

  return false;
}

export function calcularAlertasExtintores(equipos: any[], sist?: any): ExtintorAlertas {
  let caducados20 = 0;
  let retimbres5 = 0;
  const today = new Date();

  for (const eq of equipos) {
    if (!eq) continue;
    if (!esEquipoExtintor(eq, sist)) continue;

    let fabStr = eq.fechaFabricacion || eq.fabricacion || eq.item_fab || eq.fecha_fabricacion || eq.fechafab || eq.añofab || eq.anofab || eq.año || eq.ano || '';
    let retStr = eq.ultimoRetimbre || eq.pruebaHidraulica || eq.retimbre || eq.item_ret || eq.pruebahidraulica || '';
    if (!fabStr || !retStr) {
      for (const k of Object.keys(eq)) {
        const kLower = k.toLowerCase();
        if (kLower.includes('revision') || kLower.includes('inspeccion') || kLower.includes('proxim')) continue;
        if (!fabStr && (kLower.includes('fabric') || kLower.includes('fechafab') || kLower.includes('fab') || kLower.includes('año') || kLower.includes('ano'))) {
          fabStr = eq[k];
        }
        if (!retStr && (kLower.includes('retimbre') || kLower.includes('hidra') || kLower.includes('ph'))) {
          retStr = eq[k];
        }
      }
    }

    const dFab = parseFechaEquipo(fabStr);
    const dRet = parseFechaEquipo(retStr);

    // 1. Caducidad >= 20 años
    if (dFab) {
      let diffYears = today.getFullYear() - dFab.getFullYear();
      if (today.getMonth() < dFab.getMonth() || (today.getMonth() === dFab.getMonth() && today.getDate() < dFab.getDate())) {
        diffYears--;
      }
      if (diffYears >= 20) {
        caducados20++;
      }
    }

    // 2. Retimbre >= 5 años
    const refDate = dRet || dFab;
    if (refDate) {
      let diffYears = today.getFullYear() - refDate.getFullYear();
      if (today.getMonth() < refDate.getMonth() || (today.getMonth() === refDate.getMonth() && today.getDate() < refDate.getDate())) {
        diffYears--;
      }
      if (diffYears >= 5) {
        retimbres5++;
      }
    }
  }

  return { caducados20, retimbres5 };
}

export interface BieAlertas {
  caducados20: number;
  pruebasHidraulicas5: number;
}

export function esEquipoBie(eq: any, sist?: any): boolean {
  if (!eq) return false;

  // 1. Si se proporciona sistema explícito, mandar estrictamente por el sistema
  if (sist) {
    if (!esSistemaBies(sist)) return false;
    return true;
  }

  // 2. Comprobar identificadores de sistema del equipo
  const sId = (eq.sistemaId || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sNom = (eq.sistemaNombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sTipo = (eq.sistemaTipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sFam = (eq.familia || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sysAll = `${sId} ${sNom} ${sTipo} ${sFam}`;

  // Si el sistema es extintor u otro sistema, NUNCA es BIE
  if (sysAll.includes('extintor') || sysAll.includes('hidrante') || 
      sysAll.includes('rociador') || sysAll.includes('sprinkler') || sysAll.includes('deteccion') || 
      sysAll.includes('gas') || sysAll.includes('cocina') || sysAll.includes('campana') || 
      sysAll.includes('puerta') || sysAll.includes('bomba') || sysAll.includes('abastecimiento') || 
      sysAll.includes('alumbrado') || sysAll.includes('exutorio') || sysAll.includes('fuente')) {
    return false;
  }

  if (sysAll.includes('bie') || sysAll.includes('boca')) return true;

  // 3. Comprobar nombre/tipo propio del equipo
  const eqTexto = ((eq.nombre || '') + ' ' + (eq.tipo || '') + ' ' + (eq.clase || '') + ' ' + (eq.categoria || '')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (eqTexto.includes('extintor')) return false;
  if (eqTexto.includes('bie') || eqTexto.includes('boca de incendio')) return true;

  // Si tiene un sistemaId asignado y no es BIE, NO es BIE
  if (sId && !sId.includes('bie') && !sId.includes('boca')) return false;

  return false;
}

const BIE_FAB_KEYS = ['zBErDpaiUREiF2grWzCb', 'item_1781948908692', 'fechaFabricacion', 'fabricacion', 'fechafab', 'añofab', 'anofab', 'año', 'ano'];
const BIE_RET_KEYS = ['4I3N5St3fpkUuIrTuvOI', 'item_1781948939436', 'pruebaHidraulica', 'ultimoRetimbre', 'retimbre', 'pruebahidraulica', 'ph'];

export function calcularAlertasBies(equipos: any[], sist?: any): BieAlertas {
  let caducados20 = 0;
  let pruebasHidraulicas5 = 0;
  const today = new Date();

  for (const eq of equipos) {
    if (!eq) continue;
    if (!esEquipoBie(eq, sist)) continue;

    // Comprobar anomalías registradas como fuente directa
    const anomStr = ((eq.anomalias || '') + ' ' + (eq.observaciones || '') + ' ' + (eq.item_1782067098182 || '') + ' ' + (eq.bXDq6G1z8xCQYzV6m0Mg || '')).toLowerCase();
    let anomCaducado = false;
    let anomPH = false;
    if (anomStr.includes('bie caducado') || anomStr.includes('caducado + de 20') || anomStr.includes('caducado + 20')) {
      anomCaducado = true;
    }
    if (anomStr.includes('prueba hidráulica obligatoria') || anomStr.includes('prueba hidraulica obligatoria') || anomStr.includes('prueba hidráulica') || anomStr.includes('prueba hidraulica')) {
      anomPH = true;
    }

    let fabStr = '';
    for (const k of BIE_FAB_KEYS) {
      if (eq[k] && typeof eq[k] === 'string' && eq[k].trim() !== '') {
        fabStr = eq[k];
        break;
      }
    }
    let retStr = '';
    for (const k of BIE_RET_KEYS) {
      if (eq[k] && typeof eq[k] === 'string' && eq[k].trim() !== '') {
        retStr = eq[k];
        break;
      }
    }

    if (!fabStr || !retStr) {
      for (const k of Object.keys(eq)) {
        const kLower = k.toLowerCase();
        if (kLower.includes('revision') || kLower.includes('inspeccion') || kLower.includes('proxim') || kLower.includes('actualiz') || kLower.includes('update')) continue;
        if (!fabStr && (kLower.includes('fabric') || kLower.includes('fechafab') || kLower.includes('fab') || kLower.includes('año') || kLower.includes('ano'))) {
          fabStr = eq[k];
        }
        if (!retStr && (kLower.includes('hidra') || kLower.includes('prueba') || kLower.includes('ph') || kLower.includes('retimbre'))) {
          retStr = eq[k];
        }
      }
    }

    const dFab = parseFechaEquipo(fabStr);
    const dRet = parseFechaEquipo(retStr);

    let isCad20 = anomCaducado;
    if (dFab) {
      let diffYears = today.getFullYear() - dFab.getFullYear();
      if (today.getMonth() < dFab.getMonth() || (today.getMonth() === dFab.getMonth() && today.getDate() < dFab.getDate())) {
        diffYears--;
      }
      if (diffYears >= 20) isCad20 = true;
    }

    let isPH5 = anomPH;
    const refDate = dRet || dFab;
    if (refDate) {
      let diffYears = today.getFullYear() - refDate.getFullYear();
      if (today.getMonth() < refDate.getMonth() || (today.getMonth() === refDate.getMonth() && today.getDate() < refDate.getDate())) {
        diffYears--;
      }
      if (diffYears >= 5) isPH5 = true;
    }

    if (isCad20) caducados20++;
    if (isPH5) pruebasHidraulicas5++;
  }

  return { caducados20, pruebasHidraulicas5 };
}



