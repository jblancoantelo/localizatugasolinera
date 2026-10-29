# Estado de la entrega — prototipos UX/UI (rama `newUI`)

Cerrado a 25/10/2026. Este fichero deja constancia de lo corregido y de cómo se
verificó, por si hay que retomar la carpeta más adelante.

## Correcciones de la última pasada

- **v6 · lista completa**: corregido `ReferenceError: stt is not defined` al abrir
  "Todas las estaciones"; la leyenda y el color del precio usan las estadísticas
  de la lista filtrada. Quitados los `console.log('DBG …')`. Añadidos filtros de
  **marca**, **distancia máxima** y **orden** (precio / cerca / ahorro) que solo
  afectan a la lista completa, no a las 3 opciones del surtidor.
- **Explorador compartido** (`ProtoFeat.explorer`): `.pf-ex` era un flex item con
  `min-width:auto` y se estiraba a 431 px dentro de un overlay de 390 px (filas
  cortadas por la derecha). Ahora `.pf-ex`, `.pf-ex-tools` y `.pf-ex-list` llevan
  `min-width:0` + `width:100%`.
- **Overlays**: el `.proto-tag` (fixed, `z-index:200`) se pintaba encima de la
  cabecera; se oculta con `body:has(.pf-overlay.on) .proto-tag`.
- **v4 · mapa**: la columna `.center` heredaba `align-items:center` del estilo
  global y, en vista mapa sola, el `.mappane` se quedaba en **1 px** de ancho
  (parecía que el mapa no cargaba). Corregido con `align-items:stretch` y
  `body[data-view="map"] .mappane { flex:1 1 auto }`.
- **v4 · leyenda**: sale del KPI strip (lo desbordaba y tapaba la línea de caché)
  y pasa al HUD del mapa, debajo del selector de estilo.
- **v4 · proto-tag**: movido abajo a la derecha; arriba tapaba los iconos de la
  topbar.

## Verificación (sin tocar los tests del proyecto)

| Script | Resultado |
|--------|-----------|
| `_validar.mjs` | 8 prototipos × móvil/escritorio, **sin errores de consola** |
| `_auditar.cjs` | **72/72** comprobaciones OK (9 por prototipo) |
| `_cobertura.mjs` | **25/25** funciones de la app real en los 8; extras 4/7–5/7 |

La tabla de extras no es una nota: recoge patrones que la app real **no** tiene
(comparador, tema, persistencia, deep links, toasts, sheets, `aria-label`). Que
un prototipo no use uno de ellos es una decisión de diseño, no una carencia.

## Limpieza

Borrados los scripts y capturas de depuración (`_dbg-paridad.cjs`,
`_dbg-v6opts.cjs`, `_dbg-v3medir.cjs`, `_dbg-v4map.cjs` y `capturas/_dbg-*.png`).
En `capturas/` quedan solo las imágenes de `_validar.mjs` y los tres JSON de
resultados (`informe.json`, `cobertura.json`, `auditoria.json`).

## Reglas de la entrega

- No se ha tocado `README.md` raíz, `docs/`, `AGENTS.md`, `sw.js` ni
  `docs/test/full_test.mjs`.
- No se han ejecutado los tests del proyecto (`docs/test/full_test.mjs`) ni
  `check-syntax.mjs`.
- La documentación actualizada es la propia de la carpeta de prototipos.
