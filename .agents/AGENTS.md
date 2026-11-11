# Reglas del Proyecto (AGENTS.md)

# ⚠️ MANDATO SUPREMO: NO SALTARSE LAS REGLAS ⚠️

Este archivo contiene reglas y directrices críticas de comportamiento y de arquitectura específicas para este espacio de trabajo. Cualquier agente de IA que trabaje en esta base de código **DEBE** respetar y cumplir estas directrices para evitar regresiones de funcionalidad.

---

## 1. Reglas Generales de No Interferencia
- **NO SALTARSE LAS REGLAS**: Directriz suprema e inviolable. NINGUNA regla, salvaguarda, directriz de estilo o restricción (incluyendo la prohibición estricta de deploy no solicitado, no tocar código ajeno o no modificar documentación) puede ser ignorada, omitida, saltada o relajada bajo ningún concepto, circunstancia o inercia de turnos anteriores.
- **No tocar funcionalidades no solicitadas**: No se deben modificar ni refactorizar componentes o secciones del código que no estén directamente involucrados en la tarea solicitada.
- **Mantener la documentación**: No modificar `documentacion.md` ni alterar sus descripciones.
- **Evitar Errores de Compilación Estrictos (TS6133)**: No declarar variables, funciones o importaciones no utilizadas (ej. iconos de `lucide-react` importados sin usar), ya que el compilador TypeScript está configurado en modo estricto y bloquea la compilación (`npm run build`).
- **Prohibición Estricta de Despliegue No Solicitado**: Queda terminantemente prohibido ejecutar despliegues a producción (`npm run deploy`, `firebase deploy`) a menos que el usuario lo solicite de forma explícita y directa en su mensaje actual. La inercia o haberlo pedido en turnos anteriores NUNCA autoriza a realizar un deploy si el usuario no lo ha ordenado expresamente en su última petición.

---

## 2. Flujo de Trabajo y Estados de los Partes
- **Estados del Parte**:
  - `Abierto`: El parte es visible y editable tanto en escritorio como en la app móvil del técnico.
  - `Pre-Cerrado`: La revisión ha sido pre-cerrada (firmada). Permite el aviso de aviso de fechas pero sin bloquear la ejecución.
  - `Cerrado`: La revisión está finalizada y es de **solo lectura** en escritorio. Este parte **no debe aparecer** en el listado del técnico en el dispositivo móvil.
- **Acciones y Botones en Escritorio (RevisionChecklist.tsx)**:
  - Si el parte **no** está cerrado: Debe mostrarse un botón de color **negro** que diga **"Cerrar"** (cuyo estado pasa a `Cerrado`).
  - Si el parte **está** cerrado: Debe mostrarse un botón de color **amarillo-naranja** que diga **"Re-abrir"** (cuyo estado regresa a `Abierto`, permitiendo de nuevo la edición por parte del técnico en su app móvil).
- **Indicador Visual en Panel (Partes.tsx)**:
  - En la columna acciones de la tabla, los partes con estado `'Cerrado'` deben mostrar un indicador visual redondo de color **negro brillante** (luz negra).

---

## 3. Comportamiento del Formulario y Gestión Automática de Anomalías
- **Auto-generación de anomalías**:
  - Si una pregunta de revisión es respondida de forma no correcta (valor `false` en checkbox, o `"No"`, `"NO CORRECTO"`, `"INCORRECTO"`, `"NO CONFORME"` en dropdowns), la pregunta seguida de su respuesta debe agregarse automáticamente al campo de anomalías del equipo.
  - Formato del texto autogenerado: `- [Pregunta], NO CORRECTO.` (empezando con un guion medio y espacio, y finalizando con un punto).
  - Multiples fallos se desglosarán en **líneas independientes** (`\n`).
  - Si la pregunta vuelve a marcarse como correcta, su línea respectiva debe ser eliminada automáticamente.
- **Permitir Escritura Manual**:
  - El usuario debe poder escribir libremente en el cuadro de anomalías del equipo. La lógica de handleCheckChange debe **saltarse la autogeneración** si el cambio ocurre directamente en el campo de texto manual de anomalías o notas, preservando así cualquier texto introducido manualmente y uniéndolo con saltos de línea.

---

## 4. Formato de PDF (pdfGenerator.ts)
- **Separación de anomalías en el PDF**:
  - En todos los sistemas y equipos, las anomalías no deben aparecer amontonadas. Se procesa la cadena de anomalías dividiendo por comas que preceden a un número de checklist (usando la expresión regular `/,\s*(?=\d+\.\d+)/`) además de saltos de línea.
  - Cada fragmento de anomalía obtenido de esta forma debe ser impreso en una **nueva línea independiente** con su correspondiente viñeta y formato de párrafo en el archivo PDF generado.

---

## 5. Optimización Obligatoria de Imágenes en PDFs (pdfGenerator.ts)
- **Compresión Estricta de Imágenes en PDFs**:
  - ABSOLUTAMENTE TODAS las imágenes agregadas a cualquier PDF (Firmas, Logos, Sellos, Iconos de Sistemas y FOTOS de Equipos/Anomalías `eq.fotos`) DEBEN procesarse mediante `optimizarImagenParaPDF(imageData, maxWidth, quality)` ANTES de insertarse con `doc.addImage()`.
  - Ancho máximo para firmas: 600px en formato JPEG calidad 0.7.
  - Ancho máximo para logos, sellos, fotos de equipos/anomalías y artículos de presupuesto: 800px en calidad 0.75.
  - Queda ESTRICTAMENTE PROHIBIDO incluir fotos de equipos o anomalías en su resolución original de cámara sin pasar por `optimizarImagenParaPDF()`. Esto evita que los PDFs pesen megabytes y asegura que no superen los 200-400 KB.

---

## 6. Blindaje Inviolable de Autogeneración de Anomalías y Cuadros Independientes
- **Asignación Incondicional en handleCheckChange (RevisionChecklist.tsx)**:
  - La autogeneración de la línea `- [Pregunta], NO CORRECTO.` en `handleCheckChange` DEBE apuntar **siempre e incondicionalmente a `updated.anomalias`**.
  - NUNCA se debe condicionar la autogeneración a la existencia o búsqueda de un `notasKey` dentro del array de la plantilla.
- **Dos Cuadros Separados por Equipo en los 18 Sistemas**:
  - En la parte inferior de cada equipo en los 18 componentes de sistemas (`src/components/RevisionSistemas/*.tsx`), DEBEN mantenerse de forma PERMANENTE e INDEPENDIENTE dos cuadros de texto:
    1. **"Anomalías del equipo:"** (apunta a `eq.anomalias`, resalta en **ROJO** `bg-red-50 border-2 border-red-400 text-red-800` si contiene texto o fallos).
    2. **"Observaciones del equipo:"** (apunta a `eq.observaciones`, resalta en **AZUL** `bg-blue-50 border-2 border-blue-400 text-blue-800` si contiene texto).
  - Queda ESTRICTAMENTE PROHIBIDO unificar o fusionar estos campos en un solo campo llamado "Observaciones y anomalías".

---

## 7. Reglas Inviolables para Anomalías y Avisos Automáticos de Fechas (Extintores y BIEs)
- **Extintores con Fecha de Fabricación ≥ 20 años**:
  - Texto exacto obligatorio en `eq.anomalias`: `- Extintor caducado + de 20 años, se debe sustituir por equipo nuevo.`
- **Extintores con Último Retimbre / Prueba Hidráulica ≥ 5 años**:
  - Texto exacto obligatorio en `eq.anomalias`: `- Extintor necesita retimbrado obligatorio de los 5 años.`
- **BIEs con Fecha de Fabricación ≥ 20 años**:
  - Texto exacto obligatorio en `eq.anomalias`: `- BIE caducado + de 20 años, se debe sustituir tramo de manguera según normativa.`
- **BIEs con Prueba Hidráulica ≥ 5 años**:
  - Texto exacto obligatorio en `eq.anomalias`: `- BIE necesita realizar prueba hidráulica obligatoria cada 5 años.`
- **Aviso de Proximidad en Extintores (Observaciones del Equipo `eq.observaciones`)**:
  - **Condición**: Extintor a **3 meses o menos** para el próximo retimbrado de 5 años ($\ge 57$ y $< 60$ meses desde `dateRet || dateFab`), o a **3 meses o menos** para cumplir 20 años desde su fabricación ($\ge 237$ y $< 240$ meses desde `dateFab`).
  - **Texto exacto obligatorio en `eq.observaciones`**: `Se informa de fecha próxima a operación obligatoria del equipo. Posible retimbrado o sustitución en el  próximo mantenimiento.` (ubicado en `TEXTO_AVISO_PROXIMIDAD_EXTINTOR`).
  - **Independencia de Fechas**: El cómputo de proximidad de retimbrado **no debe depender** de que exista fecha de fabricación informada.
  - **Parser Universal de Fechas (`parseFechaUniversal`)**: Soporte obligatorio y tolerante a múltiples formatos españoles (`MM/YYYY`, `DD/MM/YYYY`, texto de meses en español, `YYYY-MM`, etc.).
  - **Preservación Estricta**: Al igual que en anomalías, respeta y preserva íntegramente los textos manuales, teclas Espacio y Enter. Si la fecha se actualiza quedando fuera del rango de proximidad, se retira limpiamente el aviso sin borrar notas manuales.
  - **Análisis de Partes Nuevos y Existentes**: Evaluado y persistido automáticamente al abrir o sincronizar cualquier parte (antiguo o nuevo), tanto en el estado de `RevisionChecklist.tsx` como en el rastreo preventivo de `Partes.tsx`.
- **Recuperación Automática y Preservación**:
  - Al abrir o guardar un parte, el sistema evaluará automáticamente todos los equipos. Si superan los plazos o están en rango de proximidad, insertará los textos correspondientes en `eq.anomalias` y `eq.observaciones` sin borrar el texto manual existente.

---

## 8. Maquetación Inviolable del PDF Certificado (pdfGenerator.ts)
- **Posición de Cabecera**: El título principal del PDF Certificado inicia en `y = 18`.
- **Ordenación Estricta de Sistemas**:
  - **Columna Izquierda (`col0`)**:
    1. **Primero**: Extintores (`sistemasExtintores`).
    2. **Segundo**: BIEs (`sistemasBies`).
    3. **Tercero**: Detección / Incendios, Humos y Aspiración (`sistemasDeteccion`).
  - **Columna Derecha (`col1`)**:
    - **El resto de equipos del centro** (`sistemasResto`).

---

## 9. Blindaje Inviolable de Preservación de Espacios y Saltos de Línea Manuales en Anomalías
- **Preservación Estricta de Texto Manual en `evaluarAnomaliasPorFecha` (RevisionChecklist.tsx)**:
  - Al dividir `rawAnom` por líneas (`split(/\r?\n/)`), queda **ESTRICTAMENTE PROHIBIDO** aplicar `.map(l => l.trim()).filter(Boolean)` a la división inicial de líneas.
  - Se debe capturar explícitamente `matchEndNewlines` para preservar la tecla **Enter**.
  - Se deben evaluar las líneas de fecha comprobando `l.trim()` individualmente sin mutar el texto original de la línea, preservando la tecla **Espacio** al escribir palabras.

---

## 10. Blindaje Inviolable de Modales Flotantes y Mensaje Final de Cierre (RevisionChecklist.tsx)
- **Modales Flotantes en Lugar de Alertas Nativa `alert()`**:
  - `showEquiposSinRevisarModal`: Ventana flotante cuando quedan equipos sin revisar (opciones *"Volver a la revisión"* y *"Finalizar parte"*).
  - `showEquiposFechaInvalidaModal`: Ventana flotante cuando hay fechas desactualizadas (opciones *"Volver al parte"* y *"Finalizar"*).
  - `showPreguntaRetimbrarModal`: Ventana flotante con la pregunta *"¿Se retiran equipos para retimbrar en esta revisión?"* (opciones *"Sí"* y *"No"*).
- **Mensaje de Cierre y Permanencia**:
  - Al finalizar las firmas y sincronización, se despliega la pantalla desenfocada con el texto exacto: **`"Parte finalizado pendiente de supervisar por el responsable"`**.
  - La tarjeta debe mantenerse en pantalla durante **3 segundos exactos (3000 ms)** antes de navegar a la lista de partes (`navigate(-1)`).

---

## 11. Blindaje Inviolable de Estado Retimbrando, Luz Roja Parpadeante Independiente y Confirmación de Devolución en 2 Pasos (Partes.tsx)
- **Luz Roja Parpadeante Independiente al Lado del Estado**:
  - Si el usuario responde "Sí" a la pregunta de retimbrado, el parte registra `equiposRetirados: true`.
  - En la tabla de partes (`Partes.tsx`), la bola **ROJA PARPADEANTE** (`bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse`) DEBE mostrarse **al lado** de la bola de estado del parte (`tieneRetimbrePendiente(parte)`), permaneciendo visible cuando el estado es `Finalizado` (azul), `Pre-Cerrado` (verde) y también cuando pasa a `Cerrado` (negro), hasta que se confirme la devolución de los extintores.
- **Modal en 2 Pasos al Hacer Clic en la Bola Roja (`parteDevolucionRetimbre`)**:
  - Al hacer clic en la bola roja, se abre una ventana modal preguntando *"¿Ya se han devuelto los extintores que se retiraron para retimbrar?"* (**"Sí"** / **"No"**).
  - Si se selecciona **"Sí"**, solicita confirmación definitiva (`pasoConfirmacionRetimbre === 2`) y, al confirmar (`confirmarDevolucionRetimbre`), elimina por completo la bola roja actualizando `localStorage` y Firestore.
- **Filtro de Estado "Retimbrando"**:
  - El desplegable de filtro de estado debe incorporar la opción **Retimbrando** para filtrar todos los partes con equipos retirados pendientes de devolver (incluidos los que ya estén en estado `Cerrado`).

---

## 12. Blindaje Inviolable de Modal Flotante de Cierre de Sesión (Sidebar.tsx y DashboardTecnico.tsx)
- **Prohibición de `confirm()`**:
  - Queda prohibido usar la alerta nativa `confirm()` al hacer clic en *"Cerrar Sesión"*.
  - Debe utilizarse la ventana flotante moderna `showLogoutModal` con `backdrop-blur-sm`, icono de Power en rojo y botones estilizados *"Sí, cerrar sesión"* y *"Cancelar"*.

---

## 13. Blindaje Inviolable de Iconos sin Texto en Menú Lateral (Sidebar.tsx)
- **Barra de Accesos Directos por Icono**:
  - Los accesos de **Buzón** (`Inbox`), **Configuraciones** (`Settings`) y **Cerrar Sesión** (`Power`) DEBEN ubicarse exclusivamente debajo del número de versión (`APP_VERSION`) como botones de icono **sin texto**.
  - Queda estrictamente prohibido volver a listar la opción *"Configuraciones"* o *"Buzón"* en el listado de texto navegable principal del menú lateral.

---

## 14. Blindaje Inviolable del Módulo Reparaciones y Averías (Reparaciones.tsx)
- **Cabecera de Tabla Obligatoria**:
  - DEBE mantenerse la estructura de columnas: `REPARACIÓN` - `LUGAR` - `TÉCNICO ASIGNADO` - `COMERCIAL` - `ESTADO` - `NOTA` - `ACCIONES`.
- **Insignias y Colores de Estado Reglamentarios**:
  - `Pendiente`: Gris (`bg-slate-100 text-slate-700 border-slate-300`).
  - `En curso`: Amarillo con efecto pulsante (`bg-amber-100 text-amber-800 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)] animate-pulse`).
  - `Parado`: Rojo (`bg-red-100 text-red-800 border-red-300 shadow-[0_0_8px_rgba(239,68,68,0.25)]`).
  - `Finalizado`: Verde (`bg-emerald-100 text-emerald-800 border-emerald-300`).
- **Navegación Mensual por 12 Pestañas con Colores Estacionales (`MESES_CONFIG`)**:
  - Barra superior de 12 pestañas (`Enero` a `Diciembre`) con desplazamiento horizontal (`overflow-x-auto scrollbar-none`).
  - Pestaña activa por defecto: mes en curso (`MESES[new Date().getMonth()]`).
  - Cada mes cuenta con su paleta de colores/degradados estacionales (`MESES_CONFIG`), con botón activo elevado (`scale-[1.02] shadow-md`) y distintivos numéricos de conteo de tareas registradas por mes (`badgeActive` y `badgeInactive`).
  - Determinación y filtrado dinámico de mes mediante `getItemMonth` y `getMonthFromDateStr` a partir de `item.fecha`, `item.mes` o `item.fechaCreacion`.
- **Tarjetas de Estadísticas Reactivas del Mes Activo**:
  - Panel superior con 5 tarjetas métricas: `Total Tareas`, `Pendientes`, `En curso`, `Parados` y `Finalizados`, calculadas exclusivamente sobre las tareas del mes seleccionado que no estén facturadas.
- **Insignia de Fecha con Icono Calendario en la Columna Principal**:
  - En la primera columna (`REPARACIÓN`), debajo del nombre, DEBE mostrarse la fecha en formato `DD/MM/YYYY` acompañada del icono `Calendar` en rojo (`w-3 h-3 text-red-500`) dentro de una insignia gris estilizada (`bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 text-[11px] font-semibold text-slate-500`).
- **Generación Directa de Albarán (`ReceiptText`) y Vinculación Bidireccional**:
  - En la columna `ACCIONES`, DEBE incluirse el botón con el icono `ReceiptText` ("Crear Albarán").
  - **Indicador de Albarán Asociado**: Si la tarea ya posee un albarán vinculado (`item.albaranId`), el icono cambia a color verde esmeralda (`text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50`) con tooltip indicativo `Albarán creado (ALB-XX-XXX) - Clic para generar otro`. Si no tiene albarán asociado, se muestra en azul (`text-slate-600 hover:text-blue-600 hover:bg-blue-50`).
  - **Modal Flotante de Creación de Albarán (`albaranModalItem`)**:
    - Incluye tarjeta superior de resumen en azul (`bg-blue-50/70 border border-blue-200/80`) con el nombre de la tarea, fecha formateada, lugar y técnico asignado.
    - Campos obligatorios y autocompletados: Empresa Mantenedora, Cliente (autoseleccionado según coincidencia del centro/lugar), Centro (filtrado reactivamente por cliente), Técnico asignado (emparejado automáticamente), Concepto (precargado con el nombre de la reparación), Descripción (precargada con notas u observaciones) e Importe (€ sin IVA).
    - Generación automática del código correlativo `ALB-YY-XXX` según el año actual.
    - Vinculación cruzada en Firestore: guarda el albarán con `reparacionId: repDocId` y actualiza la tarea de reparación con `albaranId: generatedId`.
- **Exclusión de Tareas Facturadas y Sincronización Automática**:
  - Las tareas marcadas con `facturado: true` (`!r.facturado`) se excluyen automáticamente del filtrado mensual de tareas activas para evitar saturación visual.
  - Al cambiar el estado de facturación en el módulo de Albaranes (`toggleFacturado`), el estado `facturado: nextFacturado` DEBE sincronizarse de forma inmediata en la tarea de reparación correspondiente (`reparacionId`) en Firestore y LocalStorage.
- **Notas Notificables e Indicador Rojo Parpadeante con Modal Rápido**:
  - La columna `NOTA` debe contener el icono `StickyNote`. Si existe texto registrado, DEBE mostrarse un **punto de notificación rojo parpadeante** con efecto de onda (`animate-ping`) sobre el icono y fondo ámbar (`bg-amber-100 text-amber-900 border-amber-300`).
  - Al pulsar el botón, DEBE abrirse un modal flotante rápido (`notaModalItem`) con `backdrop-blur-sm`, cabecera oscura (`bg-slate-900`), textarea ámbar (`bg-amber-50/30`), botón para "Borrar nota" y botón "Guardar Nota", actualizando al instante Firestore y LocalStorage sin obligar a abrir el formulario general de edición.
- **Persistencia Dual Inmediata (LocalStorage + Firestore)**:
  - Todo cambio (creación, edición, notas, eliminación o albarán) actualiza de inmediato el almacenamiento local `firecheck_db_reparaciones` para latencia cero en la interfaz, sincronizándose simultáneamente con Firestore mediante `subscribeReparaciones`, `addReparacion`, `updateReparacion` y `deleteReparacion`.

---

## 15. Blindaje Inviolable del Módulo Instalaciones (Instalaciones.tsx)
- **Cabecera de Tabla Obligatoria**:
  - DEBE mantenerse la estructura de columnas: `INSTALACIÓN` - `LUGAR` - `TÉCNICO ASIGNADO` - `COMERCIAL` - `ESTADO` - `NOTA` - `ACCIONES`.
- **Insignias y Colores de Estado Reglamentarios**:
  - Mismo esquema obligatorio: `Pendiente` (Gris), `En curso` (Amarillo con `animate-pulse`), `Parado` (Rojo), `Finalizado` (Verde).
- **Navegación Mensual por 12 Pestañas con Colores Estacionales (`MESES_CONFIG`)**:
  - Barra de 12 meses (`Enero` a `Diciembre`) con desplazamiento horizontal idéntica a Reparaciones, con mes activo por defecto del sistema y paleta individual de degradados estacionales.
  - Filtrado y asignación automática por mes (`getItemMonth`, `getMonthFromDateStr`).
- **Tarjetas de Estadísticas Reactivas del Mes Activo**:
  - Panel con 5 tarjetas métricas (`Total Tareas`, `Pendientes`, `En curso`, `Parados`, `Finalizados`) calculadas sobre las instalaciones del mes activo no facturadas.
- **Insignia de Fecha con Icono Calendario en la Columna Principal**:
  - En la primera columna (`INSTALACIÓN`), debajo del nombre, DEBE mostrarse la fecha en formato `DD/MM/YYYY` acompañada del icono `Calendar` en rojo (`w-3 h-3 text-red-500`) dentro de una insignia gris (`bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 text-[11px] font-semibold text-slate-500`).
- **Generación Directa de Albarán (`ReceiptText`) y Vinculación Bidireccional**:
  - En la columna `ACCIONES`, botón `ReceiptText` ("Crear Albarán") con indicador en verde esmeralda si ya posee `albaranId` y en azul si está pendiente.
  - Modal flotante con resumen azul, autocompletado de Empresa, Cliente, Centro, Técnico, Concepto, Descripción e Importe, numeración correlativa `ALB-YY-XXX`, guardado en `albaranes` con `instalacionId` y actualización en `instalaciones` con `albaranId`.
- **Exclusión de Tareas Facturadas y Sincronización Automática**:
  - Filtrado mensual que excluye instalaciones con `facturado: true` (`!item.facturado`).
  - Sincronización bidireccional desde `Albaranes.tsx` (`toggleFacturado` actualiza `updateInstalacion(albaranToUpdate.instalacionId, { facturado: nextFacturado })`).
- **Notas Notificables e Indicador Rojo Parpadeante con Modal Rápido**:
  - Mismo comportamiento: icono `StickyNote`, punto rojo parpadeante (`animate-ping`), fondo ámbar y modal flotante rápido de edición de nota con `backdrop-blur-sm`.
- **Persistencia Dual Inmediata (LocalStorage + Firestore)**:
  - Actualización síncrona en `firecheck_db_instalaciones` para respuesta instantánea en pantalla y sincronización en tiempo real vía `subscribeInstalaciones`, `addInstalacion`, `updateInstalacion` y `deleteInstalacion`.

---

## 16. Blindaje Inviolable de Observaciones del Técnico en Azul en el Acta PDF (pdfGenerator.ts)
- **Color Azul Obligatorio para Observaciones del Técnico**:
  - En la sección "OBSERVACIONES DEL TÉCNICO" de la última página del Acta PDF (`src/pdfGenerator.ts`), el texto anotado (`obsTexto`) DEBE imprimirse incondicionalmente en **color AZUL** (`doc.setTextColor(0, 82, 204)`).
  - Queda prohibido volver a imprimir este texto en tonos grises o negros.

---

## 17. Blindaje Inviolable de Visibilidad del Triángulo de Aviso en Acordeón de Sistemas (RevisionChecklist.tsx)
- **Visibilidad Estricta por Contenido de Texto**:
  - El icono del triángulo de aviso (`AlertTriangle`) en la cabecera del menú acordeón del sistema sólo debe mostrarse si el campo `anomalias` (o claves dinámicas de anomalía) de algún equipo del sistema contiene **texto real escrito** (`typeof eq.anomalias === 'string' && eq.anomalias.trim() !== ''`).
  - Si el campo de anomalías de los equipos del sistema está limpio/vacío, el triángulo DEBE desaparecer por completo del acordeón.

---

## 18. Blindaje Inviolable de Luces Indicadoras Numeradas y Scroll Posicionado a Equipos (RevisionChecklist.tsx y RevisionSistemas/*.tsx)
- **Luces Circulares Numeradas de 14px / 22px**:
  - Las luces de estado de los equipos en el acordeón del sistema DEBEN ser botones/elementos circulares (`min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold text-white`).
  - Muestran el número correlativo del equipo (`1`, `2`, `3`, `4`...) centrado en blanco.
  - Fondo **Verde** (`bg-green-500`) si está revisado hoy (OK); **Amarillo** (`bg-amber-500`) si la fecha no coincide o está pendiente.
- **Navegación y Scroll Posicionado con Offset de 160px**:
  - Al pulsar en cualquier luz numerada, DEBE abrirse/desplegarse el acordeón del sistema (`setOpenSistemas`) y realizarse un scroll suave (*smooth scroll*) con un desfasamiento (*offset*) de **160px** (`elementPosition + window.pageYOffset - 160`) y la clase `scroll-mt-44`.
  - Esto garantiza que la tarjeta del equipo y su cabecera (número, código, fechas y checks) queden completamente visibles holgadamente por debajo de la cabecera pegajosa del menú acordeón sin que nada la tape.

---

## 19. Blindaje Inviolable del Límite Visual de 40 Caracteres en el Campo Ubicación (RevisionSistemas/*.tsx y EquipoFormulario.tsx)
- **Alerta Visual en Rojo a partir del Carácter 41**:
  - En los 20 componentes de sistemas (`src/components/RevisionSistemas/*.tsx`) y en el modal de equipos (`src/components/EquipoFormulario.tsx`), el campo de Ubicación / Nivel planta y ubicación / Cobertura DEBE evaluarse en tiempo real.
  - Si la longitud del texto ingresado es superior a 40 caracteres (`valor.length > 40`), el campo DEBE resaltar inmediatamente en **ROJO** (`bg-red-50 border-2 border-red-500 text-red-700 font-bold focus:border-red-600 focus:ring-2 focus:ring-red-500/20`).
  - Al borrar y quedar en $\le 40$ caracteres, recupera instantáneamente su color y estilo normal.

---

## 20. Blindaje Inviolable de 1 Sola Fila Estricta y Ancho 100% de Página (269 mm) en Tablas de Actas PDF (pdfGenerator.ts)
- **1 Sola Fila Obligatoria por Celda**:
  - En todas las tablas del Acta PDF, las celdas del cuerpo DEBEN forzarse a 1 sola fila plana eliminando cualquier retorno de carro (`replace(/[\r\n]+/g, ' ')`), aplicando `overflow: 'hidden'` y **Auto-fit dinámico de tamaño de fuente** (`doc.getTextWidth`) para que jamás se creen 2 líneas ni se amontonen textos.
- **Ancho Total Uniforme de 269 mm**:
  - Absolutamente todas las tablas de todos los sistemas en el Acta PDF DEBEN tener un ancho total idéntico al de extintores (**269 mm** de margen a margen). En tablas con menos columnas, la columna de Ubicación/Descriptiva debe expandirse dinámicamente para absorber el 100% del área imprimible.

---

## 21. Blindaje Inviolable del Orden Reglamentario de Sistemas en Actas PDF (pdfGenerator.ts)
- **Jerarquía Obligatoria de Aparición**:
  - En el documento Acta PDF, el orden de los sistemas con equipos instalados DEBE ser estrictamente:
    1. **1.º EXTINTORES** (`weight = 10`)
    2. **2.º BOCAS DE INCENDIO (BIE)** (`weight = 20`)
    3. **3.º HIDRANTES** (`weight = 30`)
    4. **4.º CASETAS / DOTACIÓN** (`weight = 40`)
    5. **RESTO DE SISTEMAS**: Grupos de bombeo/abastecimiento (50-53), Rociadores (60), Detección/Aspiración/CO (70-72), Extinción gas/cocina (80-81), Alumbrado (85), Puertas RF (90)...
  - Si el centro carece de alguno de estos sistemas, el generador pasa automáticamente al siguiente.

---

## 22. Blindaje Inviolable de Acceso y Visibilidad Exclusiva de Configuraciones para SuperUsuario
- **Acceso Exclusivo a SuperUsuario**:
  - El acceso a las rutas `/ajustes` y `/configuracion-datos` DEBE estar restringido exclusivamente a usuarios con rol de SuperUsuario (`'super-administrador'`, `'superusuario'`, `'superadministrador'`).
  - Los usuarios con rol de Técnico (`'tecnico'`), Administrador (`'administrador'`), Editor (`'editor'`) o Visualizador (`'visualizador'`) NO deben tener acceso ni ver el acceso directo de Configuraciones.
- **Icono de Configuraciones en Sidebar**:
  - En `Sidebar.tsx` (tanto en la barra expandida como colapsada y móvil), el botón de acceso directo a Configuraciones (`/ajustes`) sólo debe renderizarse condicionado a roles de SuperUsuario (`['super-administrador', 'superusuario', 'superadministrador'].includes(userRole)`).

---

## 23. Blindaje Inviolable de Nomenclatura y Formato de Versiones de la Aplicación
- **Estructura Obligatoria**:
  - Toda versión de la aplicación DEBE seguir estrictamente el patrón: `V.DD.MM.YY.LETRA` (Día, Mes, Año en 2 dígitos, y Letra correlativa de versión, ej. `V.31.08.26.A`).
- **Sincronización Dual**:
  - La versión debe mantenerse sincronizada de forma idéntica y simultánea en:
    1. `src/constants.ts` (`export const APP_VERSION = 'V.DD.MM.YY.LETRA';`)
    2. `public/version.json` (`{ "version": "V.DD.MM.YY.LETRA" }`)

---

## 24. Blindaje Inviolable del Conteo y Tipos de Equipos en Certificado PDF (pdfGenerator.ts)
- **Capacidades en Litros y Kilos Exclusivas de Extintores**:
  - La detección por expresiones regulares de pesos y capacidades (`\d+\s*KG`, `\d+\s*L`, `litros`, `kilos`) y la concatenación de capacidades DEBEN restringirse **estricta y exclusivamente a Extintores** (`if (esExtintor)`).
  - Queda ESTRICTAMENTE PROHIBIDO que textos, notas o números de otros sistemas (como Hidrantes, Detectores, Bombas, Puertas RF, etc.) generen sufijos de capacidad como `2 L.` o `Kg.`.
- **Conteo y Tipo Real de Hidrantes y Demás Sistemas**:
  - En **Hidrantes** (y resto de sistemas), el tipo DEBE obtenerse del campo de la tabla o plantilla (`eq.tipo` o campos dinámicos). Si no está definido, se usa el nombre del sistema (`"Hidrante"`) en vez del genérico `"Equipo"`.
  - Todos los equipos del mismo tipo deben agruparse sumando exactamente su número total de unidades revisadas en una sola línea limpia.

---

## 25. Blindaje Inviolable del Módulo de Pruebas Técnicas y Ensayos Hidráulicos (PruebasTecnicas.tsx)
- **Persistencia en Firestore y Colección `pruebas_tecnicas`**:
  - Queda estrictamente prohibido alterar o eliminar la colección `pruebas_tecnicas` y su sincronización en tiempo real vía `onSnapshot`.
- **Estructura Unificada de Datos Generales del Ensayo**:
  - Los campos de Empresa Mantenedora, Equipo de Medición, Equipo a Medir, Cliente, Centro, Fecha/Hora y Técnico deben mantenerse permanentemente unificados en el bloque superior de Datos Generales sin dependencias de plantillas dinámicas externas.
- **Cálculo Automático de Caudal Simultáneo y Doble Ensayo**:
  - En la Prueba 2 (dos equipos simultáneos), si el técnico introduce el caudal medido en cada equipo por separado ($Q_1$ y $Q_2$), el sistema DEBE calcular automáticamente la suma combinada real de la red: $Q_{\text{total}} = Q_1 + Q_2$.
  - La evaluación de conformidad debe validar tanto presiones mínimas de servicio ($P_1, P_2 \ge P_{\text{mín}}$) como caudales individuales y simultáneos ($Q_1 \ge Q_{\text{mín1}}$, $Q_{\text{total}} \ge Q_{\text{mín2}}$).
- **Desplegable Buscador de Ensayos Anteriores**:
  - En la tarjeta principal de la vista de menú (`selectedView === 'menu'`) y en el bloque superior del formulario, DEBE mantenerse de forma permanente el desplegable buscador interactivo para cargar en 1 solo clic cualquier ensayo previo almacenado en Firebase con su Curva $P-Q$.
- **Generación y Descarga de Informe PDF Oficial**:
  - El botón «Descargar Informe PDF» debe generar el documento institucional con cabecera técnica, tablas de mediciones, análisis de variación, observaciones en azul y bloque de firmas.

---

## 26. Blindaje Inviolable del Informe Técnico de Ensayos Hidráulicos y Personalización Dinámica (PruebasTecnicas.tsx)
- **Aislamiento Estricto de Firmas y Sellos por Empresa**:
  - Cada empresa mantenedora (ABANFOC S.L., ARC Seguretat, Segupro, Abanfoc en colaboración con Segupro, Sertec Espacio, etc.) utiliza **exclusivamente su propio sello y firma** (`selloUrl`, `ingenieroFirmaUrl`) registrado en su ficha de Firebase.
  - Queda ESTRICTAMENTE PROHIBIDO prestar sellos o firmas de una empresa a otra mediante fallbacks cruzados. Si una empresa no tiene sello asignado, no debe mostrar el de otra empresa.
- **Cabecera Institucional Limpia en PDF**:
  - La cabecera superior en PDF debe incluir únicamente el título técnico, la referencia normativa y `Empresa mantenedora: [Nombre Empresa]`, sin logotipos, versiones de software ni fechas de emisión redundantes.
- **Bloque de Firmas y Sello Oficial**:
  - El sello y firma oficial de la empresa debe situarse centrado en la hoja (`x = 105 mm`, `y = currentY - 1`) acompañando al bloque de texto del técnico a la izquierda.
- **Posicionamiento Reglamentario de Etiquetas en Gráfico P-Q (Pantalla y PDF)**:
  - La etiqueta de la **Presión Estática** ($P_0, Q=0$) DEBE situarse permanentemente **por encima** del punto azul.
  - Las etiquetas de la **Prueba 1** (1 equipo) y **Prueba 2** (2 equipos simultáneos) DEBEN situarse permanentemente **por debajo** de los puntos correspondientes y de la curva para garantizar máxima legibilidad y no solaparse con las líneas superiores de referencia de la norma.
- **Leyenda del Gráfico en Dos Líneas (Pantalla y PDF)**:
  - Punto Azul: `Presión` / `Estática`.
  - Punto Verde: `Prueba 1` / `(1º equipo)`.
  - Punto Morado: `Prueba 2` / `(2º equipo)`.
  - Línea Roja: `Ref.` / `Norma`.
- **Estructuración en Dos Líneas de Conclusiones y Dictamen**:
  - Línea 1 destacada: `Prueba no conforme.` (o `PRUEBA NO CONFORME.` en PDF) / `Prueba conforme.`.
  - Línea 2 descriptiva: `No se han alcanzado los requisitos de presión y caudal exigidos por la [norma].` / `La instalación cumple satisfactoriamente con los requisitos mínimos de presión y caudal exigidos por la [norma].`.

---

## 27. Blindaje Inviolable de Valores Normativos en Ensayos Hidráulicos (PruebasTecnicas.tsx)
- **Valores Mínimos y Presiones Reglamentarias**:
  - **BIE 25 mm**: $P_{\text{mín}} \ge 3.5$ bar, $Q_{\text{mín 1 eq}} \ge 100$ LPM, $Q_{\text{mín 2 eq}} \ge 200$ LPM, $P_{\text{máx estática}} \le 9.0$ bar.
  - **BIE 45 mm**: $P_{\text{mín}} \ge 3.5$ bar, $Q_{\text{mín 1 eq}} \ge 200$ LPM, $Q_{\text{mín 2 eq}} \ge 400$ LPM, $P_{\text{máx estática}} \le 9.0$ bar.
  - **Hidrantes 70 mm**: $P_{\text{mín}} \ge 7.0$ bar, $Q_{\text{mín 1 boca}} \ge 500$ LPM, $Q_{\text{mín 2 bocas}} \ge 1000$ LPM.
  - **Hidrantes 100 mm**: $P_{\text{mín}} \ge 7.0$ bar, $Q_{\text{mín 1 boca}} \ge 1000$ LPM, $Q_{\text{mín 2 bocas}} \ge 2000$ LPM.
- **Normativa y Títulos**:
  - Referencia normativa obligatoria: `UNE 23500:2021 y Real Decreto 513/2017 de 22 de mayo` en cabecera y conclusiones.
  - Campo *Normativa aplicada* en la tabla de datos técnicos del cliente: `UNE 23500:2021 y R.I.P.CI.`.
  - Queda prohibido añadir subtítulos redundantes bajo `CURVA CARACTERÍSTICA DE PRESIÓN Y CAUDAL (P - Q)`.
- **Formato de Fechas y Pie de Página en PDF**:
  - Todas las fechas de ensayo DEBEN mostrarse en formato `DD/MM/YYYY`.
  - El pie de página del informe técnico debe ser únicamente `Página X de Y` sin menciones a software ni leyendas secundarias.

---

## 28. Blindaje Inviolable de Edición, Membrete Oficial y Firmas en Certificados (Certificados.tsx y pdfGenerator.ts)
- **Edición Completa de Certificados Existentes**:
  - En la tabla de certificados de escritorio, en las tarjetas de la app móvil y en el modal de detalle (`DetailModal`), DEBE mantenerse accesible el botón de editar certificado (`Pencil`).
  - El modal de edición debe precargar todos los campos del certificado emitido y permitir actualizar su estado, notas, fecha, técnico y firmas en Firestore (`addCertificado`).
- **Membrete y Logotipo Exclusivos de ABANFOC S.L.**:
  - En la función `generarCertificadoPDF`, los datos de la empresa mantenedora (`empData`) y el logotipo DEBEN forzarse siempre e incondicionalmente a **ABANFOC S.L.** (Razón Social: *ABANFOC S.L.*, CIF: *B16794679*, RASIC: *106001687*, dirección y logo `/logo.png`), sin importar la empresa asignada al cliente o centro.
- **Casilla de Firma del Técnico Mantenedor**:
  - En el modal de creación y edición de certificados (`src/Certificados.tsx`), DEBE mantenerse el lienzo digital táctil e interactivo (*Signature Canvas*) para registrar y almacenar la firma del técnico mantenedor (`firmaTecnico`) en Firestore, con botón de *"Limpiar firma"*.
- **Distribución de 2 Firmas Oficiales en el PDF**:
  - En el documento PDF de Certificado (`generarCertificadoPDF`), DEBEN figurar exclusivamente **2 casillas simétricas de firma**:
    1. **El Técnico Titulado (Ingeniero Colegiado)** a la izquierda (`box1X = 22`).
    2. **Técnico Mantenedor (con Nº de Habilitación)** a la derecha (`box2X = 113`).
  - Queda suprimida y prohibida la inclusión de la casilla de conformidad del cliente en certificados oficiales.

---

## 29. Blindaje Inviolable del Sistema de Papelera de Reciclaje y Retención de 100 Días (Papelera.tsx, Sidebar.tsx y firebase.tsx)
- **Acceso Permanente en Menú Lateral (`Sidebar.tsx`)**:
  - En la barra lateral (`Sidebar.tsx`), la opción **«Papelera»** (`Trash2`) DEBE situarse incondicionalmente abajo del todo en la navegación (`section: 'configuracion'`), separada por una línea divisoria sutil (`border-t border-zinc-900/80`).
  - Debe ser accesible para roles administrativos y de edición (`['super-administrador', 'administrador', 'editor']`).
- **Persistencia en Firestore y Colección `papelera`**:
  - Al eliminar cualquier archivo, ensayo o documento en Pruebas Técnicas (`pruebas_tecnicas`), Certificados (`certificados`), Albaranes (`albaranes`), Partes de Trabajo (`partes`) o Presupuestos (`presupuestos`), el sistema DEBE llamar a `moverAPapelera(...)` antes del borrado de la colección original.
  - Queda ESTRICTAMENTE PROHIBIDO el borrado directo e irreversible sin pasar previamente por la papelera.
- **Sanitización Obligatoria de Datos para Firestore (`cleanUndefinedForFirestore`)**:
  - La función `moverAPapelera` DEBE sanitizar recursivamente cualquier valor `undefined` convirtiéndolo a `null` o suprimiéndolo para evitar excepciones `Unsupported field value: undefined` en Firebase.
- **Retención y Purga Automática de 100 Días**:
  - Cada elemento en papelera debe calcular `fechaExpiracion` a 100 días vista (`fechaEliminacion + 100 días`).
  - Al sincronizarse la papelera (`subscribePapelera`), cualquier documento con más de 100 días de antigüedad debe ser purgado automáticamente de Firestore en segundo plano.
- **Restauración Íntegra a Colección Original (`restaurarElementoPapelera`)**:
  - Al pulsar «Restaurar», el sistema DEBE reinsertar el documento original con todos sus datos (`setDoc`) en su colección de origen y eliminarlo de la papelera, reapareciendo de inmediato en su módulo.

---

## 30. Blindaje Inviolable de la Estructura de 7 Categorías y Submenús en el Menú Lateral (Sidebar.tsx)
- **Estructura Reglamentaria de 7 Categorías**:
  - El menú de navegación principal (`Sidebar.tsx`) DEBE organizarse estrictamente en **7 bloques/categorías**:
    1. **Inicio** (`/`, `LayoutDashboard`): acceso directo a la vista principal.
    2. **Gestión** (`FolderKanban`): desplegable con submenús:
       - *Clientes* (`/clientes`, `Users`)
       - *Centros* (`/centros`, `Building2`)
       - *Catálogo* (`/catalogo`, `Package`)
    3. **Mantenimientos** (`ClipboardCheck`): desplegable con submenús:
       - *Planificación* (`/partes_trabajo`, `CalendarDays`)
       - *Partes de trabajo* (`/partes`, `FileText`)
       - *Revisiones* (`/revisiones`, `SearchCheck`)
    4. **Operaciones** (`Wrench`): desplegable con submenús:
       - *Reparaciones* (`/reparaciones`, `Wrench`)
       - *Instalaciones* (`/instalaciones`, `HardHat`)
       - *Pruebas técnicas* (`/pruebas-tecnicas`, `Gauge`)
    5. **Documentos** (`Files`): desplegable con submenús:
       - *Certificados* (`/certificados`, `FileCheck`)
       - *Presupuestos* (`/presupuestos`, `Calculator`)
       - *Pedidos* (`/pedidos`, `FileText`)
       - *Albaranes* (`/albaranes`, `FileDigit`)
       - *Facturas* (`/facturas`, `Receipt`)
    6. **Papelera** (`/papelera`, `Trash2`): acceso directo al final con borde divisorio superior (`border-t border-zinc-900/80`).
    7. **Tutoriales** (`/metodos`, `GraduationCap`): acceso directo a la plataforma de videos y tutoriales formativos de la aplicación.
- **Apertura Dinámica y Acordeón Interactivo**:
  - Al cargar o cambiar de ruta, la categoría que contenga el submenú activo DEBE abrirse automáticamente (`openCategories`).
  - Cada categoría con submenús debe contar con flecha indicadora `ChevronDown` con rotación suave (`rotate-180`), línea guía izquierda en submenús (`border-l-2 border-zinc-800`) y resalte del submenú activo en rojo corporativo (`text-red-600 font-black bg-white/10`).
- **Modo Colapsado con Menú Flotante (Flyout)**:
  - Al colapsar el menú lateral a 56px (`collapsed === true`), las categorías con submenús muestran sus iconos centrados y despliegan un menú emergente flotante (`group-hover/collapsed:flex`) para permitir la navegación inmediata sin perder ergonomía.

---

## 31. Blindaje Inviolable del Módulo de Tutoriales y Soporte de Video (Metodos.tsx)
- **Denominación y Encabezado Oficial**:
  - Tanto en la barra lateral (`Sidebar.tsx`) como en el título de página de `Metodos.tsx`, el módulo DEBE denominarse incondicionalmente **«Tutoriales»** con icono `GraduationCap`.
- **Gestión Integral de Videos (CRUD)**:
  - DEBE incluirse el botón superior `+ Añadir Video / Tutorial` reservado para roles administrativos y de edición (`['super-administrador', 'administrador', 'editor']`).
  - Cada tarjeta de tutorial debe contener botones individuales de **Edición** (`Edit`) y **Eliminación** (`Trash2`) con modal flotante de confirmación (sin alertas nativas).
  - Modal de creación/edición con campos: Título, Categoría, Duración, Enlace (URL), Descripción y casilla de Tutorial Destacado.
- **Reproductor Multiformato y Soporte Específico de Microsoft OneDrive**:
  - El visor modal de video debe reconocer automáticamente enlaces de **YouTube**, **Vimeo**, **Google Drive**, **Archivos directos MP4** y **Microsoft OneDrive / SharePoint** (`1drv.ms`, `onedrive.live.com`, `sharepoint.com`).
  - Para enlaces de OneDrive, ante las restricciones de `X-Frame-Options` de Microsoft, el reproductor debe presentar una tarjeta dedicada con botón de apertura directa a pantalla completa (`Abrir y Reproducir en OneDrive`).
- **Persistencia Dual Inmediata**:
  - Sincronización en tiempo real con Firestore (`tutoriales_metodos`) y caché local en LocalStorage (`firecheck_db_tutoriales_metodos`) para respuesta instantánea.

---

## 32. Blindaje Inviolable del Módulo Calendario Principal (Calendario.tsx)
- **Ubicación y Acceso en Navegación**:
  - Ubicado en el menú lateral directamente debajo de **INICIO** como acceso directo **«Calendario»** (`/calendario`, icono `Calendar`).
- **Adaptación y Visibilidad Completa en Pantalla (`h-screen`)**:
  - La vista del calendario DEBE ocupar el 100% del alto disponible de la pantalla (`h-screen max-h-screen overflow-hidden`) utilizando un layout flex vertical y cuadrícula responsiva (`flex-1 min-h-0`).
  - Todas las semanas del mes (incluyendo la última semana cuando el mes tiene 6 filas) DEBEN visualizarse completas dentro del viewport sin cortes ni necesidad de scroll vertical en la página principal.
- **Identificación Visual por Etiquetas y Código de Colores Reglamentario**:
  - En las celdas diarias, cada tarea debe mostrarse en una sola línea compacta con su sigla y nombre resumido del cliente (`[Sigla] [Cliente]`):
    1. **Revisiones de Mantenimiento (`Rev.`)**: Fondo y borde en **color DORADO / ÁMBAR** (`bg-amber-100 text-amber-900 border-amber-300`).
    2. **Reparaciones y Averías (`Rep.`)**: Fondo y borde en **color AZUL** (`bg-sky-100 text-sky-900 border-sky-300`).
    3. **Instalaciones y Montajes (`Inst.`)**: Fondo y borde en **color ROJO** (`bg-red-100 text-red-900 border-red-300`).
  - La leyenda superior debe reflejar exactamente estas 3 insignias con sus respectivos tonos dorado, azul y rojo.
- **Arrastrar y Soltar entre Días (Drag & Drop) con Persistencia Cruzada**:
  - Todas las etiquetas de tareas del calendario son arrastrables (`draggable={true}`).
  - Al soltar un elemento sobre otra casilla de día, se actualiza la fecha en tiempo real en la interfaz y en Firestore mediante:
    - `updateParte(docId, { fechaProgramada: nuevaFechaDDMMYYYY })` para revisiones, sincronizándose de inmediato con el módulo **Planificación** (`/partes_trabajo`).
    - `updateReparacion(docId, { fecha: nuevaFechaYYYYMMDD })` para reparaciones.
    - `updateInstalacion(docId, { fecha: nuevaFechaYYYYMMDD })` para instalaciones.
- **Ventana Flotante Informativa de Detalles (Modal)**:
  - Al hacer clic en cualquier tarea del calendario, se abre una ventana modal flotante (`selectedEvento`) con la cabecera del tipo de trabajo y campos detallados:
    - **Fecha programada** (formato `DD/MM/YYYY`)
    - **Concepto / Tarea**
    - **Cliente**
    - **Lugar / Centro**
    - **Técnico Asignado**
    - **Comercial** (con icono `Briefcase`, indicando el comercial asignado a la tarea o centro)
    - **Estado**
    - **Notas / Observaciones**
- **Ocultación por Defecto del Fin de Semana y Conmutador Dinámico**:
  - En la vista principal del calendario, los días de fin de semana (Sábado y Domingo) DEBEN estar ocultos por defecto, mostrando de Lunes a Viernes en 5 columnas (`grid-cols-5`).
  - En la barra de herramientas superior, junto al botón «Hoy», DEBE incluirse un botón conmutador («Mostrar Finde» / «Ocultar Finde») que permite al usuario alternar entre la vista laboral de 5 días y la vista completa de 7 días (`grid-cols-7`).
- **Festivos Oficiales de Barcelona y España**:
  - El calendario debe calcular e integrar automáticamente todos los festivos nacionales de España, autonómicos de Catalunya y locales de Barcelona (ej. Año Nuevo, Reyes, Viernes Santo, Lunes de Pascua, Día del Trabajador, Pascua Granada, Sant Joan, Asunción, Diada, La Mercè, Fiesta Nacional, Todos los Santos, Constitución, Inmaculada, Navidad, Sant Esteve).
  - La casilla del día festivo debe resaltar con fondo gris (`bg-slate-200`).
  - Dentro de la celda se muestra una insignia verde con letras blancas (`bg-emerald-600 text-white font-bold`) con el texto `"Fiesta: [Nombre de la fiesta]"` (ej. `"Fiesta: La Mercè"`).

---

## 33. Blindaje Inviolable del Flujo de Presupuestos, Pedidos de Venta y Albaranes
- **Aceptación de Presupuesto y Modal de Selección de Tipo de Trabajo**:
  - Al marcar un presupuesto como "Aprobado/Aceptado", se despliega obligatoriamente la ventana modal que pregunta el tipo de trabajo: **Reparación**, **Instalación** o **Prueba técnica**.
  - Al confirmar, el presupuesto genera automáticamente un pedido en la colección `pedidos` y deriva la tarea correspondiente a su módulo operativo (`/reparaciones`, `/instalaciones` o `/pruebas-tecnicas`).
- **Nomenclatura Correlativa PRV y PDV**:
  - Los presupuestos se identifican siempre con el prefijo **`PRV`** (ej. `PRV 26300`).
  - Al ser aceptados, el pedido de venta generado adquiere exactamente la misma numeración sustituyendo las siglas por **`PDV`** (ej. `PDV 26300`).
  - En la tabla de Reparaciones e Instalaciones, el distintivo `PDV` debe ubicarse junto a la fecha con estilo badge mono índigo (`text-indigo-700 bg-indigo-50 border-indigo-200/80 font-mono font-bold`) sin icono.
- **Generación Directa de Albarán desde Pedidos, Reparaciones e Instalaciones**:
  - El botón con icono `ReceiptText` («Crear Albarán») en `Pedidos.tsx`, `Reparaciones.tsx` e `Instalaciones.tsx` DEBE abrir directamente la pantalla del formulario de Albarán (`/albaranes` con `view = 'form'`), navegando con `useNavigate()` e inyectando `location.state.prefillAlbaran`.
  - Debe precargar automáticamente: Empresa Mantenedora, Cliente, Centro, Técnico asignado, Título, Código `PDV XXXX` en el número de pedido y la fecha de creación.
- **Desglose de Líneas de Trabajo**:
  - Cada línea del presupuesto debe cargarse en una fila independiente en el albarán, colocando la **familia** del artículo en el campo `Concepto` y la **descripción** del artículo en el campo `Descripción`.

---

## 34. Blindaje Inviolable de Presupuestos y Pedidos de Venta Oficiales con ABANFOC S.L. (pdfGenerator.ts)
- **Emisión Exclusiva con Datos y Logotipo de ABANFOC S.L.**:
  - En la generación de presupuestos y pedidos de venta en PDF (`generarPresupuestoPDF`), los datos de la cabecera, registro mercantil y RGPD, así como el logotipo principal, DEBEN corresponder **siempre e incondicionalmente** a **ABANFOC S.L.** (CIF: `B16794679`, `C/ America 16 B Ático (08921)`, `Sta. Coloma Gramanet, Barcelona`, RASIC: `10600168`, `www.abanfoc.es`, teléfonos: `930108917` / `615864999`, email: `abanfoc@abanfoc.es`).
  - Queda estrictamente prohibido emitir presupuestos o pedidos de venta con logos o membretes de empresas secundarias, subcontratadas o mantenedoras ajenas asignadas a los centros o clientes.
- **Acceso de Visualización y Descarga de Pedidos de Venta (PDV)**:
  - En los módulos de Reparaciones (`Reparaciones.tsx`), Instalaciones (`Instalaciones.tsx`), Pedidos (`Pedidos.tsx`) y Pruebas Técnicas (`PruebasTecnicas.tsx`), DEBE incluirse en la columna de acciones el botón con el icono de la **lupa** (`Search`) para visualizar y descargar el Pedido de Venta (PDV) en PDF en cualquier momento.

---

## 35. Blindaje Inviolable de Permisos y Gestión en el Módulo Buzón (Buzon.tsx)
- **Control Exclusivo de Gestión para Super Administrador**:
  - Las acciones de **editar consulta** (icono lápiz `Pencil` y formulario completo), **eliminar consulta** (icono papelera `Trash2` y confirmación) y **cambiar estado / resolver** (botón de resolución y selector de estados *Pendiente*, *En revisión* y *Resuelto*) están reservadas **exclusivamente a usuarios con rol de Super Administrador** (`'super-administrador'`, `'superusuario'`, `'superadministrador'`).
  - Las funciones mutadoras (`handleSaveResolucion`, `handleConfirmDelete`, `handleStartEdit` y `handleSaveEdit`) cuentan con salvaguardas internas estrictas que impiden cualquier ejecución no autorizada.
- **Capacidad Universal de Creación y Participación**:
  - Todos los usuarios de la aplicación (técnicos, administradores, editores, visualizadores) conservan la facultad de crear nuevas consultas (sugerencias o reporte de errores) y responder activamente en el hilo de comentarios/conversación de cualquier mensaje del buzón.

---

## 36. Blindaje Inviolable de Personalización de Imagen y Escala del Loader de Inicio (Ajustes.tsx y Loader.tsx)
- **Tarjeta de Configuración en Ajustes («Cambio de imagen inicio»)**:
  - En `Ajustes.tsx` (y su réplica `oficina/pages/Ajustes.tsx`), se mantiene la tarjeta de configuración con icono de giro `RotateCw` y color rosa/rose (`bg-rose-100 text-rose-600 border-zinc-200`).
  - Al acceder (`view === 'loader_image'`), dispone de un contenedor circular concéntrico idéntico al loader real de la app con giro lento (`animate-spin-slow origin-center`), anillo discontinuo exterior y previsualización reactiva.
- **Control de Redimensionado y Ajuste al Círculo (`loaderEscala`)**:
  - Campo deslizante (slider) de escala de 30% a 180% (paso 2) con indicador porcentual en tiempo real (`loaderEscala%`) para centrar y adaptar cualquier imagen, icono o logotipo redondo al diámetro del círculo sin que quede pequeño ni desfasado.
  - La imagen aplica la escala directamente mediante estilo `transform: scale(${loaderEscala / 100})` con `transition-transform duration-100` y `object-contain`.
- **Persistencia en la Nube y Caché Local**:
  - Guardado sincronizado en Firestore (`configuracion_inicio/loader`) vía `saveLoaderConfig({ imagenUrl, escala })` y subida a Firebase Storage (`uploadFile`).
  - Sincronización en tiempo real vía `subscribeLoaderConfig` y caché síncrona en LocalStorage (`firecheck_loader_image` y `firecheck_loader_escala`) para renderizado instantáneo en `Loader.tsx`.
  - Opción de restablecimiento a los valores de fábrica (`/loader-racor.png` al 100%).

---

## 37. Blindaje Inviolable de Tarjeta Calendario en Panel del Técnico y Centrado de Mes (DashboardTecnico.tsx y Calendario.tsx)
- **Tarjeta de Acceso en el Panel del Técnico**:
  - En `DashboardTecnico.tsx` (y `mantenimientos/pages/DashboardTecnico.tsx`), la cuadrícula de accesos principales incorpora de forma permanente la tarjeta **«Calendario»** (`id: 'calendario' as TecnicoView`) con icono `Calendar`, paleta de color rose (`bg-rose-50 border-rose-200 text-rose-900`) y distintivo *«Planificación»*.
  - Al pulsar sobre la tarjeta, se despliega la vista unificada del calendario a pantalla completa (`currentView === 'calendario'`) con una barra superior que incorpora el botón **«← Volver al panel»** (`onClick={() => setCurrentView('dashboard')}`) para un retorno inmediato y fluido.
- **Centrado del Título del Mes sin Icono en el Calendario**:
  - En la cabecera principal de `Calendario.tsx`, el bloque del mes (`MESES[month] {year}`) y la insignia de *Mes en curso* DEBEN estar perfectamente centrados en la interfaz (`w-full lg:w-auto text-center` con `justify-center`).
  - Queda suprimido de la cabecera el recuadro rojo con el icono de calendario (`CalendarIcon`), manteniéndose la estética despejada y limpia.

---

## 38. Blindaje Inviolable del Módulo Urgencias y su Integración en el Calendario
- **Ruta y Módulo Independiente de Urgencias (`/urgencias`)**:
  - La ruta `/urgencias` en `src/App.tsx` debe renderizar de forma protegida el componente `Urgencias.tsx` para los roles: `['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico']`.
  - En `Sidebar.tsx`, el acceso a Urgencias (`id: 'urgencias'`) se mantiene con icono `AlertTriangle` y ruta `/urgencias`.
- **Estructura Operativa y Persistencia Dual en Urgencias (`Urgencias.tsx`)**:
  - Colección en Firestore: `urgencias` con los métodos `subscribeUrgencias`, `addUrgencia`, `updateUrgencia` y `deleteUrgencia` en `src/firebase.tsx` con sanitización `cleanFirestoreData`.
  - Caché síncrona en `firecheck_db_urgencias` (LocalStorage).
  - 12 pestañas mensuales con `MESES_CONFIG`, contadores reactivos y tarjetas de métricas (*Total Urgencias*, *Pendientes*, *En curso*, *Paradas*, *Finalizadas*).
  - Prioridades: `Alta` (con punto rojo pulsante `animate-pulse`), `Media` (ámbar) y `Baja` (gris).
  - Notas con punto de notificación parpadeante (`StickyNote`) y modal flotante rápido.
  - Creación directa de Albarán (`ReceiptText`) con redirección vinculada a `/albaranes`.
- **Integración y Etiquetas en Negro con Letra Blanca en el Calendario (`Calendario.tsx`)**:
  - En `Calendario.tsx`, las urgencias deben suscribirse en tiempo real (`subscribeUrgencias`) y cargarse desde `firecheck_db_urgencias`.
  - Las etiquetas de urgencia en la cuadrícula de días DEBEN mostrarse en **fondo negro y letra blanca** (`bg-black text-white border-zinc-950 hover:bg-zinc-800`), con la sigla `Urg.` y el icono `AlertTriangle`.
  - La insignia de conteo en la leyenda superior DEBE lucir igualmente en fondo negro y letra blanca (`bg-black text-white border-zinc-950`).
  - Las urgencias son arrastrables entre días (*Drag & Drop*) para reprogramación automática y sincronización inmediata con Firestore y LocalStorage.

---

## 39. Blindaje Inviolable del Módulo Presupuestos, Modal de Acciones y Maquetación PDF
- **Estructura de Líneas con Familia en Negrita y Descripción Editable (`Presupuestos.tsx` y `firebase.tsx`)**:
  - En `PresupuestoLinea`, el campo `familia?: string` es permanente.
  - En el formulario de presupuestos (`Presupuestos.tsx`), tanto en la línea añadida como en el desglose de artículos y servicios, la familia se muestra y edita en negrita sobre la descripción, permitiendo modificar libremente el texto de ambos campos.
  - En el PDF generado (`generarPresupuestoPDF` en `pdfGenerator.ts`), la familia se imprime en negrita sobre la descripción en texto normal con el mismo cuerpo tipográfico (`7.5pt`), adaptándose la celda automáticamente a la altura requerida.
- **Botón "Selecciona" en la Columna de Acciones de la Tabla**:
  - En la lista de presupuestos (`Presupuestos.tsx`), la columna de acciones DEBE mostrar un único botón limpio con el texto exacto **`"Selecciona"`** acompañado de un icono `ChevronDown`, eliminando la acumulación de botones individuales.
- **Ventana Modal de Acciones Ampliada (`max-w-2xl sm:max-w-3xl`) y Botón de Cierre Rojo con Cruz Blanca**:
  - Al hacer clic en "Selecciona", se abre la ventana modal de acciones con las 7 opciones con icono, título y descripción detallada debajo:
    1. **Editar Presupuesto** (`Edit`, ámbar)
    2. **Duplicar Presupuesto** (`Copy`, violeta)
    3. **Enviar por Enlace Seguro** (`Send`, sky)
    4. **Historial y Seguimiento** (`Activity`, indigo)
    5. **Crear Pedido de Trabajo** (`PackagePlus`, emerald)
    6. **Descargar PDF Oficial** (`Download`, teal)
    7. **Eliminar Presupuesto** (`Trash2`, red)
  - La cabecera del modal DEBE incluir obligatoriamente el botón de cierre en **fondo rojo con la cruz en blanco puro** (`bg-red-600 hover:bg-red-700 text-white`).
- **Acción Duplicar para Nueva Versión (`handleDuplicar`)**:
  - La opción Duplicar debe clonar completamente el presupuesto original (partidas, familias, descripciones, cantidades, precios, cliente, centro y notas), asignando nuevos identificadores de línea, y calculando automáticamente la siguiente versión correlativa en el título (ej. `(v2)`, `(v3)`...), abriendo de inmediato el formulario para realizar las modificaciones solicitadas y guardarlo como nueva versión independiente.
- **Selector Rápido de Estados al Pie de la Ventana Modal**:
  - Al pie del modal de acciones DEBEN renderizarse los 5 estados oficiales (`Borrador`, `Enviado`, `En espera`, `Aprobado`, `Rechazado`).
  - El estado actual del presupuesto debe mostrarse resaltado con insignia `Check`. Al pulsar en cualquier estado, se actualiza de inmediato en Firestore y en la interfaz.
- **Maquetación Armónica de Cabecera en el PDF de Presupuestos (`pdfGenerator.ts`)**:
  - En `generarPresupuestoPDF`, el logotipo oficial de Abanfoc (`logoY = Math.max(3, logoYCalculado - 2)`) y los textos oficiales de datos de empresa y formas de contacto (`12.5`, `16.3`, `20.1`, `23.9`) se mantienen balanceados y armonizados verticalmente con respecto a las dos líneas rojas de la cabecera (`9.5` a `25.5`).


---

## 40. Blindaje Inviolable del Cliente y Centro Puntual en Albaranes (`Albaranes.tsx` y `firebase.tsx`)
- **Campos `clienteNombreLibre` y `centroNombreLibre` en la Interfaz `Albaran` (`firebase.tsx`)**:
  - La interfaz `Albaran` DEBE conservar permanentemente los campos opcionales `clienteNombreLibre?: string` y `centroNombreLibre?: string`.
  - Estos campos permiten grabar en el albarán un cliente o centro escrito manualmente sin crear ningún documento en Firestore (colecciones `clientes` ni `centros`).
- **Campo Cliente con Búsqueda + Texto Libre (`Albaranes.tsx`)**:
  - El campo **Cliente** en el formulario de albaranes DEBE ser un `<input type="text">` con dropdown personalizado que permita **dos modos**:
    1. **Selección de la lista**: el usuario escribe, el dropdown filtra clientes de la BD y al seleccionar uno se guarda `form.clienteId` (y se limpian `clienteNombreLibre` y `centroNombreLibre`).
    2. **Texto libre / cliente puntual**: si el texto escrito no coincide con ningún cliente de la lista, el dropdown muestra la opción **"✎ Usar 'X' como cliente puntual"**. Al seleccionarla o al perder el foco con texto no encontrado, se guarda en `form.clienteNombreLibre` (y se limpia `form.clienteId` a `''`).
  - Cuando hay `clienteNombreLibre` activo, DEBE mostrarse bajo el campo el aviso: **"⚠ Cliente puntual — no guardado en la base de datos"** en color ámbar.
  - El `onBlur` del campo usa un `setTimeout(150ms)` para dar prioridad al `onMouseDown` del dropdown antes de guardar texto libre.
- **Campo Centro con Texto Libre cuando Cliente es Puntual (`Albaranes.tsx`)**:
  - Si `form.clienteId` tiene valor (cliente de BD): se muestra el `<select>` normal filtrado por clienteId.
  - Si `form.clienteId` está vacío (cliente puntual): se muestra un `<input type="text">` libre que guarda en `form.centroNombreLibre`.
  - Queda ESTRICTAMENTE PROHIBIDO deshabilitar o eliminar este comportamiento condicional.
- **Validación del Formulario**:
  - La condición de validación en `handleSaveForm` DEBE aceptar el albarán si existe `form.clienteId` **O** `form.clienteNombreLibre` (no exigir ambos): `(!form.clienteId && !form.clienteNombreLibre)`.
- **Panel "Datos de Ubicación"**:
  - Si `form.clienteId` tiene valor: muestra datos del cliente/centro de la BD.
  - Si `form.clienteNombreLibre` tiene valor (y no hay `clienteId`): muestra `centroNombreLibre || clienteNombreLibre` en negrita + aviso ámbar "Cliente puntual (no guardado en BD)".
  - Si ninguno tiene valor: muestra "Selecciona un cliente o escribe uno nuevo."
- **Lista de Albaranes y Buscador**:
  - En la columna Centro de la tabla (mobile y desktop) DEBE usarse el fallback: `centro?.nombre || alb.centroNombreLibre || cliente?.nombre || alb.clienteNombreLibre || 'Desconocido'`.
  - El buscador DEBE incluir `alb.clienteNombreLibre` en las condiciones de `matchesSearch`.
- **Generación del PDF del Albarán**:
  - En todos los botones de descarga de PDF de la lista, DEBE construirse un objeto sintético antes de llamar a `generarAlbaranPDF`:
    ```ts
    const clienteParaPDF = cliente || (alb.clienteNombreLibre ? { nombre: alb.clienteNombreLibre } : null);
    const centroParaPDF = centro || (alb.centroNombreLibre ? { nombre: alb.centroNombreLibre } : null);
    ```
  - Queda ESTRICTAMENTE PROHIBIDO pasar `null` directamente cuando hay `clienteNombreLibre` disponible.

---

## 41. Blindaje Inviolable de CORRECTO/NO CORRECTO en Sistema Alumbrado de Emergencia (`SistemaAlumbradoEmergencia.tsx` y `pdfGenerator.ts`)
- **Normalización de Valores en UI (`SistemaAlumbradoEmergencia.tsx`)**:
  - Para los checkitems cuyas `itemOpciones` incluyan `'CORRECTO'` (desplegables tipo CORRECTO/NO CORRECTO), la normalización de `val` DEBE ser:
    - `true`, `'true'`, `'SI'`, `undefined`, `''` → `'CORRECTO'`
    - `false`, `'false'`, `'NO'` → `'NO CORRECTO'`
  - `isChecked` para estos items DEBE detectar `'CORRECTO'` y `'CONFORME'` como string, además de `true`/`'true'`.
- **PDF de Alumbrado con Texto CORRECTO/NO CORRECTO (NO con checkmarks vectoriales) (`pdfGenerator.ts`)**:
  - En la tabla del sistema Alumbrado de Emergencia (`esAlumbrado`), las columnas de "Funcionamiento en reposo" y "Funcionamiento sin tensión" (índices ≥ 5 en la cabecera horizontal) DEBEN imprimirse con texto literal **`'CORRECTO'`** (en verde bold) o **`'NO CORRECTO'`** (en rojo bold), nunca con el símbolo de checkmark vectorial.
  - Función `getAlumbradoVal(checkKey, keywords)`: busca el valor por clave directa, luego por keywords en `checkItemsDeSistema`, retornando `'CORRECTO'` como default (nunca `'TICK'`). Traduce `true` → `'CORRECTO'`, `false` → `'NO CORRECTO'`.
  - En `didParseCell`: para `esAlumbrado && data.column.index >= 5`, se fuerza `data.cell.text = ['CORRECTO']` (verde bold) o `data.cell.text = ['NO CORRECTO']` (rojo bold).
  - En `didDrawCell`: el dibujo del checkmark vectorial DEBE estar condicionado a `!esAlumbrado` para NO dibujar sobre el texto en las columnas 5 y 6 del sistema Alumbrado.

---

## 42. Blindaje Inviolable de Adjunto PDF del Albarán en Correos Automáticos (`firebase.tsx`)
- **Generación Automática del PDF y Adjunto Base64**:
  - En la función `enviarCorreoAlbaran` de `src/firebase.tsx` y `src/recursos-compartidos/firebase/firebase.tsx`, cuando un albarán esté firmado por el cliente (`isFirmaValida(albaran.firmaCliente)`), DEBE generarse obligatoriamente su PDF oficial mediante `generarAlbaranPDF(..., true)`.
  - El PDF se codifica en Base64 (`doc.output('datauristring').split(',')[1]`) y se adjunta obligatoriamente en el mensaje:
    ```ts
    attachments: [
      {
        filename: `Albaran_${safeNumero}.pdf`,
        content: base64Pdf,
        encoding: 'base64',
        contentType: 'application/pdf'
      }
    ]
    ```
  - Queda ESTRICTAMENTE PROHIBIDO adjuntar cualquier otro documento (certificados, actas o partes). Únicamente el PDF del albarán firmado.
  - El asunto, destinatario (`abanfoc@abanfoc.es`) y cuerpo HTML deben preservarse de forma inalterable.

---

## 43. Blindaje Inviolable de Ventana Modal de Progreso y Confirmación Verde en Albaranes (`Albaranes.tsx`)
- **Modal de Progreso y Sincronización**:
  - Al guardar o crear un albarán (`handleSaveForm`), la interfaz DEBE desplegar de forma obligatoria e inmediata la ventana modal flotante desenfocada (`fixed inset-0 bg-black/75 backdrop-blur-md`).
  - Durante el proceso de guardado y firma (`!sendCompleted`), muestra un spinner animado, el texto **"Registrando albarán..."**, la barra de progreso animada (`sendProgress`) y el porcentaje numérico en tiempo real.
- **Aviso Verde de Registro Exitoso**:
  - Una vez confirmada la persistencia en Firebase y almacenamiento local, la tarjeta cambia automáticamente a estado completado (`sendCompleted === true`):
    - Icono circular en fondo verde esmeralda con check: `CheckCircle2` (`bg-emerald-100 text-emerald-600`).
    - Título exacto: **`"Albarán registrado en Firebase"`**.
    - Mensaje secundario: *"El albarán ha sido guardado y sincronizado correctamente."*
  - La tarjeta permanece en pantalla durante **2 segundos exactos (2000 ms)** antes de cerrar el modal y regresar al listado de albaranes.

---

## 44. Blindaje Inviolable de Estructura de 3 Tarjetas y Permisos en el Buzón (`Buzon.tsx`)
- **Menú Principal de 3 Tarjetas Separadas e Independientes**:
  - En el menú Buzón (`src/Buzon.tsx` y `src/oficina/pages/Buzon.tsx`), la vista principal DEBE mostrar 3 tarjetas de acceso directo con navegación independiente:
    1. **"Sugerencias de Mejora"**: Para propuestas y feedback de optimización.
    2. **"Reporte de Fallos"**: Para reporte de incidencias técnicas o anomalías detectadas.
    3. **"Versiones"**: Para el registro, control cronológico y seguimiento de versiones de la aplicación (`APP_VERSION`).
  - Al hacer clic en cada tarjeta, la vista conmuta a una página dedicada con botón de retorno al menú del Buzón (`Volver al menú de opciones`).
- **Permisos Estrictos y Control de Fechas/Orden en la Tarjeta Versiones**:
  - **Exclusividad de Escritura para Super Administrador (`isSuperUser`)**:
    - Únicamente los usuarios con rol `'super-administrador'`, `'superusuario'` o `'superadministrador'` pueden crear, modificar o eliminar registros en la colección `'versiones'`.
    - Las funciones controladoras `handleSaveVersion`, `handleStartEditVersion` y `handleConfirmDeleteVersion` DEBEN contener la cláusula de guardia incondicional:
      `if (!isSuperUser) return;`
    - El formulario de registro/edición de versión y la columna/botones de `Acciones` solo se renderizan si `isSuperUser`.
  - **Modificación de Fecha en Versiones**:
    - El formulario de versiones incluye selector de fecha (`type="date"`, precargado con la fecha del registro al editar) para permitir registrar o corregir la fecha real de la actualización (`DD/MM/YYYY`).
  - **Reordenación de Notas y Versiones**:
    - La columna de acciones incluye botones para subir (`ArrowUp`) y bajar (`ArrowDown`) la posición de cada versión (`handleMoveVersion`).
    - La cabecera incluye el botón `"Ordenar por Fecha"` (`ArrowUpDown`) para reordenar de forma cronológica descendente en un clic (`handleAutoOrdenarPorFecha`).
    - Las versiones antiguas anotadas posteriormente se posicionan automáticamente en su orden cronológico correspondiente.
  - **Acceso de Solo Lectura para los Demás Roles**:
    - Cualquier otro usuario (técnico, administrador, editor, visualizador) puede acceder a la tarjeta "Versiones" únicamente para **consultar la tabla** de 2 columnas (`Versión` y `Descripción`), sin ver formulario de edición ni botones de acción.
- **Permisos en Sugerencias de Mejora y Reporte de Fallos**:
  - Todos los usuarios pueden redactar y enviar propuestas o reportar fallos con su nombre de usuario.
  - El Super Administrador es el único facultado para cambiar el estado, redactar la resolución oficial o eliminar registros.
  - El hilo de comentarios / chat multiusuario permite la participación de todos los usuarios registrados.

---

## 45. Blindaje Inviolable de Sincronización Automática con Carpeta Local del Escritorio y Protocolo de Arranque
- **Sincronización Espejo Continua y Obligatoria**:
  - Toda modificación, creación de archivos, refactorización o preparación de despliegue realizada en el espacio de trabajo principal (`noble-noether`) DEBE sincronizarse de forma inmediata y automática con la carpeta del proyecto en el Escritorio del usuario (`C:\Users\canci\OneDrive\Escritorio\SALAMANDRA [VERSIÓN]`).
  - Queda estrictamente prohibido que la carpeta del Escritorio o la de Antigravity queden desfasadas o con versiones diferentes de archivos de código, constantes de versión (`src/constants.ts` y `public/version.json`) o documentación.
- **Protocolo de Verificación en Cada Inicio**:
  - Cada vez que el usuario solicite arrancar el proyecto, abrir localhost o continuar tareas tras horas o días de inactividad, el agente DEBE:
    1. Identificar la carpeta activa más reciente en el Escritorio (`C:\Users\canci\OneDrive\Escritorio\SALAMANDRA...`).
    2. Comprobar la sincronización y paridad de archivos entre ambas rutas para garantizar que no haya archivos desfasados.
    3. Asegurar que `APP_VERSION` en `src/constants.ts` y `public/version.json` sea exactamente idéntica en ambos lados.
    4. Levantar o verificar el servidor de desarrollo Vite (`npm run dev`) y confirmar la apertura en [http://localhost:5173/](http://localhost:5173/).

---

## 46. Blindaje Inviolable del Certificado de Instalación en Certificados Oficiales (`pdfGenerator.ts` y `Certificados.tsx`)
- **Título Oficial en Certificados de Instalación**:
  - En certificados con tipo `instalacion` (`tipoCertificado === 'instalacion'` o por título), el encabezado principal de la tarjeta de resultados DEBE imprimirse estrictamente en mayúsculas como **`SISTEMAS Y EQUIPOS INSTALADOS:`**.
  - Si el centro dispone de equipos asociados, la cabecera correspondiente cambia a **`SISTEMAS Y EQUIPOS INSTALADOS`** (en lugar de `REVISADOS`).
- **Inicio Obligatorio de la Declaración Oficial**:
  - La redacción en el PDF y la plantilla del formulario de creación DEBE iniciar estrictamente con:
    **`ABANFOC S.L. CERTIFICA:`** en mayúsculas y negrita (`helvetica`, `bold`), seguido del texto legal reglamentario en tipografía regular.
- **Supresión del Resultado de la Revisión**:
  - En los Certificados de Instalación queda ESTRICTAMENTE PROHIBIDO mostrar la leyenda de resultado `"Resultado: Favorable"` o `"Resultado: NO favorable"` al pie del documento.
  - La altura de la tarjeta (`cardResultH`) debe ajustarse automáticamente sin dejar espacios vacíos.
- **Datos de la Instalación: Pregunta Normal, Respuesta en Negrita y Alineación**:
  - En la sección `DATOS DE LA INSTALACIÓN`:
    - Las preguntas/etiquetas (*Cliente:*, *Centro:*, *Dirección:*, *Población:*, *Provincia:*, *N.º Mantenimiento:*, *Fecha de emisión:*, *Técnico actuante:*) se imprimen en fuente regular normal.
    - Las respuestas/valores se imprimen en **negrita** (`helvetica`, `bold`).
    - En la columna izquierda (*Cliente*, *Centro*, *Dirección*, *Población*), las respuestas se posicionan **8 puntos más a la izquierda** (`offsetVal = i < 4 ? 20 : 28`) para quedar más próximas a sus respectivas etiquetas.

---

## 47. Blindaje Inviolable de Selectores con Búsqueda Predictiva en Tiempo Real y Orden Alfabético para Cliente (`SearchableSelect.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx` y `Urgencias.tsx`)
- **Componente Reutilizable `SearchableSelect.tsx`**:
  - Utilizado para el selector de Cliente en los formularios modales de **Reparaciones**, **Instalaciones** y **Avisos (Urgencias)**.
  - Permite escribir directamente en el campo para filtrar los resultados en tiempo real mientras el usuario teclea.
  - Búsqueda insensible a mayúsculas, minúsculas y tildes/acentos mediante normalización NFD.
  - Botón de limpieza rápida (`X`) y chevron indicador.
- **Supresión del Campo "Centro" y Preservación de "Lugar / Centro / Ubicación"**:
  - En los formularios modales de nueva tarea en Reparaciones, Instalaciones y Urgencias se ha suprimido el campo desplegable independiente "Centro".
  - Se mantiene de forma permanente e inviolable el campo **"Lugar / Centro / Ubicación"** con texto libre y sugerencias `datalist` de centros para registrar el centro o emplazamiento del trabajo.
- **Compatibilidad Táctil Completa en Dispositivos Móviles**:
  - El componente DEBE gestionar eventos táctiles (`onTouchEnd` y `onMouseDown`) con `e.preventDefault()` en las opciones del menú para evitar que el blur del input o el teclado virtual de smartphones/tablets impidan la selección.
  - Los formularios modales contenedores DEBEN contar con scroll táctil (`max-h-[80vh] overflow-y-auto` o `max-h-[82vh] overflow-y-auto`) para garantizar acceso a todos los campos en pantallas móviles.
- **Orden Alfabético**:
  - Los clientes deben presentarse siempre ordenados alfabéticamente (`localeCompare` con sensibilidad base).

---

## 48. Blindaje Inviolable del Botón de Guardado por Equipo, Orden de Acciones y Sincronización Firestore en Revisiones (`BotonGuardarEquipo.tsx`, `RevisionChecklist.tsx`, `RevisionSistemas/*.tsx` y `firebase.tsx`)
- **Añadir Equipo Inmediato sin Formulario Previo**:
  - Al pulsar `+ Añadir equipo` en la cabecera de cualquier sistema en `RevisionChecklist.tsx`, queda prohibido desplegar ventanas modales intermedias de captura de datos vacíos.
  - El sistema crea e inserta de forma instantánea el nuevo equipo directamente en el inventario/sistema del centro con sus identificadores y valores por defecto, agregándolo al final de la lista del sistema para que el técnico trabaje directamente sobre su tarjeta en el parte.
- **Botón `BotonGuardarEquipo.tsx` con 3 Estados Reactivos y Feedback Visual**:
  - Cada tarjeta de equipo en los 20 componentes de sistemas (`src/components/RevisionSistemas/*.tsx`) DEBE incorporar el botón individual `BotonGuardarEquipo`.
  - Estados obligatorios:
    1. **Azul (`Guardar`)**: Indica que existen cambios en edición pendientes de confirmar (`eqSyncStates[eqId] === 'pending'`).
    2. **Verde (`✓ Guardado`)**: Aparece cuando la escritura se ha confirmado con éxito en Cloud Firestore (`eqSyncStates[eqId] === 'saved'`).
    3. **Ámbar (`✓ Guardado en local`)**: Se activa de forma segura e inmediata cuando el dispositivo opera sin conexión a Internet o en modo offline (`eqSyncStates[eqId] === 'offline'`).
    - Durante la sincronización remota debe desplegarse el icono de carga animado (*spinner*).
- **Orden Reglamentario Estricto de los 5 Botones de Acción**:
  - En la parte inferior de cada tarjeta de equipo, los botones de acción DEBEN mantener estrictamente la siguiente secuencia de izquierda a derecha:
    1.º **`Guardar`** (`BotonGuardarEquipo`).
    2.º **`Equipo no encontrado`** (Fondo ámbar `bg-amber-500 hover:bg-amber-600 text-white`).
    3.º **`Checks ok`** (Texto con primera letra 'C' mayúscula `"Checks ok"`, fondo verde suave `bg-emerald-500 hover:bg-emerald-600 text-white`).
    4.º **`Limpiar Checks`** (Fondo gris `bg-slate-400 hover:bg-slate-500 text-white`).
    5.º **`Copiar nuevo equipo`** (Fondo negro `bg-black hover:bg-zinc-800 text-white`).
- **Persistencia Inmediata y Resiliencia en Firestore**:
  - Las acciones `Checks ok`, `Equipo no encontrado` y `Limpiar Checks` DEBEN invocar incondicionalmente a `handleGuardarEquipoManual(eq.id, equipoModificado)` para asegurar la persistencia local y remota simultánea y cambiar al instante el botón `Guardar` a verde (`✓ Guardado`).
  - La función `handleGuardarEquipoManual` en `RevisionChecklist.tsx` debe actualizar de forma atómica:
    1. `localStorage` (`firecheck_db_equipos_instalados`).
    2. La cola y paquete offline de IndexedDB (`updateParteOfflineData` y `addPendingSyncItem`).
    3. El documento exacto en Cloud Firestore con `targetCentroId` y `targetSistemaId`.
  - En `src/firebase.tsx` (`updateEquipoInstalado`), si `centroId` o `sistemaId` estuvieran ausentes en los argumentos, el sistema DEBE recuperarlos reactivamente desde `firecheck_db_equipos_instalados` en `localStorage` antes de intentar el guardado para evitar descartes silenciosos de datos.

---

## 49. Blindaje Inviolable de Alertas Preventivas de Extintores y BIEs en los Partes (`sistemasUtils.ts`, `Partes.tsx`, `PartesTecnico.tsx` y `Revisiones.tsx`)
- **Detección Exhaustiva de BIEs (`esEquipoBie`)**:
  - `esEquipoBie(eq, sist)` DEBE comprobar de forma acumulativa y estricta:
    1. Identificador y tipo de sistema (`sist.tipo`, `sist.familia`, `sist.nombre`, `sist.id`, `eq.sistemaId`, `eq.sistema`, `eq.familia`, `eq.sistemaNombre`, `eq.sistemaTipo`, `eq.categoria`).
    2. Términos `'bie'` y `'boca'` (excluyendo `'extintor'` e `'hidrante'`).
    3. Claves de campos de formulario que identifiquen una BIE (`manguera`, `pruebahidraulica`, `lanza`, `devanadera`).
    4. Valores de tipo texto dentro del equipo que contengan `'bie'` o `'boca de incendio'`.
- **Cálculo de Fechas y Claves Dinámicas de Plantilla (`calcularAlertasBies` y `calcularAlertasExtintores`)**:
  - En BIEs, las fechas de fabricación y prueba hidráulica DEBEN evaluarse contra las claves de plantilla conocidas:
    - Fabricación: `BIE_FAB_KEYS = ['zBErDpaiUREiF2grWzCb', 'item_1781948908692', 'fechaFabricacion', 'fabricacion', 'fechafab', 'añofab', 'anofab', 'año', 'ano']`.
    - Prueba Hidráulica: `BIE_RET_KEYS = ['4I3N5St3fpkUuIrTuvOI', 'item_1781948939436', 'pruebaHidraulica', 'ultimoRetimbre', 'retimbre', 'pruebahidraulica', 'ph']`.
  - Respaldo obligatorio por anomalías registradas: Si el texto de `anomalias` u `observaciones` contiene mención a caducidad de BIE o necesidad de prueba hidráulica obligatoria, debe contabilizarse directamente como alerta preventiva.
- **Consulta Dual Obligatoria de `inventario` y `sistemas` en Centros**:
  - En la carga de alertas preventivas (`cargarAlertasCentros` / `cargarEquiposAlertas`), DEBEN consultarse simultáneamente las subcolecciones `inventario` y `sistemas` de cada centro (`[...snapInv.docs, ...snapSis.docs]`), evitando omitir BIEs o extintores cuando se encuentren en subcolecciones diferentes.
  - Los equipos recuperados deben enriquecerse incondicionalmente con `sistemaNombre`, `sistemaTipo` y `sistemaId` antes de su procesamiento.
- **Formato Visual Exacto de las Insignias de Alerta Preventiva**:
  - Extintores con antigüedad $\ge 20$ años: **`Ext+20 años: {alertasExt.caducados20} und.`** (sin punto tras `Ext`).
  - Extintores con retimbre $\ge 5$ años: **`RT: {alertasExt.retimbres5} und.`**
  - BIEs con antigüedad $\ge 20$ años: **`Bie+20 años: {alertasBie.caducados20} und.`**
  - BIEs con prueba hidráulica $\ge 5$ años: **`PH: {alertasBie.pruebasHidraulicas5} und.`**
  - **Alineación Horizontal de Alertas Preventivas**: En `PartesTecnico.tsx`, `Partes.tsx` y `Revisiones.tsx`, todas las insignias de alertas preventivas (`Ext+20 años:`, `RT:`, `Bie+20 años:`, `PH:`) DEBEN mostrarse en un único contenedor horizontal continuo (`flex flex-wrap items-center gap-1.5`) para maximizar el aprovechamiento de espacio y orden visual.
  - **Ubicación en Tarjeta del Técnico (Dispositivos Móviles)**: En las tarjetas de la vista técnico (`PartesTecnico.tsx`), TODAS las alertas preventivas DEBEN situarse exclusivamente en la **parte inferior** de la tarjeta, en un contenedor independiente por debajo de la fila de fecha programada, periodicidad, recuento de sistemas y botón de descarga offline, separadas por una línea divisoria (`pt-2 border-t border-zinc-100`).

---

## 50. Blindaje Inviolable del Modal de Selección de Vista, Carga Selectiva y Fondo Corporativo en Partes del Técnico (`PartesTecnico.tsx`)
- **Fondo Azul Corporativo (`bg-[#1d3557]`)**:
  - El fondo de la pantalla de listado de partes del técnico (`PartesTecnico.tsx`) DEBE utilizar incondicionalmente el color azul profundo **`bg-[#1d3557]`**, coincidiendo con la estética del panel principal de los técnicos (`DashboardTecnico.tsx`).
  - Las tarjetas de los partes se mantienen en fondo blanco (`bg-white rounded-3xl`) para garantizar un contraste limpio y lectura clara.
- **Modal de Selección de Modo de Visualización (`showModoModal`)**:
  - Al acceder a la vista de partes, se presenta una ventana modal flotante (`showModoModal`) con dos opciones claramente diferenciadas:
    1. **`1º Vista rápida de los partes`**: Permite al técnico ver y trabajar inmediatamente sobre sus partes sin esperar la comprobación remota de alertas preventivas (ejecutando en segundo plano la consulta sin bloquear la interfaz).
    2. **`2º Mostrar alertas en partes`**: Activa la comprobación y muestra la ventana de carga.
- **Pantalla de Carga y Mensaje Reglamentario**:
  - Al seleccionar la 2.ª opción, se despliega el modal de carga con spinner animado y el texto literal exacto:
    **`leyendo fechas y alertas en los partes,...`**
- **Lectura Selectiva Estricta sobre Partes en Pantalla**:
  - Queda **ESTRICTAMENTE PROHIBIDO** consultar masivamente o en bucle todos los centros de partes históricos o cerrados.
  - La función `ejecutarCargaAlertas` DEBE filtrar exclusivamente los partes que se encuentran actualmente visibles en pantalla con estado `Planificado`, `En curso`, `Abierto` o `En revisión` (`partesObjetivo`), leyendo únicamente los centros asociados a dichos partes (`targetCentroIds`).
  - Al finalizar la lectura, la ventana de carga se cierra automáticamente y se presentan las tarjetas con sus correspondientes alertas ya calculadas.
- **Botón de Cabecera para Re-apertura o Recarga**:
  - En la barra superior de `PartesTecnico.tsx`, al lado del título y conteo de partes, DEBE mantenerse de forma permanente el botón **`Alertas`** con el icono `AlertTriangle`, permitiendo volver a abrir el selector o refrescar la lectura en cualquier momento.

---

## 51. Blindaje Inviolable de Renombrado de Carpeta en Escritorio a la Versión Actual
- **Carpeta Única Renombrada a la Versión Actual**:
  - La carpeta de trabajo y réplica en el Escritorio DEBE renombrarse siempre con el nombre y versión actual del proyecto: **`SALAMANDRA [VERSIÓN]`** (ej. `SALAMANDRA V.08.10.26.F` en `C:\Users\canci\OneDrive\Escritorio\SALAMANDRA [VERSIÓN]`).
- **Mantenimiento de Directorio Único sin Duplicados**:
  - Al realizar la copia espejo y actualización de versión, la carpeta anterior en el Escritorio se renombra/sincroniza a la versión nueva (`SALAMANDRA V.DD.MM.YY.LETRA`), eliminando versiones residuales antiguas para mantener un único directorio limpio en el Escritorio.

---

## 52. Blindaje Inviolable de Tablas de Inventario en Sistemas Especiales y Auto-adaptación de Cabeceras en 2 Filas (`TableInput.tsx` y `pdfGenerator.ts`)
- **Cabeceras Adaptables en 2 Filas en Entrada de Tablas (`TableInput.tsx`)**:
  - En componentes de entrada de tabla matriz (`TableInput.tsx` y `recursos-compartidos/components/TableInput.tsx`), las columnas dinámicas DEBEN procesarse mediante `formatTableHeader(col)`.
  - Los términos comunes como *"Detector humo"*, *"Detector térmico"*, *"Detector llama"*, *"Detector calor"*, *"Detector gas"*, *"Pulsador paro"*, *"Pulsador disparo"*, *"Pulsador alarma"*, *"Retenedor puerta"* o frases compuestas de dos palabras DEBEN dividirse y centrarse en dos líneas compactas (`flex flex-col items-center justify-center leading-tight`).
  - Ancho mínimo de columnas: Las celdas de cabecera y datos de las columnas dinámicas DEBEN mantener un ancho mínimo holgado de al menos 110px (`min-w-[110px]`) con texto centrado para evitar que los nombres queden amontonados o ilegibles.
- **Formateo y Ajuste en el Acta PDF (`pdfGenerator.ts`)**:
  - En tablas de sistemas especiales como Puestos de Control y Extinción con agua, los textos de cabecera se parten de forma balanceada (`words.slice(0, bestSplitIndex)...`) para ocupar dos filas equilibradas sin desbordar el ancho reglamentario de 269 mm.

---

## 53. Blindaje Inviolable de Filtrado Estricto de Alertas Preventivas por Sistema (`sistemasUtils.ts`)
- **Aislamiento Absoluto de Sistemas de Extintores (`esSistemaExtintores`)**:
  - `esSistemaExtintores(sistOrId)` DEBE validar que el sistema corresponde a extintores excluyendo taxativamente cualquier otro sistema (BIE, hidrante, rociador, detección, gas, cocina, puertas, bombas, abastecimiento, etc.).
  - En `esEquipoExtintor(eq, sist)`: Si se proporciona el argumento `sist`, la pertenencia queda gobernada de forma estricta e inviolable por `esSistemaExtintores(sist)`. Si el sistema es BIE o ajeno, NUNCA debe contabilizarse como extintor.
- **Aislamiento Absoluto de Sistemas de BIEs (`esSistemaBies`)**:
  - `esSistemaBies(sistOrId)` DEBE validar que el sistema corresponde a BIEs excluyendo taxativamente sistemas de extintores y el resto de sistemas ajenos.
  - En `esEquipoBie(eq, sist)`: Si se proporciona `sist`, queda gobernado estrictamente por `esSistemaBies(sist)`.
- **Prevención de Falsas Alertas en Clientes sin Equipos**:
  - Queda **ESTRICTAMENTE PROHIBIDO** evaluar fechas de extintores en sistemas que no sean de extintores, o fechas de BIEs en sistemas que no sean de BIEs.
  - Si un centro no dispone de sistemas de extintores, bajo ninguna circunstancia se mostrarán alertas de `Ext+20 años` ni `RT:`. Si no dispone de BIEs, bajo ninguna circunstancia se mostrarán alertas de `Bie+20 años` ni `PH:`.

---

## 54. Blindaje Inviolable del Check «Puerta y/o cristal» en Sistemas de BIEs (`pdfGenerator.ts`, `plantillas.ts`, `Centros.tsx`, `models.ts` y `firebase.tsx`)
- **Check Oficial de 15 Preguntas en BIEs**:
  - En el sistema de Bocas de Incendio Equipadas (BIE), la comprobación **`Puerta y/o cristal`** (identificador dinámico de plantilla `item_1790629281657` y alias `checkPuertaCristal`) está integrada de forma oficial en la secuencia de comprobaciones del checklist de revisión.
- **Cabeceras y Columnas en Tablas de Actas PDF (`pdfGenerator.ts` y `recursos-compartidos/services/pdfGenerator.ts`)**:
  - En `checkLabels` para `isBie`, DEBE incluirse permanentemente `'Puerta y/o cristal'`.
  - En `checkHeaders` de respaldo, se mantiene la numeración del 1 al 15 (`['1', '2', ..., '15']`).
  - En `checkKeys` de respaldo para `isBie`, se incluye `'checkPuertaCristal'`.
  - En el mapeo de `tableData`, DEBE resolverse el acceso bidireccional entre `checkPuertaCristal` e `item_1790629281657` (`if (k === 'checkPuertaCristal') val = eq['item_1790629281657']...`).
- **Modelos y Plantillas por Defecto**:
  - En `EquipoInstalado` (`Centros.tsx`, `firebase.tsx`, `models.ts`), se declaran opcionalmente `checkPuertaCristal?: boolean | null;` e `item_1790629281657?: boolean | null;`.
  - En `PLANTILLAS_POR_DEFECTO` (`plantillas.ts` y `recursos-compartidos/types/plantillas.ts`), `SISTEMA BIES` incorpora `{ label: 'Puerta y/o cristal', key: 'item_1790629281657', tipoRespuesta: 'check', requerido: true }`.

---

## 55. Blindaje Inviolable del Campo Multilínea y Extensible de Descripción en Versiones (`Buzon.tsx`)
- **Área de Texto Multilínea (`<textarea>`)**:
  - En el formulario de registro y edición de versiones (`src/Buzon.tsx` y `src/oficina/pages/Buzon.tsx`), el campo **"Descripción de la actualización"** DEBE ser obligatoriamente un elemento `<textarea>` con `rows={4}` y altura mínima `min-h-[90px]`.
- **Tirador de Redimensionamiento Vertical (`resize-y`)**:
  - El campo DEBE incorporar incondicionalmente la clase CSS `resize-y`, permitiendo al usuario estirar y expandir verticalmente el área de edición con el ratón según la extensión del texto a redactar.
- **Soporte de Saltos de Línea y Visualización en Tabla**:
  - Permite escribir textos multilínea pulsando <kbd>Enter</kbd> (líneas una debajo de otra).
  - En la tabla de historial de versiones, la celda de descripción conserva permanentemente `whitespace-pre-wrap` para reflejar con total fidelidad los saltos de línea introducidos.

---

## 56. Blindaje Inviolable del Catálogo/Inventario: Estados Físicos de Material y Aviso de Stock 0 (`Catalogo.tsx`, `AvisoStockModal.tsx`, `firebase.tsx`, `models.ts`)
- **Columna y Campo ESTADO**:
  - Representa exclusivamente la condición física del material: **`Nuevo`**, **`Usado`**, o **`Reparado`**.
  - Por defecto, el valor inicial y de respaldo DEBE ser **`Nuevo`** (`formData.estado = 'Nuevo'`, `getEstadoCfg(estado)` retorna `Nuevo`).
  - Queda **ESTRICTAMENTE PROHIBIDO** sobreescribir o mutar el campo `estado` en función del stock numérico (las cantidades 0 o positivas NO deben cambiar el estado a "Agotado" o "Disponible").
- **Aviso Modal en Tiempo Real de Rotura de Stock (`AvisoStockModal.tsx` y `avisos_stock`)**:
  - Cuando un artículo tiene cantidad numérica `0` (`cantNum === 0`), se publica un documento activo en la colección de Firestore `avisos_stock` conteniendo sus datos y su foto (`fotoUrl`).
  - En todos los dispositivos conectados (móviles y PC), se despliega de inmediato la ventana modal `AvisoStockModal` con fondo desenfocado, sonido de alerta, vibración háptica, tarjeta con foto ampliada del material (`img-no-bg`), código, nombre, familia, tipo y botón para silenciar/entendido.
  - Al reponer stock (`cantNum > 0` o al quedar en blanco), se desactiva automáticamente el aviso en Firestore y se oculta la alerta modal en todos los dispositivos.
- **Tipografía Suave y Modal de Clic en Artículos**:
  - En la tabla de artículos de `Catalogo.tsx`, los nombres y descripciones deben mostrarse con tipografía estilizada y suave (`font-medium text-slate-700`).
  - Al hacer clic sobre cualquier artículo o código en la tabla de escritorio, se abre de inmediato la ventana modal de edición/gestión del artículo (`handleOpenModal(a)`).

---

## 57. Blindaje Inviolable de la Tabla 2.18 Puesto de Control en Extinción con Espuma y Secciones de Checklist en Actas PDF (`pdfGenerator.ts`)
- **Maquetación y Pegado de la Tabla 2.18 a la 2.17**:
  - En el sistema de Extinción Automática con Espuma (y sistemas análogos con puestos de control), la tabla **`2.18 PUESTO DE CONTROL`** debe maquetarse inmediatamente pegada a la sección previa `2.17` con una separación mínima (`currentY += 2`), evitando saltos de página prematuros (`estimatedSectionHeight: 22`, `maxAllowedY: 275`) para que ambas queden juntas en la misma página siempre que haya espacio disponible.
- **Salto Obligatorio de la Sección 3 a la Siguiente Hoja**:
  - La sección posterior (`3. COMPROBACIONES DE FUNCIONAMIENTO` o cualquier sección de nivel `3.`) DEBE forzar obligatoriamente un salto de página limpio (`doc.addPage()`, `currentY = 34`) para iniciarse siempre en una nueva hoja.
- **Mensaje Oficial de Conformidad en Verde al Finalizar el Sistema**:
  - Si al concluir la revisión del sistema ningún equipo presenta anomalías ni observaciones pendientes, DEBE imprimirse obligatoriamente en verde el mensaje reglamentario:
    **`"Sin anomalías ni observaciones. Los equipos se encuentran en correcto estado de funcionamiento."`**
- **Equilibrio de Columnas y Ancho 100% de Página (269 mm)**:
  - En la tabla `2.18 PUESTO DE CONTROL`, la columna de **Ubicación** DEBE fijarse en un ancho moderado y equilibrado (**`34 mm`**), prohibiéndose terminantemente que absorba todo el ancho restante disponible.
  - El resto de columnas funcionales (Tipo, Marca/Modelo, Año, Diámetro, Presión de entrada, Presión de red, Cantidad de Sprinklers, Comprobación de válvulas, Actuación de válvula de pruebas, Accionamiento de presostatos, Actuación GONG, etc.) DEBEN disponer de anchos base generosos (20 a 28 mm) y absorber de forma proporcional el ancho restante hasta completar exactamente los **`269 mm`** de margen a margen del documento según la Regla 20.
- **Tipografía y Relleno Idénticos a las Tablas de Inventario (`7 pt`)**:
  - Los estilos de cabecera (`headStyles`) y cuerpo (`bodyStyles`) de la tabla 2.18 DEBEN utilizar exactamente el mismo tamaño de letra que la tabla "4. INVENTARIO DE EQUIPOS" y demás tablas de checklist: **`fontSize: 7`** y **`cellPadding: 2`**.
  - En `didParseCell`, se implementa Auto-fit dinámico (`doc.getTextWidth`) que escala el tamaño de fuente suavemente si un texto excede el ancho de su celda, garantizando el cumplimiento estricto de la Regla 20 (1 sola fila plana sin saltos ni desbordamientos).

---

## 58. Blindaje Inviolable de Tablas Horizontales y Orden de Aspiración (ASD) y Fuentes Auxiliares en PDFs (`pdfGenerator.ts`)
- **Formato Horizontal de Tablas para ASD y Fuentes de Alimentación**:
  - En la generación de PDFs del Acta de Mantenimiento (`pdfGenerator.ts` y réplicas), las tablas de **Detección por Aspiración (ASD)** y de **Fuentes de Alimentación Auxiliares** deben maquetarse en orientación horizontal y ancho completo de 269 mm, garantizando legibilidad total de sus parámetros técnicos y columnas de comprobación.
- **Jerarquía y Secuencia Obligatoria de Aparición**:
  - Siempre que en una instalación exista sistema de Detección por Aspiración (`isDeteccionAspiracion` o similar), las **Fuentes de Alimentación Auxiliares** DEBEN imprimirse **incondicionalmente después** de los sistemas de aspiración, tanto en el Acta PDF como en el PDF Certificado de Mantenimiento.
  - Queda terminantemente prohibido invertir este orden o intercalar otros sistemas entre la aspiración y su fuente asociada.

---

## 59. Blindaje Inviolable del Botón de Copiar Línea en Puestos de Control de Rociadores (`TableInput.tsx`)
- **Disposición de Iconos en la Tabla 4 de Puestos de Control**:
  - En el sistema "RED DE ROCIADORES Y PUESTOS DE CONTROL", concretamente en la tabla "4. INVENTARIO Y PRUEBAS EN LOS PUESTOS DE CONTROL" (y tablas análogas gestionadas con `TableInput.tsx`), DEBE figurar el botón de **Copiar Línea** (`Copy`).
  - El botón `Copy` DEBE ubicarse **al lado** del botón de eliminar fila (`Trash2`), permitiendo duplicar de forma inmediata la línea con sus datos seleccionados y acelerar la toma de datos del técnico.
- **Sincronización Dual Obligatoria**:
  - Esta funcionalidad DEBE mantenerse reflejada y sincronizada idénticamente en `src/components/TableInput.tsx` y en `src/recursos-compartidos/components/TableInput.tsx`.

---

## 60. Blindaje Inviolable de Visibilidad Permanente del Botón de Eliminar Fotos en los 21 Sistemas (`RevisionSistemas/*.tsx`)
- **Visibilidad Permanente en Pantallas Táctiles y Móviles**:
  - En las tarjetas de equipos de los 21 sistemas de revisión (`src/components/RevisionSistemas/*.tsx`), el botón de papelera (`Trash2`) para eliminar fotos adjuntas de los equipos DEBE ser **permanentemente visible** sobre la esquina superior de la miniatura fotográfica (`bg-black/60 hover:bg-red-600 text-white p-1 rounded-full shadow`).
  - Queda terminantemente prohibido ocultar este botón tras pseudoclases `opacity-0 group-hover:opacity-100`, ya que en dispositivos móviles y tablets el cursor no existe y los técnicos quedaban impedidos para eliminar fotos erróneas.

---

## 61. Blindaje Inviolable del Acceso a PDF en Listado de Partes para Técnicos (`PartesTecnico.tsx`)
- **Insignia y Botón de PDF con Letra Roja**:
  - En la lista de partes de trabajo (`src/PartesTecnico.tsx`), en la fila/tarjeta de cada parte donde se detallan la fecha, periodicidad y sistemas, DEBE incluirse de forma permanente un botón de acceso directo al PDF con icono `FileText` y texto en **rojo** (`text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200`).
- **Consulta de Revisiones Realizadas**:
  - Si el parte ya ha sido realizado o pre-cerrado, este botón abre de inmediato el visor del PDF oficial, permitiendo al técnico consultar en cualquier momento los datos registrados de revisiones pasadas o del parte en curso directamente desde su tablet o móvil.

---

## 62. Blindaje Inviolable de Persistencia Local-First, Supresión de Autoguardado Destructivo y Botón "Equipo revisado" (`RevisionChecklist.tsx` y `BotonGuardarEquipo.tsx`)
- **Supresión Total de Autoguardado Destructivo en Segundo Plano**:
  - Queda **TERMINANTEMENTE PROHIBIDO** reactivar temporizadores automáticos de guardado (como `setTimeout` de 600 ms tras teclear o flush al cambiar de equipo en `handleCheckChange`) que envíen datos a Firestore a cada pausa o que muten automáticamente el estado a verde (`'saved'`).
- **Persistencia Local Inmediata (Local-First)**:
  - Todo cambio manual de campos, checks, notas o anomalías en un equipo se guarda al instante en la memoria local del dispositivo (`localStorage` e IndexedDB mediante `updateParteOfflineData` y `addPendingSyncItem`). Esto garantiza **cero pérdida de datos** ante apagones, bloqueos de pantalla o pérdidas de cobertura, manteniendo el estado visual del equipo en pendiente (`'pending'`, botón azul).
- **Botón Reglamentario "Equipo revisado" (`BotonGuardarEquipo.tsx`)**:
  - En cada tarjeta de equipo, el botón de guardado se denomina obligatoriamente **`"Equipo revisado"`** y cuenta con la misma escala y tamaño que los botones vecinos:
    - **Azul (`Equipo revisado`)**: Cambios locales pendientes de sincronizar con la nube.
    - **Verde (`✓ Equipo revisado`)**: Al pulsar, guarda en Firestore, actualiza incondicionalmente `revisado: true` en el equipo y en el parte (`updateParte({ estado: 'Abierto' })` si estaba planificado), confirmando con éxito visual.
    - **Ámbar (`✓ Equipo revisado (Local)`)**: Confirmación de guardado seguro en memoria local si no hay conexión a internet en ese momento.
    - **Azul parpadeante con spinner (`Guardando...`)**: Estado transitorio mientras viaja la petición.
- **Blindaje Inviolable contra el "Efecto Rebote" de Firestore**:
  - En la suscripción en tiempo real (`subscribeEquiposInstalados`), los datos del equipo que el técnico tiene en pantalla (`equipoLocalActual`) tienen **prioridad absoluta e inviolable** sobre los datos que provengan de la red:
    ```typescript
    if (equipoLocalActual) {
        return { ...itemFromFirestore, ...equipoLocalActual };
    }
    ```
  - Queda estrictamente prohibido que un snapshot de Firestore sobreescriba, revierta o borre campos de texto, ubicaciones, anomalías o checks modificados o vaciados por el técnico en su pantalla.
- **Clonado Seguro en `handleCopiarEquipo` y `handleAnadirEquipoDirecto`**:
  - Al pulsar "Copiar nuevo equipo", el nuevo equipo se instancia de inmediato con nuevo ID (`EQ-...`), código correlativo y `revisado: false`.
  - Se registra de inmediato en `pendingEquiposRef` y en `setEqSyncStates` con estado `'pending'` (botón azul "Equipo revisado").
  - Queda **ESTRICTAMENTE PROHIBIDO** invocar `saveEquiposProgress(updatedEquipos)` masivo al copiar o añadir un equipo individual. El nuevo equipo se guarda localmente y se añade a Firestore en segundo plano sin bloquear la UI ni provocar rebotes que alteren los datos que el técnico comience a escribir.

---

## 63. Blindaje Inviolable de Preguntas de Prueba de Caudal y Presión en Bombas (`RevisionSistemas/*.tsx`, `TableInput.tsx`, `pdfGenerator.ts` y `FormBuilderPlantillas.tsx`)
- **Renderizado Incondicional en Todos los Componentes de Sistemas (`src/components/RevisionSistemas/*.tsx`)**:
  - En los 21 componentes de sistemas (especialmente `SistemaBombaDiesel.tsx`, `SistemaBombaElectrica.tsx`, `SistemaBombaJockey.tsx`, `SistemaAbastecimientoSalaBombas.tsx` y `SistemaGenerico.tsx`), queda **ESTRICTAMENTE PROHIBIDO** condicionar el renderizado de tablas exclusivamente a `if (tipo === 'tabla')`.
  - La condición de renderizado DEBE ser obligatoriamente universal mediante `isTablaOGrafico`:
    ```typescript
    const isTablaOGrafico = tipo === 'tabla' || tipo === 'grafico' || (
        typeof item.label === 'string' && (
            item.label.toLowerCase().includes('caudal y presion') ||
            item.label.toLowerCase().includes('caudal y presión') ||
            item.label.toLowerCase().includes('curva de caudal')
        )
    );
    ```
  - Al renderizar `<TableInput>`, DEBEN suministrarse incondicionalmente todos sus parámetros esenciales:
    ```tsx
    <div key={item.key} className="col-span-full">
        <TableInput
            label={item.label}
            opciones={(item as any).opciones || []}
            filasInicio={(item as any).filasInicio}
            filasNombres={(item as any).filasNombres}
            tipoRespuesta={isGraficoItem ? 'grafico' : tipo}
            currentEquipo={eq}
            equiposInstalados={equiposInstalados}
            value={String(val || '')}
            onChange={(newVal) => handleCheckChange(eq.id, item.key, newVal)}
        />
    </div>
    ```
  - Esto evita que una pregunta de tipo `grafico` creada en el editor de plantillas sea ignorada o tratada erróneamente como campo horizontal de texto de 48px, garantizando su presencia fija e interactiva en la tarjeta del equipo.
- **Aislamiento de Sección y Detección en PDFs (`pdfGenerator.ts` y `src/recursos-compartidos/services/pdfGenerator.ts`)**:
  - En el agrupador de secciones para el Acta PDF, todo item con `item.tipoRespuesta === 'grafico'` O cuyo label contenga `CAUDAL Y PRESI` o `CURVA DE CAUDAL` DEBE aislarse en su propia sección independiente para evitar que se fusione con secciones anteriores (ej. sección 11).
  - La variable `isGrafico` en la tabla PDF debe evaluar:
    ```typescript
    const isGrafico = tableItem.tipoRespuesta === 'grafico' ||
      tableItemLblNorm.includes('CAUDAL Y PRESI') ||
      tableItemLblNorm.includes('CURVA DE CAUDAL') ||
      (sec.title || '').toUpperCase().includes('CAUDAL Y PRESI');
    ```
  - Esto asegura que se dibujen siempre los 4 puntos de funcionamiento (`0%`, `50%`, `100%`, `140%`), se calculen los valores nominales a partir de Abastecimiento o del propio equipo, y se dibuje la gráfica interactiva y vectorizada en el documento PDF generado.

---

## 64. Blindaje Inviolable de Maquetación y Distribución de Páginas en Bombas Diesel (`pdfGenerator.ts`)
- **Distribución de Secciones 11, 12 y 13**:
  - En el sistema Bomba Diesel del Acta PDF, la pregunta 11 "CURVA DE CAUDAL Y PRESIÓN" debe ubicarse en la página anterior para que la tabla y gráfico de la pregunta 12 "PRUEBA DE CAUDAL Y PRESIÓN" suban de posición y permitan que la sección/pregunta 13 "CONCLUSIONES" quede maquetada en la misma hoja que la tabla 12, evitando que Conclusiones quede suelta en una hoja individual desierta.

---

## 65. Blindaje Inviolable de Valor Predeterminado en el Editor de Plantillas (`FormBuilderPlantillas.tsx` y `RevisionChecklist.tsx`)
- **Configuración de Valor por Defecto**:
  - En el creador/editor de plantillas de checklist, cada pregunta debe admitir la configuración de un campo de **Valor Predeterminado** (`valorPredeterminado` / `defaultValue`), permitiendo preestablecer opciones habituales como `N/A`, `CORRECTO`, etc.
  - Al instanciar o cargar una revisión para un equipo en checklist, los campos no rellenados deben inicializarse automáticamente con su valor predeterminado configurado.

---

## 66. Blindaje Inviolable de Marcado Rápido de Notas Completadas y Categoría 'Completadas' (`Notas.tsx` y `src/oficina/pages/Notas.tsx`)
- **Acción Rápida de Completado desde la Vista Principal**:
  - En la vista principal del módulo de Notas, junto al botón de edición con icono de lápiz, DEBE figurar un botón con icono de check apagado.
  - Al pulsarlo, el icono pasa inmediatamente a verde y tras 1 segundo exacto (1000 ms) la nota se traslada automáticamente a la categoría `"Completadas"`, guardando el usuario que la completó (`completadaPor`) y la fecha exacta.
  - Al abrir la nota en la categoría Completadas, se muestra de forma destacada la autoría con el texto *"Completada por: [Nombre del Usuario]"*.

---

## 67. Blindaje Inviolable del Acceso al Catálogo y Modificación Exclusiva de Stock para Rol Técnico (`Catalogo.tsx`, `App.tsx`, `Sidebar.tsx`)
- **Acceso Autorizado para el Rol Técnico**:
  - El rol `'tecnico'` tiene acceso garantizado al menú Catálogo (`/catalogo`) tanto desde la barra lateral de escritorio como desde el panel móvil del técnico (`DashboardTecnico.tsx`).
- **Permiso Exclusivo de Modificación de Stock / Inventario**:
  - El técnico ÚNICAMENTE tiene autorización para consultar los artículos y modificar el campo de **Stock / Unidades en inventario** (`cantidad`), mediante el panel de ajuste rápido (`[-]`, entrada numérica directa, `[+]` y botón destacado "Guardar Stock").
  - Al guardar, se actualiza inmediatamente en Firestore y LocalStorage, activando o desactivando automáticamente los avisos de rotura de stock.
- **Blindaje Estricto de Solo Lectura para los Demás Campos**:
  - Queda estrictamente prohibido permitir al técnico editar el nombre, código, familia, precios de venta/compra, modelos, estado, fotos u observaciones.
  - Los botones de *"Nuevo Artículo / Servicio"*, *"Importar"* y *"Exportar"*, así como las acciones de duplicar y eliminar artículos, quedan totalmente ocultos e inaccesibles para el rol técnico.

---

## 68. Blindaje Inviolable de Alineación Centrada de la Columna "RENDIMIENTO" en PDFs de Bombas (`pdfGenerator.ts` y réplicas)
- **Alineación Centrada Obligatoria**:
  - En el Acta PDF, tanto en la cabecera (`RENDIMIENTO`) como en todas las celdas del cuerpo de la columna 0 (`0%`, `50%`, `100%`, `140%`) de la tabla "PRUEBA DE CAUDAL Y PRESIÓN", la alineación de texto DEBE ser incondicionalmente **CENTRADA** (`halign: 'center'`).
  - Queda terminantemente prohibido alinear esta columna a la izquierda (`halign: 'left'`).

---

## 69. Blindaje Inviolable del Icono de Sobre en Buzón, Distintivo Limpio "NUEVO" y Control de Lectura por Usuario (`Buzon.tsx` y `oficina/pages/Buzon.tsx`)
- **Icono de Sobre Obligatorio (`Mail`)**:
  - En toda la aplicación (barra lateral `Sidebar.tsx`, panel de técnico `DashboardTecnico.tsx`, cabecera y accesos directos), el icono representativo del menú Buzón DEBE ser obligatoriamente el sobre (`Mail` de `lucide-react`).
  - Queda prohibido volver a utilizar el icono de bandeja de entrada (`Inbox`).
- **Alerta Limpia y Estática de "NUEVO" sin Destellos ni Bordes Rojos Invasivos**:
  - En la vista principal del Buzón que contiene las 3 tarjetas (*Sugerencias de Mejora*, *Reporte de Fallos*, *Versiones*), si alguna de las secciones tiene novedades o comentarios no vistos, DEBE mostrarse una pastilla estática y limpia con el texto literal exacto **`"NUEVO"`**:
    `<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider text-white bg-red-600 shadow-xs">NUEVO</span>`
  - Queda **ESTRICTAMENTE PROHIBIDO** aplicar bordes rojos (`border-red-500`), anillos pulsantes (`ring-4 ring-red-500/20`), sombras fluorescentes rojas gigantes, textos rojos o animaciones invasivas (`animate-pulse`, `animate-ping`) sobre las tarjetas. Cada tarjeta debe mantener sus colores y estética sobria reglamentaria (morado para Sugerencias, rose/slate para Fallos y azul para Versiones).
- **Control y Persistencia de Lectura Individual por Usuario**:
  - Cada usuario tiene su propio registro independiente de lectura mediante `getLoggedUserId()`, persistido tanto en `localStorage` (clave de usuario) como en Firestore (`buzon_lecturas/{userId}`).
  - **Desaparición Inmediata al Entrar**: En cuanto un usuario pulsa y entra en una sección (o envía una sugerencia, fallo o versión), dicha sección se marca como leída y la alerta **"NUEVO"** desaparece de inmediato para él.
  - **Independencia entre Usuarios**: La alerta continuará visible de forma independiente para todos los demás usuarios hasta que cada uno de ellos acceda a la sección correspondiente.
  - Esta arquitectura DEBE mantenerse sincronizada e idéntica en `src/Buzon.tsx` y en `src/oficina/pages/Buzon.tsx`.

---

## 70. Blindaje Inviolable de la Fecha Real de Revisión en Documentos PDF (`pdfGenerator.ts`, `RevisionChecklist.tsx` y réplicas)
- **Extracción Obligatoria de la Fecha de Revisión de los Equipos**:
  - En todos los documentos generados a partir de un parte de mantenimiento (**Acta de revisión**, **Certificado** y **Albarán**), queda **ESTRICTAMENTE PROHIBIDO** plasmar la fecha actual (`new Date()`) en los campos representativos de la revisión cuando los equipos contengan una fecha de revisión registrada por el técnico.
  - La fecha del documento DEBE determinarse dinámicamente mediante `obtenerUltimaFechaRevision(equiposTodos, checklistItemsPorSistema, fallbackDateStr)`.
  - Si la revisión se extendió a lo largo de varios días con distintas fechas introducidas en los equipos (ej. 03/06/2026 y 04/06/2026), el sistema tomará **cronológicamente la última fecha** de revisión registrada para todos los documentos.
- **Campos Afectados en el Acta de Revisión (`generarActaExtintoresPDF`)**:
  - **Cabecera**: Subtítulo superior centrado `N.º Acta: MANT-xxxxx  -  Fecha: DD/MM/YYYY`.
  - **Portada**: Campo `'Fecha del mantenimiento: DD/MM/YYYY'`.
  - **Sello/Firma Digital**: Campo `'Fecha de emisión: DD/MM/YYYY'`.
  - **Hoja de Firmas**: Campo `'Fecha de revisión: DD/MM/YYYY'`.
  - **Pie de página (todas las hojas)**: Texto inferior centrado `DD/MM/YYYY - Centro: [Nombre] - (página X de Y)`.
  - **Nombre de archivo guardado**: `Acta_Revision_[Centro]_[YYYY-MM-DD].pdf`.
- **Campos Afectados en Certificado y Albarán**:
  - **Certificado (`generarCertificadoPDF`)**: Campo `'Fecha de emisión: DD/MM/YYYY'` en la tarjeta de Datos de la Instalación.
  - **Albarán (`generarAlbaranPDF`)**: Campo `'Fecha: DD/MM/YYYY'` en la cabecera.
  - **Persistencia en Firestore/Local (`RevisionChecklist.tsx`)**: Al finalizar el parte, `nuevoAlbaran` y `nuevoCertificado` se registran con `fechaCreacion` coincidente con la fecha de revisión obtenida.





---

## 71. Blindaje Inviolable de Imagen en Editor de Plantillas y Sistema 'EXTINCIÓN MANUAL CON AGUA'
- **Selector y Subida de Imagen por Plantilla (`FormBuilderPlantillas.tsx` y réplicas)**:
  - En la cabecera del editor de plantillas junto al título, debe existir de forma permanente la capacidad de seleccionar y previsualizar una imagen para el sistema correspondiente, persistiendo `imagenUrl` en Firestore y en los tipos de datos de `Plantilla`.
  - Esta imagen debe sincronizarse con las categorías de sistemas (`sistemas`) y mostrarse como miniatura tanto en el listado lateral de plantillas como en los iconos de sistemas.
- **Sistema Dedicado 'EXTINCIÓN MANUAL CON AGUA' (`SistemaExtincionManualAgua.tsx`)**:
  - DEBE mantenerse de forma permanente el componente `SistemaExtincionManualAgua.tsx` con su cuestionario dinámico vinculado a su plantilla, campo ubicación con límite de 40 caracteres y las dos cajas independientes obligatorias de Anomalías y Observaciones.
  - **Discriminación Estricta sin Confusiones**: En `RevisionChecklist.tsx`, `Sistemas.tsx` y `pdfGenerator.ts`, debe evaluarse prioritariamente `sistLower.includes('manual') && sistLower.includes('agua')` para evitar cualquier colisión o solapamiento con los sistemas de extinción automática por agua o espuma (`!isExtincionManualAgua`).

---

## 72. Blindaje Inviolable de Indicadores de Sincronización CSS Nativos (Prevención de Mojibake `ðŸŸ¢`)
- **Prohibición de Emojis Unicode de 4 Bytes en Etiquetas de Sincronización**:
  - En todos los componentes de sistemas de revisión de equipos (`src/components/RevisionSistemas/*.tsx` y `src/mantenimientos/components/RevisionSistemas/*.tsx`), queda **ESTRICTAMENTE PROHIBIDO** usar caracteres de emoji Unicode directos como `🟢`, `🟡` o `🔴` para los estados de sincronización.
  - Esto previene de forma absoluta la corrupción de codificación de caracteres en entornos Windows/ANSI que provocaba la aparición del texto corrupto `ðŸŸ¢ Sincronizado`, `ðŸŸ¡ Guardando...` o `ðŸ”´ Sin conexión`.
- **Indicadores CSS Nativos Obligatorios**:
  - Estado Sincronizado: `<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Sincronizado`.
  - Estado Guardando: `<span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-ping"></span> Guardando...`.
  - Estado Sin conexión: `<span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span> Sin conexión`.

---

## 73. Blindaje Inviolable del Sistema 'CAÑÓN MONITOR CON ESPUMA'
- **Componente Dedicado Multi-Equipo**:
  - DEBE mantenerse de forma permanente el componente `SistemaCanonMonitorEspuma.tsx` (y su réplica en `src/mantenimientos/components/RevisionSistemas/SistemaCanonMonitorEspuma.tsx`).
  - Su comportamiento en formulario debe ser análogo a Hidrantes y Extintores: tabla con múltiples equipos, cuestionario estructurado, límite de 40 caracteres en ubicación y las dos cajas independientes obligatorias de Anomalías (roja) y Observaciones (azul).
- **Sincronización Reactiva con el Editor de Plantillas en Actas PDF (`pdfGenerator.ts`)**:
  - En `pdfGenerator.ts`, las columnas de la tabla de Cañón Monitor DEBEN construirse dinámicamente a partir de la plantilla configurada en Firestore (`checklistItemsPorSistema[sist.id]`).
  - Si el usuario borra, añade o modifica columnas/preguntas en el editor de plantillas, el PDF DEBE reflejar con total fidelidad esos cambios exactos sin columnas residuales ni hardcodeadas.
- **Cabecera de Ubicación en 1 Sola Línea**:
  - En la cabecera de la tabla de Cañón Monitor, el texto `"Ubicación del equipo"` DEBE maquetarse forzosamente en una sola línea plana horizontal (vía `formatCanonHeader` sin saltos de carro).
- **Ancho Horizontal Proporcional y Sin Espacios Excesivos**:
  - El reparto de anchuras de columna (`colNaturalWidths` escalado a 269 mm exactos) debe evitar excesivo espacio en blanco en Ubicación y distribuir espacio holgado a las columnas de preguntas.
- **Tipografía Homogénea en la Tabla**:
  - En toda la tabla de Cañón Monitor, el tamaño de letra debe ser uniforme: cuerpo en `6.8pt` (vía `didParseCell`) y cabecera en `7pt`.

---

## 74. Blindaje Inviolable del Índice Interactivo en Página 2 y Marcadores Laterales en Actas PDF
- **Reserva Exclusiva de Página 2 para el Índice**:
  - Inmediatamente tras la portada (`drawInfoPage`), se añade una página dedicada (`doc.addPage(); doc.setPage(2);`) para el índice. Todos los sistemas comienzan obligatoriamente en páginas >= 3.
- **Declaración Previa de `drawnTablePages`**:
  - La variable `const drawnTablePages = new Set<number>();` DEBE declararse antes de la página 2 para prevenir errores en tiempo de ejecución (`ReferenceError: Cannot access 'drawnTablePages' before initialization`).
- **Tarjetas Clicables con `doc.link`**:
  - Cada sistema del acta y la sección final de Firmas deben renderizarse con tarjetas estilizadas provistas de insignia numérica circular, título en mayúsculas, conteo de equipos y pastilla `Pág. X`.
  - Toda el área de la tarjeta debe ser interactiva mediante hipervínculo interno `doc.link(x, y, w, h, { pageNumber })` que redirige a la página inicial del sistema o de firmas.
- **Marcadores Laterales (PDF Outlines / Bookmarks)**:
  - Se deben registrar en la barra lateral del visor PDF: `1. Portada y Datos Generales` (pág. 1), `2. Índice de Sistemas` (pág. 2), `[N]. [Nombre Sistema] ([X] eq.)` y `[N+1]. Firmas y Conformidad` mediante `doc.outline.add`.
- **Encapsulación Defensiva con `try...catch`**:
  - La llamada a `drawIndicePage()`, la creación de enlaces `doc.link` y los marcadores `doc.outline.add` DEBEN estar protegidos con bloques `try...catch` para asegurar que ninguna anomalía de visor interrumpa la descarga del PDF.

---

## 75. Blindaje Inviolable del Sistema 'ARQUETA Y ACOMETIDA'
- **Habilitación Completa Multi-Equipo**:
  - DEBE mantenerse de forma permanente el componente `SistemaArquetaAcometida.tsx` (y su réplica en `src/mantenimientos/components/RevisionSistemas/SistemaArquetaAcometida.tsx`).
  - Su comportamiento en formulario debe ser multi-equipo con tarjetas/cuestionario dinámico según plantilla de Firestore (`QzUYmjPnYFFUM6MBf2jD`), límite de 40 caracteres en ubicación y las dos cajas independientes obligatorias de Anomalías (roja) y Observaciones (azul).
- **Discriminación Estricta sin Confusiones**:
  - En `RevisionChecklist.tsx`, `Partes.tsx`, `Sistemas.tsx`, `sistemasUtils.ts`, `EquipoFormulario.tsx` y `pdfGenerator.ts`, debe reconocerse prioritariamente `'ARQUETA'` o `'ACOMETIDA'` (`isArquetaAcometida`, `isArquetaA`, `isArquetaB`).
- **Orden Obligatorio en PDFs**:
  - En las Actas PDF y Certificados (`pdfGenerator.ts`), Arqueta y Acometida DEBE ordenarse inmediatamente después de los BIEs o después de los Hidrantes/Casetas (peso `45` en la jerarquía, siempre después de cualquiera de estos sistemas que esté presente), precediendo a los grupos de presión/abastecimiento y resto de sistemas.

---

## 76. Blindaje Inviolable de Ubicación y Nombres Exclusivos de Bombas en Anomalías del Acta PDF (pdfGenerator.ts)
- **Ubicación o Referencia en la Cabecera de Anomalías**:
  - En la sección de anomalías y observaciones de cada sistema en el Acta PDF, la cabecera de cada equipo DEBE incluir su ubicación o referencia al lado de la numeración: `EQUIPO Nº XX - [Ubicación]` (ej. `EQUIPO Nº 06 - Pasillo principal`).
  - La ubicación se obtiene de `eq.ubicacion`, `eq.cobertura`, `eq.zona` o del campo dinámico de plantilla. Si no tiene ubicación registrada, se mantiene limpio como `EQUIPO Nº XX`.
- **Identificación Exclusiva y Limpia en Sistemas de Bombas**:
  - En los equipos pertenecientes a grupos de presión y salas de bombas, la cabecera DEBE identificar taxativamente el tipo de bomba:
    - `EQUIPO Nº 01 - BOMBA JOCKEY`
    - `EQUIPO Nº 01 - BOMBA ELECTRICA`
    - `EQUIPO Nº 01 - BOMBA DIESEL`
  - Queda **ESTRICTAMENTE PROHIBIDO** añadir sufijos, porcentajes o textos residuales de plantilla (como ` - 80%`, ` - N/A`) a las bombas en la cabecera de anomalías.

---

## 77. Blindaje Inviolable del Concepto '*Desplazamientos' en Albaranes (Albaranes.tsx y Firestore)
- **Persistencia en Firestore y Grupo VISITAS**:
  - En la colección `trabajos` de Cloud Firestore, el documento `-VISITAS` DEBE conservar de forma permanente la clave `*Desplazamientos`.
- **Respaldo Offline en Albaranes**:
  - En `src/Albaranes.tsx` y `src/oficina/pages/Albaranes.tsx`, la lista de respaldo (fallback) de conceptos DEBE incluir obligatoriamente `'*Desplazamientos'` para garantizar su selección aun sin conexión a internet.

---

## 78. Blindaje Inviolable de Ubicación Unificada, Población y Enlace Oficial a Google Maps en el Calendario (Calendario.tsx)
- **Interfaz `EventoCalendario` y Extracción de Población**:
  - La interfaz `EventoCalendario` DEBE incluir de forma permanente las propiedades `poblacion?: string;` y `direccion?: string;`.
  - En la transformación de tareas para los 4 módulos (Mantenimientos `partes`, Reparaciones `reparaciones`, Instalaciones `instalaciones` y Urgencias `urgencias`), la población DEBE extraerse prioritariamente a partir del objeto o de sus centros (`c.poblacion`) o clientes (`cl.poblacion`) vinculados.
- **Unificación de Dirección y Población en un Solo Campo**:
  - En el modal de detalle del evento (`selectedEvento`), la dirección y la localidad DEBEN mostrarse unificadas bajo el título **`Lugar / Dirección y Población`**, evitando cajas separadas redundantes.
  - El modal DEBE exhibir la pastilla distintiva `📍 [Población]` cuando esté disponible.
- **Botón y Enlace Interactivo Oficial a Google Maps**:
  - En el mismo bloque de ubicación del modal, DEBE mantenerse de forma permanente el botón con el **icono vectorial oficial multicolor de Google Maps** (Pin con cuadrantes `#EA4335`, `#4285F4`, `#FBBC04`, `#34A853` y círculo blanco central).
  - El enlace DEBE apuntar directamente a `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawQuery)}` con `target="_blank"` y `rel="noopener noreferrer"`.
- **Tooltip Informativo en Etiquetas de Calendario**:
  - En las píldoras de evento del calendario diario, el atributo `title` DEBE incorporar la población entre corchetes (`[${ev.poblacion}]`) para consulta rápida al sobrevolar con el ratón.

---

## 79. Blindaje Inviolable de Renombrado Obligatorio de la Carpeta del Escritorio con la Versión Actual
- **Nomenclatura Obligatoria de la Carpeta en el Escritorio**:
  - En cada copia espejo, sincronización o avance de versión, la carpeta ubicada en el Escritorio del usuario (`C:\Users\canci\OneDrive\Escritorio\...`) DEBE renombrarse obligatoria y taxativamente con la marca y versión activa:
    **`SALAMANDRA [VERSIÓN]`** (ejemplo exacto: `SALAMANDRA V.08.10.26.F`).
- **Eliminación de Nombres Genéricos y Versiones Antiguas**:
  - Queda **ESTRICTAMENTE PROHIBIDO** mantener carpetas con el nombre plano `Salamandra` a secas o acumular carpetas desfasadas con versiones anteriores en el Escritorio.
  - Al generar o actualizar cualquier versión (`V.DD.MM.YY.LETRA`), el agente DEBE renombrar la carpeta anterior a la versión nueva y garantizar la sincronización integral de los archivos sin duplicar directorios.

---

## 80. Blindaje Inviolable de Maquetación de Rociadores y Puestos de Control en Actas PDF (pdfGenerator.ts)
- **Cabecera Exclusiva de Manifold / Colector sin Columna 'ESTADO'**:
  - En la sección **"MANIFOLD / COLECTOR DE PUESTOS DE CONTROL"** de la tabla de Red de Rociadores en el Acta PDF, la primera fila de cabecera DEBE tener `colSpan: 2` abarcando todo el ancho (269 mm), alineada a la izquierda en color granate burdeos (`[128, 0, 32]`).
  - Queda **ESTRICTAMENTE PROHIBIDO** mostrar la palabra `ESTADO` o trazar una línea separadora vertical en esta primera fila.
- **Filas Combinadas 2 y 3 (Referencia y Ubicación) en Fondo Amarillo Identificativo**:
  - La fila 2 (`Referencia manifold / colector`) y la fila 3 (`Ubicación del manifold / colector`) DEBEN tener `colSpan: 2` sin divisiones verticales intermedias y con fondo amarillo claro reglamentario (`fillColor: [255, 249, 196]`).
  - La etiqueta/pregunta se imprime alineada a la izquierda en tipografía normal y la **respuesta pegada a continuación en negrita y mayúsculas** (`fontStyle: 'bold'`).
- **Formato en Anomalías del Acta PDF**:
  - En las cabeceras de anomalías por equipo (`EQUIPO Nº XX - [Ubicación]`), solo debe ir en negrita el prefijo `EQUIPO Nº XX - `, mientras que la referencia o ubicación del equipo DEBE imprimirse en estilo de fuente normal (sin negrita).

---

## 81. Blindaje Inviolable de Ventana Modal de Progreso de Generación y Descarga de Documentos (Partes.tsx)
- **Modal Flotante Reactivo Inmediato**:
  - Al pulsar el botón "Descargar" en el diálogo de selección de documentos de un parte (`Partes.tsx`), DEBE desplegarse de forma instantánea una ventana modal flotante central con fondo desenfocado (`bg-black/70 backdrop-blur-md`).
- **Elementos Visuales Obligatorios**:
  - Icono animado central con documento pulsante y aro de carga giratorio (`FileText` + `Loader2 animate-spin`).
  - Barra de progreso horizontal fluida con gradiente de color (`bg-gradient-to-r from-red-500 via-rose-500 to-amber-500`) y porcentaje numérico reactivo visible.
  - Mensajes de estado descriptivos por cada fase del proceso:
    - *Preparando sistemas y equipos del centro...*
    - *Generando Acta de Mantenimiento...*
    - *Generando Certificado Oficial...*
    - *Generando Albarán de Trabajo...*
    - *Generando Contrato de Mantenimiento...* (si procede).
- **Finalización y Cierre Automático**:
  - Al concluir al 100%, el modal DEBE exhibir un icono verde de éxito rebotante (`CheckCircle2` en `bg-emerald-50 text-emerald-600`) y el texto exacto **`¡Documentos generados y descargados con éxito!`**.
  - La ventana debe permanecer visible durante un retardo de cortesía de aproximadamente 1,4 segundos antes de cerrarse suavemente.

---

## 82. Blindaje Inviolable de Ancho y Distribución de Columnas en Tabla de Puestos de Control del Acta PDF (pdfGenerator.ts)
- **Ancho Total Idéntico de 269 mm**:
  - En la tabla "4. INVENTARIO Y PRUEBAS EN LOS PUESTOS DE CONTROL" del sistema RED DE ROCIADORES Y PUESTO DE CONTROL en el Acta PDF, la suma total de anchos de columna DEBE ser exactamente **269 mm** (margen a margen: 14 a 283).
- **Ajuste y Amplitud de Columnas sin Saltos de Texto Anti-estéticos**:
  - La primera columna (`Orden`) DEBE contar con al menos **11 mm** de ancho para garantizar que la palabra "Orden" quepa holgadamente en una sola línea sin partirse verticalmente jamás (`"Orde\nn"`).
  - Las preguntas y columnas cortas ("Alarma", "Presión campana", "Presión manómetro", etc.) se ajustan dinámicamente entre 14 y 22 mm, otorgando el ancho sobrante a la columna descriptiva/ubicación del puesto de control para absorber el ancho del 100% de la hoja.

---

## 83. Blindaje Inviolable de Recuento de Puestos de Control del Inventario en Certificado y Albarán (pdfGenerator.ts)
- **Recuento Real por Puestos de Control de la Tabla de Inventario**:
  - Exclusivamente en el sistema RED DE ROCIADORES Y PUESTO DE CONTROL, la suma de equipos en el Certificado Oficial (`generarCertificadoPDF`) y en el Albarán de Trabajo (`generarAlbaranPDF`) DEBE calcularse a partir del número de puestos de control listados en la tabla de inventario mediante `contarEquiposInventarioPuestosPDF(eqs)`.
  - Queda **ESTRICTAMENTE PROHIBIDO** contar los colectores/manifolds individuales como si fueran el total de equipos revisados, garantizando la perfecta coincidencia entre el Inventario del Acta, el Certificado Oficial y el Albarán.

---

## 84. Blindaje Inviolable de Tarjeta en 2 Columnas y Formato Unificado de Sistemas y Equipos Revisados en Certificado PDF (pdfGenerator.ts)
- **Formato Unificado Homologado al Índice del Acta de Revisión**:
  - En la tarjeta "SISTEMAS Y EQUIPOS REVISADOS" del Certificado Oficial PDF (`generarCertificadoPDF`):
    - **1.ª Línea (Negrita y Mayúsculas)**: Nombre del sistema en mayúsculas (ej. `EXTINTORES`, `BOCAS DE INCENDIOS`, `DETECCIÓN DE INCENDIOS`).
    - **2.ª Línea (Texto normal debajo)**: Recuento total de equipos del sistema con formato `${totalEquipos} ${totalEquipos === 1 ? 'equipo revisado' : 'equipos revisados'}` (o `equipo instalado` / `equipos instalados` si es instalación).
  - Queda **ESTRICTAMENTE PROHIBIDO** desglosar subtipos o imprimir valores de campos internos del checklist (como `"• CORRECTO. = 1 unidad"` o `"• Extintores varios formatos: 5 und"`), garantizando coherencia absoluta con el Índice del Acta de Revisión.
- **Distribución y Balanceo Dinámico en 2 Columnas**:
  - La tarjeta de sistemas y equipos revisados DEBE balancear dinámicamente sus bloques en 2 columnas (`itemsCol0` e `itemsCol1`) calculando la altura acumulada para que ambas mitades queden equilibradas y nunca sobrecarguen una sola columna vertical.
  - Esto previene de forma permanente que la tarjeta empuje los bloques de firmas de conformidad hacia el límite inferior de la página.

---

## 85. Blindaje Inviolable de Persistencia Multi-Pestaña de Firestore y Carga Operativa Continua
- **Persistencia Multi-Pestaña Obligatoria (`firebase.tsx`)**:
  - La inicialización de Firestore localCache DEBE utilizar incondicionalmente `persistentMultipleTabManager()`.
  - Queda **ESTRICTAMENTE PROHIBIDO** utilizar `persistentSingleTabManager()`, ya que bloquea el acceso exclusivo a IndexedDB e interrumpe las suscripciones `onSnapshot` cuando existen múltiples pestañas o recargas de la aplicación.
- **Temporizador de Seguridad de Carga (`loadingSafetyTimer`)**:
  - En las vistas operativas principales (`Revisiones.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx` y `Urgencias.tsx`), DEBE incluirse un temporizador de seguridad de 2000 ms (`loadingSafetyTimer = setTimeout(() => setLoading(false), 2000)`).
  - Esto garantiza que la interfaz jamás quede congelada en estado de carga aunque Firestore o la conexión de red experimenten latencia.
- **Protección de Almacenamiento Local (`safeLocalSet`)**:
  - En los componentes de operaciones, las escrituras en `localStorage` DEBEN gestionarse de forma segura para evitar que errores por cuota de almacenamiento (`QuotaExceededError`) bloqueen la reactividad del componente.
- **Selector de Estado de Parte Exclusivo para SuperAdministrador (`RevisionChecklist.tsx`)**:
  - En la vista de revisión de partes, el selector desplegable de cambio manual de estado (`Abierto`, `En curso`, `Pre-Cerrado`, `Cerrado`, `Finalizado`) sólo debe ser visible y editable para usuarios con rol de SuperAdministrador (`userRole === 'super-administrador' || userRole === 'superusuario' || userRole === 'superadministrador'`). Para el resto de roles se muestra como etiqueta de solo lectura.

---

## 86. Blindaje Inviolable de Cierre y Navegación de Detalle de Centro (Centros.tsx y oficina/pages/Centros.tsx)
- **Cierre Incondicional del Modal de Detalle (`handleTryCloseDetail`)**:
  - En la vista de detalle del centro (`DetailModal`), el botón de volver (`<ArrowLeft /> Volver`), la cruz de cierre (`X`) y la tecla `Escape` ejecutan `handleTryCloseDetail()`.
  - Esta función DEBE ejecutar incondicionalmente `setIsDetailOpen(false)` para regresar limpiamente y sin trabas al listado de centros.
  - Queda **ESTRICTAMENTE PROHIBIDO** condicionar el cierre del detalle a validaciones de campos incompletos o invocar `setShowValidationModal(true)` desde `handleTryCloseDetail`.
- **Preservación de Validación Obligatoria en Guardado (`handleSave`)**:
  - Las validaciones obligatorias de datos generales, contrato, técnico, empresa y sistemas mínimos pertenecen de forma exclusiva al guardado del formulario (`handleSave`) al crear o editar un centro.
- **Sincronización Dual Obligatoria**:
  - Esta lógica DEBE mantenerse idéntica e inviolable en `src/Centros.tsx` y en `src/oficina/pages/Centros.tsx`.

---

## 87. Blindaje Inviolable de Marcado Manual de Tareas Resueltas en Calendario para Super Administrador (Calendario.tsx)
- **Conmutador Rápido Exclusivo de Super Administrador (`handleToggleResuelta`)**:
  - En el modal de visualización de tarea del calendario (`Calendario.tsx`), DEBE incluirse un botón azul conmutador ("Marcar como resuelta" / "Desmarcar como resuelta") visible y accionable exclusivamente por usuarios con rol de Super Administrador (`isSuperUser`).
  - Aplica exclusivamente a tareas operativas de **Reparaciones**, **Instalaciones** y **Urgencias** (las revisiones de mantenimiento no se ven afectadas).
- **Insignia y Estilo Atenuado en Gris de Tarea Resuelta (`COLOR_COMPLETADO_TAG` y `COLOR_COMPLETADO_BADGE`)**:
  - Al marcarse como resuelta (`resueltaManual: true`), la tarea adquiere inmediatamente el estilo visual atenuado en gris claro en la cuadrícula del calendario, considerándose completada sin necesidad de contar con un albarán emitido.
- **Persistencia Dual Simultánea (Firestore + LocalStorage)**:
  - Todo cambio persiste de forma inmediata en el documento correspondiente de Firestore (`updateReparacion`, `updateInstalacion`, `updateUrgencia`) y en la memoria local (`firecheck_db_reparaciones`, `firecheck_db_instalaciones`, `firecheck_db_urgencias`).

---

## 88. Blindaje Inviolable de Filtros de Visibilidad con Tachado en Cabecera del Calendario (Calendario.tsx)
- **Botones Interactivos de Conteo y Visibilidad (`filtrosVisibles`)**:
  - Las cuatro etiquetas de resumen mensual ubicadas en la cabecera del calendario (`Rev.`, `Rep.`, `Inst.`, `Urg.`) DEBEN ser botones interactivos que alternan la visibilidad de cada categoría de tarea (`toggleFiltro`).
- **Efecto Visual Tachado al Desactivar**:
  - Al desactivar una categoría, su botón pasa al estilo inactivo tachado (`bg-slate-50 text-slate-400 border-slate-200 opacity-60 line-through`).
  - Al estar desactivada, todas las tareas de dicha categoría se ocultan de las celdas de los días del calendario.
  - Al activarse nuevamente, recupera su color y sombra habitual y restaura la visibilidad de las tareas.
- **Recálculo Reactivo de Tareas por Día**:
  - El distintivo numérico de cantidad de tareas en cada celda del día (`eventosDia.length`) DEBE recalcularse en tiempo real para reflejar exactamente el número de tareas visibles.
  - Los días festivos oficiales permanecen siempre visibles e inalterados.

---

## 89. Blindaje Inviolable de Título Obligatorio y Visualización en Avisos / Urgencias (Urgencias.tsx y Calendario.tsx)
- **Etiqueta Obligatoria en Formulario de Urgencias (`Urgencias.tsx`)**:
  - En el modal de creación y edición de avisos de urgencia (`src/Urgencias.tsx`), la etiqueta del campo de título DEBE denominarse obligatoriamente:
    `TITULO OBLIGATORIO A MOSTRAR EN EL AVISO *`
    con el placeholder indicativo `Ej: Fallo gotera en bazar chino`.
- **Visualización Exacta del Título en Alertas del Calendario (`Calendario.tsx`)**:
  - En la vista del calendario (`src/Calendario.tsx`), las etiquetas de avisos de urgencia DEBEN mostrar en primer plano el título del aviso: `Urg. [Título]` (ej. `Urg. Fallo gotera en bazar chino`), mapeando `clienteResumido: u.titulo || u.urgencia || ...`.

---

## 90. Blindaje Inviolable de Eliminación de Partes con Confirmación Modal a la Papelera (`Partes.tsx`)
- **Permiso Universal de Eliminación a Papelera**:
  - En el listado de partes (`Partes.tsx`), cualquier parte listado (incluidos los partes en estado `Pre-Cerrado`, `En revisión`, de prueba o planificados) DEBE poder ser enviado a la papelera mediante el botón con icono de papelera (`Trash2`).
  - Queda **ESTRICTAMENTE PROHIBIDO** bloquear la acción de eliminar o condicionarla restrictivamente según el estado del parte.
- **Modal Flotante de Confirmación Obligatorio (`parteAEliminar`)**:
  - Al pulsar el botón de eliminar, DEBE abrirse una ventana modal flotante moderna (`parteAEliminar`) con `backdrop-blur-sm`, advirtiendo claramente: *"¿Estás seguro de que deseas mover este parte a la papelera?"* y detallando el cliente, centro y número de parte o mantenimiento.
  - Botones estilizados de acción: *"Cancelar"* y *"Mover a la papelera"*.
- **Envío a Papelera y Recuperación Garantizada (`deleteParte`)**:
  - Al confirmar, el sistema ejecuta `deleteParte(docId, usuarioNombre, fallbackData)` enviando el registro a la colección de papelera con metadatos completos para permitir su restauración en cualquier momento.
  - Se actualiza de inmediato el almacenamiento local (`firecheck_db_partes`) y el estado React sin requerir recargar la página.

---

## 91. Blindaje Inviolable del Logotipo de GRIMEC en la Esquina Superior Izquierda de Todas las Hojas del Acta PDF (`pdfGenerator.ts`)
- **Ubicación en la Esquina Superior Izquierda de Todas las Hojas**:
  - En el documento Acta de Revisión (`generarActaExtintoresPDF`), se incluye **únicamente el logotipo de GRIMEC** (sin AERME, almacenado en `logoGrimecBase64`) en la **esquina superior izquierda de todas las hojas**:
    1. **Página 1 (Portada — `drawInfoPage`)**: Se coloca en la **esquina superior izquierda** (`x = 14`, `gremioY = 10`, `maxGremioWidth = 22`, `maxGremioHeight = 22`), alineado con el logotipo de la empresa mantenedora a la derecha (`pageWidth - 14 - logoWidth`) y por encima de la línea divisoria (`y = 36`).
    2. **Páginas 2 en adelante (`drawTableHeader`: índice, tablas de sistemas, inventario y firmas)**: Se coloca en la **esquina superior izquierda** (`x = 14`, `gremioY = 4.0`, `maxGremioWidth = 20`, `maxGremioHeight = 20`), por encima de la línea divisoria (`y = 26`) y en simetría con el logotipo de la empresa mantenedora a la derecha (`pageWidth - 14 - logoWidth`).
- **Prioridad y Optimización Obligatoria de Imagen**:
  - La carga de la imagen (`logoGrimecBase64 || empData?.gremioLogoUrl`) DEBE priorizar `logoGrimecBase64` y procesarse incondicionalmente mediante `optimizarImagenParaPDF(gremioLogoRaw, 800, 0.75)` antes de insertarse en el documento, garantizando soporte 100% offline y peso ligero del PDF.
- **Sincronización Dual**:
  - Mantenido de forma idéntica en `src/pdfGenerator.ts` y en `src/recursos-compartidos/services/pdfGenerator.ts`.

---

## 92. Blindaje Inviolable de Eliminación Certera de Equipos y Prevención de Resurrección / Duplicación en Firestore y PDFs
- **Eliminación y Validación Robusta en Firestore (`deleteEquipoInstalado`)**:
  - `deleteEquipoInstalado` en `src/firebase.tsx` DEBE validar incondicionalmente que `centroId`, `sistemaId` y `equipoId` sean válidos y no vacíos. Si faltan `centroId` o `sistemaId`, debe recurrir a `localStorage` (`firecheck_db_equipos_instalados`) para recuperarlos antes de construir la ruta de Firestore (`doc(db, 'centros', cId, 'inventario', sId, 'equipos', targetId)`).
  - `subscribeEquiposInstalados` DEBE inyectar siempre `centroId` y `sistemaId` en cada objeto retornado.
- **Prevención de Resurrección en `RevisionChecklist.tsx`**:
  - Uso obligatorio del registro de exclusión `deletedEquiposIdsRef` (`useRef<Set<string>>(new Set())`).
  - Al eliminar un equipo (`confirmDeleteEquipo`), su ID DEBE registrarse inmediatamente en `deletedEquiposIdsRef`, retirarse de `pendingEquiposRef` e `inFlightSyncRef`, y removerse del estado local `equiposInstalados`, de `firecheck_db_equipos_instalados`, de `updateParteOfflineData` y de Firestore mediante `deleteEquipoInstalado`.
  - El listener de Firestore (`subscribeEquiposInstalados`) DEBE filtrar cualquier equipo presente en `deletedEquiposIdsRef` y en `nuevosLocales` solo DEBE incluir equipos explícitamente registrados en `pendingEquiposRef` que no estén en `deletedEquiposIdsRef`. Queda estrictamente prohibido resucitar equipos no presentes en Firestore.
  - `saveEquiposProgress` DEBE omitir incondicionalmente cualquier equipo presente en `deletedEquiposIdsRef` para no re-crearlo en Firestore con `setDoc({ merge: true })`.
- **Eliminación Inmediata con Latencia Cero en `Centros.tsx` y `oficina/pages/Centros.tsx`**:
  - En `confirmDeleteEquipo`, resolver `centroId` y `sistemaId` con fallback a `centroSeleccionado` y `sistemaSeleccionado`.
  - Actualizar de inmediato el estado local `setEquiposInstalados` y `firecheck_db_equipos_instalados` para latencia cero y ejecutar `deleteEquipoInstalado`.

---

## 93. Blindaje Inviolable de Celdas Combinadas en Cuadro de Control y Datos Generales de Sistemas (Actas PDF - `pdfGenerator.ts`)
- **Fila Combinada de Cuadro de Control (`isCuadroControlPregunta` y `colSpan: 2`)**:
  - En las tablas de sistemas en el Acta PDF (`src/pdfGenerator.ts` y `src/recursos-compartidos/services/pdfGenerator.ts`), toda pregunta referente al cuadro de control (`cuadro de control`, `ubicacion del cuadro del control`, `cuadro de mando`, etc.) y datos de cobertura/referencia DEBEN maquetarse como fila de celda combinada (`colSpan: 2`), eliminando la separación vertical.
  - Fondo amarillo suave reglamentario (`fillColor: [255, 249, 196]`).
  - La pregunta DEBE finalizar obligatoriamente con dos puntos (`:`).
  - La respuesta DEBE dibujarse a la izquierda inmediatamente tras los dos puntos en formato **MAYÚSCULAS** y **NEGRITA** (`fontStyle: 'bold'`).
  - **Exclusión Estricta de Preguntas de Inspección Operativa**: Queda terminantemente prohibido aplicar celda combinada o fondo amarillo a preguntas de inspección operativa (ej. `5.7 Arranque en manual desde el cuadro de control:`). Estas filas se mantienen en color blanco convencional con separación de dos columnas: columna 0 con la pregunta y columna 1 con la respuesta en verde (si es correcto) o rojo (si es no correcto).
- **Anomalías con Encabezado Formato Oración y Línea Divisoria Gris Suave**:
  - En las anomalías de equipos del Acta PDF, el título de equipo DEBE imprimirse como `EQUIPO Nº XX - (Ubicación en formato oración)` con solo la primera letra en mayúscula y entre paréntesis.
  - Separación entre anomalías de distintos equipos mediante una línea divisoria horizontal gris suave (`RGB: [220, 224, 230]`, grosor `0.25 mm`) con espacio simétrico para una legibilidad óptima.
- **Sincronización Dual**:
  - Mantenido de forma idéntica en `src/pdfGenerator.ts` y en `src/recursos-compartidos/services/pdfGenerator.ts`.

---

## 94. Blindaje Inviolable de Sincronización Multi-Técnico y Prevención de Sobreescrituras Concurrentes (`RevisionChecklist.tsx`)
- **Fusión Inteligente con Dirty Tracking en `subscribeEquiposInstalados`**:
  - En la recepción de datos en tiempo real de Firestore, queda ESTRICTAMENTE PROHIBIDO sobreescribir los datos de Firestore con la copia local ciega (`{ ...itemFromFirestore, ...equipoLocalActual }`).
  - Si el equipo NO está siendo editado activamente en este dispositivo (`!pendingEquiposRef.current.has(itemFromFirestore.id)`), Firestore ES la fuente de verdad absoluta y se adopta de inmediato (`fusion = itemFromFirestore`). Si el equipo remoto viene marcado como `revisado: true`, se refleja en estado `'saved'`.
  - Si el equipo tiene cambios locales pendientes en este dispositivo (`pendingEquiposRef.current.has(...)`), se preservan los campos del técnico local sobre la base remota sin descartar campos no conflictivos.
  - Al recibir datos de Firestore, DEBEN actualizarse síncronamente `localStorage` (`firecheck_db_equipos_instalados`) e IndexedDB (`updateParteOfflineData`) para mantener los cachés permanentemente frescos.
- **Prevención de Sobreescritura Masiva en `saveEquiposProgress`**:
  - Queda ESTRICTAMENTE PROHIBIDO que `saveEquiposProgress` envíe a Firestore la lista completa de todos los equipos del centro en un bucle ciego.
  - `saveEquiposProgress` solo DEBE sincronizar con Firestore los equipos que contengan modificaciones locales pendientes (`pendingEquiposRef.current.has(eq.id)`, `eqSyncStates[eq.id] === 'pending'` o creados localmente).
- **Sincronización Bidireccional (Push + Pull) en `handleSincronizarParteCompleto`**:
  - El botón "Sincronizar parte" DEBE ejecutar un ciclo completo de dos vías:
    1. **PUSH**: Sube fotos pendientes (Blob a Storage) y cambios pendientes a Firestore.
    2. **PULL**: Descarga de Firestore (`getEquiposInstalados`) todos los equipos actualizados del centro para todos los sistemas, reconciliándolos con el estado local sin borrar ediciones en curso.
    3. **FEEDBACK**: Muestra mensajes claros al técnico informando del número de cambios subidos y equipos actualizados desde la nube.
- **Guardado Explícito y Controlado por el Técnico ("Equipo revisado")**:
  - Al realizar cambios en checks o texto de un equipo, la sincronización a Firestore es 100% manual y consciente, ejecutándose al pulsar el botón azul **"Equipo revisado"** (`handleGuardarEquipoManual`), al pulsar **"Sincronizar parte"** o al finalizar con firmas.
  - Se prescinde de temporizadores invisibles en segundo plano (debounce) para garantizar estabilidad total en zonas con cobertura intermitente (sótanos/parkings), evitando envíos a medio escribir o colisiones de teclado.
- **Blindaje de Operaciones Masivas y Modales (`handleConfirmarRevisarTodo` y `EquipoFormulario`)**:
  - En la acción "Revisar todo como ok" (`handleConfirmarRevisarTodo`), los equipos del sistema modificado se registran individualmente en `pendingEquiposRef.current`, se encolan en la cola offline (`addPendingSyncItem`) y se sincronizan concurrentemente con Firestore usando `await Promise.allSettled`, asegurando que no queden promesas flotantes ni colisiones con otros técnicos que trabajen en otros sistemas.
  - En la edición modal de equipos (`EquipoFormulario.tsx`), el guardado (`onSave`) registra inmediatamente el equipo modificado en `pendingEquiposRef.current`, persiste en IndexedDB offline y actualiza individualmente en Firestore gestionando los estados `saving`, `saved` y `offline`.

---

## 95. Blindaje Inviolable de Edición Rápida Exclusiva de Estado y Notas en Tareas del Calendario (`Calendario.tsx`)
- **Edición Exclusiva de `Estado` y `Notas / Observaciones` en el Modal de Detalle (`selectedEvento`)**:
  - En el modal de detalle de tarea del calendario (`src/Calendario.tsx`), todos los datos de creación de la tarea (fecha, cliente, centro, técnico, comercial, concepto, etc.) permanecen en modo **solo lectura**, salvo el **Estado** y el campo de **Notas / Observaciones**, que DEBEN ser editables directamente desde el calendario.
  - **Selector de Estado Interactivo (`editEstado`)**: Botones para alternar entre `Pendiente`, `En curso`, `Parado` y `Finalizado`.
  - **Cuadro de Texto de Notas (`editNota`)**: `<textarea>` siempre visible y editable para añadir o modificar comentarios rápidamente.
- **Guardado Directo y Sincronización Dual (`handleGuardarCambiosEvento`)**:
  - El botón **"Guardar cambios"** en el pie del modal DEBE actualizar de forma inmediata tanto el estado local y `localStorage` (`firecheck_db_reparaciones`, `firecheck_db_instalaciones`, `firecheck_db_urgencias`, `firecheck_db_partes`) como el documento correspondiente en Cloud Firestore (`updateReparacion`, `updateInstalacion`, `updateUrgencia`, `updateParte`).

---

## 96. Blindaje Inviolable contra Errores de Cuota de Almacenamiento Local (`QuotaExceededError` / Firestore `ID: b815`) en `main.tsx`
- **Interceptor Global de `Storage.prototype.setItem` (`instalarBlindajeStorageQuota`)**:
  - En `src/main.tsx`, DEBE ejecutarse `instalarBlindajeStorageQuota()` antes de montar Firebase y la aplicación.
  - Si cualquier escritura en `localStorage` (especialmente las claves internas `firestore_*` del SDK de Firestore con `persistentMultipleTabManager`) encuentra `QuotaExceededError`, el interceptor DEBE liberar progresivamente las cachés secundarias de `EVICTABLE_CACHE_PRIORITY` y reintentar la escritura de inmediato para que Firestore jamás aborte con `INTERNAL ASSERTION FAILED (ID: b815)`.
- **Compactación Automática de Imágenes Base64 Masivas en `localStorage` (`compactarPayloadMasivoLocalStorage`)**:
  - Las escrituras en claves espejo `firecheck_db_*` que superen los 250 KB y contengan imágenes/firmas Base64 (`data:image/...`) DEBEN recortar automáticamente dichas cadenas Base64 extensas en la copia de `localStorage`, preservando intactos los datos en Firestore e IndexedDB.
- **Protección Estricta de Sesión (`PROTECTED_STORAGE_KEYS`) y Auto-Recuperación**:
  - Jamás se debe eliminar `firecheck_logged_user` durante la liberación automática de espacio. Si se detecta un estado previo bloqueado por `QuotaExceededError` o `b815`, el sistema sanea las cachés secundarias y se recupera automáticamente sin cerrar la sesión del usuario.

---

## 97. Blindaje Inviolable de Casilla "Fecha confirmada" y Prefijo de Asterisco (`* `) en Tareas del Calendario (`Calendario.tsx` y `firebase.tsx`)
- **Casilla de Verificación en el Modal de Detalle (`editFechaConfirmada`)**:
  - En el modal de detalle de tarea del calendario (`src/Calendario.tsx`), al lado de **"Fecha programada"** DEBE mostrarse el check interactivo **"Fecha confirmada"** para los 4 tipos de tareas (`Mantenimientos`, `Reparaciones`, `Instalaciones` y `Urgencias`).
- **Prefijo Visual con Asterisco Destacado (`* `) en la Cuadrícula del Calendario**:
  - Cuando una tarea tiene `fechaConfirmada: true`, DEBE mostrarse al principio de la etiqueta en la celda del calendario un asterisco ligeramente más grande seguido de un espacio antes de la sigla (`* Rev.`, `* Rep.`, `* Inst.`, `* Urg.`).
- **Persistencia Dual y Suscripción en Tiempo Real (`firebase.tsx`)**:
  - Al pulsar **"Guardar cambios"**, el estado `fechaConfirmada` se guarda en `localStorage` y en Firestore (`updateParte`, `updateReparacion`, `updateInstalacion`, `updateUrgencia`), y los listeners `subscribeReparaciones`, `subscribeInstalaciones` y `subscribeUrgencias` en `src/firebase.tsx` DEBEN mapear siempre `fechaConfirmada: Boolean(d.fechaConfirmada)`.

---

## 98. Blindaje Inviolable del Flujo Comercial Completo (`Presupuestos ➔ Pedidos ➔ Albaranes ➔ Facturación`) y Factura Oficial PDF con `VERI*FACTU` (`Pedidos.tsx`, `Albaranes.tsx`, `Facturas.tsx`)
- **Submenú Comercial en `Sidebar.tsx` y Rutas en `App.tsx`**:
  - El menú desplegable `Comercial` DEBE listar en orden: `Presupuestos` (`/presupuestos`), `Pedidos` (`/pedidos`) y `Facturación` (`/facturas`).
- **Módulo de Pedidos (`src/Pedidos.tsx`)**:
  - Vista principal en formato **Tabla** ordenable por columnas (`sortField`, `sortDirection`) con buscador y filtros de estado.
  - En la columna `Acciones`, botón de icono de hoja con la letra **"A"** (`handleCrearAlbaranDesdePedido`) para generar directamente el Albarán vinculado al pedido.
- **Conexión Directa Albaranes ➔ Facturación (`src/Albaranes.tsx`)**:
  - En la columna `Acciones` de la tabla de Albaranes, DEBE mantenerse el botón con el icono de hoja y la letra **"F"** que redirige a `/facturas?fromAlbaran=...` precargando todos los datos e importes del albarán (o abriendo la factura ya emitida si el albarán ya está facturado).
- **Módulo de Facturación y PDF Oficial ABANFOC S.L. (`src/Facturas.tsx` y `src/firebase.tsx`)**:
  - **Panel KPI y Bandeja de Albaranes Pendientes**: 4 tarjetas superiores de resumen (`Total Facturado`, `Cobrado`, `Pendiente de Cobro`, `Albaranes por Facturar`) y bandeja compacta de **"Albaranes pendientes de facturar"** con contenedor desplazable (`max-h-[142px] overflow-y-auto`) que muestra todos los albaranes pendientes sin recortar la lista (8 visibles de un vistazo en cuadrícula de 4 columnas y scroll vertical para el resto).
  - **PDF Oficial de Factura (`generarFacturaOficialPDF`) y Código QR `VERI*FACTU`**:
    - Maquetación corporativa de **ABANFOC S.L.** con cabecera, datos de emisor y cliente, centro de trabajo, tabla de líneas de facturación, resumen de Base Imponible, IVA y Total Factura, condiciones de pago / IBAN y pie registral.
    - A la izquierda del bloque de totales (tanto en el PDF generado como en la vista previa del modal) DEBE incluirse el bloque **`QR tributario:`** con el código QR escaneable generado localmente (`generarQRVerifactuDataUrl('https://www.abanfoc.es')` optimizado en JPEG) y la leyenda **`VERI*FACTU`** debajo.
  - **Sincronización Cruzada en Firestore y LocalStorage**:
    - Al guardar una factura vinculada a un albarán (`albaranId`), DEBE marcarse automáticamente dicho albarán como `facturado: true` y vincularse con `facturaId` y `facturaNumero` en Firestore y `localStorage`.

---

## 99. Blindaje Inviolable del Formulario de Albarán Unificado en Avisos, Reparaciones e Instalaciones (`Urgencias.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx`)
- **Estructura idéntica al Albarán**: Al crear o editar un Aviso (Urgencia), una Reparación o una Instalación, el modal DEBE contener la misma estructura completa de datos que el albarán:
  - **Empresa Mantenedora**: Selector obligatorio con vista previa de nombre, CIF, dirección y logotipo oficial.
  - **Cliente y Centro**: Selector con buscador integrado (`SearchableSelect`) y compatibilidad para clientes y centros no registrados (`clienteNombreLibre`, `centroNombreLibre`).
  - **Número de Pedido**: Campo autogenerado de forma correlativa e indeleble (`PDV.YYXXX`), no duplicable.
  - **Fecha y Título**: Campos obligatorios con fecha del día por defecto y título descriptivo del trabajo.
  - **Tabla de Partidas / Líneas**: Tabla de desglose con columnas para `Orden`, `Cant.` (mínimo 1), `Concepto` (con categorías dinámicas `trabajosConfig`), `Descripción` (con modal flotante para ampliar texto largo), `P. Unidad` y `Subtotal` calculado automáticamente.
- **Persistencia y Vinculación**: Toda tarea guarda sus líneas (`items`), `total`, `empresaId`, `clienteId`, `centroId` y `numeroPedido`, permitiendo transferir los datos al 100% sin pérdida hacia albaranes, pedidos o facturas.

---

## 100. Blindaje Inviolable de Numeración Secuencial Unificada y No Duplicable (`PRE.YYXXX` ➔ `PDV.YYXXX` ➔ `ALB.YYXXX` / `contadores/pedidos_secuencia`) y Referencia en Facturación (`firebase.tsx`, `Facturas.tsx`)
- **Cadena Numérica Compartida e Identificador Universal**:
  - Toda propuesta o trabajo que avanza por el ciclo comercial mantiene el mismo sufijo correlativo del año (`YYXXX`, ej. `26001`):
    - **Presupuesto**: `PRE.YYXXX` (ej. `PRE.26001`).
    - **Pedido**: `PDV.YYXXX` (ej. `PDV.26001`).
    - **Albarán**: `ALB.YYXXX` (ej. `ALB.26001`).
- **Prevención Absoluta de Duplicados (`obtenerSiguienteNumeroPedido` y `obtenerSiguienteNumeroAlbaran`)**:
  - Contador centralizado en Firestore `contadores/pedidos_secuencia` ejecutado bajo transacción atómica.
  - Escaneo preventivo multi-colección (`pedidos`, `albaranes`, `reparaciones`, `instalaciones`, `urgencias`, `presupuestos`) tanto en Firestore como en `localStorage` (`firecheck_ultimo_pedido_secuencia`) para determinar el número más alto existente y prevenir colisiones.
  - Extractor universal de sufijo (`extraerSufijoSecuencia`) para compatibilidad total con formatos históricos (`ALB-26-001`, `PDV 26001`, `PRE.26001`, etc.).
- **Facturación Independiente con Referencia Exclusiva a Albarán (`Facturas.tsx`)**:
  - Las facturas mantienen su serie y numeración legal correlativa independiente (`FAC-2026-XXX`), pero DEBEN mostrar e imprimir explícitamente en el cuerpo y PDF únicamente la referencia del albarán:
    - `Ref. Albarán: ALB.YYXXX` (quedando excluida la referencia del pedido en la factura emitida y su PDF).
  - **Exclusión Absoluta de Referencia a Pedido en Observaciones (`limpiarNotasFactura`)**:
    - En el recuadro inferior de **"OBSERVACIONES"** del PDF oficial y en el campo de notas del formulario, queda estrictamente prohibido incluir o mantener menciones a "pedido", "pedido de venta" o "(Pedido PDV.XXXXX)".
    - La referencia debe ser única y exclusivamente al albarán: `Factura emitida conforme al Albarán firmado ALB.YYXXX.`, saneando tanto facturas nuevas como existentes mediante la función `limpiarNotasFactura`.

---

## 101. Blindaje Inviolable de Empresa Mantenedora Predeterminada ABANFOC (`obtenerEmpresaPorDefecto` en `firebase.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`, `Albaranes.tsx`, `Pedidos.tsx`)
- **Prioridad Absoluta a ABANFOC S.L.**:
  - Al abrir un nuevo formulario de Aviso, Reparación, Instalación, Albarán o Pedido, la empresa mantenedora seleccionada por defecto DEBE ser incondicionalmente **ABANFOC** mediante `obtenerEmpresaPorDefecto(empresas)`.
  - Queda estrictamente prohibido asignar como valor por defecto la primera empresa alfabética (como ocurría con Sertec) cuando exista ABANFOC registrada.
- **Acceso Inmediato y Respaldo Local**:
  - `obtenerEmpresaPorDefecto` inspecciona la lista en memoria y, de estar vacía durante la inicialización, recurre a `firecheck_db_empresas` / `firecheck_db_empresa` en `localStorage` para garantizar respuesta síncrona sin retardo visual.
  - Sincronización reactiva mediante `useEffect` en formularios abiertos para actualizar la empresa a ABANFOC en cuanto los datos de Firestore se confirmen.

---

## 102. Blindaje Inviolable de Reordenación de Líneas de Artículos con Drag & Drop y Botones Subir/Bajar (`Albaranes.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`)
- **Doble Mecanismo de Reordenamiento**:
  - Todas las tablas de partidas de albaranes y tareas asociadas DEBEN permitir reordenar sus líneas mediante:
    1. **Arrastrar y soltar (Drag & Drop)**: Icono de agarre `GripVertical` (`⋮⋮`) con atributo `draggable`, manejadores `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd` y retroalimentación visual (`bg-violet-50` / `border-violet-500` o `bg-red-50` / `border-red-500`).
    2. **Botones de desplazamiento paso a paso**: Botones `ChevronUp` (`▲ Subir`) y `ChevronDown` (`▼ Bajar`) con control de límites deshabilitados en primer y último elemento (`disabled={index === 0}`, `disabled={index === length - 1}`).
- **Soporte Completo en Escritorio y Móvil**:
  - En escritorio: Columna dedicada **"Orden"** en la cabecera `<thead>` de la tabla.
  - En móvil: Bloque compacto de controles de orden integrado en la tarjeta de cada partida.
- **Integridad de Datos**: El intercambio de posiciones (`handleMoverLinea` / `handleDrop`) preserva íntegros los conceptos, descripciones, cantidades, precios y subtotales sin recalcular erróneamente ni perder datos.

---

## 103. Blindaje Inviolable de Campo Fecha Creación en Presupuestos (`Presupuestos.tsx`)
- **Etiqueta Reglamentaria "Fecha creación"**:
  - En el formulario de creación, edición y duplicación de presupuestos (`Presupuestos.tsx`), el campo del calendario selector de fecha DEBE etiquetarse de forma permanente e incondicional como **"Fecha creación"** (sustituyendo la antigua etiqueta "Fecha de validez").
- **Precarga Automática del Día en Curso**:
  - Al abrir un presupuesto nuevo (`handleNuevo`), el campo de fecha debe precargarse automáticamente con la fecha actual del sistema (`new Date().toISOString().slice(0, 10)`).
- **Mapeo Bidireccional y Compatibilidad Absoluta**:
  - El valor seleccionado se persiste tanto en `fechaCreacion` como en `fechaValidez` para mantener 100% de compatibilidad con presupuestos históricos y los generadores de PDF oficiales de presupuestos y pedidos de venta.

---

## 104. Blindaje Inviolable de Controles Compactos en Cabecera, Tablas Gris Neutro y Paginación en Avisos, Reparaciones, Instalaciones y Revisiones (`Urgencias.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx`, `Revisiones.tsx`)
- **Cabecera y Controles Reubicados**:
  - En los cuatro módulos de operaciones (`Urgencias.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx` y `Revisiones.tsx`), se eliminan las 5 tarjetas métricas intermedias y las barras separadas de filtros inferiores.
  - El campo de búsqueda compacto (`w-44 sm:w-48 lg:w-52`) y los desplegables de filtrado DEBEN ubicarse exclusivamente en la barra superior de cabecera junto al título de la vista.
  - El desplegable de estado DEBE incluir el recuento en tiempo real de cada estado: `Todos los estados (X)`, `Pendientes (X)` (o `Planificado (X)`), `En curso (X)`, `Parados (X)`, `Finalizados (X)`.
  - En `Revisiones.tsx`, el desplegable de tipos de revisión DEBE incluir el recuento en tiempo real: `Todos los tipos (X)`, `Anual (X)`, `Trimestral (X)`, `Semestral (X)`, `Mensual (X)`.
- **Estilizado de Tablas Gris Neutro y Filas Cebra**:
  - Las cabeceras `<thead> <tr ...>` DEBEN utilizar el estilo gris uniforme: `bg-zinc-200/90 border-b border-zinc-300 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700` con espaciado vertical compacto (`py-3`).
  - Las filas del cuerpo `<tbody>` DEBEN alternar color cebra (`index % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'`), resaltar en tono ámbar al posar el cursor (`hover:bg-amber-100/90 hover:shadow-xs`) y tener un padding de celda optimizado (`py-2.5`).
- **Paginación y Límite Inicial de 10 Elementos**:
  - Todas las tablas deben mostrar inicialmente las **10** tareas más recientes o prioritarias mediante su respectivo estado (`limiteUrgencias`, `limiteReparaciones`, `limiteInstalaciones`, `limiteRevisiones`).
  - Debajo de cada tabla DEBE ubicarse una barra de selector de límite permitiendo elegir entre **10, 20, 50, 100, 200 o Mostrar todos**.
  - Al ingresar o montar la vista, DEBE ejecutarse incondicionalmente `window.scrollTo(0, 0)`.

---

## 105. Blindaje Inviolable del Calendario y Columna Lateral de Tareas en Planificación (`Planificacion.tsx`)
- **Cabecera del Calendario en Gris Neutro Cohesivo**:
  - La barra superior del mes en el calendario DEBE lucir el estilo gris corporativo de las tablas: `px-6 py-3.5 border-b border-zinc-300 bg-zinc-200/90` con tipografía negra `font-black text-zinc-800`.
  - La fila de encabezados de días de la semana (`Lun`, `Mar`, `Mié`, `Jue`, `Vie`, etc.) DEBE lucir en gris suave `bg-zinc-100 border-b border-zinc-300` con texto en mayúsculas `text-[11px] font-extrabold uppercase tracking-wider text-zinc-700`.
- **Columna Lateral de Tareas a Planificar Simétrica y con Toques de Color**:
  - El panel lateral izquierdo (`w-full lg:w-80 xl:w-88`) DEBE estructurarse con `overflow-hidden` y una cabecera superior en `bg-zinc-200/90 border-b border-zinc-300` con título **"Tareas a Planificar"**, icono `Calendar` en rojo y distintivo contador con el número de centros pendientes de programar.
  - La subcabecera del selector de mes DEBE ubicarse en `bg-zinc-100 border-b border-zinc-300`, alineada en altura con los días del calendario.
  - Las tarjetas de centros en la lista vertical DEBEN diferenciarse visualmente con bordes y acentos cromáticos según su periodicidad:
    - **Revisión Anual**: `border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/20 border-amber-200/90`.
    - **Revisión Trimestral**: `border-l-4 border-l-sky-500 bg-gradient-to-br from-sky-50/80 via-white to-sky-50/20 border-sky-200/90`.
    - **Revisión Mensual**: `border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/20 border-emerald-200/90`.
  - Conservación íntegra de la interactividad Drag & Drop bidireccional (`onDragOver={onDragOver}`, `onDrop={onDropSidebar}`).

---

## 106. Blindaje Inviolable de Numeración de Sistemas con Prefijo "S" en Editor de Plantillas (`FormBuilderPlantillas.tsx`, `plantillas.ts`, `types/plantillas.ts`)
- **Campo de Código de Sistema "S"**:
  - En el editor de plantillas de sistemas (`FormBuilderPlantillas.tsx` y `oficina/pages/FormBuilderPlantillas.tsx`), cada sistema cuenta con un campo dedicado junto al título para ingresar el número de sistema.
  - El campo muestra de forma permanente y en negrita el prefijo **"S"** a la izquierda (`font-black text-slate-800`), persistiendo el código en la propiedad `codigoSistema` (ej. `S01`).
- **Definición de Tipos y Plantillas Predeterminadas**:
  - El tipo `PlantillaSistema` en `plantillas.ts` y `recursos-compartidos/types/plantillas.ts` incluye opcionalmente `codigoSistema?: string;`.
  - Las plantillas de sistemas predefinidas conservan sus códigos `S01`, `S02`, etc., facilitando su identificación y referencia en conceptos de facturación y albaranes.

---

## 107. Blindaje Inviolable de Tablas Limpias en 1 Sola Fila, Columnas Adaptables al Espacio sin Columna de Acciones y Apertura de Acciones al Pulsar en la Línea (`Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`, `Revisiones.tsx`, `Pedidos.tsx`, `Albaranes.tsx`, `Facturas.tsx`)
- **Diseño Limpio en 1 Sola Fila por Registro y Columnas Fluidas**:
  - En los módulos de gestión (`Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`, `Revisiones.tsx`, `Pedidos.tsx`, `Albaranes.tsx`, `Facturas.tsx`), toda la información de cada registro DEBE mostrarse en una sola fila plana sin saltos de línea amontonados debajo del título o cliente.
  - La tipografía se mantiene suave y legible (`font-medium text-slate-700/800`), eliminando negritas agresivas innecesarias.
  - Las columnas se adaptan de forma fluida y proporcional al ancho de pantalla disponible, dando espacio generoso a descripciones, títulos y lugares para evitar cortes prematuros o huecos vacíos.
  - En la fecha se utiliza el icono `Calendar` en rojo (`text-red-500`). En Reparaciones, Instalaciones y Urgencias, el icono genérico izquierdo fue sustituido por la referencia directa de la tarea.
- **Supresión de la Columna de Acciones y Apertura al Pulsar en Cualquier Parte de la Línea**:
  - En `Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx` y `Revisiones.tsx`, se suprime la columna redundante de "Acciones".
  - Al pulsar en cualquier parte de la fila (con cursor `cursor-pointer`), se despliega la ventana modal (`accionesModalItem`) con fondo difuminado (`backdrop-blur-sm`).
  - La cabecera del modal cuenta con el icono interactivo de la mano con botones (`HandOptionsIcon`), reuniendo todas las operaciones del registro de forma accesible, ordenada y limpia.
  - En la celda de notas, el botón `StickyNote` utiliza `e.stopPropagation()` para abrir directamente la edición rápida de notas sin disparar el modal general de acciones.

---

## 108. Blindaje Inviolable de Descargas de Pedidos de Venta Valorados y Sin Valorar para Operarios (`Pedidos.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`)
- **Doble Modalidad de Descarga del Pedido de Venta (PDV)**:
  - En el modal de acciones de Pedidos de Venta (`Pedidos.tsx`), Reparaciones (`Reparaciones.tsx`), Instalaciones (`Instalaciones.tsx`) y Avisos/Urgencias (`Urgencias.tsx`), se ofrecen dos modalidades de descarga del Pedido de Venta:
    1. **Valorado**: Descarga completa con precios e importes para control de gestión o cliente.
    2. **Sin valorar (para operario)**: Descarga oficial adaptada sin precios para entregar al técnico u operario que ejecutará el trabajo en obra o cliente.

---

## 109. Blindaje Inviolable de Tablas Limpias en 1 Sola Fila, Cabecera Gris Neutro, Filas Cebra, Paginación de 10 Elementos, Columnas Adaptables al Espacio sin Columna de Acciones y Apertura de Acciones al Pulsar en Cualquier Parte de la Línea (`Clientes.tsx`, `Centros.tsx`, `Catalogo.tsx`, `Articulos.tsx`)
- **Cabecera Gris Neutro y Filas Cebra Adaptables al Ancho**:
  - En los directorios de Clientes (`Clientes.tsx`), Centros (`Centros.tsx`) y Catálogo de Artículos (`Catalogo.tsx`, `Articulos.tsx`), las tablas lucen cabecera gris uniforme: `bg-zinc-200/90 border-b border-zinc-300 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700` con espaciado vertical compacto (`py-3`).
  - Las filas alternan diseño cebra (`index % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'`), resaltan en tono ámbar suave al pasar el ratón (`hover:bg-amber-100/90 hover:shadow-xs`) y mantienen toda la información en 1 sola fila plana con tipografía limpia y suave (`font-medium text-slate-700/800`).
  - **Distribución Proporcional y Fluida**: Las columnas se adaptan armoniosamente a la pantalla aprovechando todo el ancho sin cortes abruptos ni espacios vacíos desproporcionados.
- **Supresión de la Columna de Acciones y Apertura al Pulsar en Cualquier Parte de la Línea**:
  - Se elimina la columna redundante de "Acciones" tanto de la cabecera como del extremo derecho de las filas.
  - Al hacer clic en cualquier parte de la fila (o tarjeta móvil), se abre automáticamente el modal flotante de acciones agrupadas (`accionesModalItem`).
  - El modal cuenta con cabecera estilizada con el icono interactivo de la mano con botones de opciones (`HandOptionsIcon`), tarjeta de resumen y accesos directos completos (Ver Ficha, Editar, Duplicar, Eliminar).
- **Paginación y Selector de Límite (10 inicial)**:
  - Inicialmente se muestran 10 registros (`limiteClientes`, `limiteCentros`, `limiteArticulos`), con una barra inferior que informa del número total de elementos y un selector para elegir entre **10, 20, 50, 100, 200 o Mostrar todos**.
- **Buscador Compacto Integrado en la Fila Superior de Acciones**:
  - En Clientes, Centros y Catálogo, el buscador ya no ocupa una franja independiente completa de ancho total debajo de la cabecera.
  - Se integra de forma compacta (`w-48 sm:w-60 lg:w-72`) en la misma fila de los botones superiores de acción (`+ Nuevo...`, `Importar`, `Exportar`), optimizando el espacio visual de la pantalla.
- **Cabecera Limpia sin Botón 'Volver al panel'**:
  - En `Clientes.tsx`, `Centros.tsx`, `Catalogo.tsx` y `ClientesCentros.tsx` (así como sus réplicas en `src/oficina/pages/`), se suprime permanentemente el botón superior `"Volver al panel"`, permitiendo que el título principal y la barra de búsqueda y acciones ocupen limpiamente la parte superior sin elementos redundantes.

---

## 110. Blindaje Inviolable del Diseño Visual de Casillas en el Calendario: Días con Línea Roja, Contador de Tareas en Número Azul Pequeño sobre la Scrollbar y Scrollbar Negra (`Calendario.tsx`, `Planificacion.tsx`)
- **Diferenciación del Número de Día**:
  - El día **"Hoy"** (`isToday`) resalta con fondo rojo sólido y texto blanco (`bg-red-600 text-white shadow-xs shadow-red-500/30`).
  - Los **demás días del mes actual** (`d.currentMonth && !isToday`) llevan un marco perimetral con línea roja sin fondo (`border border-red-500 text-slate-900 bg-transparent`), diferenciando nítidamente el número del día.
  - Los días fuera del mes actual se muestran atenuados (`text-slate-400`).
- **Contador de Cantidad de Tareas en Número Azul Vivo sobre la Scrollbar**:
  - En la esquina superior derecha de cada celda con eventos o tareas registradas, colocado directamente encima de la barra de desplazamiento, la cantidad se muestra como un **número pequeño en azul vivo sin fondo** (`text-blue-500 font-black`), diferenciando claramente la cantidad de tareas respecto al día de forma limpia, visible, sutil y elegante.
- **Barra de Desplazamiento (Scrollbar) en Negro**:
  - La lista de tareas dentro de cada celda de día cuenta con barra de desplazamiento en negro (`scrollbar-color: #000000 transparent`, `::-webkit-scrollbar-thumb { background: #000000; }`), permitiendo al usuario identificar de inmediato cuándo una celda contiene más tareas ocultas por desbordamiento vertical.
- **Cabecera con Color de Días de la Semana**:
  - La fila superior con los días de la semana cuenta con fondo gris neutro sólido y definido (`bg-zinc-200/90 border-b border-zinc-300 divide-x divide-zinc-300/60`), con tipografía oscura destacada (`text-zinc-800 font-black`) y fines de semana resaltados en rojo (`text-red-600 font-black`), eliminando fondos blancos descoloridos o camuflados.

---

## 111. Blindaje Inviolable del Icono Vectorial de Mano con Botones de Opciones 1-2-3 (`HandOptionsIcon.tsx`)
- **Geometría y Fidelidad Vectorial**:
  - El componente `src/components/HandOptionsIcon.tsx` sustituye de forma permanente al icono anterior de varita mágica para la representación interactiva de acciones y opciones al pulsar en las filas de las tablas.
  - Consta de una composición SVG con `viewBox="0 0 100 100"`:
    1. **Botones superiores circulares**: Tres botones rotulados con los dígitos `1`, `2` y `3`. El botón central `2` cuenta con un arco abierto en su parte inferior donde penetra la punta del dedo índice al pulsarlo.
    2. **Contorno continuo de la mano**: Trazo uniforme con pulgar en cuña a la izquierda, dedo índice vertical extendido hacia el botón central, y tres nudillos plegados en el lateral derecho de la palma.
    3. **Muñeca y manga**: Collarín horizontal tipo cápsula y puño de manga redondeado.
  - Queda prohibido volver a renderizar iconos genéricos o sustitutos que desvirtúen esta iconografía corporativa.

---

## 112. Blindaje Inviolable de Tablas a Ancho Completo sin Columna de Acciones y Apertura al Pulsar en Cualquier Punto de la Fila (`Revisiones.tsx`, `Instalaciones.tsx`, `Reparaciones.tsx`, `Urgencias.tsx`, `PruebasTecnicas.tsx`)
- **Apertura de Acciones al Pulsar en la Línea**:
  - Se suprime la columna rígida de "ACCIONES".
  - Al pulsar en cualquier punto de la fila del registro, se despliega automáticamente el modal flotante de acciones agrupadas (`accionesModalItem`) con fondo difuminado (`backdrop-blur-sm`).
  - En la cabecera de este modal se muestra obligatoriamente el icono `HandOptionsIcon` en un contenedor estilizado.
- **Filas Planas y Prevención de Desbordamiento**:
  - En todos estos módulos, cada fila se mantiene estrictamente en una sola línea plana con efecto cebra (`bg-white` / `bg-slate-100/80`) y resaltado ámbar al posar el cursor (`hover:bg-amber-100/90`).
  - Las celdas deben incorporar `whitespace-nowrap` y textos con `title={...}` para que los datos respiren con fluidez a través de la pantalla sin montarse en dos líneas.
- **Retirada del Botón "Volver al panel"**:
  - En `Revisiones.tsx`, se mantiene permanentemente retirado el botón superior "Volver al panel".

---

## 113. Blindaje Inviolable del Módulo Pruebas Técnicas con 2 Pestañas Estilizadas y Tabla a Ancho Completo (`PruebasTecnicas.tsx`)
- **Estructura por 2 Pestañas Estacionales**:
  - El módulo muestra directamente una vista de tabla organizada por 2 pestañas principales con distintivos numéricos de conteo en tiempo real y degradados estacionales:
    1. **Pruebas con Red Pública** (`activeTab === 'red-publica'`, azul/índigo con icono `Droplets` y contador numérico).
    2. **Pruebas con Grupos de Presión** (`activeTab === 'grupo-presion'`, ámbar/naranja con icono `Activity` y contador numérico).
- **Aprovechamiento Integral del Ancho de Pantalla**:
  - El contenedor principal de la tabla utiliza `w-full px-4 sm:px-8 py-6` sin restricciones artificiales de `max-w-7xl`, expandiéndose en monitores panorámicos.
- **Acciones Agrupadas y Descargas**:
  - Al hacer clic en cualquier fila de la tabla se abre el modal de acciones (`HandOptionsIcon`) con las opciones: "Cargar y Ver Curva P-Q", "Descargar Informe PDF Oficial", "Descargar Pedido de Venta (PDV)" y "Eliminar Ensayo".
- **Persistencia Dual Inmediata**:
  - Sincronización en tiempo real con Firestore (`pruebas_tecnicas`) y almacenamiento instantáneo local en `localStorage` (`firecheck_db_pruebas_tecnicas`).

---

## 114. Blindaje Inviolable del Título Oficial Listado de mantenimientos anuales "LISTMAN" (`Revisiones.tsx`, `src/mantenimientos/pages/Revisiones.tsx`, `App.tsx`)
- **Texto Exacto del Título**:
  - En la cabecera principal del módulo de Revisiones (`Revisiones.tsx` y su ruta homóloga `src/mantenimientos/pages/Revisiones.tsx`), el título oficial DEBE ser obligatoriamente:
    `Listado de mantenimientos anuales "LISTMAN"` (con las comillas dobles explícitas en `"LISTMAN"`).
  - Queda prohibido volver a titularlo "Planificación de Revisiones".
  - En el panel principal del Dashboard (`App.tsx`), el tooltip de acceso directo correspondiente DEBE reflejar: `Ir al módulo Listado de mantenimientos anuales "LISTMAN"`.

---

## 115. Blindaje Inviolable de Cabecera Ampliada y Modal en Lista con Scroll en Facturación (`Facturas.tsx`)
- **Subtítulo Oficial y Tarjetas KPI Ampliadas**:
  - En la cabecera de `Facturas.tsx`, debajo del título "Facturación", el subtítulo oficial es:
    `Emisión de facturas a partir de albaranes finalizados`.
  - Las 4 tarjetas KPI de importes (`Facturado`, `Cobrado`, `Pendiente`, `Vencido`) se expanden a lo largo del encabezado (`flex-1 xl:ml-8`) con espaciado amplio (`px-4 sm:px-5 py-3.5`), iconos de `11x11` y cifras en `text-base sm:text-lg lg:text-xl font-black`.
- **Modal de Albaranes Listos para Facturar en 1 Sola Línea con Scroll**:
  - Al pulsar "Lista de albaranes para facturar" (`showModalAlbaranesPendientes`), la ventana modal (`max-w-5xl`) DEBE renderizar los albaranes en formato de **lista donde cada albarán se muestra en una sola línea horizontal**:
    1. Código (`ALB-YY-XXX`) y fecha.
    2. Nombre del cliente y concepto / centro de trabajo.
    3. Insignia de estado de firma (`Firmado` / `Sin firma`).
    4. Importe base `+ IVA`.
    5. Botón interactivo `+ Facturar`.
  - El contenedor de la lista cuenta con scroll vertical independiente (`overflow-y-auto flex-1`), garantizando una navegación ágil sin que la ventana modal se desborde o se recorte independientemente del número de albaranes registrados.

---

## 116. Blindaje Inviolable de Tabla Limpia sin Columna de Acciones, Cliente sin Negrita, Filtro Inicial Planificados y Modal Flotante de Acciones al Pulsar en Fila en Partes de Trabajo (`Partes.tsx`)
- **Columna Cliente sin Negrita**:
  - En la tabla de partes de trabajo (`src/Partes.tsx`), el nombre del cliente se muestra con tipografía normal sin negrita (`font-medium text-zinc-800 text-sm`), homologado con el resto de módulos del sistema.
- **Filtro Inicial Obligatorio en Partes Planificados**:
  - El estado inicial de filtro por estado debe ser `useState('Abierto')` (etiquetado como "Planificado"), cargando por defecto de forma automática los partes abiertos/planificados para agilizar el trabajo diario.
- **Sustitución de la Columna Rígida de Acciones por Columna Limpia de Estado**:
  - Se suprime la cabecera fija `Acciones` y su celda de botones, reemplazándose por la columna `Estado`.
  - La celda de estado integra la luz de estado (`bg-black` para Cerrado, `bg-green-500` para Pre-Cerrado, `bg-blue-500` para Finalizado, `bg-yellow-500` para En revisión, `bg-zinc-400` para Planificado), la bola roja parpadeante si `tieneRetimbrePendiente(parte)`, y el texto legible del estado.
- **Fila Interactiva y Modal Flotante de Acciones Rápidas (`accionesModalItem`)**:
  - Toda la fila (`<tr>`) es interactiva (`cursor-pointer`) y al hacer clic en cualquier parte se abre el modal flotante (`accionesModalItem`):
    - Cabecera oscura con el icono oficial `HandOptionsIcon` en recuadro ámbar y título "Acciones del Parte de Trabajo".
    - Tarjeta de resumen con número de parte, tipo de revisión con color, nombre del cliente, centro, población, fecha planificada y estado.
    - Botón **Ver / Revisar Parte**: acceso directo al checklist y formulario (`irARevision(item)`).
    - Botón **Descargar Documentos Oficiales**: abre el asistente de descarga de PDFs (Acta, Certificado y Albarán) mediante `openDownloadModal(item)`.
    - Botón **Confirmar Devolución de Extintores**: si `tieneRetimbrePendiente(item)`, permite confirmar la entrega de los equipos retimbrados.
    - Botón **Eliminar Parte de Trabajo**: acceso para mover a la papelera (`eliminarParte(item)`) con la confirmación de seguridad reglamentaria.

---

## 117. Blindaje Inviolable del Rediseño del Módulo Certificados con Cabecera Integrada, Filtros con Colores Suaves, Buscador Compacto, Botón Único de Creación, Columna de Número de Certificado Ampliada y Tabla Cebra con Límite de 10 (`Certificados.tsx`)
- **Cabecera Integrada en una Sola Franja sin Botón 'Volver al panel'**:
  - En `src/Certificados.tsx`, el subtítulo oficial es: `Gestión y edición de certificados`.
  - Quedan suprimidas permanentemente las 6 tarjetas de categoría de gran tamaño de la cabecera.
  - A la derecha del campo de búsqueda se sitúa el botón único de creación: `+ Crear nuevo certificado` (`handleOpenCreateModal()`).
  - Todo el bloque superior (título, filtros, buscador y botón de crear) se unifica en una sola línea integrada, haciendo que la tabla suba a la parte superior de la pantalla.
- **Filtros por Categoría con Paleta Reglamentaria de Colores Suaves (`FILTER_STYLES`)**:
  - `instalacion`: rojo suave (`bg-red-50 text-red-700 border-red-200`).
  - `reparacion`: azul suave (`bg-blue-50 text-blue-700 border-blue-200`).
  - `revision`: amarillo suave (`bg-amber-50 text-amber-800 border-amber-200`).
  - `puesta_en_marcha`: lila suave (`bg-purple-50 text-purple-700 border-purple-200`).
  - `obligacion_salarial`: verde suave (`bg-emerald-50 text-emerald-700 border-emerald-200`).
  - `generico`: naranja suave (`bg-orange-50 text-orange-700 border-orange-200`).
  - `todos`: gris neutro (`bg-zinc-100 text-zinc-700 border-zinc-200`).
  - Cada botón incorpora su icono correspondiente y distintivo numérico de conteo de certificados.
- **Buscador Compacto Integrado**:
  - Campo de texto `Buscar certificado...` (`w-44 sm:w-56 lg:w-64`) con icono de lupa y botón `X` de limpieza rápida.
- **Tabla Cebra con Columna de Número de Certificado Ampliada (`w-52`)**:
  - La primera columna (`Nº Certificado`) cuenta con un ancho mínimo obligatorio de 208px (`w-52`) y clase `whitespace-nowrap`, garantizando que el código identificativo completo y el badge `Manual` se muestren siempre en una única línea plana.
  - Cabecera con fondo gris destacado (`bg-zinc-200/90 border-b border-zinc-300 px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700`).
  - Filas alternadas en cebra (`bg-white` / `bg-slate-100/80`) con efecto hover ámbar (`hover:bg-amber-100/90`).
  - Nombre del cliente en tipografía normal sin negrita (`font-medium text-zinc-800`).
- **Modal Flotante de Acciones Rápidas (`accionesModalItem`) con `HandOptionsIcon`**:
  - Al hacer clic en cualquier punto de la fila se despliega el modal flotante (`accionesModalItem`) con cabecera oscura `bg-slate-900`, icono oficial `HandOptionsIcon` en recuadro ámbar, tarjeta de resumen y botones para:
    1. *Ver Detalle Completo* (`handleViewDetail`).
    2. *Ver Documento PDF Oficial* en nueva pestaña (`handleViewPDF`).
    3. *Descargar Certificado PDF* (`handleGenerarPDF`).
    4. *Editar Certificado* (`handleOpenEditModal`).
    5. *Eliminar Certificado* (`handleDeleteCertificado`).
- **Paginación y Límite Inicial de 10 Elementos**:
  - Carga inicial limitada a 10 certificados (`useState<number | 'todos'>(10)`), con selector de 10, 20, 50, 100, 200 o Todos, y barra inferior con conteo global.

---

## 118. Blindaje Inviolable de Tabla de Inventario e Información de Recipientes en Extinción Automática con Gas, Anomalía de Retimbrado > 10 Años, Formato de Fecha MM/YYYY y Limpieza Total de Anomalías Manuales (`TableInput.tsx`, `RevisionChecklist.tsx`, `pdfGenerator.ts`)
- **Formato de Fechas Mes/Año (`MM/YYYY`) y Resaltado en Rojo (> 10 años) en Tabla de Recipientes**:
  - En `src/components/TableInput.tsx` y `src/recursos-compartidos/components/TableInput.tsx`, las columnas de fecha de fabricación y de prueba hidrostática / retimbre en tablas de recipientes/depósitos se muestran y editan en formato mes y año (`MM/YYYY`, ej. `04/2014`).
  - Si la fecha de prueba hidrostática / retimbre supera los 10 años (`esFechaMayor10Anos`), la celda se resalta automáticamente en rojo (`bg-red-50 border-2 border-red-500 text-red-700 font-bold`) y en el PDF (`esFechaMayor10AnosLocal`) se imprime en negrita roja (`[200, 0, 0]`).
- **Autogeneración de Anomalía por Recipiente con Retimbrado > 10 Años (`RevisionChecklist.tsx`)**:
  - La función `evaluarAnomaliasTablasRecipientes` evalúa las filas de la tabla de recipientes/depósitos y, cuando una fecha supera los 10 años, inserta automáticamente en `eq.anomalias` el texto exacto:
    `- Recipiente Nº [X]: Fecha de prueba hidrostatica supera los 10 años. Se debe realizar retimbrado.`
  - Si la fecha se actualiza a un valor dentro de plazo (< 10 años), la línea de anomalía se retira automáticamente.
- **Adaptación Proporcional de Columnas en Tabla de Recipientes (`isTablaRecipientesGas`)**:
  - Tanto en `TableInput.tsx` como en `pdfGenerator.ts`, la tabla `3. INVENTARIO E INFORMACIÓN DE RECIPIENTES` adapta el ancho de cada columna según su contenido (compactando `Nº`/`Orden` y ampliando `Nº Serie`, `Agente extintor`, `Fecha fabricación`, `Prueba hidrostática`, `Ubicación`, etc.).
  - En `pdfGenerator.ts`, `totalColsCount` y `maxTableWidth` DEBEN declararse al inicio del bloque `colStyles` antes de evaluar `isPuestosControl` e `isTablaRecipientesGas`.
- **Limpieza Sincronizada de `anomalias` y `observaciones` en `handleCheckChange` (`RevisionChecklist.tsx`)**:
  - Cuando el usuario edita o borra manualmente el campo `anomalias` (`checkKey === 'anomalias'`) o `observaciones` (`checkKey === 'observaciones'`), DEBEN actualizarse y vaciarse simultáneamente todas las claves dinámicas asociadas (`anoItems`, `obsItems`), impidiendo que la última letra se restaure desde una propiedad secundaria y garantizando que el cuadro pueda vaciarse por completo.

---

## 119. Blindaje Inviolable de Prefijos Diferenciados (`PDV`, `PDR`, `PDI`, `PDA`), Columnas `NÚMERO` y `TÍTULO` Completo Adaptadas a Pantalla, Columnas `Dirección` en Clientes/Centros, Planificación a Ancho Completo y Rango de Fecha Programada en Calendario (`Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`, `Clientes.tsx`, `Centros.tsx`, `Planificacion.tsx`, `Calendario.tsx`, `firebase.tsx`, `pdfGenerator.ts`)
- **Prefijos Diferenciados de Número de Pedido y Botón Compacto "Generar" (`firebase.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`, `pdfGenerator.ts`)**:
  - La función `obtenerSiguienteNumeroPedido(prefijo)` soporta los 4 prefijos oficiales compartiendo la misma secuencia correlativa anual no duplicable (`contadores/pedidos_secuencia`):
    - **Ventas / Presupuestos**: `PDV.YYXXX`
    - **Reparaciones**: `PDR.YYXXX`
    - **Instalaciones**: `PDI.YYXXX`
    - **Avisos / Urgencias**: `PDA.YYXXX`
  - En el modal de creación/edición de `Reparaciones.tsx`, `Instalaciones.tsx` y `Urgencias.tsx`, a la derecha de la etiqueta `NÚMERO DE PEDIDO` se ubica el botón compacto **"Generar"** (`px-2 py-0.5 rounded-md text-[10px]`) que asigna un número correlativo único con su prefijo respectivo sólo si el campo está vacío.
- **Columnas `NÚMERO` y `TÍTULO` Completo Adaptadas al Ancho de Pantalla (`Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`)**:
  - Las tablas de Reparaciones, Instalaciones y Avisos dividen las dos primeras columnas en **`NÚMERO`** (`w-[8%]`) y **`TÍTULO`** (`w-[28%]`).
  - El título de la tarea se muestra siempre completo sin recortes (`whitespace-normal break-words leading-snug`), y el resto de columnas se distribuyen proporcionalmente al 100% del ancho de pantalla.
- **Columna `Dirección` y Ancho Proporcional en Clientes y Centros (`Clientes.tsx`, `Centros.tsx`)**:
  - En `Clientes.tsx` y `Centros.tsx`, se incorpora la columna **`Dirección`** y todas las columnas se adaptan proporcionalmente a la pantalla. En `Centros.tsx`, la columna `Código` cuenta con ancho ampliado (`w-40 lg:w-44 shrink-0 pr-5`) para alojar códigos de 18 caracteres sin solapamientos.
- **Planificación a Pantalla Completa sin Scroll Horizontal (`Planificacion.tsx`)**:
  - `Planificacion.tsx` utiliza ancho completo (`w-full max-w-full`), columna lateral ampliada (`lg:w-[30%] lg:min-w-[340px] lg:max-w-[460px]`) y oculta cualquier barra de desplazamiento horizontal en tarjetas y celdas del calendario (`overflow-x-hidden`).
- **Ampliar Rango de Fecha Programada en Calendario (`Calendario.tsx`, `firebase.tsx`)**:
  - En el modal de detalle de tarea de `Calendario.tsx`, junto a `Fecha programada` y `Fecha confirmada`, se incluye el botón y panel desplegable **"Ampliar rango de fecha programada"** (`mostrarAmpliarRango`, `editFechaInicio`, `editFechaFin`).
  - Al definir un rango de fechas (`fechaFinProgramada`), la tarea se repite automáticamente en todos los días comprendidos dentro del rango en el calendario (`getDatesInRange`), y al finalizarse la tarea todos los días del rango quedan marcados como realizados.

---

## 120. Blindaje Inviolable de Reorganización del Módulo Operaciones ("Crear nuevo parte" y "Partes de Trabajo"), Formulario Directo sin Lista Subyacente (`CrearNuevoParte.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`, `PruebasTecnicas.tsx`, `Sidebar.tsx`, `App.tsx`)
- **Menú Lateral Operaciones (`Sidebar.tsx`)**:
  - En el submenú de Operaciones DEBEN mostrarse únicamente 2 opciones:
    1. **"Crear nuevo parte"** (`/crear-parte`, icono `FilePlus2`).
    2. **"Partes de Trabajo"** (`/partes-trabajo`, icono `FileText`).
  - Queda prohibido volver a mostrar los accesos redundantes directos a listas separadas de Reparaciones, Instalaciones, Urgencias y Pruebas Técnicas en la barra lateral.
  - La sección de Mantenimientos / Partes de Revisión (`/partes`) permite acceso tanto al rol oficina/superusuario como al rol `tecnico` (`r.id === 'partes'`).
- **Selector Visual de 4 Opciones en `CrearNuevoParte.tsx` (`/crear-parte`)**:
  - Presenta 4 tarjetas estilizadas con iconos y colores diferenciados:
    1. **Reparación** (Azul, `Wrench`, enlace `/reparaciones`).
    2. **Instalación** (Rojo, `HardHat`, enlace `/instalaciones`).
    3. **Prueba técnica** (Púrpura/Lila, `Gauge`, enlace `/pruebas-tecnicas`).
    4. **Aviso / Urgencia** (Ámbar/Naranja, `AlertTriangle`, enlace `/urgencias`).
  - Cada botón navega a su ruta con el estado `{ abrirCrear: true }`.
- **Apertura Directa del Formulario sin Parpadeo ni Tabla Subyacente (`Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`, `PruebasTecnicas.tsx`)**:
  - Al recibir `location.state?.abrirCrear === true`, el componente detecta mediante `desdeCrearParteRef` la intención de creación directa y activa de inmediato el modal/formulario (`isModalOpen = true` o `viewMode = 'form'`).
  - La tabla de datos subyacente **no se renderiza** mientras `desdeCrearParteRef.current === true`, evitando parpadeos de carga de la lista antigua.
  - Si el usuario pulsa en cerrar/cancelar en el formulario, regresa de inmediato a `/crear-parte` (`navigate('/crear-parte')`).
  - Si el usuario guarda el parte satisfactoriamente, navega de inmediato al listado unificado `/partes-trabajo` (`navigate('/partes-trabajo')`).

---

## 121. Blindaje Inviolable del Módulo Unificado Partes de Trabajo de Operaciones (`PartesTrabajoOperaciones.tsx`), Tarjeta Alargada de Pestañas con Colores Reglamentarios, Tabla Limpia sin Botones Directos, Modal de Opciones al Clicar y Filtros Desacoplados
- **Tarjeta Alargada de Pestañas con Colores Reglamentarios (`PartesTrabajoOperaciones.tsx`)**:
  - En la parte superior, los tipos de operación se agrupan dentro de una tarjeta alargada horizontal blanca con borde suave y sombra (`bg-white p-2.5 rounded-2xl border border-zinc-200/80 shadow-sm mb-6 overflow-x-auto scrollbar-none`).
  - Cada pestaña cuenta con su paleta de color reglamentaria tanto activa como inactiva:
    1. **Todas las Operaciones**: Verde esmeralda (`bg-emerald-600 text-white border-emerald-600` / reposo `bg-emerald-50 text-emerald-800 border-emerald-300`).
    2. **Reparaciones**: Azul (`bg-blue-600 text-white border-blue-600` / reposo `bg-blue-50 text-blue-800 border-blue-300`).
    3. **Instalaciones**: Rojo (`bg-red-600 text-white border-red-600` / reposo `bg-red-50 text-red-800 border-red-300`).
    4. **Pruebas Técnicas**: Lila / Púrpura (`bg-purple-600 text-white border-purple-600` / reposo `bg-purple-50 text-purple-800 border-purple-300`).
    5. **Avisos y Urgencias**: Negro (`bg-zinc-950 text-white border-black` / reposo `bg-zinc-100 text-zinc-900 border-zinc-400`).
- **Tabla Limpia sin Botones Directos de Acción y Modal Interactivo de Opciones (`tareaOpcionesModal`)**:
  - Tanto en la tabla de escritorio como en las tarjetas móviles, se eliminan los botones directos individuales en las filas para ofrecer una interfaz limpia y despejada.
  - Al hacer clic en cualquier parte de la fila de la tabla o de la tarjeta móvil, se abre el modal flotante unificado de opciones de tarea (`renderTareaOpcionesModal`):
    - *Ver detalle* (`handleVerDetalle`)
    - *Editar parte* (`handleOpenEditarParte`)
    - *Crear albarán* (`handleCrearAlbaran`)
- **Filtros de Estado Desacoplados e Independientes**:
  - Los estados "Pendientes" y "En curso" funcionan como filtros estrictamente independientes y desacoplados (sin agruparlos en una sola opción).
- **Paginación Predeterminada a 10 Líneas**:
  - El selector de límite de partes inicia predeterminado en 10 filas (`useState<number | 'todos'>(10)`).
- **Recuento Reactivo y Marca Visual por Estado (`countsPorEstado`, `( X )`)**:
  - En el selector de filtro por estado (`PartesTrabajoOperaciones.tsx`), se evalúa reactivamente el número de partes que corresponden a cada estado (`TODOS`, `Pendiente`, `En curso`, `Parado`, `Finalizado`) considerando la pestaña de operación activa (`tipoFilter`) y las búsquedas o fechas aplicadas.
  - El botón selector muestra la etiqueta del estado acompañada de una marca destacada con el recuento, ej. `Pendientes ( 3 )`. Cada opción del desplegable y del selector móvil refleja igualmente su número entre paréntesis.
- **Integración en Panel Técnico (`DashboardTecnico.tsx`)**:
  - La tarjeta de operaciones en el Dashboard del Técnico enlaza directamente a Partes de Trabajo unificadas (`partes-trabajo`) y consolida los contadores globales de tareas activas de reparaciones, instalaciones, pruebas técnicas y urgencias.

---

## 122. Blindaje Inviolable del Campo Descuento ("Dto. %") en Albaranes Multiorigen y Generador de PDF
- **Campo de Descuento Obligatorio en Partidas de Albarán (`Albaranes.tsx`, `PartesTrabajoOperaciones.tsx`, `Reparaciones.tsx`, `Instalaciones.tsx`, `Urgencias.tsx`, `oficina/pages/Albaranes.tsx`)**:
  - En todos los formularios y tablas donde se configuren o generen partidas de albarán (escritorio y móvil), DEBE existir el campo de descuento con cabecera `"Dto. %"`, posicionado directamente después de `"P. Unidad"` (o `"Precio ud."`) y antes de `"Subtotal"`.
  - El campo acepta valores numéricos de porcentaje (0 a 100) y se inicializa predeterminado en `0`.
- **Cálculo Matemático Inviolable del Subtotal por Partida**:
  - El cálculo del subtotal en cada línea debe incorporar incondicionalmente el descuento:
    $$\text{subtotal} = \text{cantidad} \times \text{precioUnidad} \times \left(1 - \frac{\text{descuento}}{100}\right)$$
- **Columna Reglamentaria en la Tabla del PDF Oficial (`pdfGenerator.ts` y `recursos-compartidos/services/pdfGenerator.ts`)**:
  - En la función `generarAlbaranPDF`, la tabla de conceptos debe contar obligatoriamente con 6 columnas en su cabecera:
    `['Cant.', 'Concepto', 'Descripción', 'Precio ud.', 'Dto. %', 'Subtotal']`.
  - Cada fila debe imprimir el porcentaje de descuento formateado (`${descuento}%` o `0%` si es 0 o no aplica).
  - Los resúmenes de pie de tabla (`Total:`, `IVA:`, `Total + IVA:`) deben mantener la cuadrícula alineando el texto en la quinta columna y el importe en la sexta columna.
- **Tipado e Interfaces de Datos (`firebase.tsx` y `recursos-compartidos/firebase/firebase.tsx`)**:
  - La propiedad `descuento?: number;` forma parte reglamentaria de la estructura de `items` en `Albaran`, `ReparacionItem`, `InstalacionItem`, `UrgenciaItem` y `TareaOperacionUnificada`.

---

## 123. Blindaje Inviolable de Cabecera y Barra de Filtros en Menú Calendario (`Calendario.tsx`)
- **Alineación Izquierda del Título de Mes y Subtítulo Fijo**:
  - En `src/Calendario.tsx`, la cabecera del calendario debe alinear a la izquierda el título con el nombre del mes y año en curso.
  - Directamente debajo del título del mes, el subtítulo debe contener exclusivamente el texto: **`Calendario unificado de todas las tareas.`**
- **Disposición Uniforme en una Sola Línea**:
  - Todos los botones de filtrado por tipo de tarea (Revisiones, Reparaciones, Instalaciones, Urgencias, etc.) deben disponerse en una sola línea horizontal continua.
  - Los botones de navegación y acciones ("Hoy", anterior, siguiente, etc.) deben posicionarse a la derecha con un tamaño uniforme y alineados en la misma fila para mantener el equilibrio visual.

---

## 124. Blindaje Inviolable del Botón Rápido "+ Crear artículo" con Fotografía, Eliminación de Fondo y 25 Familias en Presupuestos (`Presupuestos.tsx`, `constants.ts`, `Articulos.tsx`)
- **Botón Rojo "+ Crear artículo" a la Derecha de Añadir Artículo y en Filas de Capítulo**:
  - En la barra de acciones de líneas de presupuesto y en cada fila de capítulo de `src/Presupuestos.tsx`, DEBE ubicarse un botón de color **rojo** (`bg-red-600 hover:bg-red-700 text-white font-bold text-xs`) con el texto exacto **`+ Crear artículo`** posicionado a la derecha de "Añadir artículo".
  - Al pulsarlo, abre el modal flotante para dar de alta un artículo sin salir de la edición del presupuesto y cuenta con botón explícito para volver al presupuesto sin perder cambios.
- **Subida de Fotografía y Sincronización en Tiempo Real con Catálogo**:
  - El modal de creación rápida de artículos incorpora carga de imagen con procesamiento transparente mediante `removeWhiteBackground` y guardado directo en Firebase Storage (`articulos_fotos/...`).
  - El artículo creado se guarda simultáneamente en la colección `articulos` de Firestore y en `firecheck_db_articulos` de LocalStorage, quedando disponible de inmediato tanto en el presupuesto en curso como en el menú **Catálogo** (`/catalogo`).
- **Integración de las 25 Familias de Sistemas Existentes (`FAMILIAS_SISTEMAS_EXISTENTES`)**:
  - Definida en `src/constants.ts` la lista canónica de las 25 familias de sistemas contra incendios, conectada a los desplegables de familia en `Presupuestos.tsx` y `Articulos.tsx`.

---

## 125. Blindaje Inviolable del Subtítulo de Partes de Trabajo (`PartesTrabajoOperaciones.tsx`)
- **Texto Obligatorio del Subtítulo**:
  - En `src/PartesTrabajoOperaciones.tsx`, debajo del título principal "Partes de Trabajo", el texto descriptivo debe ser exactamente:
    **`Gestion y seguimiento de los partes y tareas.`**
  - Queda prohibido volver a listar la descripción antigua detallando albaranes o firmas en dicho subtítulo.

---

## 126. Blindaje Inviolable de Plantillas de Sistemas y Otras Plantillas en Configuración (`Ajustes.tsx`, `plantillas.ts`, `FormBuilderPlantillas.tsx`)
- **Dos Menús Independientes en Configuración de Salamandra (`Ajustes.tsx`)**:
  - En la cuadrícula de configuración de Salamandra deben existir dos tarjetas separadas e independientes:
    1. **"Plantillas de sistemas"**: Abre el constructor visual de plantillas sobre la colección `'plantillas'` para sistemas de protección contra incendios normativos.
    2. **"Otras plantillas"**: Abre el constructor visual sobre la colección `'otras_plantillas'` para vehículos, taller, herramientas u otros temas operativos.
- **Constructor de Formularios Completo y Multi-colección (`FormBuilderPlantillas.tsx`, `plantillas.ts`)**:
  - `FormBuilderPlantillas` acepta las propiedades `coleccion?: string`, `titulo?: string` e `isOtrasPlantillas?: boolean`, permitiendo crear plantillas, añadir preguntas con cualquier tipo de respuesta (`check`, `texto`, `texto-largo`, `numero`, `fecha`, `imagen`, `desplegable`, `tabla`), ordenar, duplicar, subir imagen y vista previa en tiempo real.
  - Todas las operaciones CRUD de `src/plantillas.ts` soportan el parámetro `coleccionNom: string = COLECCION_PLANTILLAS`.
  - Se incorporan `OTRAS_PLANTILLAS_POR_DEFECTO` y `inicializarOtrasPlantillasPorDefecto()` para inicializar plantillas de ejemplo de vehículos (`V01`) y taller (`T01`).

---

## 127. Blindaje Inviolable del Módulo Vehículos (`Vehiculos.tsx`), Tarjetas Limpias Exteriores, Ficha Interior Completa y 4 Tarjetas en el Menú HOY con Alertas de 15 Días (`App.tsx`, `firebase.tsx`)
- **Tarjetas Exteriores Limpias en el Listado de Vehículos (`Vehiculos.tsx`)**:
  - En la vista principal del menú `/vehiculos`, los vehículos se muestran en una cuadrícula de tarjetas donde por fuera **solo se ve la matrícula** (en placa real española con Eurobanda azul `#003399`, corona de 12 estrellas amarillas `#FFCC00` de la UE y letra 'E'), **la marca y el modelo**, y la fotografía o icono del vehículo, junto con el enlace *"Entrar al vehículo →"*.
  - La placa de matrícula se posiciona al lado derecho de la marca y modelo en una sola línea armónica.
- **Ficha Completa al Entrar en el Vehículo y Cabecera Compacta**:
  - Al pulsar en cualquier tarjeta, se accede a la vista detallada del vehículo con:
    1. Botón superior: **`← Volver al listado de vehículos`**.
    2. Datos completos en cabecera: Conductor/técnico asignado, kilometraje, tipo de vehículo, notas y foto.
    3. **Marca, Modelo y Matrícula Real**: El nombre del vehículo se acompaña en la misma fila a su derecha de la placa de matrícula española oficial de tamaño grande (`size="lg"`).
    4. **Botones de Acción en Cabecera**: Los botones (**Editar vehículo** y **Eliminar vehículo**) se disponen alineados a la derecha de la cabecera superior con altura uniforme (`h-9`).
    5. **Tabla de Preguntas Compacta con Estilo Cebra y Alertas de Caducidad al Lado del Título**:
       - Al lado del título **`INFORMACIÓN DEL VEHICULO`**, se disponen en cápsulas compactas las alertas y fechas de caducidad del Seguro, ITV y mantenimiento.
       - Columna `Tipo` eliminada.
       - Líneas alternadas estilo cebra en color blanco y azul suave (`bg-white` y `bg-blue-50/40`).
       - Filas compactas de altura reducida (`py-2 px-3`).
       - Retirado el texto de `* Requerido`.
       - Textos de la tabla sin negrita (`font-normal` / `font-medium`).
       - Controles interactivos (OK/Fallo, inputs, selector de opciones, notas individuales, subida y visualizador en pantalla completa de fotografías para tipos `imagen`), más botón **"Guardar Revisión"**.
- **Tarjeta "4. Notificaciones" en el Menú "HOY" (`src/App.tsx`)**:
  - El panel principal de "HOY" cuenta exactamente con **4 tarjetas** en cuadrícula adaptada (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`):
    1. `1. Facturación` (Naranja: albaranes pendientes de facturar).
    2. `2. Tareas de Hoy` (Azul: intervenciones y revisiones del día).
    3. `3. Stock` (Verde: artículos con existencias bajas).
    4. `4. Notificaciones` (Púrpura / Carmesí: alertas y vencimientos de flota).
- **Lógica Inviolable de Preaviso de 15 Días**:
  - Cualquier alerta de vehículo cuya fecha de vencimiento esté a **15 días o menos** de la fecha actual (o ya vencida) debe aparecer automáticamente en la tarjeta `4. Notificaciones` del menú "HOY" con la matrícula, título de la alerta, fecha y días restantes, enlazando directamente al módulo de vehículos.

---

## 128. Blindaje Inviolable del Reporte de Anomalías en PDF Apaisado, Generación de Presupuesto Borrador desde Catálogo y Pantalla Dividida (Split-Screen) de Revisión (`Partes.tsx`, `Presupuestos.tsx`, `pdfReporteAnomaliasGenerator.ts`, `presupuestoBorradorFromAnomalias.ts`, `firebase.tsx`)
- **Reporte de Anomalías en PDF Apaisado (`generarReporteAnomaliasPDF` en `src/pdfReporteAnomaliasGenerator.ts`)**:
  - Orientación horizontal apaisada obligatoria (`new jsPDF('l', 'mm', 'a4')`, ancho 297mm, tabla de 269mm útiles).
  - Tipografía fina sin negrita (`fontStyle: 'normal'`) con tamaño `fontSize: 6.5` en celdas y `cellPadding: { top: 1.2, bottom: 1.2, left: 2.5, right: 2.5 }` para máxima esbeltez visual y filas compactas.
  - Columnas distribuidas para máxima legibilidad en una sola línea plana: `SISTEMA` (50mm), `EQUIPO` (44mm, código y tipo en una sola línea sin salto `\n`), `UBICACIÓN` (50mm) y `ANOMALÍA / DEFECTO DETECTADO` (`auto`, 125mm de ancho libre en color rojo tenue `[185, 28, 28]` sin negrita).
  - Cabecera con datos de Empresa Mantenedora, Cliente, Centro, Dirección, Nº Mantenimiento, Fecha y Técnico, adaptada al ancho apaisado.
  - Mensaje verde de revisión sin anomalías si no se detectan incidencias.
- **Generación Automática de Presupuesto Borrador (`generarPresupuestoBorradorDesdeAnomalias` en `src/services/presupuestoBorradorFromAnomalias.ts`)**:
  - Escanea todas las anomalías desglosadas por equipo y busca coincidencias inteligentes semánticas en el catálogo de artículos (`firecheck_db_articulos` / Firestore `articulos`).
  - Coincidencias soportadas: retimbrados de extintores y BIEs, sustituciones > 20 años por equipo nuevo o tramo de manguera, manómetros, señalización fotoluminiscente, detectores, pulsadores, sirenas, baterías, luminarias de emergencia y recipientes de gas > 10 años.
  - Si encuentra artículo afín, genera la partida valorada con código, concepto, precio de venta del catálogo y capítulo por sistema. Si no hay coincidencia exacta, genera partida manual con precio 0 y descripción del equipo, ubicación y defecto para ajuste manual.
  - Crea el presupuesto en estado `'Borrador'` con numeración correlativa `PRE.YYXXX`, cálculos de base imponible, IVA y total, y persiste las anomalías en `anomaliasReporte`.
- **Opciones en el Modal de Descarga de Partes de Trabajo (`Partes.tsx`)**:
  - En `showDownloadModal`, se mantienen accesibles e independientes las 6 opciones:
    1. *Acta de Revisión*
    2. *Certificado*
    3. *Albarán de Trabajo*
    4. *Contrato de Mantenimiento*
    5. *Reporte de anomalías (PDF)*
    6. *Generar presupuesto borrador*
  - Al completar la generación de un presupuesto borrador, redirige automáticamente a `/presupuestos` mediante `navigate('/presupuestos', { state: { editarPresupuestoId, anomalias } })`.
- **Pantalla Dividida (Split-Screen) en Presupuestos (`src/Presupuestos.tsx`)**:
  - Al abrir un presupuesto que contenga anomalías vinculadas (`anomaliasSplitList` o `anomaliasReporte`), el modal de edición se expande a pantalla completa (`max-w-[98vw] xl:max-w-[97vw] h-[95vh]`) y se divide en 2 paneles:
    1. **Panel Izquierdo (Vista previa de anomalías)**: Tarjetas con Sistema, Equipo, Ubicación, texto de anomalía en rojo, buscador en tiempo real, indicador de estado (`✓ En presupuesto` / `Pendiente`) y botón rápido `+ Añadir partida a presupuesto` para incorporar o reincorporar partidas al presupuesto con un clic.
    2. **Panel Derecho (Editor del presupuesto)**: El formulario íntegro del presupuesto (cliente, centro, partidas, catálogo, descuentos, totales y guardar).
  - Botón en la cabecera para alternar entre "Ocultar panel anomalías" y "Ver anomalías al lado".
  - Presupuestos convencionales sin anomalías conservan intacta su visualización estándar (`max-w-6xl xl:max-w-7xl`).

---

## 129. Blindaje Inviolable del Módulo Reinicio de Contadores (`Ajustes.tsx`, `ReinicioContadores.tsx`, `contadoresService.ts`, `Facturas.tsx`, `Certificados.tsx`, `firebase.tsx`)
- **Tarjeta Dedicada en Configuración de Salamandra (`src/Ajustes.tsx`)**:
  - En el menú principal de Ajustes (`view === 'menu'`), tarjeta obligatoria **"Reinicio de contadores"** con icono `RotateCcw`, fondo y borde violeta estilizado (`border-violet-200 bg-white hover:border-violet-250 hover:bg-violet-50/30`), navegando a `view === 'contadores'`.
  - Vista completa y responsive integrada: [`src/ReinicioContadores.tsx`](file:///C:/Users/canci/Documents/antigravity/noble-noether/src/ReinicioContadores.tsx) con selector de documentos, botones rápidos y preajustes de ejercicio anual.
- **Documentos Gestionados y Secuencia Configurable**:
  - Control de numeración individual para los 6 documentos clave:
    1. **Facturas**: prefijo configurable (ej. `27.` o `FAC 27.`), cifras (ej. 4 dígitos `0001` o 3 dígitos `001`), contador inicial y fecha de reinicio (ej: `31/12/2026`).
    2. **Albaranes**: prefijo (ej. `ALB.27`), cifras (3 dígitos `001`) y contador inicial.
    3. **Pedidos**: prefijo (ej. `PDV.27`), cifras (3 dígitos `001`) y contador inicial.
    4. **Certificados**: prefijo (ej. `CERT-2027-`), cifras (4 dígitos `0001`) y contador inicial.
    5. **Presupuestos**: prefijo (ej. `PRE.27`), cifras (3 dígitos `001`) y contador inicial.
    6. **Partes de Mantenimiento**: prefijo (ej. `MANT-2027-`), cifras (4 dígitos `0001`) y contador inicial.
- **Lógica de Activación y Fechas de Corte (`estaReinicioActivo` en `src/services/contadoresService.ts`)**:
  - Si el reinicio está activado (`activo: true`) y la fecha actual o la del documento es $\ge$ `fechaReinicio` (o si se aplica desde hoy), los nuevos documentos generados adoptan de inmediato la nueva estructura.
  - Si la fecha es futura, permanece en estado `Programado` y entra en vigor automáticamente al llegar la fecha indicada.
  - Si está desactivado, el sistema mantiene intacto el formato correlativo estándar.
- **Asistente Rápido de Cambio de Ejercicio**:
  - Panel superior con preajuste en un solo clic para el año objetivo (ej. 2027) con opciones rápidas de fecha de corte ("Corte 31 Dic", "Corte 1 Ene", "Aplicar desde Hoy").
- **Prevención de Duplicados y Persistencia Dual (`contadoresService.ts`)**:
  - Sincronización en tiempo real mediante Firestore (`contadores/configuracion_reinicios`) y LocalStorage (`firecheck_contadores_config`).
  - Al generar un código, el motor inspecciona los documentos existentes que coincidan con el prefijo activo para asegurar que el siguiente número sea estrictamente `Math.max(config.siguienteNumero, maxExistente + 1)`.
  - Caja de vista previa en tiempo real en cada tarjeta que muestra instantáneamente cómo se generará el próximo documento (ej: `27.0001`).







