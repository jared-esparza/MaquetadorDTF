# Maquetador DTF 1.5.0 para Windows 10/11 x64

Instalador guiado en español y versión portátil. Publicada como preliminar sin firma.

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
## Compatibilidad de formatos desde 1.4.0

Desde 1.4.0 se admite la importación de PNG, JPG/JPEG, WebP estático y PDF, se permite elegir entre un PDF por pliego o un único PDF multipágina y se conserva la exportación PNG/ZIP. La opción «Un PDF por pliego» queda seleccionada por defecto porque es la más compatible con los proveedores de impresión.

Las páginas PDF se convierten al importarlas a una imagen de 300 ppp por defecto o 600 ppp opcional. El diseño resultante sigue el mismo flujo que PNG, JPG y WebP; la conversión rasterizada no conserva vectores.

La versión web y Electron incluyen PDF.js y sus recursos localmente para funcionar sin CDN. La salida continúa siendo RGB para PNG; la gestión de color y tinta blanca corresponde al RIP.


## Memoria, medidas y nombres de exportación

El presupuesto de imágenes puede elegirse entre 60 MP (inicial), 120 MP y 240 MP; se recuerda en cada navegador o instalación. El indicador cuenta originales y versiones de edición únicas, sin multiplicar por las copias del montaje. Una selección mayor consume más memoria y puede agotar la del equipo. No cambia el máximo de 25 MP por imagen/página convertida ni los límites de salida.

Cada diseño permite editar ancho o alto en centímetros. La última medida válida calcula la otra manteniendo la proporción. El nombre común del trabajo puede editarse antes de descargar; inicialmente es DTF-AAAA-MM-DD-HHmm con fecha y hora local. Los ZIP usan el mismo nombre y contienen archivos BASE-pliego-001, BASE-pliego-002, etc. La extensión se añade automáticamente. El nombre se conserva durante el trabajo y no se guarda entre sesiones.

La validación de esta entrega se realiza en GitHub Actions. Los pendientes anteriores de fidelidad de importación PDF y de validación en Windows limpio siguen documentados en CONTEXTO.md; estas mejoras no los dan por resueltos.
