# Publicación web en IONOS

Cada push a `main` ejecuta `.github/workflows/windows.yml`: pruebas del editor, navegador, Electron y PDF, empaquetado de Windows y preparación de la web. El job `deploy-web` publica después de superar esos controles. Las PR no despliegan. También se puede ejecutar manualmente el workflow sobre `main` para reintentar sin crear un commit.

## Configuración de GitHub

En Settings → Secrets and variables → Actions:

- Repository secrets: `IONOS_SFTP_HOST`, `IONOS_SFTP_USER`, `IONOS_SFTP_PASSWORD`, `IONOS_SFTP_PORT`.
- Repository variable: `WEB_URL`, inicialmente `https://dtf.wcard.es`.

El usuario SFTP debe estar limitado a la carpeta del maquetador. El destino `/` es la raíz de ese usuario, asociada a la raíz HTTPS del subdominio. El hosting solo sirve archivos; no ejecuta Node ni necesita PHP para el editor.

## Qué se publica

`npm run build` genera `dist`. `npm run web:package` prepara `artifacts/web-dist` con `index.html`, `help.html`, los recursos compilados, `.htaccess` y `deployment.json` (versión y commit). No se publican fuentes, secretos, dependencias de desarrollo ni ejecutables.

La acción SFTP está fijada al commit de la versión usada por Gym Tracker. Se publica `.htaccess` explícitamente, porque es un archivo oculto. Los despliegues se serializan y se omiten los commits que ya no sean el más reciente de `main` al comenzar la transferencia.

No se borran los archivos remotos anteriores: una sesión abierta puede seguir necesitando su chunk PDF. El HTML y el marcador de despliegue se revalidan; los recursos con nombre hash pueden conservarse en caché. Los recursos antiguos se podrán limpiar como mantenimiento separado, una vez que no se necesiten para sesiones abiertas o recuperación.

Tras subir se comparan por HTTPS el HTML, ayuda, marcador y todos los recursos con los bytes del artefacto aprobado. Si falla la subida o la verificación, el workflow informa del fallo y permite reintentar.

Para repetir las pruebas completas de navegador contra la web publicada, establece `DTF_WEB_URL=https://dtf.wcard.es` y ejecuta `npm run test:deployed` desde un equipo de desarrollo con Chrome. Incluye los flujos del editor, PNG/ZIP, descargas y formatos; no inicia un servidor local. Las pruebas de Releases interceptan GitHub para simular publicaciones y errores, y no requieren verificaciones manuales posteriores al despliegue. Los resultados quedan en `test-results-deployed`.

## Cambios de dominio y versiones Windows

Para cambiar a otro subdominio con la app en su raíz, configura DNS, HTTPS y la carpeta de hosting, y cambia `WEB_URL` en GitHub. Reejecuta el workflow sobre `main`. El dominio no está fijado en el editor. Los formatos guardados por el navegador pertenecen al dominio anterior y no migran automáticamente.

Las entregas funcionales publican automáticamente una Release preliminar y la web del mismo commit. Consulta PUBLICACION.md. Desde 1.3.0, la instalada permite comprobar y descargar actualizaciones; la instalación requiere reinicio explícito y trabajo exportado. El portátil conserva actualización asistida.
