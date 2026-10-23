# Plan de implementación de los prototipos

Carpeta: `prototipos_opencode_musespark1.3free/` · Fecha: 2026-10-16

Los prototipos son HTML autocontenidos con datos falsos. No se portan tal cual:
se extrae el **diseño y la interacción** y se aplica sobre la app real
(`index.html`, `css/styles.css`, `js/*`), respetando `AGENTS.md`
(tabs en kebab-case, `STATE`/`saveState`, módulos compartidos con el SW,
`npm run bump` + `node check-syntax.mjs` + suite completa antes de commit).

Recomendación vigente: **P1 como base** + hero de P4 + leyenda flotante de P2.
P3 es alternativa solo-PC. **P5 no es un diseño**: es la checklist de paridad
funcional para no perder nada al rediseñar.

---

## P1 · Pulso (recomendado — implementar primero)

**Idea**: mobile-first Material You. Buscador sticky, chips de combustible,
cards grandes con precio, KPIs (mín/media/favs) y detalle en bottom-sheet.

### Fases
1. **Header sticky + buscador** (`index.html`, `css/styles.css`)
   - Reordenar `.toolbar-groups`: buscador siempre visible arriba (hoy está
     tras el toggle 🔍). Mantener el toggle como colapso opcional.
   - Fijar `.toolbar` con `position: sticky` + `backdrop-filter: blur`.
2. **Chips de combustible** (`js/controls.js`, `index.html`)
   - Sustituir el `<select id="fuelFilter">` por chips horizontales con scroll.
   - Rellenar desde `FUEL_KEYS` (no hardcodear) y sincronizar con
     `STATE.selectedFuel`. Mantener el select oculto para los tests que lo usan
     o actualizar `docs/test/full_test.mjs` + `TEST_PLAN.md` a la vez.
3. **KPIs** (`js/controls.js`)
   - Calcular mín/media/nº sobre `STATE.filtered` en `render()` y pintarlos
     sobre la lista. Sin llamadas nuevas a la API.
4. **Cards en móvil, tabla en PC** (`css/styles.css`, `js/table.js`)
   - Bajo 768 px, cada fila se pinta como card (precio grande, distancia,
     badge). Reutilizar el orden y la paginación existentes.
   - La tabla densa se conserva ≥960 px.
5. **Bottom-sheet de detalle** (`css/styles.css`, `js/table.js`)
   - El `#detailPanel` actual ya es bottom-sheet: aplicar radios de 22 px,
     `grabber`, tabs Info/Histórico a 44 px mín. y botones de 48 px.

### Riesgos
- Los tests 1–12 referencian selectores del toolbar: actualizarlos en el mismo
  commit. Contadores de `README`/`TEST_PLAN.md`/changelog al final.
- No romper `setActiveTab()` (kebab-case en HTML+CSS+JS a la vez).

---

## P2 · Mapa Vivo (implementar segundo, como modo)

**Idea**: mapa a pantalla completa, chips flotantes, carrusel inferior con snap,
pin y tarjeta sincronizados, FABs de GPS y solo-favoritas.

### Fases
1. **Layout fullscreen** (`css/styles.css`)
   - En `tab-map`, `#map` a `100dvh` menos la barra de tabs; toolbar superpuesta
     flotante (pill de búsqueda + chips), no en flujo.
2. **Carrusel sincronizado** (`js/map.js`, `js/controls.js`)
   - Contenedor horizontal con `scroll-snap` bajo el mapa con las 10–12
     estaciones más cercanas (no todas: rendimiento).
   - `markerMap[id]` ya existe: al pulsar pin → `scrollIntoView` de su tarjeta
     y viceversa. Reutilizar `showDetail()` para el detalle completo.
3. **FABs** (`index.html`, `js/main.js`)
   - Botones flotantes 📍 (reutiliza `geolocBtn`) y ☆ (reutiliza
     `showFavoritesOnly`). Sin lógica nueva.
4. **Leyenda flotante** (`js/controls.js`)
   - Mover `#legend` sobre el mapa en `tab-map`; ya es dinámica por
     percentiles, solo cambia su contenedor.

### Riesgos
- El carrusel + pines duplican listeners: delegar eventos, no re-pintar el mapa
  en cada scroll.
- En PC el carrusel pasa a panel lateral izquierdo (media query ≥960 px).

---

## P3 · Consola Pro (solo si se quiere modo escritorio)

**Idea**: dashboard denso — sidebar de filtros, KPIs, mapa + tabla, drawer
de detalle. En móvil colapsa a drawer lateral.

### Fases
1. **Sidebar ≥1080 px** (`css/styles.css`, `index.html`)
   - Grid de 3 columnas: filtros | contenido | detalle. Los filtros ya existen:
     solo se reubican con CSS, sin tocar `controls.js`.
2. **KPIs + tabla densa** (`js/table.js`)
   - Reutilizar los KPIs de P1 y la tabla actual con `font-variant-numeric:
     tabular-nums` y paginación hasta 300/Todas (ya existe `#pageSize`).
3. **Drawer de detalle** (`js/table.js`)
   - `showDetail()` pintando en panel lateral fijo en vez de bottom-sheet
     (misma función, distinto contenedor según breakpoint).
4. **Atajo `/`** (`js/main.js`): foco al buscador. 5 líneas.

### Riesgos
- Es el que más CSS toca y menos aporta en móvil: hacerlo **detrás de un
  `body.pro`** o solo ≥1080 px para no afectar al móvil.
- No duplicar lógica de filtros: la sidebar reutiliza los mismos inputs.

---

## P4 · Volante (modo conducción / accesible)

**Idea**: targets ≥56 px, hero gigante con la más barata, alto contraste,
botones Navegar + Vigilar. Pensado para usar parado en el coche.

### Fases
1. **Modo `body.driving`** (`css/styles.css`, `index.html`)
   - Toggle en toolbar que escala tipografías, paddings y min-heights
     (48→56 px) y sube el contraste. Solo CSS + 1 clase: riesgo mínimo.
2. **Hero "más barata"** (`js/controls.js`)
   - Tarjeta con `filtered[0]` (ya ordenado): precio grande + distancia +
     botones 🧭 (abre geo-URI) y ☆ (vigilar → favorito + push).
3. **Controles segmentados** (`index.html`)
   - Gasolina/Gasóleo como 2 botones grandes que escriben en `fuelFilter`.
4. **Modo claro/oscuro del modo** (`css/styles.css`)
   - Variables CSS ya centralizables: `--bg/--card/--ink` como en el prototipo.

### Riesgos
- No convertirlo en app paralela: es un **modo**, no una vista. Todo tras la
  clase `driving` para que los tests en modo normal sigan pasando.

---

## P5 · Completo (no se implementa — es la checklist)

P5 ya vive en la app real; se usó para auditar que el rediseño no pierde nada.
Al portar P1–P4, validar contra esta lista (11 puntos que P5 añadió sobre P1):

1. Marcas multi-selección con buscador + Todas/Ninguna.
2. Filtro km + GPS + posicionado manual.
3. Los 10 estilos de mapa en el desplegable (orden A–Z, `satellite` por defecto).
4. Orden asc/desc por las 4 columnas + desplegable completo.
5. Paginación 5/10/15/30/50/100/Todas con `◀ ▶`.
6. ☆ pulsable también en filas de tabla.
7. Descuentos por marca que mueven precios, KPIs y badges.
8. Histórico 7/14/21/30/60/90/180 + 5 combustibles + tooltip + nota "hasta hoy".
9. IA: 8 pestañas, modelos, refresh, ✎ editar, cancelar, General en paralelo
   con `⏱ proveedor · modelo · tiempo`, prompts solo en General.
10. Config: push subida/bajada + intervalo + días + promedio/consecutivos +
    probar; caché con tabs IDB/LS y ✕ por clave; logs API/Push con toasts con
    formato `dd/mm/yy hh:mm:ss`; claves por proveedor + `demo`; proxy con
    ↺/🔎; visibilidad de pestañas (mínimo 1); 5 prompts; update con versión.
11. Estado vacío sin provincia + reset sin re-fetch + leyenda por percentiles.

---

## Orden de trabajo sugerido

| Paso | Qué | Toca |
|------|-----|------|
| 1 | P1 fases 1–2 (header + chips) | HTML, CSS, controls.js, tests toolbar |
| 2 | P1 fases 3–5 (KPIs, cards, sheet) | controls.js, table.js, CSS |
| 3 | P4 modo `driving` (solo CSS + hero) | CSS, 1 tarjeta en controls.js |
| 4 | P2 carrusel + FABs (modo mapa) | map.js, CSS |
| 5 | P3 solo si hay demanda PC | CSS grid + drawer |
| 6 | Cierre | `bump`, `check-syntax`, suite, docs |

Cada paso termina con: `node check-syntax.mjs`, suite completa
(`node docs/test/full_test.mjs`), `npm run bump`, y actualización de
`README.md`, `docs/CHANGELOG.md`, `docs/mejoras-petrol.md`,
`docs/test/TEST_PLAN.md` (contadores = salida real) y `AGENTS.md` si hay
convenios nuevos. Fixes pequeños directo en `main`; refactors en rama + PR.
