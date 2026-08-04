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
  - `Pendiente`: Gris (`bg-slate-100 text-slate-700`).
  - `En curso`: Amarillo con efecto pulsante (`bg-amber-100 text-amber-800 animate-pulse`).
  - `Parado`: Rojo (`bg-red-100 text-red-800`).
  - `Finalizado`: Verde (`bg-emerald-100 text-emerald-800`).
- **Notas Notificables e Indicador Rojo Parpadeante**:
  - La columna `NOTA` debe contener el icono `StickyNote`. Si existe texto registrado, DEBE mostrarse un **punto de notificación rojo parpadeante** (badge) sobre el icono, permitiendo abrir/editar la nota en una ventana flotante rápida.
- **Sincronización Firestore**:
  - Todos los cambios deben sincronizarse automáticamente mediante `subscribeReparaciones` y `updateReparacion`.

---

## 15. Blindaje Inviolable del Módulo Instalaciones (Instalaciones.tsx)
- **Cabecera de Tabla Obligatoria**:
  - DEBE mantenerse la estructura de columnas: `INSTALACIÓN` - `LUGAR` - `TÉCNICO ASIGNADO` - `COMERCIAL` - `ESTADO` - `NOTA` - `ACCIONES`.
- **Colores de Estado y Notas Notificables**:
  - Mismo esquema obligatorio de insignias de estado (Gris, Amarillo pulsante, Rojo, Verde) e icono de nota `StickyNote` con **punto de notificación rojo parpadeante** y modal flotante de edición rápida.
- **Sincronización Firestore**:
  - Todos los cambios deben sincronizarse automáticamente mediante `subscribeInstalaciones` y `updateInstalacion`.

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


