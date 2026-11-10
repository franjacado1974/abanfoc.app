import { addPresupuesto, getArticulos, type Articulo, type Presupuesto, type PresupuestoLinea } from '../firebase';
import { extraerReporteAnomalias, type EquipoAnomaliaReporte } from '../pdfReporteAnomaliasGenerator';

/**
 * Normaliza una cadena de texto para comparaciones léxicas sin acentos ni signos.
 */
function normalizarTexto(txt: string): string {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

/**
 * Busca en el catálogo de artículos el artículo más afín para subsanar una anomalía.
 */
export function encontrarArticuloMasCercano(
  anomalia: string,
  equipo: { codigo: string; tipo: string; sistemaNombre: string; ubicacion: string },
  articulos: Articulo[]
): Articulo | null {
  if (!articulos || articulos.length === 0) return null;

  const anomNorm = normalizarTexto(anomalia);
  const tipoNorm = normalizarTexto(equipo.tipo);
  const sistNorm = normalizarTexto(equipo.sistemaNombre);

  // Palabras clave de acción y componente
  const esRetimbrado = anomNorm.includes('retimbr') || anomNorm.includes('hidraulic') || anomNorm.includes('hidrostatic');
  const esCaducadoSustituir = anomNorm.includes('caducad') || anomNorm.includes('sustitu') || anomNorm.includes('nuevo');
  const esManometro = anomNorm.includes('manometr');
  const esManguera = anomNorm.includes('manguer') || anomNorm.includes('tramo');
  const esSenal = anomNorm.includes('senal') || anomNorm.includes('cartel') || anomNorm.includes('fotolumin');
  const esBateria = anomNorm.includes('bateri') || anomNorm.includes('acumulad');
  const esLuminaria = anomNorm.includes('luminari') || anomNorm.includes('emergenc') || anomNorm.includes('led') || anomNorm.includes('tubo');
  const esDetector = anomNorm.includes('detector') || anomNorm.includes('optico') || anomNorm.includes('termico');
  const esPulsador = anomNorm.includes('pulsador');
  const esSirena = anomNorm.includes('siren');

  // Tipo y capacidad
  const esPolvo = tipoNorm.includes('polvo') || sistNorm.includes('polvo');
  const esCO2 = tipoNorm.includes('co2') || tipoNorm.includes('dioxido') || sistNorm.includes('co2');
  const esBie = sistNorm.includes('bie') || tipoNorm.includes('bie');
  const esBie25 = esBie && (tipoNorm.includes('25') || anomNorm.includes('25'));
  const esBie45 = esBie && (tipoNorm.includes('45') || anomNorm.includes('45'));
  const es6kg = tipoNorm.includes('6') || tipoNorm.includes('6kg');
  const es2kg = tipoNorm.includes('2') || tipoNorm.includes('2kg');
  const es5kg = tipoNorm.includes('5') || tipoNorm.includes('5kg');
  const es9kg = tipoNorm.includes('9') || tipoNorm.includes('9kg');

  let mejorArticulo: Articulo | null = null;
  let maxScore = 0;

  for (const art of articulos) {
    const artNombreNorm = normalizarTexto(art.nombre);
    const artTipoNorm = normalizarTexto(art.tipo || '');
    const artFamiliaNorm = normalizarTexto(art.familia || '');
    const fullArt = `${artNombreNorm} ${artTipoNorm} ${artFamiliaNorm}`;

    let score = 0;

    // Coincidencia para Retimbrados / Pruebas Hidráulicas
    if (esRetimbrado) {
      if (fullArt.includes('retimbr') || fullArt.includes('hidraulic') || fullArt.includes('hidrostatic')) {
        score += 25;
        if (esBie && fullArt.includes('bie')) score += 15;
        if (esPolvo && fullArt.includes('polvo')) score += 15;
        if (esCO2 && (fullArt.includes('co2') || fullArt.includes('dioxido'))) score += 15;
        if (es6kg && fullArt.includes('6')) score += 10;
        if (es2kg && fullArt.includes('2')) score += 10;
        if (es5kg && fullArt.includes('5')) score += 10;
      }
    }

    // Coincidencia para Caducados (> 20 años) / Sustituciones
    if (esCaducadoSustituir) {
      if (esBie && esManguera) {
        if (fullArt.includes('manguer') || fullArt.includes('tramo')) {
          score += 25;
          if (esBie25 && fullArt.includes('25')) score += 15;
          if (esBie45 && fullArt.includes('45')) score += 15;
        }
      } else if (sistNorm.includes('extintor')) {
        if (fullArt.includes('extintor')) {
          score += 20;
          if (esPolvo && fullArt.includes('polvo')) score += 15;
          if (esCO2 && (fullArt.includes('co2') || fullArt.includes('dioxido'))) score += 15;
          if (es6kg && fullArt.includes('6')) score += 10;
          if (es2kg && fullArt.includes('2')) score += 10;
          if (es5kg && fullArt.includes('5')) score += 10;
          if (es9kg && fullArt.includes('9')) score += 10;
        }
      }
    }

    // Coincidencia para manómetros
    if (esManometro && fullArt.includes('manometr')) score += 30;

    // Coincidencia para mangueras / lanzas
    if (esManguera && (fullArt.includes('manguer') || fullArt.includes('lanza'))) score += 25;

    // Coincidencia para señalización
    if (esSenal && (fullArt.includes('senal') || fullArt.includes('cartel') || fullArt.includes('fotolumin'))) score += 30;

    // Coincidencia para baterías
    if (esBateria && (fullArt.includes('bateri') || fullArt.includes('acumulad'))) score += 30;

    // Coincidencia para alumbrado de emergencia
    if (esLuminaria && (fullArt.includes('emergenc') || fullArt.includes('luminari') || fullArt.includes('led'))) score += 25;

    // Coincidencia para detección
    if (esDetector && fullArt.includes('detector')) score += 30;
    if (esPulsador && fullArt.includes('pulsador')) score += 30;
    if (esSirena && fullArt.includes('siren')) score += 30;

    // Búsqueda por palabras significativas
    const anomPalabras = anomNorm.split(/\s+/).filter(w => w.length > 3 && !['para', 'debe', 'anos', 'esta', 'este', 'buen', 'estado', 'segun'].includes(w));
    for (const p of anomPalabras) {
      if (artNombreNorm.includes(p)) score += 4;
    }

    if (score > maxScore && score >= 15) {
      maxScore = score;
      mejorArticulo = art;
    }
  }

  return mejorArticulo;
}

/**
 * Genera un presupuesto en estado Borrador a partir de las anomalías detectadas en una revisión.
 */
export async function generarPresupuestoBorradorDesdeAnomalias(
  cliente: any,
  centro: any,
  sistemasDelCentro: any[],
  equiposTodos: any[],
  numeroMantenimiento: string | number,
  usuarioNombre?: string
): Promise<{ success: boolean; presupuesto?: Presupuesto; anomalias?: EquipoAnomaliaReporte[]; message: string; anomaliasCount: number }> {
  // 1. Extraer reporte de anomalías
  const anomalias: EquipoAnomaliaReporte[] = extraerReporteAnomalias(sistemasDelCentro, equiposTodos);

  if (anomalias.length === 0) {
    return {
      success: false,
      message: 'No se han detectado anomalías en los equipos revisados. No es necesario generar presupuesto de reparación.',
      anomaliasCount: 0
    };
  }

  // 2. Obtener catálogo de artículos
  let articulos: Articulo[] = [];
  try {
    const stored = localStorage.getItem('firecheck_db_articulos');
    if (stored) {
      articulos = JSON.parse(stored);
    }
    if (!articulos || articulos.length === 0) {
      articulos = await getArticulos();
      if (articulos.length > 0) {
        localStorage.setItem('firecheck_db_articulos', JSON.stringify(articulos));
      }
    }
  } catch (err) {
    console.warn('Error cargando artículos del catálogo:', err);
  }

  // 3. Crear las líneas de presupuesto
  const lineas: PresupuestoLinea[] = [];

  for (let idx = 0; idx < anomalias.length; idx++) {
    const item = anomalias[idx];
    const artCoincidente = encontrarArticuloMasCercano(item.anomalia, item, articulos);

    if (artCoincidente) {
      const pUnit = typeof artCoincidente.precioVenta === 'number' ? artCoincidente.precioVenta : parseFloat(String(artCoincidente.precioVenta || 0)) || 0;
      lineas.push({
        id: `linea_anom_${Date.now()}_${idx}`,
        tipo: 'articulo',
        codigo: artCoincidente.codigo || `ART-${idx + 1}`,
        concepto: artCoincidente.nombre,
        descripcion: `Subsanación en ${item.sistemaNombre} - Eq. ${item.codigo} (${item.ubicacion}): ${item.anomalia}`,
        cantidad: 1,
        precioUnidad: pUnit,
        descuento: 0,
        subtotal: pUnit,
        capitulo: item.sistemaNombre
      });
    } else {
      // Línea manual para que el responsable la complete o refine
      lineas.push({
        id: `linea_anom_${Date.now()}_${idx}`,
        tipo: 'manual',
        concepto: `Reparación: ${item.anomalia}`,
        descripcion: `Equipo ${item.codigo} (${item.tipo}) en ${item.ubicacion} - Sistema: ${item.sistemaNombre}`,
        cantidad: 1,
        precioUnidad: 0,
        descuento: 0,
        subtotal: 0,
        capitulo: item.sistemaNombre
      });
    }
  }

  // 4. Calcular importes totales
  const subtotal = lineas.reduce((acc, l) => acc + (l.subtotal || 0), 0);
  const iva = Math.round(subtotal * 0.21 * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;

  // 5. Estructurar el presupuesto en estado Borrador
  const centroNombre = centro?.nombre || 'Centro';
  const clienteNombre = cliente?.nombre || cliente?.razonSocial || 'Cliente';
  const hoyStr = new Date().toISOString().slice(0, 10);
  const validezStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const presupuestoData: Presupuesto = {
    id: '',
    titulo: `Reparación anomalías - Mantenimiento ${numeroMantenimiento} (${centroNombre})`,
    clienteId: cliente?._docId || cliente?.id || '',
    nombreCliente: clienteNombre,
    centroId: centro?._docId || centro?.id || '',
    fechaCreacion: hoyStr,
    fechaValidez: validezStr,
    estado: 'Borrador',
    lineas,
    subtotal,
    descuentoPorcentaje: 0,
    descuentoImporte: 0,
    iva,
    total,
    notas: `Presupuesto borrador generado automáticamente a partir de las ${anomalias.length} anomalías detectadas en la revisión de mantenimiento nº ${numeroMantenimiento}.`,
    usuarioRealizado: usuarioNombre || 'Administración',
    tipoTrabajo: 'Reparación',
    anomaliasReporte: anomalias
  };

  try {
    const saved = await addPresupuesto(presupuestoData);

    // Actualizar localStorage para reflejo instantáneo en la vista de presupuestos
    try {
      const presList = JSON.parse(localStorage.getItem('firecheck_db_presupuestos') || '[]');
      presList.unshift(saved);
      localStorage.setItem('firecheck_db_presupuestos', JSON.stringify(presList));
    } catch { /* ignore */ }

    return {
      success: true,
      presupuesto: saved,
      anomalias,
      message: `Presupuesto borrador ${saved.numeroPresupuesto || ''} generado con éxito con ${lineas.length} partidas.`,
      anomaliasCount: anomalias.length
    };
  } catch (error: any) {
    console.error('Error al guardar presupuesto borrador:', error);
    return {
      success: false,
      message: `Error al guardar el presupuesto en Firestore: ${error?.message || String(error)}`,
      anomaliasCount: anomalias.length
    };
  }
}
