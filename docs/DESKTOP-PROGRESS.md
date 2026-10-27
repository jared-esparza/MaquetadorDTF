# Ejecución — docs/DESKTOP-PLAN.md

> Registro histórico de Electron 1.1.0, no un listado de pendientes actuales. Para continuar: [CONTEXTO.md](CONTEXTO.md).

- Baseline: 26 pruebas web y build correctos. Commit d75c4cf, etiqueta v1.0.0-web, rama feat/electron-desktop.
- GitHub: sesión existente verificada para jared-esparza. Usar correo noreply en los commits públicos.
- Ruling: usar la carpeta actual con rama dedicada, como pide el plan; no mover el proyecto a otro worktree y romper las rutas del usuario.
- Implementados puente/settings, Electron/UI, pruebas y empaquetado. Pendiente integrar PR y publicar la versión preliminar.
- GitHub creado y baseline subido: https://github.com/jared-esparza/MaquetadorDTF, main d75c4cf y tag v1.0.0-web.
- Servicios/puente: guardado atómico, validación de preferencias y rutas, cancelación y errores de escritura. Total: 35 pruebas Vitest.
- Electron dev: 6 flujos pasan; web: 5 flujos pasan. Verificación independiente de PDF confirma alfa, giro, espejo, calibración y márgenes.
- Paquetes generados: NSIS asistido en español con escritorio opcional y portátil sin instalación. AuthenticodeNotSigned confirmado.
- Entorno limpio: Windows Sandbox 10.0.26100.0, Node ausente y red desactivada. Instalador y portátil bloqueados por Control de aplicaciones, también tras copiar dentro del invitado. No se alteraron las protecciones. Esta validación no pasa.
- Ruling autorizado por el usuario: publicar primera entrega como versión preliminar sin firma, mostrando el bloqueo del entorno limpio. No declarar aprobación ni distribución estable.
- Revisión independiente: corregidos el cierre con preferencias pendientes, propagación de errores de subida y exclusión por etiqueta en publicación. Añadida regresión para la cola de preferencias.

- Ejecutable final empaquetado: 6/6 flujos correctos. PDF exportado por ese paquete comprobado con pypdf/PDFium: 60 piezas, 3 páginas de 550 × 1000 mm y alfa.
- Paquetes finales también bloqueados en Sandbox. El informe de Release contendrá sus hashes exactos.
