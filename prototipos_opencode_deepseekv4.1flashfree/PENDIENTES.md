# Pendientes — prototipos UX/UI (rama `newUI`)

Estado a 25/10/2026. Este fichero es la lista de trabajo viva: lo que queda
hasta dar la carpeta por cerrada.

## Hecho en la última pasada

- **v6 · lista completa**: corregido `ReferenceError: stt is not defined` al abrir
  "Todas las estaciones"; la leyenda y el color del precio usan ahora las
  estadísticas de la lista filtrada. Quitados los `console.log('DBG …')`.
  Añadidos filtros de **marca**, **distancia máxima** y **orden** (precio /
  cerca / ahorro) que solo afectan a la lista completa, no a las 3 opciones del
  surtidor.
- **Explorador compartido** (`ProtoFeat.explorer`): `.pf-ex` era un flex item con
  `min-width:auto` y se estiraba a 431 px dentro de un overlay de 390 px
  (filas cortadas por la derecha). Ahora `.pf-ex`, `.pf-ex-tools` y
  `.pf-ex-list` llevan `min-width:0` + `width:100%`.
- **Overlays**: el `.proto-tag` (fixed, `z-index:200`) se pintaba encima de la
  cabecera de los overlays; se oculta con `body:has(.pf-overlay.on) .proto-tag`.
- **v4 · mapa**: la columna `.center` heredaba `align-items:center` del estilo
  global y, en vista mapa sola, el `.mappane` se quedaba en **1 px** de ancho
  (parecía que el mapa no cargaba). Corregido con `align-items:stretch` y
  `body[data-view="map"] .mappane { flex:1 1 auto }`.
- **v4 · leyenda**: sale del KPI strip (lo desbordaba y tapaba la línea de caché)
  y pasa al HUD del mapa, debajo del selector de estilo.
- **v4 · proto-tag**: movido a abajo a la derecha; arriba tapaba los iconos de
  la topbar.

## Pendiente

1. **Revisar capturas finales** de v3 (explorador), v4 (mapa + leyenda) y v6
   (lista con marcas/distancia/orden). Ojo: el visor a veces muestra artefactos
   de fuente en las capturas 2×; comprobar los estilos computados antes de
   tocar nada.
2. **`_validar.mjs` completo**: `node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs`
   (8 prototipos × móvil y escritorio, sin errores de consola).
3. **`_auditar.cjs` completo**: `node prototipos_opencode_deepseekv4.1flashfree/_auditar.cjs`
   (interacción real: sheets, overlays, IA, Config, mapa).
4. **`_cobertura.mjs`**: reejecutar y anotar totales (debe seguir 25/25 en
   funciones de la app real en los 8; revisar la tabla de extras).
5. **Actualizar `README.md` de la carpeta** con: 8 prototipos, v8 planificador,
   25/25 de paridad, tabla de patrones extra y comandos de validación.
6. **Limpiar temporales**: `_dbg-paridad.cjs`, `_dbg-v6opts.cjs`,
   `_dbg-v3medir.cjs`, `_dbg-v4map.cjs`, `capturas/_dbg-*.png`.
7. **Commit final descriptivo** y push a `newUI`.

## Reglas de la entrega

- No tocar `README.md` raíz, `docs/`, `AGENTS.md`, `sw.js` ni
  `docs/test/full_test.mjs`.
- No ejecutar los tests del proyecto (`docs/test/full_test.mjs`) ni
  `check-syntax.mjs`.
- Solo documentación propia de la carpeta de prototipos.
