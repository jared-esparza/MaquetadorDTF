# Maquetador DTF — plan acordado

Aplicación local para Windows, React/TypeScript/Vite. Editor de tres columnas con identidad PKprint y exportación PDF para impresión. No hay servicios externos ni cuentas.

1. Interfaz, lanzamiento local y carga múltiple PNG (20 MB).
2. Imágenes: recorte de transparencia, ancho físico y copias, ppp originales, borrado por color conectado/global, tolerancia 35, varita, deshacer y afinado sin falsear ppp.
3. Montaje en worker: perfiles editables, 550×1000 mm inicialmente, márgenes 0, separación 3/4/5/6/7 mm (7 mm por defecto), rotaciones 0/90, MaxRects con seis combinaciones deterministas. Sin solapamientos, cambio de tamaño ni edición manual.
4. PDF con pdf-lib: medidas exactas, transparencia, misma geometría de vista previa, imagen compartida entre copias, espejo optativo desactivado, sin guías ni damero. Blanco y gestión de color corresponden al RIP.
5. Vitest (imágenes, geometría, validación, PDF), Playwright (flujo real y descarga), renderizado del PDF con comprobación de medidas y píxeles.

## Aceptación
Todas las copias colocadas una vez, dentro de márgenes, con separación mínima; pieza que no cabe bloquea exportación. PDF multipágina a escala real, con alfa y espejo correcto. Perfil persiste; diseños son de sesión. Falta validar muestra de 100×100 mm en el RIP y la impresora del usuario.

## Diseño visual
Tres paneles: Diseños / Tu pliego / Exportar PDF. Arial del sistema, texto oscuro #202d3c, azul #1269b0, borde #d3dde7, fondo #f6f8fb, avisos #fff5d7. Cabecera compacta; el pliego es el elemento visual principal. Controles densos, funcionales, con foco visible y disposición vertical en pantalla estrecha.
