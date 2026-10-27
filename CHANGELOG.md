# Cambios

## 1.5.1

- Los diseños se muestran del último cargado al primero, también en cargas múltiples y páginas PDF, para acceder antes a sus medidas y edición. El orden interno del montaje se conserva.

## 1.5.0

- Presupuesto de imágenes de 60, 120 o 240 MP, recordado por navegador o instalación, con indicador de consumo y protección al reducirlo.
- Ancho y alto editables en centímetros, siempre proporcionales y sin acumular redondeos.
- Nombre de trabajo editable y común a PNG, PDF y ZIP, con fecha y hora local inicial y nombres numerados dentro de los ZIP.
- Se mantienen los límites por imagen, resolución y tamaño final; no se reduce calidad automáticamente.

## 1.4.0

### PDF por pliego y formatos de imagen

- Importación de PNG, JPG/JPEG, WebP estático y páginas PDF con miniaturas y selección.
- Conversión de páginas PDF a imagen a 300 ppp por defecto o 600 ppp opcional.
- Exportación de un PDF por pliego (por defecto), PDF único opcional y ZIP de PDFs para varios pliegos.
- PNG desde diseños PDF a 150, 300 o 600 ppp, manteniendo la exportación existente.
- Límites y validaciones para documentos PDF, transparencia, orientación EXIF y cancelación segura.

## 1.3.0
- Actualizaciones de escritorio configurables: manual, avisar antes de descargar (predeterminado) y descarga automática.
- Se incluyen preliminares; instalación y reinicio solo mediante acción explícita y sin trabajo pendiente ni operaciones.
- Portátil con comprobación y descarga asistida, conservando MaquetadorDTF-datos.
- Metadatos y mapas de actualización publicados y verificados junto con los ejecutables.

## 1.2.0
- Exportación PNG transparente a 150, 300 o 600 ppp; un archivo por pliego y ZIP para montajes multipágina.
- Renderizado por franjas en worker, progreso y cancelación, con guardado nativo PNG/ZIP en Windows.
- Publicación automática coordinada de web y Release preliminar del mismo commit, reutilizando binarios comprobados.
- Validación de versiones, etiquetas, hashes y reintentos sin sobrescribir archivos publicados.

## Web · octubre de 2026
- Descargas de Windows desde la publicación más reciente que incluya instalador y portátil x64, también preliminares, con comprobación al descargar.
- Avisos sobre almacenamiento privado por navegador y restauración de formatos originales conservando formatos personalizados y selección.
- Sin cambios de comportamiento en Electron ni nuevos ejecutables en esta entrega.

## 1.1.1
- Gama azul PKprint en el editor, bienvenida, ayuda e iconos de Windows.
- Eliminadas las referencias a servicios ajenos en la documentación actual.
- Sumatorio SHA-256 limitado a la versión actual para conservar paquetes anteriores.

## 1.1.0
- Aplicación Electron para Windows x64, instalador guiado en español y ejecutable portátil.
- Preferencias propias, guardado nativo PDF y última carpeta utilizada.
- Bienvenida, ayuda, calibración, instancia única y confirmación de cierre con cambios pendientes.
- Pruebas de escritorio, paquetes y automatización de GitHub.

## 1.0.0-web
- Editor web local con carga PNG, medidas, copias, borrador por color, varita, afinado y deshacer.
- Montaje MaxRects con rotaciones, perfiles y PDF multipágina a tamaño real con transparencia.
- Separaciones de 3, 4, 5, 6 y 7 mm; 7 mm por defecto.

