#!/usr/bin/env node
/**
 * VERIFICADOR AUTOMÁTICO DE BLINDAJE INTEGRAL DE FUNCIONALIDADES
 * Se ejecuta antes de cada build/deploy (prebuild).
 * Si alguna regla de blindaje de AGENTS.md se rompe, aborta la compilación con error.
 */

const fs = require('fs');
const path = require('path');

console.log('🛡️ Verificando blindaje integral de todas las funcionalidades del proyecto...');

let errors = [];

// 1. Verificación de RevisionChecklist.tsx
const revChecklistPath = path.join(__dirname, '../src/RevisionChecklist.tsx');
if (!fs.existsSync(revChecklistPath)) {
  errors.push('No se encontró src/RevisionChecklist.tsx');
} else {
  const content = fs.readFileSync(revChecklistPath, 'utf8');

  // a. Autogeneración directa a eq.anomalias
  if (!content.includes('updated.anomalias = resultAnoStr') && !content.includes('updated.anomalias = lineasActuales.join') && !content.includes('evaluarAnomaliasPorFecha')) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece de la asignación incondicional a updated.anomalias en handleCheckChange.');
  }

  // b. Reglas de anomalías de fecha oficial de Extintores y BIEs
  if (!content.includes('- Extintor caducado + de 20 años') || !content.includes('- Extintor necesita retimbrado obligatorio de los 5 años.')) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece del texto reglamentario obligatorio para anomalías de fecha (AGENTS.md REGLA 7).');
  }

  // c. Exclusión de la pregunta de estado final del sistema
  if (!content.includes('esPreguntaEstadoFinal')) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece de la exclusión de la pregunta resumen de estado final en la autogeneración de anomalías.');
  }

  // d. Preservación estricta de espacios y saltos de línea manuales en anomalías
  if (!content.includes('matchEndNewlines') || content.includes('split(/\\r?\\n/).map((l: string) => l.trim()).filter(Boolean)')) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece de la preservación estricta de espacios y saltos de línea manuales en evaluarAnomaliasPorFecha.');
  }
  // e. Modales flotantes de advertencias, retimbrado y mensaje final de 3 segundos
  if (!content.includes('showEquiposSinRevisarModal') || !content.includes('showEquiposFechaInvalidaModal') || !content.includes('showPreguntaRetimbrarModal')) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece de los modales flotantes obligatorios de aviso de equipos/fechas o retimbrado (AGENTS.md REGLA 10).');
  }
  if (!content.includes('Parte finalizado pendiente de supervisar por el responsable')) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece del mensaje de cierre obligatorio "Parte finalizado pendiente de supervisar por el responsable".');
  }
  if (!content.includes('3000')) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece del temporizador de 3 segundos (3000ms) para la permanencia del mensaje final.');
  }
}

// 2. Verificación de los 18 componentes de sistemas
const sistemasDir = path.join(__dirname, '../src/components/RevisionSistemas');
if (!fs.existsSync(sistemasDir)) {
  errors.push('No se encontró el directorio src/components/RevisionSistemas');
} else {
  const files = fs.readdirSync(sistemasDir).filter(f => f.endsWith('.tsx'));
  if (files.length === 0) {
    errors.push('No hay componentes en src/components/RevisionSistemas');
  }

  files.forEach(file => {
    const filePath = path.join(sistemasDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const hasAnomalias = content.includes('Anomalías del equipo:');
    const hasObservaciones = content.includes('Observaciones del equipo:');
    const hasMerged = content.includes('Observaciones y anomalías');

    if (!hasAnomalias) {
      errors.push(`${file} no contiene la casilla separada 'Anomalías del equipo:'.`);
    }
    if (!hasObservaciones) {
      errors.push(`${file} no contiene la casilla separada 'Observaciones del equipo:'.`);
    }
    if (hasMerged) {
      errors.push(`${file} contiene la etiqueta errónea unificada 'Observaciones y anomalías'.`);
    }
  });
}

// 3. Verificación de la maquetación y ordenación en pdfGenerator.ts
const pdfGenPath = path.join(__dirname, '../src/pdfGenerator.ts');
if (!fs.existsSync(pdfGenPath)) {
  errors.push('No se encontró src/pdfGenerator.ts');
} else {
  const content = fs.readFileSync(pdfGenPath, 'utf8');
  if (!content.includes('sistemasExtintores') || !content.includes('sistemasBies') || !content.includes('sistemasDeteccion')) {
    errors.push('CRÍTICO: pdfGenerator.ts carece de la ordenación estricta (Extintores -> BIEs -> Detección -> Resto) en el Certificado PDF.');
  }
}

// 4. Verificación de Partes.tsx (Estado Retimbrando y Luz Roja Parpadeante)
const partesPath = path.join(__dirname, '../src/Partes.tsx');
if (!fs.existsSync(partesPath)) {
  errors.push('No se encontró src/Partes.tsx');
} else {
  const content = fs.readFileSync(partesPath, 'utf8');
  if (!content.includes('Retimbrando') || !content.includes('animate-pulse') || !content.includes('bg-red-600')) {
    errors.push('CRÍTICO: Partes.tsx carece del estado "Retimbrando" o la luz roja parpadeante obligatoria (AGENTS.md REGLA 11).');
  }
}

// 5. Verificación de Sidebar.tsx (Barra de accesos directos sin texto y Modal Flotante de Cierre de Sesión)
const sidebarPath = path.join(__dirname, '../src/components/Sidebar.tsx');
if (fs.existsSync(sidebarPath)) {
  const content = fs.readFileSync(sidebarPath, 'utf8');
  if (!content.includes('showLogoutModal') || !content.includes('¿Cerrar sesión?')) {
    errors.push('CRÍTICO: Sidebar.tsx carece de la ventana flotante de confirmación de cierre de sesión (AGENTS.md REGLA 12).');
  }
  if (!content.includes('APP_VERSION') || !content.includes('/ajustes') || !content.includes('/buzon')) {
    errors.push('CRÍTICO: Sidebar.tsx carece de los accesos directos por icono debajo del número de versión (AGENTS.md REGLA 13).');
  }
}

// 6. Verificación de Reparaciones.tsx (AGENTS.md REGLA 14)
const reparacionesPath = path.join(__dirname, '../src/Reparaciones.tsx');
if (!fs.existsSync(reparacionesPath)) {
  errors.push('No se encontró src/Reparaciones.tsx');
} else {
  const content = fs.readFileSync(reparacionesPath, 'utf8');
  if (!content.includes('REPARACIÓN') || !content.includes('TÉCNICO ASIGNADO') || !content.includes('COMERCIAL') || !content.includes('NOTA')) {
    errors.push('CRÍTICO: Reparaciones.tsx carece de las columnas obligatorias de la tabla (AGENTS.md REGLA 14).');
  }
  if (!content.includes('StickyNote') || !content.includes('animate-ping') || !content.includes('bg-red-600')) {
    errors.push('CRÍTICO: Reparaciones.tsx carece del icono StickyNote con indicador de notificación rojo parpadeante (AGENTS.md REGLA 14).');
  }
  if (!content.includes('subscribeReparaciones') || !content.includes('updateReparacion')) {
    errors.push('CRÍTICO: Reparaciones.tsx carece de la integración de sincronización Firestore.');
  }
}

// 7. Verificación de Instalaciones.tsx (AGENTS.md REGLA 15)
const instalacionesPath = path.join(__dirname, '../src/Instalaciones.tsx');
if (!fs.existsSync(instalacionesPath)) {
  errors.push('No se encontró src/Instalaciones.tsx');
} else {
  const content = fs.readFileSync(instalacionesPath, 'utf8');
  if (!content.includes('INSTALACIÓN') || !content.includes('TÉCNICO ASIGNADO') || !content.includes('COMERCIAL') || !content.includes('NOTA')) {
    errors.push('CRÍTICO: Instalaciones.tsx carece de las columnas obligatorias de la tabla (AGENTS.md REGLA 15).');
  }
  if (!content.includes('StickyNote') || !content.includes('animate-ping') || !content.includes('bg-red-600')) {
    errors.push('CRÍTICO: Instalaciones.tsx carece del icono StickyNote con indicador de notificación rojo parpadeante (AGENTS.md REGLA 15).');
  }
  if (!content.includes('subscribeInstalaciones') || !content.includes('updateInstalacion')) {
    errors.push('CRÍTICO: Instalaciones.tsx carece de la integración de sincronización Firestore.');
  }
}

// 8. Verificación de Observaciones del Técnico en Azul en el Acta PDF (AGENTS.md REGLA 16)
if (fs.existsSync(pdfGenPath)) {
  const content = fs.readFileSync(pdfGenPath, 'utf8');
  if (!content.includes('OBSERVACIONES DEL TÉCNICO') || !content.includes('doc.setTextColor(0, 82, 204)')) {
    errors.push('CRÍTICO: pdfGenerator.ts carece de la impresión de Observaciones del Técnico en color Azul (AGENTS.md REGLA 16).');
  }
}

// 9. Verificación de Lógica del Triángulo de Aviso, Luces Numeradas y Scroll Posicionado (AGENTS.md REGLAS 17 y 18)
if (fs.existsSync(revChecklistPath)) {
  const content = fs.readFileSync(revChecklistPath, 'utf8');
  if (!content.includes("typeof eq.anomalias === 'string' && eq.anomalias.trim() !== ''")) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece de la comprobación estricta de anomalías escritas para el triángulo de aviso (AGENTS.md REGLA 17).');
  }
  if (!content.includes('headerOffset = 160') || (!content.includes('min-w-[22px] h-[22px]') && !content.includes('min-w-[14px] h-[14px]'))) {
    errors.push('CRÍTICO: RevisionChecklist.tsx carece del desfasamiento de scroll de 160px o las luces numeradas (AGENTS.md REGLA 18).');
  }
}

// 10. Verificación de alerta >40 caracteres en campo Ubicación (AGENTS.md REGLA 19)
const eqFormPath = path.join(__dirname, '../src/components/EquipoFormulario.tsx');
if (fs.existsSync(eqFormPath)) {
  const content = fs.readFileSync(eqFormPath, 'utf8');
  if (!content.includes('isUbicacionExcedida') || !content.includes('value.length > 40')) {
    errors.push('CRÍTICO: EquipoFormulario.tsx carece de la alerta en rojo para ubicaciones > 40 caracteres (AGENTS.md REGLA 19).');
  }
}

// 11. Verificación de 1 sola fila y ancho 269mm en Actas PDF (AGENTS.md REGLA 20)
if (fs.existsSync(pdfGenPath)) {
  const content = fs.readFileSync(pdfGenPath, 'utf8');
  if (!content.includes('tableWidth: 269') || !content.includes('data.cell.styles.overflow = \'hidden\'')) {
    errors.push('CRÍTICO: pdfGenerator.ts carece del forzado de 1 sola fila y ancho uniforme de 269mm (AGENTS.md REGLA 20).');
  }
  // 12. Verificación del orden reglamentario de sistemas en Actas (AGENTS.md REGLA 21)
  if (!content.includes('// Orden de sistemas en Actas: 1º EXTINTORES, 2º BOCAS DE INCENDIO (BIE), 3º HIDRANTES, 4º CASETAS') && !content.includes('sistemasOrdenados')) {
    errors.push('CRÍTICO: pdfGenerator.ts carece del orden reglamentario estricto de sistemas (AGENTS.md REGLA 21).');
  }
}

// Resultado de la verificación
if (errors.length > 0) {
  console.error('\n❌ ERROR CRÍTICO DE BLINDAJE INTEGRAL (AGENTS.md):');
  errors.forEach(err => console.error(`  - ${err}`));
  console.error('\nSe ha abortado el build para prevenir publicar versiones con regresiones.\n');
  process.exit(1);
} else {
  console.log('✅ BLINDAJE INTEGRAL VERIFICADO CON ÉXITO: 100% de reglas y salvaguardas validadas.\n');
}


