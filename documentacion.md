Explicación general



Explicación general:
Esta aplicación es para realizar mantenimientos y revisiones en sistemas contra incendios con un dispositivo móvil en los clientes y centros del cliente.



"Objetivo: no romper funcionalidades existentes". Antes de escribir código, explica el plan, indica qué archivos tocarás y qué funcionalidades podrían verse afectadas. Después de cada cambio, resume los archivos modificados y qué funciones debo revisar. Luego añade una sección de funcionalidades críticas: alta de clientes, centros, planificación, recepción en tablet, checklist, firmas, precierre, reapertura, cierre definitivo, visualización de revisiones cerradas, generación de PDF. Y una regla de oro. No modificar ni eliminar nada de esto sin autorización explícita.



"no elimines ni modifiques funcionalidades existentes sin pedir permiso", y "si un cambio afecta a otra parte, avísame antes".  "explícame el plan y qué archivos tocarás"



ESO GRABALO A FUEGO. por que en algunas indicaciones se han creado funcionalidades nuevas y otras han dejado de funcionar después de los ultimas indicaciones, a partir de ahora vamos a ir poco a poco y con pies de plomo para no romper nada de lo que se ha creado, la aplicación esta siendo cada vez más compleja y requiere atención y no romper nada. siempre vas a decirme que vas a analizar tocar y modificar EN ESPAÑOL. no podemos romper nadas mas.











Flujo de trabajo:
En la oficina se crea la información primero del cliente, son los datos de fiscales, donde se factura. Luego están los centros, que son las sedes o diferentes emplazamientos que puede tener un cliente, por ejemplo una cadena de supermercados llamados "SUPER COL" con la sede principal en Madrid, puede tener un centro "SUPER COL" en Valencia y otro en Barcelona.

Después de tener la información del cliente se crea la información del centro, donde se introduce la periodicidad del trabajo para saber en que mes le toca la revisión anual y sus revisiones trimestrales, después se le asignan los sistemas que hay en ese centro, por ejemplo extintores y bies, y dentro de eesos sistemas los equipos por ejemplo extintores de polvo con numero de placa tipo etc...cuando ya tenemos la información del cliente y centros, los trabajos de mantenimientos se gestionan y se planifican  desde el entorno del escritorio y una vez planificados los trabajos en el calendario, el técnico recibe los partes en el dispositivo móvil para realizar las revisiones tipo check list en los clientes, los partes se crean a partir de unas plantillas creadas en el menú Configuración/Plantillas y cada sistema tiene su plantilla, estas plantillas cuando están acabadas se crean unos documentos independientes tipo .tsx que donde se guardan sus reglas y funcionamiento en src/component/RevisonSistemas y asi queda todo mas ordenado para no hacer un código muy largo ya que hay muchos sistemas como extintores, bies, hidrantes y total puede haber 20 sistemas aproximadamente, esto haría un código muy largo.

Toda la información de la revisión realiza en el cliente y su centro se guarda y se sincroniza con la base de datos de Firebase en la colección de centros y son guardadas para próximas revisiones  ya que solemos ir trimestral y anualmente...estos partes se muestran en el dispositivo del técnico como Revisión del parte, cada cliente es diferente y un parte puede tener diferentes sistemas, y una vez finalizada la revisión y el técnico pre-cierra el parte, la persona encargada desde el entorno escritorio revisará el parte y podrá generar los documentos como: Actas de la revisión en los sistemas, certificado con el resultado Favorable/No favorable, un albarán que cuenta los equipos revisados y un contrato de mantenimiento si es necesario se puede descargar también, esto ya esta funcionando asi...



Conceptos clave:
¿Qué significa cada término dentro de tu app para no confundirlos?
El nombre de Salamandra: se lo he puesto como nombre a la aplicación, por que Salamandra es un animal que es capaz de regenerarse y mitológicamente decían que podía ser resistente al fuego.
Acta: es el nombre del documento que se descarga cuando se acaba la revisión del parte, es el documento Acta existe la información de los sistemas y equipos revisados, es como un inventario de equipos y las pruebas que se realizan en el para comprobar su estado y si están funcionando correctamente ante un peligro de incendio.
Certificado: es otro documento que se descarga y es un documento oficial para confirmar que esos sistemas se han revisado y en que estado están.
Contrato de mantenimiento: es otro documento que se descarga al finalizar la revisión y es donde empresa y cliente ajustan el precio,  compromisos y deberes de cada uno.

Preferencias técnicas o visuales:
Es muy importante mantener el funcionamiento de la aplicación y no borrar nada, es mejor no tomar decisiones y hacer cambios si no se indican. La aplicación tiene muchas configuraciones y a la mínima puede dejar algo si funcionar.



Cuando se crea un sistema nuevo:
Cuando se introduce un nuevo sistema, cada sistema tiene una imagen que se busca en Firebase o en configuración/Gestión sistemas, esa imagen se muestra en el pdf, deberías analizar otro sistema para ver como funcionan y debes crear un archivo tsx para cada sistema y hacer que funcionen como los demás, debes hacer que en la Revisión de parte cuando se elije uno de estos sistemas, el formulario que se muestra para la revisión debe se el de la plantilla creada, y mostrarlo exactamente igual.

PARTES DE REVISIÓN:

\-Una de las reglas en la revisión de un parte es que si alguna de las preguntas del formulario es tipo CORRECTO/NO CORRECTO y la respuesta es NO CORRECTO, el campo se pone en rojo y automáticamente esa pregunta se muestra abajo en el campo de anomalías seguido de una coma y la palabra MAL. por ejemplo, ¿3.7 el manometro esta en buen estado?, si la respuesta es "NO CORRECTO" en el campo de anomalías aparecerá: ¿3.7 el manometro esta en buen estado?, MAL.



No hagas deploy sin que yo lo indique.!!

el proyecto se llama  https://app-abanfoc-v1.web.app.  pero he redireccionado el proyecto a la dirección app.abanfoc.es llámalo siempre asi.



Quiero que hagas únicamente el cambio que te pido. No modifiques nada más. Antes de escribir código, explícame qué entendiste, qué archivos planeas tocar y por qué. Si necesitas más archivos de lo previsto, detente y pregúntame. No reescribas componentes completos, haz solo los cambios mínimos necesarios. Conserva todo el código y funcionalidad existente. No elimines nada sin mi autorización. No cambies nombres ni estructuras si no te lo pido. Al final, dame un resumen de los archivos y líneas que tocaste y qué comprobaste que sigue funcionando. No hagas deploys ni subas cambios sin que yo lo autorice explícitamente.

