# Electron y distribución — plan aprobado

## Objetivo
Instalador NSIS guiado en español y portátil Windows10/11 x64, Electron incluido, sin Node externo ni red. Un repositorio público MaquetadorDTF, fuente compartida web/escritorio. Sin firma inicial ni licencia de reutilización elegida todavía.

## Secuencia
1. Guardar fuente web actual en main y etiqueta v1.0.0-web, antes de Electron. Trabajar en feat/electron-desktop, revisión/PR y merge tras pruebas.
2. Electron con protocolo local seguro, renderer aislado y sandbox. Puente mínimo para preferencias, guardar PDF y estado de cambios. Nada de acceso general al filesystem desde el renderer.
3. Guardado nativo con última carpeta, cancelar y errores sin perder trabajo; aviso de cierre por cambios sin exportar; ayuda, bienvenida, calibración, versión e instancia única.
4. Preferencias instaladas en perfil Windows y portátiles en MaquetadorDTF-datos junto al exe. Fallar claramente si no se puede escribir. Conservar datos al actualizar/desinstalar.
5. NSIS por usuario en español y portátil completo, nombres MaquetadorDTF-{Setup|Portable}-1.1.0-x64.exe; SHA256 y avisos de dependencias. CI por PR/main y Release en borrador por tag.
6. Pruebas originales, Electron, binarios empaquetados, PDF independiente y Windows limpio sin Node/red. No confundir pruebas en desarrollo con validación en máquina limpia.

## Decisiones
- La etiqueta web no se moverá después del primer push.
- No se guardan proyectos editables ni se añaden actualizaciones automáticas.
- El estado exportado se confirma después de escritura completa, no al cerrar el diálogo. Cambios de imagen, perfil, separación, copias, medidas o espejo vuelven a marcar pendiente.
- El repositorio no contendrá ZIP, exe, node_modules, builds, datos de usuario ni resultados de pruebas. La copia ZIP existente no se borra.
- La versión pública conserva todos los avisos de terceros, sin declarar MIT/GPL para el código propio.
