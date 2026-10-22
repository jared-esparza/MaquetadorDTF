# Publicar web y Windows juntos

Una entrega funcional usa una versión X.Y.Z nueva en package.json y package-lock.json, un apartado en CHANGELOG y notas actualizadas en docs/RELEASE.md. Abre una PR a main. Los cambios en src, electron, public, build, web, scripts, dependencias o workflows cuentan como funcionales. Solo documentación o pruebas no crean Release.

CI comprueba el incremento respecto a la base y rechaza versiones ya etiquetadas o publicadas. Ejecuta pruebas unitarias, navegador y escritorio, verifica imágenes y PDF con lectores independientes y comprueba el ejecutable empaquetado. Genera una compilación web y ambos EXE por ejecución; los pasos de publicación reutilizan esos artefactos.

Al integrar en main, la publicación se serializa con el despliegue. Si el commit ha quedado superado por otro main, se omiten su Release y su despliegue: se publica la entrega más reciente. Primero se crea la etiqueta sobre el commit construido, se suben los siete archivos de distribución a un borrador y se verifican sus hashes; después se publica como preliminar sin firma y se despliega la web del mismo commit. La etiqueta no inicia otro workflow.

La Release adjunta instalador, portátil, SHA256SUMS.txt, USO-WINDOWS.md, THIRD_PARTY_NOTICES.txt, latest.yml y el .blockmap del instalador, y enlaza la compilación y sus pruebas. No se presentan las pruebas de CI como una comprobación nueva en Windows limpio ni como calibración física.

## Reintentos y errores

Usa Re-run failed jobs cuando falle la publicación. Los artefactos de la ejecución se conservan y el paso vuelve a comprobar versión, commit y hashes. Re-run all jobs reutiliza los artefactos completos de esa misma ejecución mientras no hayan expirado. Si un archivo publicado tiene un hash diferente, el proceso falla y no lo sustituye. No borres etiquetas o Releases publicadas para forzar otro binario con la misma versión: crea una versión nueva.

Una ejecución manual sobre main permite repetir el despliegue. Si esa versión ya está publicada y pertenece al mismo commit, no intenta publicar otros ejecutables. Si los artefactos han expirado y la publicación quedó a medias, prepara una versión nueva en lugar de sustituir los archivos existentes.

Si la Release se publica pero falla IONOS, Windows queda disponible y la web conserva la entrega anterior hasta reintentar. No existe una transacción entre GitHub y el hosting. Los fallos se atienden desde Actions; se mantiene la verificación automática HTTPS y no se realizan comprobaciones manuales posteriores del agente.

Desde 1.3.0, la instalada ofrece actualizaciones configurables y descarga automática opcional; el reinicio siempre requiere una acción explícita y trabajo exportado. El portátil conserva actualización asistida, reemplazando el EXE y conservando MaquetadorDTF-datos. El actualizador incluye preliminares y comprueba SHA-512. Antes de publicar se valida que latest.yml referencia exactamente el instalador y su tamaño/hash. Los botones de descarga web detectan la nueva Release sin recompilar.
