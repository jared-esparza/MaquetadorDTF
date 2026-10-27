# Maquetador DTF · PKprint

## Instalación
Abre MaquetadorDTF-Setup-1.3.0-x64.exe, sigue el asistente en español y abre el acceso directo Maquetador DTF. No necesitas Node ni Internet. Destinado a Windows 10/11 de 64 bits. Esta versión no está firmada; Windows puede mostrar avisos de editor desconocido o bloquear la ejecución según sus políticas. Se publica como versión preliminar: las pruebas automatizadas de esta entrega se realizan en desarrollo y CI, y no equivalen a una validación en Windows limpio. La comprobación de una entrega anterior en Windows Sandbox quedó bloqueada por Control de aplicaciones. Consulta las pruebas enlazadas en la Release.

## Portátil
Abre MaquetadorDTF-Portable-1.3.0-x64.exe desde una carpeta con permiso de escritura. Se crea MaquetadorDTF-datos junto al ejecutable. Copia también esa carpeta al moverlo a otro PC si quieres conservar los formatos y preferencias. No es necesario ejecutar el instalador.

## Tres pasos
1. Sube PNG, JPG/JPEG, WebP estático o PDF. Para PDF, selecciona páginas y elige 300 ppp (inicial) o 600 ppp: se convierten a imágenes, sin conservar vectores. Indica ancho en centímetros y número de copias. Usa el borrador si necesitas quitar fondos; el blanco no se elimina automáticamente.
2. Configura el film y los márgenes en milímetros. La separación inicial es 7 mm; puedes elegir entre 3 y 7 mm. Revisa los pliegos.
3. Descarga el PDF y elige dónde guardarlo. Imprime desde tu RIP al 100 % o Tamaño real, sin ajustar a página. El RIP debe generar el blanco y gestionar el color. Activa espejo aquí solamente si lo desactivas en el RIP.

Los diseños no se guardan como proyecto editable. Exporta antes de cerrar. Ayuda incluye instrucciones y un PDF de calibración con un cuadrado de 100 × 100 mm. Debes comprobarlo en tu impresora antes de producir.

## Exportar PNG o ZIP
Se conserva Descargar PDF. Para PNG, elige 150, 300 o 600 ppp en Resolución PNG; 300 es el valor inicial. Más ppp no recuperan detalle ausente en el original. Un solo pliego genera un PNG; varios generan un ZIP con un PNG numerado por pliego. Extrae el ZIP antes de importar los PNG en el RIP y respeta su tamaño físico y resolución.

El PNG conserva transparencia, espejo, giros, márgenes y separación. La opción de espejo se aplica tanto a PDF como a PNG. No se incluye el damero ni las guías. La generación muestra progreso y puede cancelarse sin perder el montaje. El diálogo Guardar permite elegir carpeta y confirmar sobrescrituras.

Límites de salida PNG: 32 767 píxeles por lado, 512 megapíxeles por pliego y 256 MiB para el archivo PNG o ZIP final. Si se supera un límite, reduce la resolución o divide el trabajo; no se reduce calidad automáticamente. El film de 55 × 100 cm admite las tres resoluciones.

## Actualizar
Desde 1.2.0 o anterior, instala 1.3.0 manualmente una vez para incorporar este sistema. Abre Actualizaciones en la cabecera de la aplicación.

- Manual: busca versiones solo al pulsar Buscar actualizaciones.
- Avisarme antes de descargar (predeterminado): comprueba aproximadamente 30 segundos después de iniciar y cada 6 horas mientras está abierta. Avisa en la cabecera y espera a que pulses Descargar actualización.
- Automático (solo instalada): descarga en segundo plano y avisa cuando está preparada. Debes pulsar Instalar y reiniciar para aplicarla. No se instala automáticamente al cerrar.

Se incluyen las publicaciones preliminares. El reinicio está bloqueado si hay un montaje sin exportar, edición abierta o una operación en curso. Exporta y cierra la edición antes de actualizar. Los formatos, preferencias y última carpeta se conservan. Un error de red o de integridad no cierra la aplicación ni elimina el trabajo; puedes reintentar o consultar las versiones de GitHub.

En portátil, la actualización es asistida: pulsa Descargar nuevo portátil, cierra esta versión y reemplaza el EXE conservando MaquetadorDTF-datos. No se sustituye automáticamente y no ofrece el modo de descarga automática.

La comprobación y descarga necesitan conexión; el editor y las exportaciones siguen funcionando sin Internet. Esta distribución permanece sin firma, con los posibles avisos y bloqueos de Windows. La desinstalación conserva preferencias por defecto.

Los formatos del navegador anterior no se importan automáticamente. Configúralos una vez en la aplicación de escritorio.

Los archivos se procesan localmente. Código propio: licencia de reutilización pendiente. Los avisos de los componentes de terceros se incluyen en THIRD_PARTY_NOTICES.txt y los archivos de licencia de Electron y Chromium.

## Memoria y nombres de trabajo (1.5.0)

Junto a la carga, «Presupuesto de imágenes» permite 60, 120 o 240 MP y muestra consumo / presupuesto. Cuenta originales y versiones únicas para edición y deshacer; las copias no multiplican el consumo. Se recuerda por navegador o instalación. No se permite reducirlo por debajo del consumo actual: quita diseños antes. Los niveles mayores pueden agotar la memoria y no garantizan el procesamiento en cualquier equipo. Los límites por imagen (25 MP) y archivo final siguen vigentes.

Ancho y Alto (cm) son editables y siempre proporcionales; cambiar uno actualiza el otro. La geometría conserva precisión interna aunque se muestren dos decimales. Una entrada inválida debe corregirse antes de exportar.

«Nombre del trabajo» propone DTF-AAAA-MM-DD-HHmm al cargar el primer diseño, con fecha y hora local. Puedes cambiarlo conservando espacios, tildes y ñ. No escribas rutas ni nombres reservados de Windows; máximo 120 caracteres. La extensión se añade automáticamente y una extensión PNG/PDF/ZIP pegada se retira al terminar de editar. Un archivo usa BASE.png/pdf; varios usan BASE.zip con BASE-pliego-001.png/pdf y numeración consecutiva. El PDF multipágina usa BASE.pdf. El nombre se conserva al descargar ambos formatos y cambia al empezar un trabajo vacío; no se recuerda entre sesiones. En Windows se propone al guardar; renombrar el ZIP en el diálogo no renombra sus archivos interiores.
