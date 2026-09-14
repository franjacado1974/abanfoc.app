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
