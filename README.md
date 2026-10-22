# Maquetador DTF · PKprint

Editor local para cargar PNG, indicar medidas y copias, quitar fondos y repartir automáticamente los diseños sobre film. Descarga un PDF multipágina con transparencia y medidas físicas exactas.

## Aplicación de escritorio para Windows

El código fuente vive en https://github.com/jared-esparza/MaquetadorDTF. La etiqueta **v1.0.0-web** conserva el editor anterior a Electron. Se mantiene una única base de código para web y escritorio.

Para usuarios finales, descarga el **instalador** o la **versión portátil** de GitHub Releases. Ambos incluyen Electron: no requieren Node.js ni conexión a Internet para usarlos. Consulta [las instrucciones de Windows](docs/USO-WINDOWS.md). La primera versión es sin firma y puede ser bloqueada por políticas de Control de aplicaciones de Windows; no desactives esas protecciones para probarla.

La aplicación instalada guarda preferencias en `%APPDATA%/PKprint/MaquetadorDTF`. La portátil las guarda en `MaquetadorDTF-datos` junto al exe; copia también esa carpeta si quieres llevarte la configuración. Los formatos del navegador anterior deben configurarse inicialmente en la aplicación de escritorio.

La licencia de reutilización del código propio está pendiente. No se declara licencia MIT/GPL para este proyecto. Se incluyen los avisos y licencias de los componentes de terceros distribuidos.

## Abrir en Windows

Haz doble clic en **Iniciar Maquetador.cmd**. La aplicación se abre en el navegador en **http://127.0.0.1:47831**. Mantén abierta la ventana del lanzador mientras trabajas; ciérrala con Ctrl+C.

Requiere Node.js **22.12 o posterior** (se recomienda una versión LTS). Las dependencias y la compilación ya están preparadas en este equipo. En una copia nueva, el lanzador ejecuta `npm ci` y `npm run build` si faltan. Esa primera preparación necesita Internet; el uso posterior es local y no requiere conexión.

Si el puerto está ocupado, comprueba si el maquetador ya está abierto. El puerto es fijo para conservar tus perfiles entre arranques; cambiarlo cambia el almacenamiento del navegador.

## Preparar un trabajo

1. Sube los diseños PNG. El editor recorta el margen completamente transparente y conserva las proporciones.
2. Introduce el ancho en **centímetros** y las copias de cada diseño. La medida final corresponde al contenido visible recortado.
3. Si hay fondo, abre **Borrador · fondo y colores**. La tolerancia controla qué colores se eliminan. El modo conectado conserva zonas interiores del mismo color; el modo global también las elimina. Con la varita puedes quitar otro color. Aplica o cancela los cambios.
4. Selecciona o configura el formato de film y los márgenes en **milímetros**. Elige una separación de 3, 4, 5, 6 o 7 mm. Por defecto se seleccionan **7 mm**.
5. Revisa los pliegos y descarga el PDF. Si un diseño tiene menos de 150 ppp, tendrás que aceptar el aviso de calidad o reducir su tamaño.

El montaje prueba seis variantes de MaxRects con giros de 90°. Es una optimización heurística: busca reducir los pliegos, sin garantizar el mínimo matemático. No anida formas dentro de otras ni permite colocar piezas manualmente.

**Afinar los bordes** amplía mediante interpolación con alfa premultiplicado. No reconstruye detalle ni aumenta los ppp informados. **Deshacer** restaura la versión anterior de ese diseño; el original también se conserva internamente durante la sesión.

## Imprimir

- Imprime a **100 % / Tamaño real**, sin ajustar al papel.
- El PDF conserva transparencia, medidas, posiciones y giros. No contiene el damero, las guías ni los textos de la interfaz.
- Por defecto el PDF sale sin espejo. Tu RIP debe generar la base blanca y gestionar el color. Activa **Aplicar espejo en el PDF** únicamente si desactivas el espejo del RIP.
- Al activar espejo se reflejan las piezas y sus posiciones; los márgenes físicos configurados se conservan.
- Salida RGB con transparencia. No incluye conversión CMYK, perfil ICC de impresora ni canales de tinta blanca. No es un sustituto del RIP.

Antes del primer trabajo de producción, abre **artifacts/calibracion-100mm.pdf** en tu RIP: es una página A4 con un cuadrado exterior de **100 × 100 mm** y una marca asimétrica negra en la esquina superior izquierda. Imprime a tamaño real y comprueba medida, orientación y blanco con tu equipo. La compatibilidad con tu RIP y la impresión física requieren esta prueba en la impresora.

## Privacidad, sesión y límites

Los PNG se procesan en el navegador; no hay subidas, cuentas ni servicios externos. Los perfiles de formato se guardan en ese navegador. Los diseños son de sesión: descarga el PDF antes de cerrar o recargar. No se guardan proyectos editables.

Límites: 20 MB y 25 megapíxeles por PNG, 60 megapíxeles retenidos en conjunto (incluye original y versiones de edición únicas), 3000 copias por trabajo, formato entre 10 y 5000 mm por lado. El afinado también comprueba el presupuesto de memoria. Estos límites evitan ampliaciones ilimitadas; el uso real de memoria incluye además copias temporales de cálculo y exportación.

## Desarrollo y pruebas

```powershell
npm ci
npm run dev
npm test
npm run test:e2e
npm run test:desktop
npm run desktop:dev
npm run dist:win
```

`npm run test:e2e` compila y comprueba el **servidor de producción** en Chrome instalado, incluido el PDF descargado. `npm test` ejecuta las pruebas de imagen, montaje, PDF y servidor; el test de servidor necesita una compilación en `dist`, que ya se incluye en el equipo de trabajo. En una instalación limpia, ejecuta primero `npm run build`.

Para reconstruir después de cambiar código: `npm run build`. El lanzador usa la compilación existente y no la reconstruye en cada arranque.

La comprobación independiente del PDF usa Python con `pypdf`, `pypdfium2` y `Pillow`:

```powershell
python scripts/verify-pdf.py
```

Las muestras se regeneran con `npm test`. Los informes y renders quedan en `artifacts/qa/`; las capturas y descargas del flujo real, en `test-results/`. La prueba de calibración verifica digitalmente la geometría; la impresión física depende del RIP y de la impresora.

Para PDF independiente en otro equipo de desarrollo: `python -m pip install -r requirements-test.txt`. Los comandos de escritorio necesitan las dependencias de desarrollo, que se instalan con `npm ci`; el usuario final usa únicamente los ejecutables.

`npm run dist:win` produce instalador, portátil y SHA256SUMS.txt en `release`. Ejecuta previamente `npm test` para regenerar las muestras de calibración. `npm run test:desktop` prueba Electron de desarrollo; para probar el paquete compilado establece `DTF_ELECTRON_EXE` con la ruta absoluta de `release/win-unpacked/MaquetadorDTF.exe` y ejecuta `npx playwright test -c playwright.desktop.config.ts`.

`powershell -NoProfile -File scripts/create-sandbox-check.ps1 -Start` prepara e inicia la comprobación en Windows Sandbox sin red. No añade Node al invitado. El informe de `artifacts/sandbox-qa/verification.json` indica el resultado real, los hashes y el sistema probado. Un bloqueo de Control de aplicaciones queda registrado como fallo de esa comprobación, no como una validación exitosa.

## Cómo mantener y publicar versiones

En la web, los formatos se guardan únicamente en el navegador de cada visitante: editarlos no modifica los de otras personas. «Restaurar formatos predeterminados» recupera los nombres, medidas y márgenes originales de Film 55 × 100 cm, A3 y A4, conservando los formatos personalizados y la selección. Borrar los datos del sitio o cambiar de navegador o dominio puede dejar esas preferencias fuera de alcance.

El bloque «Versión para Windows» consulta la API pública de GitHub, sin credenciales, al abrir la web y al descargar. Escoge por fecha de publicación la Release no borrador más reciente con ambos ejecutables x64, incluidas las preliminares, e identifica estas últimas. Las descargas usan las URL reales de sus archivos; una nueva Release no requiere desplegar otra vez la web. Si la consulta falla o no hay una publicación completa, se ofrece el listado de versiones sin mantener enlaces desactualizados. Este bloque solo aparece en la web.

La versión web se despliega automáticamente en IONOS con cada push a `main` que supere los controles. La URL se configura mediante `WEB_URL` en GitHub; los datos SFTP permanecen como secretos. Consulta [la configuración y el procedimiento de despliegue](docs/DEPLOY-WEB.md).

1. Crea una rama para el cambio y modifica el código compartido en `src`; el contenedor vive en `electron`.
2. Ejecuta `npm run check` y la verificación independiente del PDF.
3. Actualiza versión, archivo de dependencias y CHANGELOG. Abre una PR hacia `main`; GitHub Actions ejecuta pruebas y genera los binarios.
4. Tras integrar, crea una etiqueta `vX.Y.Z`. El workflow prepara una Release en borrador con instalador, portátil y sumas SHA256.
5. Verifica los ejecutables concretos de esa Release en Windows limpio y publica únicamente cuando la comprobación sea satisfactoria. Si permanece una limitación, mantén el borrador o identifícala explícitamente como versión preliminar.

No subas `node_modules`, `dist`, `release`, ZIP, datos de usuario ni informes temporales a Git. Los instaladores se distribuyen como archivos de Release. No hay actualizaciones automáticas: se ejecuta el nuevo instalador o se reemplaza el portátil conservando su carpeta de datos.

## Estructura

- `src/core`: imágenes, medidas, validación, MaxRects y PDF.
- `src/workers`: cálculo de imágenes y montaje fuera del hilo de la interfaz.
- `src/components` y `src/App.tsx`: editor, perfiles y vista previa SVG.
- `scripts/serve.mjs`: servidor local que solo publica `dist` en loopback.
- `tests`: pruebas unitarias, de servidor y de navegador.
