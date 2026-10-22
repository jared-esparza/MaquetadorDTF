# Maquetador DTF · PKprint

## Instalación
Abre MaquetadorDTF-Setup-1.2.0-x64.exe, sigue el asistente en español y abre el acceso directo Maquetador DTF. No necesitas Node ni Internet. Destinado a Windows 10/11 de 64 bits. Esta versión no está firmada; Windows puede mostrar avisos de editor desconocido o bloquear la ejecución según sus políticas. Se publica como versión preliminar: las pruebas automatizadas de esta entrega se realizan en desarrollo y CI, y no equivalen a una validación en Windows limpio. La comprobación de una entrega anterior en Windows Sandbox quedó bloqueada por Control de aplicaciones. Consulta las pruebas enlazadas en la Release.

## Portátil
Abre MaquetadorDTF-Portable-1.2.0-x64.exe desde una carpeta con permiso de escritura. Se crea MaquetadorDTF-datos junto al ejecutable. Copia también esa carpeta al moverlo a otro PC si quieres conservar los formatos y preferencias. No es necesario ejecutar el instalador.

## Tres pasos
1. Sube PNG, indica ancho en centímetros y número de copias. Usa el borrador si necesitas quitar fondos.
2. Configura el film y los márgenes en milímetros. La separación inicial es 7 mm; puedes elegir entre 3 y 7 mm. Revisa los pliegos.
3. Descarga el PDF y elige dónde guardarlo. Imprime desde tu RIP al 100 % o Tamaño real, sin ajustar a página. El RIP debe generar el blanco y gestionar el color. Activa espejo aquí solamente si lo desactivas en el RIP.

Los diseños no se guardan como proyecto editable. Exporta antes de cerrar. Ayuda incluye instrucciones y un PDF de calibración con un cuadrado de 100 × 100 mm. Debes comprobarlo en tu impresora antes de producir.

## Exportar PNG o ZIP
Se conserva Descargar PDF. Para PNG, elige 150, 300 o 600 ppp en Resolución PNG; 300 es el valor inicial. Más ppp no recuperan detalle ausente en el original. Un solo pliego genera un PNG; varios generan un ZIP con un PNG numerado por pliego. Extrae el ZIP antes de importar los PNG en el RIP y respeta su tamaño físico y resolución.

El PNG conserva transparencia, espejo, giros, márgenes y separación. La opción de espejo se aplica tanto a PDF como a PNG. No se incluye el damero ni las guías. La generación muestra progreso y puede cancelarse sin perder el montaje. El diálogo Guardar permite elegir carpeta y confirmar sobrescrituras.

Límites de salida PNG: 32 767 píxeles por lado, 512 megapíxeles por pliego y 256 MiB para el archivo PNG o ZIP final. Si se supera un límite, reduce la resolución o divide el trabajo; no se reduce calidad automáticamente. El film de 55 × 100 cm admite las tres resoluciones.

## Actualizar
Instalada: ejecuta el nuevo instalador. Portátil: reemplaza el exe conservando MaquetadorDTF-datos. No hay actualizaciones automáticas. La desinstalación conserva tus preferencias por defecto.

Los formatos del navegador anterior no se importan automáticamente. Configúralos una vez en la aplicación de escritorio.

Los archivos se procesan localmente. Código propio: licencia de reutilización pendiente. Los avisos de los componentes de terceros se incluyen en THIRD_PARTY_NOTICES.txt y los archivos de licencia de Electron y Chromium.
