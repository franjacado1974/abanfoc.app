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

// 5. Verificación de Sidebar.tsx (Barra de accesos directos sin texto, Modal Flotante y Estructura de 7 Categorías)
const sidebarPath = path.join(__dirname, '../src/components/Sidebar.tsx');
if (fs.existsSync(sidebarPath)) {
  const content = fs.readFileSync(sidebarPath, 'utf8');
  if (!content.includes('showLogoutModal') || !content.includes('¿Cerrar sesión?')) {
    errors.push('CRÍTICO: Sidebar.tsx carece de la ventana flotante de confirmación de cierre de sesión (AGENTS.md REGLA 12).');
  }
  if (!content.includes('APP_VERSION') || !content.includes('/ajustes') || !content.includes('/buzon')) {
    errors.push('CRÍTICO: Sidebar.tsx carece de los accesos directos por icono debajo del número de versión (AGENTS.md REGLA 13).');
  }
  if (!content.includes('CATEGORIAS_MENU') || !content.includes('subItems') || !content.includes('ChevronDown')) {
    errors.push('CRÍTICO: Sidebar.tsx carece de la estructura de categorías con submenús desplegables.');
  }
  if (!content.includes('/metodos')) {
    errors.push('CRÍTICO: Sidebar.tsx carece de la sección Métodos (/metodos).');
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
  if (!content.includes('MESES_CONFIG') || !content.includes('activeMonth')) {
    errors.push('CRÍTICO: Reparaciones.tsx carece de la navegación mensual por pestañas y configuración de meses (AGENTS.md REGLA 14).');
  }
  if (!content.includes('ReceiptText') || !content.includes('albaranModalItem')) {
    errors.push('CRÍTICO: Reparaciones.tsx carece del botón o modal para crear albaranes directos (AGENTS.md REGLA 14).');
  }
  if (!content.includes('!r.facturado')) {
    errors.push('CRÍTICO: Reparaciones.tsx carece del filtrado para excluir tareas facturadas (AGENTS.md REGLA 14).');
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
  if (!content.includes('MESES_CONFIG') || !content.includes('activeMonth')) {
    errors.push('CRÍTICO: Instalaciones.tsx carece de la navegación mensual por pestañas y configuración de meses (AGENTS.md REGLA 15).');
  }
  if (!content.includes('ReceiptText') || !content.includes('albaranModalItem')) {
    errors.push('CRÍTICO: Instalaciones.tsx carece del botón o modal para crear albaranes directos (AGENTS.md REGLA 15).');
  }
  if (!content.includes('!i.facturado')) {
    errors.push('CRÍTICO: Instalaciones.tsx carece del filtrado para excluir tareas facturadas (AGENTS.md REGLA 15).');
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

// 13. Verificación de exclusividad de Configuraciones para SuperUsuario (AGENTS.md REGLA 22)
if (fs.existsSync(sidebarPath)) {
  const content = fs.readFileSync(sidebarPath, 'utf8');
  if (content.includes("['super-administrador', 'administrador'].includes(userRole)") && content.includes('/ajustes')) {
    errors.push('CRÍTICO: Sidebar.tsx no debe permitir el menú configuraciones al rol administrador (AGENTS.md REGLA 22).');
  }
  if (!content.includes("['super-administrador', 'superusuario', 'superadministrador'].includes(userRole)")) {
    errors.push('CRÍTICO: Sidebar.tsx carece de la restricción exclusiva de Configuraciones para SuperUsuario (AGENTS.md REGLA 22).');
  }
}

const appPath = path.join(__dirname, '../src/App.tsx');
if (fs.existsSync(appPath)) {
  const content = fs.readFileSync(appPath, 'utf8');
  const matchAjustes = content.match(/<Route\s+path="\/ajustes"[\s\S]*?allowedRoles=\{([^}]+)\}/);
  if (matchAjustes && matchAjustes[1].includes("'administrador'")) {
    errors.push('CRÍTICO: App.tsx permite acceso a /ajustes a usuarios administradores no superusuarios (AGENTS.md REGLA 22).');
  }
  if (!content.includes('path="/ajustes"') || (matchAjustes && !matchAjustes[1].includes("'super-administrador'"))) {
    errors.push('CRÍTICO: App.tsx carece de la ruta protegida /ajustes para super-administrador (AGENTS.md REGLA 22).');
  }
}

// 14. Verificación de Pruebas Técnicas y Ensayos Hidráulicos (AGENTS.md REGLA 25)
const pruebasTecPath = path.join(__dirname, '../src/PruebasTecnicas.tsx');
if (!fs.existsSync(pruebasTecPath)) {
  errors.push('CRÍTICO: No se encontró src/PruebasTecnicas.tsx (AGENTS.md REGLA 25).');
} else {
  const content = fs.readFileSync(pruebasTecPath, 'utf8');
  if (!content.includes("'pruebas_tecnicas'") || !content.includes('onSnapshot')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece de la sincronización en tiempo real con la colección pruebas_tecnicas (AGENTS.md REGLA 25).');
  }
  if (!content.includes('empresaMantenedora') || !content.includes('equipoMedicion') || !content.includes('tipoEquipo')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece de los campos unificados en Datos Generales del Ensayo (AGENTS.md REGLA 25).');
  }
  if (!content.includes('qTotalNum') || !content.includes('q1Num + q2Num')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece del cálculo automático de caudal simultáneo Q1 + Q2 (AGENTS.md REGLA 25).');
  }
  if (!content.includes('handleExportPDF') || !content.includes('Descargar Informe PDF')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece de la generación/descarga de informe PDF oficial (AGENTS.md REGLA 25).');
  }
  if (!content.includes('Recuperar ensayo anterior') && !content.includes('Recuperar ensayos anteriores')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece del desplegable/buscador de ensayos anteriores guardados (AGENTS.md REGLA 25).');
  }

  // 15. Verificación de Aislamiento de Firmas por Empresa y Maquetación (AGENTS.md REGLA 26)
  if (!content.includes('matchedEmpRaw?.selloUrl') && !content.includes('matchedEmpRaw?.ingenieroFirmaUrl')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece del aislamiento estricto de firmas y sellos por empresa (AGENTS.md REGLA 26).');
  }
  if (!content.includes('PRUEBA NO CONFORME.') && !content.includes('PRUEBA CONFORME.')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece de la estructuración en 2 líneas del dictamen en el PDF (AGENTS.md REGLA 26).');
  }
  if (!content.includes('selloX = 105')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece de la posición centrada del sello de empresa (AGENTS.md REGLA 26).');
  }

  // 16. Verificación de Valores Normativos en Ensayos Hidráulicos (AGENTS.md REGLA 27)
  if (!content.includes('caudalMin1Eq: 100') || !content.includes('caudalMin2Eq: 200') || !content.includes('caudalMin1Eq: 500') || !content.includes('caudalMin1Eq: 1000')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece de los valores normativos mínimos de caudal y presión (AGENTS.md REGLA 27).');
  }
  if (!content.includes('UNE 23500:2021 y Real Decreto 513/2017 de 22 de mayo') || !content.includes('UNE 23500:2021 y R.I.P.CI.')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece de las referencias normativas obligatorias (AGENTS.md REGLA 27).');
  }
  if (!content.includes('formatFechaEnsayo')) {
    errors.push('CRÍTICO: PruebasTecnicas.tsx carece de la función de formateo de fecha DD/MM/YYYY (AGENTS.md REGLA 27).');
  }
}

// 17. Verificación de Edición, Membrete Oficial y Firmas en Certificados (AGENTS.md REGLA 28)
const certsPath = path.join(__dirname, '../src/Certificados.tsx');
if (!fs.existsSync(certsPath)) {
  errors.push('CRÍTICO: No se encontró src/Certificados.tsx (AGENTS.md REGLA 28).');
} else {
  const certContent = fs.readFileSync(certsPath, 'utf8');
  if (!certContent.includes('handleOpenEditModal') || !certContent.includes('editingCert')) {
    errors.push('CRÍTICO: Certificados.tsx carece del soporte de edición completa de certificados (AGENTS.md REGLA 28).');
  }
  if (!certContent.includes('canvasTecnicoRef') || !certContent.includes('firmaTecnico')) {
    errors.push('CRÍTICO: Certificados.tsx carece del canvas digital para la firma del técnico mantenedor (AGENTS.md REGLA 28).');
  }
}

if (fs.existsSync(pdfGenPath)) {
  const pdfContent = fs.readFileSync(pdfGenPath, 'utf8');
  if (!pdfContent.includes("cargaDatosEmpresa('ABANFOC S.L.')") && !pdfContent.includes('ABANFOC S.L.')) {
    errors.push('CRÍTICO: pdfGenerator.ts carece del forzado permanente de ABANFOC S.L. en certificados oficiales (AGENTS.md REGLA 28).');
  }
  const certIdx = pdfContent.indexOf('export const generarCertificadoPDF');
  const certSlice = certIdx !== -1 ? pdfContent.slice(certIdx) : '';
  if (!certSlice.includes('box1X = 22') || !certSlice.includes('box2X = 113') || certSlice.includes('Conformidad Cliente')) {
    errors.push('CRÍTICO: pdfGenerator.ts carece de la distribución de 2 firmas oficiales o contiene la casilla cliente en el Certificado Oficial (AGENTS.md REGLA 28).');
  }
}

// 18. Verificación de Papelera de Reciclaje y Retención de 100 Días (AGENTS.md REGLA 29)
const papeleraPath = path.join(__dirname, '../src/Papelera.tsx');
if (!fs.existsSync(papeleraPath)) {
  errors.push('CRÍTICO: No se encontró src/Papelera.tsx (AGENTS.md REGLA 29).');
} else {
  const papContent = fs.readFileSync(papeleraPath, 'utf8');
  if (!papContent.includes('subscribePapelera') || !papContent.includes('restaurarElementoPapelera')) {
    errors.push('CRÍTICO: Papelera.tsx carece de las funciones de suscripción y restauración (AGENTS.md REGLA 29).');
  }
  if (!papContent.includes('100') || !papContent.includes('calcularDiasRestantes')) {
    errors.push('CRÍTICO: Papelera.tsx carece del cálculo y visualización de retención de 100 días (AGENTS.md REGLA 29).');
  }
}

if (fs.existsSync(sidebarPath)) {
  const sideContent = fs.readFileSync(sidebarPath, 'utf8');
  if (!sideContent.includes('/papelera') || !sideContent.includes('Trash2')) {
    errors.push('CRÍTICO: Sidebar.tsx carece del acceso directo a la Papelera con icono Trash2 (AGENTS.md REGLA 29).');
  }
}

const firebasePath = path.join(__dirname, '../src/firebase.tsx');
if (fs.existsSync(firebasePath)) {
  const fbContent = fs.readFileSync(firebasePath, 'utf8');
  if (!fbContent.includes('moverAPapelera') || !fbContent.includes('cleanUndefinedForFirestore')) {
    errors.push('CRÍTICO: firebase.tsx carece de moverAPapelera o sanitización cleanUndefinedForFirestore (AGENTS.md REGLA 29).');
  }
}

// 19. Verificación de 7 Categorías y Submenús en el Menú Lateral (AGENTS.md REGLA 30)
if (fs.existsSync(sidebarPath)) {
  const sideContent = fs.readFileSync(sidebarPath, 'utf8');
  if (!sideContent.includes('CATEGORIAS_MENU') || !sideContent.includes('subItems') || !sideContent.includes('ChevronDown')) {
    errors.push('CRÍTICO: Sidebar.tsx carece de la estructura CATEGORIAS_MENU o subItems reglamentarios (AGENTS.md REGLA 30).');
  }
  if (!sideContent.includes('title: \'Tutoriales\'') && !sideContent.includes('title: "Tutoriales"')) {
    errors.push('CRÍTICO: Sidebar.tsx carece del menú oficial con título Tutoriales (AGENTS.md REGLA 30 y 31).');
  }
}

// 20. Verificación del Módulo de Tutoriales y Soporte OneDrive (AGENTS.md REGLA 31)
const metodosPath = path.join(__dirname, '../src/Metodos.tsx');
if (!fs.existsSync(metodosPath)) {
  errors.push('CRÍTICO: No se encontró src/Metodos.tsx para el módulo de Tutoriales (AGENTS.md REGLA 31).');
} else {
  const metContent = fs.readFileSync(metodosPath, 'utf8');
  if (!metContent.includes('tutoriales_metodos') || !metContent.includes('getEmbedInfo')) {
    errors.push('CRÍTICO: Metodos.tsx carece de persistencia en tutoriales_metodos o del analizador getEmbedInfo (AGENTS.md REGLA 31).');
  }
  if (!metContent.includes('1drv.ms') || !metContent.includes('Abrir y Reproducir en OneDrive')) {
    errors.push('CRÍTICO: Metodos.tsx carece del soporte e interfaz específica para enlaces de Microsoft OneDrive (AGENTS.md REGLA 31).');
  }
  if (!metContent.includes('handleOpenCreateModal') || !metContent.includes('handleConfirmDelete')) {
    errors.push('CRÍTICO: Metodos.tsx carece de las funciones completas de creación, edición y eliminación de tutoriales (AGENTS.md REGLA 31).');
  }
}

// 21. Verificación del Módulo de Calendario Principal (AGENTS.md REGLA 32)
const calPath = path.join(__dirname, '../src/Calendario.tsx');
if (!fs.existsSync(calPath)) {
  errors.push('CRÍTICO: No se encontró src/Calendario.tsx (AGENTS.md REGLA 32).');
} else {
  const calContent = fs.readFileSync(calPath, 'utf8');
  if (!calContent.includes('h-screen') || !calContent.includes('max-h-screen')) {
    errors.push('CRÍTICO: Calendario.tsx carece del ajuste de altura completa h-screen / max-h-screen (AGENTS.md REGLA 32).');
  }
  if (!calContent.includes('handleDrop') || (!calContent.includes('draggable') && !calContent.includes('draggable={true}'))) {
    errors.push('CRÍTICO: Calendario.tsx carece del sistema de arrastrar y soltar (Drag & Drop) (AGENTS.md REGLA 32).');
  }
  if (!calContent.includes('bg-amber-100') || !calContent.includes('bg-sky-100') || !calContent.includes('bg-red-100')) {
    errors.push('CRÍTICO: Calendario.tsx carece del esquema oficial de colores (Dorado, Azul, Rojo) (AGENTS.md REGLA 32).');
  }
  if (!calContent.includes('selectedEvento') || !calContent.includes('selectedEvento.comercial')) {
    errors.push('CRÍTICO: Calendario.tsx carece del modal de detalles o del campo Comercial (AGENTS.md REGLA 32).');
  }
  if (!calContent.includes('mostrarFinSemana') || !calContent.includes('grid-cols-5')) {
    errors.push('CRÍTICO: Calendario.tsx carece del conmutador o soporte para ocultar fin de semana (AGENTS.md REGLA 32).');
  }
  if (!calContent.includes('getFestivosBarcelona') || !calContent.includes('bg-emerald-600') || !calContent.includes('bg-slate-200')) {
    errors.push('CRÍTICO: Calendario.tsx carece de la integración automática de festivos de Barcelona y España (AGENTS.md REGLA 32).');
  }
}
if (fs.existsSync(sidebarPath)) {
  const sideContent = fs.readFileSync(sidebarPath, 'utf8');
  if (!sideContent.includes('/calendario')) {
    errors.push('CRÍTICO: Sidebar.tsx carece de la ruta /calendario debajo de INICIO (AGENTS.md REGLA 32).');
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


