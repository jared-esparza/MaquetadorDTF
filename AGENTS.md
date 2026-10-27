# Contexto de trabajo

Lee primero [docs/CONTEXTO.md](docs/CONTEXTO.md): contiene el estado comprobado,
las decisiones actuales y los pendientes. Después consulta solo la guía relevante.

- Idioma de comunicación y documentación: español.
- Una base de código para web y Electron; no mantener editores divergentes.
- El usuario prefiere que GitHub Actions ejecute las pruebas. No lanzar pruebas
  locales sin una petición posterior que cambie esta preferencia.
- No hacer comprobaciones manuales de la web desplegada.
- No fusionar, etiquetar, publicar ni desplegar por iniciativa propia. La PR #8
  ya fue integrada externamente; eso no autoriza futuros merges.
- Conservar diseños, preferencias y archivos ajenos al cambio. No subir binarios,
  dependencias, credenciales ni resultados temporales.
- Los planes y registros originales bajo docs son históricos; no reejecutarlos.
- Al cerrar una tarea significativa, actualizar docs/CONTEXTO.md con hechos
  verificados y distinguir pruebas ejecutadas, pendientes y limitaciones conocidas.
