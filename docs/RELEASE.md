Maquetador DTF 1.3.0 para Windows 10/11 x64: instalador guiado en español y versión portátil.

- Actualizaciones configurables desde el botón Actualizaciones. Modo inicial: avisar antes de descargar.
- Instalada: búsqueda manual, comprobación al iniciar y cada 6 horas, o descarga automática. Las versiones preliminares están incluidas.
- La instalación exige pulsar Instalar y reiniciar, sin montaje pendiente de exportar ni operaciones activas. Nunca se instala automáticamente al cerrar.
- Portátil: avisos y descarga asistida del nuevo EXE; reemplazarlo conservando MaquetadorDTF-datos. No se sustituye automáticamente.
- Las Releases incorporan latest.yml y el mapa de descarga del instalador, con sumas SHA-256 y verificación SHA-512 del actualizador.
- Se mantienen exportaciones PDF, PNG y ZIP a tamaño real y todas las preferencias.

**Instalación inicial del sistema de actualización:** desde 1.2.0 o anteriores, descarga e instala esta versión manualmente una vez. Las siguientes versiones compatibles podrán descargarse desde la aplicación instalada.

**Versión preliminar sin firma.** Se mantiene la distribución sin Authenticode: Windows puede mostrar avisos o bloquear la ejecución según sus políticas. El actualizador comprueba la integridad del instalador descargado, pero esto no equivale a una firma de editor. Las pruebas automatizadas del paquete no equivalen a una validación en Windows limpio ni a calibración física.

El instalador y el portátil incluyen todos los recursos necesarios; no requieren Node. El editor sigue funcionando sin conexión. Consultar o descargar actualizaciones requiere Internet y no bloquea el trabajo si la conexión falla.

Consulta USO-WINDOWS.md y SHA256SUMS.txt. Licencia del código propio pendiente; avisos de dependencias incluidos.
# Maquetador DTF 1.4.0 — PDF por pliego y formatos de imagen

Esta entrega añade la importación de PNG, JPG/JPEG, WebP estático y PDF, permite elegir entre un PDF por pliego o un único PDF multipágina y conserva la exportación PNG/ZIP. La opción «Un PDF por pliego» queda seleccionada por defecto porque es la más compatible con los proveedores de impresión.

Las páginas PDF se convierten al importarlas a una imagen de 300 ppp por defecto o 600 ppp opcional. El diseño resultante sigue el mismo flujo que PNG, JPG y WebP; la conversión rasterizada no conserva vectores.

La versión web y Electron incluyen PDF.js y sus recursos localmente para funcionar sin CDN. La salida continúa siendo RGB para PNG; la gestión de color y tinta blanca corresponde al RIP.

