# Desarrollo y referencia técnica

[Volver a la presentación](../README.md) · [Uso en Windows](USO-WINDOWS.md)

Para retomar el desarrollo en un hilo nuevo, leer primero [CONTEXTO.md](CONTEXTO.md).
Esta guía describe el producto y las herramientas; el contexto distingue los
pendientes reales y el alcance de las verificaciones.

El editor web y la aplicación Electron comparten código. El usuario final puede usar la web o los ejecutables; los comandos siguientes son para desarrollo.

## Lanzador local alternativo para desarrollo

Haz doble clic en **Iniciar Maquetador.cmd**. La aplicación se abre en el navegador en **http://127.0.0.1:47831**. Mantén abierta la ventana del lanzador mientras trabajas; ciérrala con Ctrl+C.

Requiere Node.js **22.12 o posterior** (se recomienda una versión LTS). En una copia nueva, el lanzador ejecuta `npm ci` y `npm run build` si faltan. Esa primera preparación necesita Internet; el uso posterior es local y no requiere conexión.

Si el puerto está ocupado, comprueba si el maquetador ya está abierto. El puerto es fijo para conservar tus perfiles entre arranques; cambiarlo cambia el almacenamiento del navegador.

## Preparar un trabajo

1. Sube PNG, JPG/JPEG, WebP estático o PDF. Para PDF, selecciona páginas y conversión a 300 o 600 ppp. El diseño entra en el flujo de imágenes; no se promete conservación vectorial. El recorte conserva el blanco dibujado.
2. Introduce el ancho o el alto en **centímetros**, siempre proporcionales, y las copias de cada diseño. La medida final corresponde al contenido visible recortado.
3. Si hay fondo, abre **Borrador · fondo y colores**. La tolerancia controla qué colores se eliminan. El modo conectado conserva zonas interiores del mismo color; el modo global también las elimina. Con la varita puedes quitar otro color. Aplica o cancela los cambios.
4. Selecciona o configura el formato de film y los márgenes en **milímetros**. Elige una separación de 3, 4, 5, 6 o 7 mm. Por defecto se seleccionan **7 mm**.
5. Revisa los pliegos y descarga PDF o PNG. Un pliego genera un PNG; varios, un ZIP con un PNG por pliego. La resolución PNG inicial es 300 ppp y puede cambiarse a 150 o 600. Si un diseño tiene menos de 150 ppp, tendrás que aceptar el aviso de calidad o reducir su tamaño.

El montaje prueba seis variantes de MaxRects con giros de 90°. Es una optimización heurística: busca reducir los pliegos, sin garantizar el mínimo matemático. No anida formas dentro de otras ni permite colocar piezas manualmente.

**Afinar los bordes** amplía mediante interpolación con alfa premultiplicado. No reconstruye detalle ni aumenta los ppp informados. **Deshacer** restaura la versión anterior de ese diseño; el original también se conserva internamente durante la sesión.

## Privacidad, sesión y límites

Los diseños se procesan en el navegador; no se suben ni se requieren cuentas. Las descargas y actualizaciones consultan GitHub. Los perfiles de formato se guardan en ese navegador. Los diseños son de sesión: exporta el trabajo antes de cerrar o recargar. No se guardan proyectos editables.

Límites: 20 MiB y 25 megapíxeles por imagen, 60 megapíxeles retenidos en conjunto por defecto, ampliables a 120 o 240 MP (incluye original y versiones de edición únicas), 3000 copias por trabajo, formato entre 10 y 5000 mm por lado. El afinado también comprueba el presupuesto de memoria. La salida PNG admite hasta 32 767 píxeles por lado, 512 megapíxeles por pliego y 256 MiB por archivo PNG o ZIP final. Superar un límite muestra un error sin reducir la calidad automáticamente; Film 55 × 100 cm admite 150, 300 y 600 ppp. Estos límites evitan ampliaciones ilimitadas; el uso real de memoria incluye además copias temporales de cálculo y exportación.

## Desarrollo y pruebas

Los comandos siguientes son referencia. La preferencia actual del usuario es
delegar las pruebas en GitHub Actions y no repetirlas localmente por defecto.

```powershell
npm ci
npm run build
npm run dev
npm test
npm run test:e2e
npm run test:desktop
npm run desktop:dev
npm run dist:win
```

`npm run test:e2e` compila y comprueba el **servidor de producción** en Chrome instalado, incluido el PDF descargado. `npm test` ejecuta las pruebas de imagen, montaje, PDF y servidor; el test de servidor necesita una compilación en `dist`, que se genera ejecutando primero `npm run build`.

Para reconstruir después de cambiar código: `npm run build`. El lanzador usa la compilación existente y no la reconstruye en cada arranque.

La comprobación independiente del PDF usa Python con `pypdf`, `pypdfium2` y `Pillow`:

```powershell
python scripts/verify-pdf.py
python scripts/verify-png.py
```

Las muestras se regeneran con `npm test`. Los informes y renders quedan en `artifacts/qa/`; las capturas y descargas del flujo real, en `test-results/`. La prueba de calibración verifica digitalmente la geometría; la impresión física depende del RIP y de la impresora.

Para PDF independiente en otro equipo de desarrollo: `python -m pip install -r requirements-test.txt`. Los comandos de escritorio necesitan las dependencias de desarrollo, que se instalan con `npm ci`; el usuario final usa únicamente los ejecutables.

`npm run dist:win` produce instalador, portátil, metadatos de actualización y SHA256SUMS.txt en `release`. Ejecuta previamente `npm test` para regenerar las muestras de calibración. `npm run test:desktop` prueba Electron de desarrollo; para probar el paquete compilado establece `DTF_ELECTRON_EXE` con la ruta absoluta de `release/win-unpacked/MaquetadorDTF.exe` y ejecuta `npx playwright test -c playwright.desktop.config.ts`.

`powershell -NoProfile -File scripts/create-sandbox-check.ps1 -Start` prepara e inicia la comprobación en Windows Sandbox sin red. No añade Node al invitado. El informe de `artifacts/sandbox-qa/verification.json` indica el resultado real, los hashes y el sistema probado. Un bloqueo de Control de aplicaciones queda registrado como fallo de esa comprobación, no como una validación exitosa.

## Cómo mantener y publicar versiones

En la web, los formatos se guardan únicamente en el navegador de cada visitante: editarlos no modifica los de otras personas. «Restaurar formatos predeterminados» recupera los nombres, medidas y márgenes originales de Film 55 × 100 cm, A3 y A4, conservando los formatos personalizados y la selección. Borrar los datos del sitio o cambiar de navegador o dominio puede dejar esas preferencias fuera de alcance.

El bloque «Versión para Windows» consulta la API pública de GitHub, sin credenciales, al abrir la web y al descargar. Escoge por fecha de publicación la Release no borrador más reciente con ambos ejecutables x64, incluidas las preliminares, e identifica estas últimas. Las descargas usan las URL reales de sus archivos; una nueva Release no requiere desplegar otra vez la web. Si la consulta falla o no hay una publicación completa, se ofrece el listado de versiones sin mantener enlaces desactualizados. Este bloque solo aparece en la web.

La versión web se despliega automáticamente en IONOS con cada push a `main` que supere los controles. La URL se configura mediante `WEB_URL` en GitHub; los datos SFTP permanecen como secretos. Consulta [la configuración y el procedimiento de despliegue](DEPLOY-WEB.md).

1. Crea una rama para el cambio y modifica el código compartido en `src`; el contenedor vive en `electron`.
2. Delega las pruebas y las verificaciones independientes de PNG/PDF en GitHub Actions. Los comandos locales son referencia; no los ejecutes sin una petición que cambie la preferencia vigente.
3. Para cada entrega funcional, incrementa la versión X.Y.Z en package.json y package-lock.json, actualiza CHANGELOG y docs/RELEASE.md, y abre una PR hacia `main`. CI rechaza versiones no incrementadas o ya etiquetadas.
4. Al integrar, GitHub reutiliza una sola compilación comprobada para crear la etiqueta y publicar la Release preliminar sin firma con ambos ejecutables, notas y sumas SHA-256. Después despliega la web del mismo commit. Crear la etiqueta no dispara otra compilación.
5. Los reintentos de la misma ejecución reutilizan los artefactos completos y no sustituyen archivos publicados con hashes diferentes. Las modificaciones solo de documentación o pruebas no crean Release. El agente no realiza comprobaciones manuales de la web tras el despliegue; las verificaciones automáticas permanecen en Actions. Consulta [el proceso de publicación](PUBLICACION.md).

No subas `node_modules`, `dist`, `release`, ZIP, datos de usuario ni informes temporales a Git. Los instaladores se distribuyen como archivos de Release. Desde 1.3.0, la instalada ofrece búsqueda manual, aviso antes de descargar (predeterminado) y descarga automática opcional. La instalación exige una acción explícita y trabajo exportado. Se incluyen versiones preliminares. El portátil ofrece descarga asistida y se reemplaza conservando su carpeta de datos. Las versiones anteriores necesitan instalar 1.3.0 manualmente una vez.

## Estructura

- `src/core`: imágenes, medidas, validación, MaxRects y exportación PDF/PNG.
- `src/workers`: cálculo de imágenes y montaje fuera del hilo de la interfaz.
- `src/components` y `src/App.tsx`: editor, perfiles y vista previa SVG.
- `scripts/serve.mjs`: servidor local que solo publica `dist` en loopback.
- `tests`: pruebas unitarias, de servidor y de navegador.

## Historia y distribución

El repositorio mantiene una única base de código para web y escritorio. La etiqueta [`v1.0.0-web`](https://github.com/jared-esparza/MaquetadorDTF/tree/v1.0.0-web) conserva el editor anterior a Electron. Los ejecutables se distribuyen en Releases, separados del código fuente.

Las preferencias de la instalada se guardan en `%APPDATA%/PKprint/MaquetadorDTF`; la portátil usa `MaquetadorDTF-datos` junto al ejecutable. Los formatos del navegador no se importan automáticamente al escritorio.

La calibración se abre desde Ayuda en la aplicación de escritorio. Las muestras y los informes generados bajo `artifacts/` son resultados locales de pruebas y no se incluyen en Git.
## Cambios funcionales de 1.4.0

La interfaz acepta PNG, JPG/JPEG, WebP estático y PDF. Las páginas PDF seleccionadas se convierten a imágenes a 300 ppp por defecto o 600 ppp opcional; se exportan por el flujo de imágenes y no conservan vectores. PDF.js se sirve desde `dist/pdfjs` sin CDN. Persisten caminos internos del prototipo vectorial pendientes de retirar, detallados en [CONTEXTO.md](CONTEXTO.md).

La exportación PDF ofrece «Un PDF por pliego» (predeterminada) y «Un único PDF con todos los pliegos». Cuando hay varios pliegos y se elige la primera opción, se genera un ZIP numerado. La exportación PNG mantiene 150/300/600 ppp y también genera ZIP para varios pliegos.

Los límites de PDF acordados son 50 MiB por archivo, 100 páginas por documento, 25 MP por página convertida y 256 MiB por archivo PDF/ZIP final. Las imágenes convertidas cuentan en los 60 MP retenidos por trabajo por defecto, ampliables a 120 o 240 MP. El código aún contiene el límite del prototipo de 100 MiB de fuentes PDF; no equivale a un nuevo presupuesto de imágenes. La cancelación durante la conversión y la fidelidad de la salida tienen pendientes documentados en CONTEXTO.md.


## Memoria y nombres de trabajo (1.5.0)

Junto a la carga, «Presupuesto de imágenes» permite 60, 120 o 240 MP y muestra consumo / presupuesto. Cuenta originales y versiones únicas para edición y deshacer; las copias no multiplican el consumo. Se recuerda por navegador o instalación. No se permite reducirlo por debajo del consumo actual: quita diseños antes. Los niveles mayores pueden agotar la memoria y no garantizan el procesamiento en cualquier equipo. Los límites por imagen (25 MP) y archivo final siguen vigentes.

Ancho y Alto (cm) son editables y siempre proporcionales; cambiar uno actualiza el otro. La geometría conserva precisión interna aunque se muestren dos decimales. Una entrada inválida debe corregirse antes de exportar.

«Nombre del trabajo» propone DTF-AAAA-MM-DD-HHmm al cargar el primer diseño, con fecha y hora local. Puedes cambiarlo conservando espacios, tildes y ñ. No escribas rutas ni nombres reservados de Windows; máximo 120 caracteres. La extensión se añade automáticamente y una extensión PNG/PDF/ZIP pegada se retira al terminar de editar. Un archivo usa BASE.png/pdf; varios usan BASE.zip con BASE-pliego-001.png/pdf y numeración consecutiva. El PDF multipágina usa BASE.pdf. El nombre se conserva al descargar ambos formatos y cambia al empezar un trabajo vacío; no se recuerda entre sesiones. En Windows se propone al guardar; renombrar el ZIP en el diálogo no renombra sus archivos interiores.
