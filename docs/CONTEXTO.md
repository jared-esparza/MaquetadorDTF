# Relevo de contexto — Maquetador DTF

Última revisión: 27 de octubre de 2026. Punto de entrada para continuar el trabajo.
Describe hechos verificados y decisiones vigentes; los pendientes no son una orden
para implementar cambios sin acordar la siguiente tarea.

## Estado confirmado

- Repositorio: https://github.com/jared-esparza/MaquetadorDTF.
- Versión en main: **1.5.1**, coincidente en package.json y package-lock.json.
- [PR #11](https://github.com/jared-esparza/MaquetadorDTF/pull/11): integrada con
  autorización del usuario; merge `738a17878a3d7ec40173e854bd1a17a03ee01932`.
- [Release v1.5.1](https://github.com/jared-esparza/MaquetadorDTF/releases/tag/v1.5.1):
  publicada como preliminar sin firma sobre `738a178`, con Setup, Portable,
  blockmap, latest.yml, SHA256SUMS, avisos y guía Windows. Ver el cierre de 1.5.1
  al final de este documento para los resultados de publicación y despliegue.
- [PR #9](https://github.com/jared-esparza/MaquetadorDTF/pull/9): integrada;
  relevo documental de 1.4.0, merge `06d5d4fdfe99559de9ee142194b33011edc2c56b`.
- [PR #10](https://github.com/jared-esparza/MaquetadorDTF/pull/10): integrada;
  memoria, medidas y nombres de 1.5.0, merge `2cf6ffa53ffe2b9146e30cc3e6807ed17c5490cb`.
- El usuario aprobó expresamente integrar estos cambios y actualizar la
  documentación dejando el repositorio sin PR abiertas. Las dos integraciones
  se realizaron en esta sesión; la API confirmó cero PR abiertas después.
- [Release v1.5.0](https://github.com/jared-esparza/MaquetadorDTF/releases/tag/v1.5.0):
  publicada el 27/10/2026 como preliminar sin firma sobre `2cf6ffa`. Incluye Setup,
  Portable, blockmap, latest.yml, SHA256SUMS, avisos de terceros y guía Windows.
  El despliegue en IONOS y la verificación automática de web/recursos finalizaron
  correctamente en la misma ejecución que publicó la Release.
- Las PR #7 (README visual) y #8 (1.4.0) ya estaban integradas; conservar sus
  cambios y capturas. El merge de #8 fue externo a la sesión que lo documentó.
- El contexto incorpora los cierres documentales de #9/#10 y #11. Comprobar
  siempre `git status` y referencias remotas: el estado de este archivo es fechado.

## Producto y decisiones vigentes

Editor DTF de PKprint, en español y azul. Una base React/TypeScript/Vite para web
y Electron Windows 10/11 x64. Web estática IONOS: https://dtf.wcard.es.

- Diseños procesados localmente, sin cuenta ni servidor Node de producción.
  No se guardan proyectos editables: exportar antes de cerrar. Las preferencias
  de cada navegador/dominio y de Electron permanecen separadas.
- Entrada: PNG, JPG/JPEG, WebP estático y PDF. Las páginas PDF seleccionadas se
  convierten a imagen a 300 ppp por defecto o 600 opcional, sin promesa vectorial.
  Deben conservarse blanco dibujado, transparencia, orientación y tamaño físico.
- Lista de diseños como una pila: el último añadido aparece arriba, también
  al cargar varios archivos o páginas PDF. Solo cambia la presentación; el orden
  interno de los diseños utilizado por el montaje se conserva.
- Ancho y alto editables en centímetros, siempre proporcionales. Prevalece la
  última medida válida; solo se almacena widthMm, sin redondear la geometría
  interna. Presentación a dos decimales, coma/punto y bloqueo por valor inválido.
- Separación 3–7 mm, 7 inicial; MaxRects con giros, geometría en milímetros.
  Formatos entre 10 y 5000 mm por lado y máximo 3000 piezas por trabajo.
- Imagen: 20 MiB/25 MP. PDF: 50 MiB/100 páginas, conversión 25 MP/página.
  Presupuesto de imágenes retenidas: **60/120/240 MP**, 60 inicial, persistido por
  navegador o instalación. Cuenta originales y versiones únicas, incluido deshacer;
  las copias del montaje no multiplican el contador. No permite bajar bajo consumo.
  240 MP son unos 960 MB de píxeles RGBA, más temporales: no garantizan memoria.
- PDF: un archivo por pliego por defecto, ZIP si hay varios; PDF multipágina
  opcional. PNG: 150/300/600 ppp, 300 inicial, ZIP si hay varios pliegos.
  Salida PNG: 32767 px/lado y 512 MP/pliego. Archivo PNG, PDF o ZIP final: 256 MiB.
  No reducir calidad automáticamente al superar límites.
- Nombre común editable: DTF-AAAA-MM-DD-HHmm con fecha/hora local al primer diseño
  de un trabajo vacío. Se conserva durante ese trabajo y no entre sesiones.
  Máximo 120 caracteres, validación Windows/rutas y extensión automática.
  Archivos BASE.png/pdf o BASE.zip con BASE-pliego-NNN.png/pdf dentro.
- Instalada: actualizaciones manuales, aviso antes de descargar (predeterminado)
  o descarga automática; incluye preliminares. Reinicio explícito bloqueado con
  trabajo sin exportar. Portátil: actualización asistida y datos junto al EXE.
- Distribución preliminar sin Authenticode. Licencia del código propio pendiente.
  No incluye tinta blanca, CMYK ni sustitución del RIP. La comprobación inicial en
  Windows Sandbox bloqueó los EXE sin firmar: no afirmar éxito en Windows limpio.

## Pruebas ejecutadas y alcance

- CI final de la PR #10: [40535149776](https://github.com/jared-esparza/MaquetadorDTF/actions/runs/40535149776),
  correcta en `8dc20ef`: compilación, unitarias, navegador, Electron de desarrollo,
  empaquetado, ejecutable Windows y verificación independiente PNG/PDF.
- CI de main y publicación: [40536980721](https://github.com/jared-esparza/MaquetadorDTF/actions/runs/40536980721),
  correcta en `2cf6ffa`: todas las comprobaciones de Windows, publicación de la
  preliminar, despliegue y verificación automática HTTPS de la web y recursos.
  Este cierre posterior solo modifica documentación y no reconstruye una Release
  con la misma versión; su propia CI se consulta en el historial de main.
- Se comprobó el estado mediante la API de GitHub. Localmente solo se revisaron
  código/documentación y `git diff --check`; no se ejecutaron pruebas locales ni
  comprobaciones manuales de la web desplegada.
- Las nuevas pruebas cubren presupuesto y persistencia, rechazo de PDF multipágina
  sin incorporación parcial, medidas enlazadas, nombres y cancelación del guardado.
  Pillow/PDFium comprobaron colores, transparencia y tamaño físico de exportaciones
  con entrada PNG. Esto no prueba la resolución real de una importación PDF.
- La revisión independiente detectó normalización repetida de extensiones;
  se corrigió en `d009c0f` con pruebas. La muestra E2E inicial activaba el bloqueo
  legítimo de baja resolución; `65df637` aumentó sus píxeles sin quitar el bloqueo.
- La ayuda pública se actualizó en 1.5.0 para formatos de entrada, medidas,
  presupuesto y nombres; ya no es un pendiente de ayuda limitada a PNG.

## Pendientes y limitaciones conocidas

1. **Prioridad: fidelidad PDF → imagen.** App.tsx conserva un fallback que amplía
   la miniatura cuando la rasterización queda vacía. Contradice resolución real
   sin degradación silenciosa. El test previo de importación se debilitó a
   dimensiones/longitud: recuperar comprobaciones independientes de contenido,
   alfa, color, posiciones y resolución antes de afirmar fidelidad validada.
2. **Simplificación incompleta.** Persisten PdfSource, inserción vectorial,
   renderMixedPng, PdfConversion y ramas asociadas. Los nuevos diseños entran sin
   pdf; falta retirar los caminos antiguos. No reabrir el modelo vectorial descartado.
3. **Importación PDF.** El análisis renderiza todas las páginas a 300 ppp para
   miniaturas. Tras confirmar se cierra el diálogo y falta cancelar desde UI durante
   la conversión. Desde 1.5.0 se comprueba el presupuesto retenido antes de convertir
   cada página seleccionada; eso no resuelve el consumo transitorio del análisis.
   Revisar recorte de dos píxeles a la resolución elegida y liberación de recursos.
4. **Entrada de imágenes.** decodeImage comprueba tamaño tras decodificar y no
   restringe por firma a los formatos acordados. WebP animado solo busca ANIM en
   los primeros 64 bytes; necesita análisis fiable del contenedor. Faltan pruebas
   específicas JPEG/EXIF/WebP y archivos suplantados.
5. **Avisos de terceros.** prepare-desktop.mjs omite paquetes ausentes y tiene un
   fallback MIT que dice incluir el texto sin adjuntarlo. Revisar dependencias
   opcionales empaquetadas y avisos completos.

La CI verde no da por resueltos estos pendientes ni equivale a calibración física.

## Flujo de trabajo y navegación

- Commit/push autorizados para el trabajo solicitado; pruebas en GitHub Actions.
  No repetir suites locales ni comprobar manualmente la web después del despliegue.
- La autorización de integrar y publicar esta entrega no autoriza las siguientes.
  No fusionar, etiquetar, publicar ni desplegar sin autorización de esa entrega.
- Cambios funcionales: incrementar versión respecto a main, lockfile y notas,
  y abrir PR. Solo documentación/pruebas no requieren versión ni Release.
- PR a main: CI prueba y empaqueta. Push a main: CI publica preliminar cuando
  hay cambio funcional y despliega el mismo commit. Tags no reconstruyen.
  Fallo de CI bloquea publicación/despliegue; Release y hosting no son atómicos.
- [DESARROLLO.md](DESARROLLO.md): comandos y estructura.
  [PUBLICACION.md](PUBLICACION.md): política y reintentos.
  [DEPLOY-WEB.md](DEPLOY-WEB.md): IONOS.
  [USO-WINDOWS.md](USO-WINDOWS.md): guía de usuario.
- PLAN/PROGRESS y DESKTOP-PLAN/DESKTOP-PROGRESS son históricos, no backlog ni
  prueba del estado actual. No reejecutarlos.
- .tools, artifacts, dist, release y node_modules están ignorados. No depender de
  scripts bajo .tools para un clon nuevo; no subir temporales, binarios, dependencias
  ni credenciales. Nunca imprimir secretos de Git/SFTP o enlaces firmados de logs.

## Entrega 1.5.1 — diseños recientes arriba

Petición posterior a la integración de #9/#10: mostrar el último diseño cargado
al principio para acceder a sus medidas y edición sin recorrer toda la lista.
El usuario autorizó pasar el cambio a main. La [PR #11](https://github.com/jared-esparza/MaquetadorDTF/pull/11)
se integró con merge `738a17878a3d7ec40173e854bd1a17a03ee01932`.
La API confirmó cero PR abiertas tras integrarla. Main local quedó sincronizado.
La versión 1.5.1 coincide en manifiesto y lockfile, con notas actualizadas.

El cambio invierte una copia del array solo al mostrar las tarjetas; no muta el
estado ni el orden enviado a MaxRects. Los lotes y páginas PDF se muestran también
con el último elemento arriba. Las tarjetas conservan su identidad y sus ajustes.
Se adaptaron comprobaciones existentes de navegador para orden, edición, borrado,
cargas sucesivas y páginas PDF. Validación local: revisión del cambio y
`git diff --check`; no se ejecutaron pruebas locales. Las pruebas de esta rama
pasaron en la [CI de la PR #11](https://github.com/jared-esparza/MaquetadorDTF/actions/runs/40554070579),
commit `3a25994`: compilación, unitarias, navegador, Electron, ejecutable empaquetado
y verificaciones independientes de exportación. La [CI de main](https://github.com/jared-esparza/MaquetadorDTF/actions/runs/40555193435)
finalizó correctamente en `738a178`: pruebas completas, publicación preliminar
[v1.5.1](https://github.com/jared-esparza/MaquetadorDTF/releases/tag/v1.5.1),
despliegue en IONOS y verificación automática de web y recursos. Estado consultado
por API. Este cierre posterior solo documenta esos resultados; su propia ejecución
se consulta en el historial de Actions de main.
Los pendientes técnicos anteriores siguen abiertos. Esta autorización no se
extiende a futuras entregas; no se realizaron pruebas locales ni comprobaciones
manuales de la web desplegada.

## Implementación candidata 1.6.0 — descarga individual de pliegos

Plan aprobado para implementar en `codex/pliegos-individuales`, desde main
`78037d6`. Versiones de manifiesto/lockfile y notas preparadas para 1.6.0.
No hay autorización para integrar, etiquetar, publicar ni desplegar esta entrega.

- Pliego visible descargable PDF/PNG; PNG usa los ppp elegidos. Tras éxito se
  atenúa y aparta de descargas generales PDF/PNG/ZIP, con «Volver a incluir».
  La web registra entrega al navegador; Electron solo marca tras guardar.
  No se afirma impresión ni confirmación del guardado posterior en web.
- ZIP conserva números originales con huecos, el PDF único conserva orden y omite
  apartados. Un pendiente se entrega directo, numerado si el trabajo tenía varios;
  individual siempre BASE-pliego-NNN.ext. La descarga general no añade marcas.
- Marcas en memoria de sesión. Cambios de diseños/raster, medidas/copias, deshacer,
  dimensiones/márgenes, separación o espejo reinician con aviso. Nombre, ppp,
  organización y navegación las conservan. Una descarga parcial no limpia dirty;
  completar todos individualmente o exportar pendientes en conjunto sí. Reincluir
  deja dirty otra vez. Cancelación/errores conservan estado y diseños.
- Selección pageIndices opcional compartida PDF/PNG, validada después del montaje
  completo: no se eluden recuentos de copias ni validación geométrica. Se rechazan
  vacíos, duplicados o fuera de rango; se exporta en orden original.
- GAP_OPTIONS compartido: enteros 3–10 mm, 7 inicial, en UI/cálculo/validación.

Se añadieron pruebas de selección/numeración y validación completa, navegador,
Electron, guardado/cancelación/error, trabajo pendiente y muestras independientes
Pillow/PDFium con contenido, transparencia, espejo y tamaño físico. No se ejecutaron
pruebas locales ni comprobaciones manuales de la web desplegada. Validación local:
revisión del código y `git diff --check`. Consultar el resultado de esta rama en
[GitHub Actions](https://github.com/jared-esparza/MaquetadorDTF/actions?query=branch%3Acodex%2Fpliegos-individuales).
Los pendientes anteriores de fidelidad PDF y otros límites siguen abiertos; las
muestras nuevas parten de PNG y no prueban resolución real de PDF importado.
