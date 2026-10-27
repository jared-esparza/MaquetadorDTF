# Relevo de contexto — Maquetador DTF

Última revisión: 27 de octubre de 2026. Este archivo es el punto de entrada para
un hilo nuevo. Describe hechos del repositorio y decisiones vigentes; no es una
orden para implementar todos los pendientes.

## Estado confirmado

- Repositorio: https://github.com/jared-esparza/MaquetadorDTF
- Versión de trabajo: 1.5.0 en package.json y package-lock.json; publicada anteriormente: 1.4.0.
- PR #7 (README visual): integrada; conservar su documentación y capturas.
- PR #8: integrada el 27/10/2026 a las 11:23 UTC. Commit de merge en main:
  `3f3bdb4d7c4a381c4225c2c1216afe4db6f5c1cf`.
- CI de la PR, commit `5e8cba3`: correcta, ejecución `40495166439`.
- CI/publicación de main: correcta, ejecución `40495807688`.
- Release `v1.4.0`: publicada como preliminar sin firma el 27/10/2026 a las
  11:28 UTC; incluye Setup, Portable, blockmap, latest.yml, SHA256SUMS y guías.
- Estos hechos se consultaron en la API de GitHub. No se comprobó manualmente
  la web desplegada ni se repitieron pruebas locales durante este relevo.
- La rama anterior es `codex/pdf-designs-sheets`. Este relevo documental se
  prepara en `codex/context-handoff`, creada desde origin/main. Revisar siempre
  `git status` y las referencias remotas antes de continuar; este estado es fechado.

Enlaces: [PR #8](https://github.com/jared-esparza/MaquetadorDTF/pull/8),
[CI main](https://github.com/jared-esparza/MaquetadorDTF/actions/runs/40495807688),
[Release 1.4.0](https://github.com/jared-esparza/MaquetadorDTF/releases/tag/v1.4.0).

## Producto y decisiones vigentes

Editor DTF de PKprint, en español y azul, React/TypeScript/Vite con contenedor
Electron para Windows 10/11 x64. Web pública sin cuenta ni servidor Node de
producción: https://dtf.wcard.es, hosting estático IONOS mediante SFTP.

- Diseños procesados localmente. Sin proyectos editables guardados; exportar
  antes de cerrar. Formatos privados por navegador/dominio, separados de Electron.
- Separación: 3 a 7 mm, 7 mm inicial. MaxRects con giros; geometría en milímetros.
- PDF: un archivo por pliego por defecto; varios pliegos se entregan en ZIP.
  PDF multipágina opcional. PNG: 150/300/600 ppp, 300 inicial; ZIP multipágina.
- Importación solicitada: PNG, JPG/JPEG, WebP estático y PDF. El plan vectorial
  original quedó sustituido: convertir PDF al importar a 300 ppp por defecto
  o 600 opcional; después usar el flujo común de imágenes. Mantener blanco
  dibujado y transparencia, orientación, tamaño físico y selección de páginas.
- Límites acordados: imagen 20 MiB/25 MP, PDF 50 MiB/100 páginas, conversión
  25 MP/página, presupuesto de 60 MP retenidos por defecto, seleccionable a 120/240 MP, 3000 piezas. Sin reducir calidad
  silenciosamente. PNG final: 32767 px/lado, 512 MP/pliego, 256 MiB/archivo;
  PDF y ZIP final: 256 MiB.
- Instalada: actualizaciones manuales, aviso antes de descargar (predeterminado)
  o descarga automática; incluye preliminares. Reinicio explícito, bloqueado
  con trabajo sin exportar. Portátil: actualización asistida y datos junto al EXE.
- Sin firma Authenticode, licencia propia pendiente. Sin tinta blanca, conversión
  CMYK ni sustitución del RIP. Sandbox limpio bloqueó los EXE sin firmar en la
  primera entrega; no afirmar validación satisfactoria en Windows limpio.

## Pendientes y límites de lo verificado

La CI verde no demuestra que todo el plan de simplificación esté terminado.
La revisión de código de este relevo detectó lo siguiente (no corregido aquí):

1. **Prioridad: fidelidad PDF → imagen.** El flujo actual tiene un fallback en
   src/App.tsx que amplía la miniatura si la rasterización queda vacía. Contradice
   el requisito de resolución real sin degradación silenciosa. En la sesión previa
   se observó una salida PNG vacía y se debilitó el test de contenido de
   tests/e2e/pdf-import.spec.ts hasta comprobar solo dimensiones/longitud.
   Deben recuperarse comprobaciones de contenido, alfa, color, posiciones y
   resolución con un lector independiente antes de dar la fidelidad por validada.
2. **Simplificación incompleta.** Persisten PdfSource en el modelo, inserción
   vectorial, renderMixedPng, PdfConversion y estados/ramas asociados. Los nuevos
   diseños importados se añaden sin `pdf`, pero aún falta retirar esos caminos.
3. **Importación PDF.** El análisis sigue renderizando todas las páginas a 300 ppp
   para obtener miniaturas, en lugar de miniaturas ligeras. Tras confirmar se
   cierra el diálogo y la conversión usa un AbortController sin control de cancelar
   en UI. Revisar recorte de dos píxeles a la resolución elegida y liberación de
   canvases/documentos. No afirmar cancelación completa ni presupuesto de memoria
   previo a cada render sin comprobarlo.
4. **Entrada de imágenes.** decodeImage utiliza createImageBitmap y EXIF, pero no
   restringe realmente por firma a los tres formatos acordados. La detección de
   WebP animado solo busca ANIM en los primeros 64 bytes; necesita análisis fiable
   del contenedor. Los límites de píxeles se comprueban después de decodificar.
   Faltan pruebas específicas de JPEG/EXIF/WebP y archivos suplantados.
5. **Avisos de terceros.** scripts/prepare-desktop.mjs omite paquetes ausentes y
   tiene un fallback MIT que dice incluir el texto de licencia sin adjuntarlo.
   Revisar dependencias opcionales realmente empaquetadas y avisos completos.
6. **Ayuda de producto.** public/help.html aún describe carga solo PNG. No se editó
   aquí porque afecta al paquete de aplicación: incluirlo en una futura entrega
   funcional con incremento de versión, no en esta revisión documental.

Los pendientes anteriores siguen abiertos: no presentarlos como arreglados ni reabrir el desarrollo vectorial descartado. La tarea autorizada de 1.5.0 se describe a continuación.

## Historial de fallos CI ya resueltos

- `11fa0db`: política exigía cabecera exacta `## 1.4.0` en CHANGELOG y texto
  `Maquetador DTF 1.4.0 ` en docs/RELEASE.md.
- `56e4d78`: selector accesible de carga cambiado; 11 tests esperaban 60/120 s
  buscando «Subir diseños PNG». Se restauró «Subir diseños PNG o PDF», que permite
  la coincidencia parcial. La etiqueta no enumera todos los formatos visibles.
- `5e8cba3`: único fallo restante esperaba «PNG válido»; actualizado a «La imagen
  está dañada o no se puede leer», comprobando además cero diseños añadidos.
- Última ejecución verde comprobada: GitHub Actions; no confundir los resultados
  anteriores al cambio rasterizado con validación de la implementación actual.

## Flujo de trabajo y navegación

- Preferencia vigente: commit/push autorizados, pruebas en GitHub. No repetir
  suites locales ni comprobar manualmente el sitio después del deploy.
- No hacer merge/publicación sin autorización explícita para la siguiente entrega.
  El agente no realizó el merge de #8; GitHub ya lo registra como integrado.
- Cambios funcionales requieren nueva versión respecto a main (1.4.0 ya publicada),
  lockfile y notas. Solo documentación/pruebas no requieren versión ni Release.
- PR a main: CI prueba y empaqueta. Push a main: CI publica preliminar y despliega
  el mismo commit. Tags no reconstruyen. Fallo CI bloquea publicación/despliegue;
  Release y hosting no son una transacción atómica.
- [DESARROLLO.md](DESARROLLO.md): comandos y estructura.
  [PUBLICACION.md](PUBLICACION.md): política y reintentos.
  [DEPLOY-WEB.md](DEPLOY-WEB.md): IONOS.
  [USO-WINDOWS.md](USO-WINDOWS.md): usuario final.
- PLAN/PROGRESS y DESKTOP-PLAN/DESKTOP-PROGRESS son archivos históricos de las
  entregas iniciales. No son el backlog actual ni prueba de resultados actuales.
- .tools, artifacts, dist, release y node_modules están ignorados. No depender de
  scripts bajo .tools como si fueran herramientas versionadas de un clon nuevo.
  Nunca imprimir credenciales de Git, secretos SFTP ni enlaces firmados de logs.

## Implementación 1.5.0 — memoria, medidas y nombres (27/10/2026)

Rama: `codex/memoria-medidas-nombres`, creada desde el relevo documental `fa30f32` sobre main 1.4.0. El usuario autorizó implementar el plan y entregar mediante PR; no autorizó merge, etiquetas, publicación ni despliegue.

- Presupuesto 60/120/240 MP, persistido en clave web independiente y preferencias Electron validadas, con fallback a 60 MP. El contador usa originales/versiones únicas; rechaza reducir bajo consumo. Los mensajes muestran el límite seleccionado. La conversión PDF comprueba el tamaño esperado antes de rasterizar. No se aumenta el máximo individual de 25 MP ni los límites de salida.
- Ancho y alto editables y siempre proporcionales; solo se almacena widthMm, sin redondear la geometría interna. Presentación a dos decimales, coma/punto y bloqueo por entradas inválidas.
- Nombre del trabajo común a PNG/PDF/ZIP, fecha/hora local al primer diseño, conservación durante el trabajo y reinicio al vaciar. Valida Windows y longitud; nombres interiores BASE-pliego-NNN. Extensiones automáticas y sugerencia de guardado nativa. No se persiste el nombre entre sesiones.
- Ayuda y guías actualizadas, versión y notas 1.5.0 preparadas. No hay dependencias nuevas.

Verificación local realizada: inspección de código y `git diff --check` (sin errores de espacios; avisos de normalización CRLF/LF). No se ejecutaron pruebas locales ni comprobaciones manuales de la web desplegada. Se añadieron pruebas unitarias, navegador, preferencias/Electron y verificación independiente de PNG/PDF con Pillow/PDFium para ejecutar en GitHub Actions. CI funcional de esta entrega correcta en el commit `65df637`: ejecución [40534196105](https://github.com/jared-esparza/MaquetadorDTF/actions/runs/40534196105), consultada por API. Pasaron compilación, pruebas unitarias, navegador, verificaciones independientes PNG/PDF, Electron de desarrollo, empaquetado, pruebas del ejecutable y verificaciones de sus exportaciones. El despliegue quedó omitido por tratarse de PR.

Entrega: [PR #10](https://github.com/jared-esparza/MaquetadorDTF/pull/10), abierta contra main y sin integrar. Se hizo revisión estática independiente; su hallazgo de normalización repetida de extensiones se corrigió en `d009c0f`, con pruebas de extensiones encadenadas y de rechazo completo de PDF multipágina por presupuesto. La primera muestra E2E activaba el aviso legítimo de baja resolución: se sustituyó por una muestra con píxeles suficientes en `65df637`, conservando la protección de calidad. Este cierre documental no cambia el código funcional comprobado; su ejecución posterior puede consultarse en la PR.

Limitaciones: 240 MP equivalen a unos 960 MB de píxeles RGBA retenidos, más temporales; no es una garantía de memoria disponible. Los pendientes de fidelidad PDF y el fallback de miniatura descritos arriba siguen vigentes: las nuevas muestras de contenido usan entrada PNG y no prueban la resolución real de una importación PDF. No se ha publicado ni desplegado 1.5.0.
