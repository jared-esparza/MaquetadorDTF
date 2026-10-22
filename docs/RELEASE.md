Maquetador DTF 1.2.0 para Windows 10/11 x64: instalador guiado en español y versión portátil.

- Exportación PNG RGBA con transparencia y resolución seleccionable de 150, 300 o 600 ppp (300 por defecto).
- Un pliego genera un PNG; varios generan un ZIP con archivos numerados. Se conservan medidas, márgenes, giros, separación y espejo.
- Progreso y cancelación sin perder el montaje; renderizado por franjas para el film completo a 600 ppp.
- Se conserva la exportación PDF y se añade guardado nativo PNG/ZIP, última carpeta y apertura de carpeta.
- Web y Windows se publican desde el mismo commit con sus pruebas y sumas SHA-256. No hay actualizaciones automáticas de los programas instalados.

**Versión preliminar sin firma.** Windows puede mostrar avisos o bloquear los ejecutables según sus políticas. Las pruebas automatizadas del paquete en GitHub no equivalen a una validación en Windows limpio ni a una impresión física con el RIP. La comprobación anterior en Windows Sandbox sin Node y sin red quedó bloqueada por Control de aplicaciones; no se presenta esta entrega como una nueva validación de ese requisito.

Los ejecutables incluyen Electron y los recursos necesarios: el usuario no necesita instalar Node ni conectarse para trabajar. La versión portátil conserva sus preferencias en MaquetadorDTF-datos junto al exe; conserva esa carpeta al actualizar.

Consulta USO-WINDOWS.md y SHA256SUMS.txt. Imprime la calibración desde el RIP al 100 % antes de producir. La licencia de reutilización del código propio sigue pendiente; se incluyen los avisos de dependencias.
