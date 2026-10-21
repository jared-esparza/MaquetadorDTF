# Ejecución — docs/PLAN.md

Plan y especificación: plan aprobado en conversación, transcrito en docs/PLAN.md.

- Pre-flight: imagen procesada → dimensiones y ppp → PackItem → LayoutResult → vista previa y PDF. Todos comparten geometría en milímetros.
- Ruling: usar la carpeta vacía del usuario directamente; no existe repositorio ni rama que proteger. No crear un worktree sin repositorio.
- Ruling: fijar límites de recursos explícitos (25 MP por PNG, 60 MP retenidos entre originales y versiones únicas, 3000 piezas) para evitar agotar la memoria del navegador; mostrar errores claros y no reducir diseños silenciosamente. Un trabajo mayor debe dividirse.
- Task 1: complete — interfaz de tres columnas, perfiles editables, servidor local y lanzador Windows.
- Task 2: complete — PNG, límites, recorte, medidas, ppp, borrador conectado/global, varita, tolerancia, aplicar/cancelar/deshacer, afinado alfa premultiplicado y comparación.
- Task 3: complete — MaxRects determinista de seis variantes en worker, rotaciones, márgenes y separación exacta, navegación, rechazo de piezas imposibles y de resultados antiguos.
- Task 4: complete — PDF multipágina con imagen compartida, máscara alfa, tamaño real, rotación, espejo y validación de integridad.
- Task 5: complete — 24 pruebas Vitest, 5 flujos Playwright en compilación y servidor de producción, renderizado independiente con pypdf/PDFium y comprobaciones de píxeles y calibración.
- Revisión independiente: agente GPT-6.1 Sol con razonamiento alto, lectura sin cambios. Detectó servidor403, puerto aleatorio que perdía perfiles y presupuesto de memoria no aplicado al afinado.
- Final: fixed servidor403 — test HTTP real RED (403) → GREEN (HTML/JS200, traversal403, ausente404).
- Final: fixed puerto aleatorio — test reinicio RED (orígenes distintos) → GREEN (origen estable47831).
- Final: fixed memoria de afinado — contador de versiones únicas y proyección antes de ampliar RED (funciones ausentes) → GREEN (60MP originales +24MP ampliación =84MP, operación rechazada).
- Verificación adicional: perfil abierto bloquea PDF RED→GREEN; márgenes asimétricos físicos preservados con espejo RED→GREEN; proporción de vista previa RED (0.608 frente a0.55)→GREEN; 40 trabajos variados y límite3000copias sin solapamientos.
- Ajuste técnico: carga diferida de pdf-lib; sin avisos de tamaño de bundle en compilación. El PDF no necesita una captura ni un canvas de todo el film.
- Pendiente externo: imprimir artifacts/calibracion-100mm.pdf en el RIP/impresora del usuario y medir el cuadrado. No se ha afirmado validación de impresión física.
- Cambio solicitado: separaciones 6 y 7 mm añadidas; valor inicial 7 mm. Dos pruebas nuevas comprueban encaje exacto y separación; el flujo del navegador comprueba selección inicial y cambio 6→7. Verificación: 26 pruebas Vitest y 5 flujos Playwright pasan; compilación de producción actualizada.
