# Reglas del Proyecto (AGENTS.md)

Este archivo contiene reglas y directrices críticas de comportamiento y de arquitectura específicas para este espacio de trabajo. Cualquier agente de IA que trabaje en esta base de código **DEBE** respetar y cumplir estas directrices para evitar regresiones de funcionalidad.

---

## 1. Reglas Generales de No Interferencia
- **No tocar funcionalidades no solicitadas**: No se deben modificar ni refactorizar componentes o secciones del código que no estén directamente involucrados en la tarea solicitada.
- **Mantener la documentación**: No modificar `documentacion.md` ni alterar sus descripciones.
- **Evitar Errores de Compilación Estrictos (TS6133)**: No declarar variables, funciones o importaciones no utilizadas (ej. iconos de `lucide-react` importados sin usar), ya que el compilador TypeScript está configurado en modo estricto y bloquea la compilación (`npm run build`).

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

## 7. Reglas Inviolables para Anomalías Automáticas de Fechas (Extintores y BIEs)
- **Extintores con Fecha de Fabricación ≥ 20 años**:
  - Texto exacto obligatorio en `eq.anomalias`: `- Extintor caducado + de 20 años, se debe sustituir por equipo nuevo.`
- **Extintores con Último Retimbre / Prueba Hidráulica ≥ 5 años**:
  - Texto exacto obligatorio en `eq.anomalias`: `- Extintor necesita retimbrado obligatorio de los 5 años.`
- **BIEs con Fecha de Fabricación ≥ 20 años**:
  - Texto exacto obligatorio en `eq.anomalias`: `- BIE caducado + de 20 años, se debe sustituir tramo de manguera según normativa.`
- **BIEs con Prueba Hidráulica ≥ 5 años**:
  - Texto exacto obligatorio en `eq.anomalias`: `- BIE necesita realizar prueba hidráulica obligatoria cada 5 años.`
- **Recuperación Automática y Preservación**:
  - Al abrir o guardar un parte, el sistema evaluará automáticamente todos los equipos. Si superan los plazos, insertará las anomalías correspondientes en `eq.anomalias` sin borrar el texto manual existente.

---

## 8. Maquetación Inviolable del PDF Certificado (pdfGenerator.ts)
- **Posición de Cabecera**: El título principal del PDF Certificado inicia en `y = 8` (10 ptos más arriba que los 18 ptos por defecto).
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

## 11. Blindaje Inviolable de Estado Retimbrando y Luz Roja Parpadeante (Partes.tsx)
- **Luz Roja Parpadeante**:
  - Si el usuario responde "Sí" a la pregunta de retimbrado, el parte registra `equiposRetirados: true`.
  - En la tabla de partes (`Partes.tsx`), la luz de estado debe ser **ROJA PARPADEANTE** (`bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse`).
- **Filtro de Estado "Retimbrando"**:
  - El desplegable de filtro de estado debe incorporar la opción **Retimbrando** para filtrar los partes con equipos retirados.

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

