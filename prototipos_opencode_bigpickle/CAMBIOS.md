# Cambios hechos y pendientes · prototipos Big_pickle

Estado del trabajo de la carpeta `prototipos_opencode_bigpickle/`.
Última actualización: **27/10/2026** (rama `newUI`).

> Este documento es el **registro de trabajo** de la carpeta de prototipos. No
> forma parte de la documentación de la app (`README.md`, `docs/`, `AGENTS.md`
> de la raíz) y no la modifica.

---

## 1. Resumen

| Dato | Valor |
|------|-------|
| Prototipos | **9** (8 conceptos + el nuevo «coste real») |
| Ficheros por prototipo | `index.html`, `estilo.css`, `app.js` (sin build, sin CDN, `file://`) |
| Datos | `shared/datos-fake.js` → `window.FAKE` (determinista) |
| Auditoría de diseño | **0 avisos** en móvil 390×844 y PC 1440×900 en los 9 |
| Smoke test (`capturar.mjs`) | **9/9 sin errores de consola** |
| Capturas | `shared/capturas/*.png` (móvil, móvil-detalle, móvil-vista, PC) |
| Informes | `shared/informes/*.md` (generados por `auditar.mjs`) |
| Paridad funcional con la app real | **verificada** en los 8 y en el 9, con los huecos que marca §6 |
| Nuevo prototipo (9) | **implementado** (ver §7) |

---

## 2. Qué se ha hecho

### 2.1 Los 9 prototipos

Cada uno explora una dirección de diseño distinta, con el mismo contrato de
datos para que se puedan comparar precios entre ellos:

| # | Carpeta | Concepto | Enfoque |
|---|---------|----------|---------|
| 1 | `prototipo1-mapa-hojas/` | **Mapa + hojas** | Móvil primero: mapa protagonista y lista en hoja inferior arrastrable (peek / medio / lleno). En PC la hoja pasa a panel lateral. |
| 2 | `prototipo2-escritorio-sala-de-control/` | **Sala de control** | Escritorio primero: rail + 3 columnas (mapa · lista densa · detalle), tarjetas de resumen, sparklines y tabla paginada. |
| 3 | `prototipo3-lista-tarjetas/` | **Lista primero** | Tarjetas grandes con precio destacado, grupos pegajosos por localidad y filtros en hojas. El mapa es secundario. |
| 4 | `prototipo4-modo-noche-conduccion/` | **Modo noche / conducción** | Tema oscuro de alto contraste, tipografía grande, tres acciones (Ir · Favorito · Salir) y carrusel de cercanas. |
| 5 | `prototipo5-split-comparador/` | **Split + comparador** | Lista y mapa sincronizados (hover de fila resalta marcador) + comparador de 2–4 estaciones con gráfica solapada. |
| 6 | `prototipo6-gestos-atajos/` | **Gestos y atajos** | Sin chrome: swipe entre vistas, deslizar tarjeta, long-press, pull-to-refresh; en PC paleta de comandos (⌘K) y atajos `j`/`k`, `/`, `?`, `1`–`5`. |
| 7 | `prototipo7-asistente-decisiones/` | **Asistente por decisiones** | Una decisión por pantalla: «¿Qué necesitas?» → repostar barato / ahorrar en ruta / vigilar estación, con recomendación accionable. |
| 8 | `prototipo8-panel-de-datos/` | **Panel de datos** | KPIs, evolución de la media, mapa de calor, histograma, ranking de marcas, comparador y «¿cuándo repostar?». |
| 9 | `prototipo9-coste-real/` | **Coste real** | Decisión por el coste total del repostaje (litros × precio + desvío ida/vuelta), no por €/L. Héroe razonado, alternativas por total, barras, lista con columna «Total», mapa, IA y ajustes. Único con **persistencia** en `localStorage`. |

### 2.2 Datos fake compartidos

- `shared/datos-fake.js` expone `window.FAKE` como contrato único: 37
  estaciones en 16 provincias, precios por combustible, histórico determinista
  (`FAKE.historico(id, combustible, días)`), chats IA, prompts, logs de API y
  push, configuración, caché y versión.
- Fechas de histórico en `dd-mm-aaaa` (igual que la API del Ministerio).
- Helpers: `provinciaNombre`, `estacionesDe`, `localidadesDe`, `marcasDe`,
  `precioDe`, `precioConDescuento`, `colorPrecio`, `mediaProvincia`,
  `masBarata`, `kmh`, `eur`.
- Al ser determinista, las capturas y los precios cuadran entre prototipos.

### 2.3 Herramientas de validación

- `capturar.mjs` — abre cada prototipo por `file://` en móvil y PC, guarda
  capturas y **falla si hay errores de consola**. Usa los marcadores
  `[data-shot="detalle"]` y `[data-shot="vista"]`.
- `auditar.mjs` — mide en móvil (390×844) y PC (1440×900): desbordamiento
  horizontal, *tap targets* < 32 px, textos < 12 px, contraste AA, frases
  sospechosas (`undefined`, `NaN`, `[object Object]`), navegación tapada y
  número de destinos. Escribe `shared/informes/<prototipo>.md`.

### 2.4 Correcciones de accesibilidad (todas cerradas)

- **Pasada 5**: auditoría cruzada de los 8 y corrección de lo detectado.
  Criterios: texto ≥ 12 px, *tap targets* ≥ 32 px, contraste AA real (no solo
  declarado).
- Colisión de clases del toast: `.aviso` (toast `position: fixed`) coincidía
  con `.etiqueta.aviso` de las tarjetas y tapaba la barra inferior en 1, 6 y 7.
  Se estiliza por `#aviso` en esos tres.
- **Esta sesión — prototipo 2 (96 → 0 avisos).** La última revisión de otra
  sesión dejó el 2 con 96 avisos (30 *tap targets*, 13 textos de 11 px y 19
  contrastes en móvil; 28/14/19 en PC). Corregido:
  - Marcadores-precio: `padding` vertical 3 → 5 px (alto real 28 → 32 px).
  - Colores propios del marcador, más oscuros que los semánticos de texto,
    para que el precio en blanco cumpla AA: `#157a35`, `#a04a00`, `#b3261e`,
    `#5a6b7c`.
  - Tokens de texto oscurecidos: `--verde` `#1e8e3e` → `#146b3c`,
    `--naranja` `#e8710a` → `#9a4b00`, `--rojo` `#d93025` → `#c5221f`,
    `--gris` `#8a97a4` → `#5a6b7c`.
  - `small` global a 0,75 rem (el navegador lo dejaba en 11,67 px) y todos los
    `0.6875rem` a `0.75rem`.
  - `.fav-btn` de 20×20 a mínimo 32×32 (`display: grid; place-items: center`).
  - Paginación `◀ ▶`: `min-width: 32px; flex: 0 0 auto` (el flex la encogía a
    27 px).
  - Badges: `.icono-btn-badge` con tinta oscura sobre ámbar, `.chip-badge` y
    `.insignia-barata` sobre fondos oscuros, `.chip-estado.ok/.warn/.err` con
    los tonos oscuros documentados.
  - **Bug de especificidad**: `.tarjeta-precio span` pisaba el color de
    `.precio-dto`, que nunca llegaba a verse en verde. Ahora
    `.tarjeta-precio > span:not(.precio-dto)`.

  Resultado: `auditar.mjs 2` → **0 avisos** en móvil y PC.

### 2.5 Bugs funcionales corregidos

- **`closest('[data-vista]')`** en los prototipos 1, 7 y 8: las secciones
  también llevan `data-vista`, así que el `closest` devolvía la sección en vez
  del botón y **rompía todos los clics internos**. Ahora
  `closest('button[data-vista], a[data-vista]')`.
- **Prototipo 6**: `.aviso` del toast heredado por las etiquetas de descuento
  (ver §2.4).
- **Prototipo 2**: el detalle y los filtros se abren con `data-accion`
  (`abrir-detalle`, `vista`, `favorito`, `ordenar`, `pagina`) en vez de
  `data-shot`/`data-vista`.
- **Prototipo 1 — filtro de marca**: `estado.marcas = valor` guardaba un
  `Array`, pero el filtro usa `estado.marcas.has(...)`. La excepción se
  tragaba el render y el filtro **no aplicaba nunca**. Ahora
  `new Set(valor)`.
- **Prototipo 1 — filtro de distancia**: el `input` del slider cambiaba el
  texto («12 km») pero no `cuerpo._valor`, que es lo que lee el botón
  «Aplicar». El chip y la lista se quedaban igual. Ahora el listener también
  actualiza `_valor`.
- **Prototipos 1, 6 y 7 — toast que se comía los toques**: `#aviso` está
  `position: fixed` sobre la barra inferior y con `opacity: 0` seguía
  interceptando clics. Se añade `pointer-events: none`, y 1 y 6 además retiran
  el toast al abrir una hoja. Sin esto no se podían pulsar las opciones del
  borde inferior de los sheets (en la sonda, `elementFromPoint` devolvía
  `DIV#aviso`).
- **Prototipo 9 — repaso de la primera versión** (detectado con sonda propia):
  - `renderLista` mostraba «coste desde» con `lista[0].total`, que solo es el
    mínimo si el orden activo es «coste». Ahora calcula el mínimo real.
  - Residuo `S.favoritos`: se rellenaba con **todas** las estaciones en
    `cargarEstado()` y no se usaba. Eliminado (los favoritos viven en el mapa
    `favoritos`).
  - Los descuentos se escribían en los `<input type="number">` con coma
    (`0,05`), que el campo numérico considera inválido. Ahora `toFixed(2)`.
  - Al restaurar `S.texto` tras F5 la fila de búsqueda seguía cerrada; ahora se
    reabre. «Limpiar filtros» la vuelve a cerrar.
  - La marca de agua de la IA se añadía al DOM después del render, así que se
    perdía al cambiar de pestaña o recargar. Ahora viaja en el propio mensaje
    (`meta`) y se pinta con él.
  - «Borrar datos guardados» cancelaba nada: el *debounce* de guardado podía
    reescribir el estado justo después. Ahora cancela el timer, pone
    `listo = false`, borra y recarga. Además el arranque ya no guarda por sí
    solo: la primera escritura la provoca un cambio real, así el borrado deja
    `localStorage` limpio.
  - «Limpiar caché» no hacía nada visible; ahora vacía el bloque IndexedDB
    simulado y lo explica.
  - El aviso educativo solo aparecía cuando la más barata por litro perdía, y
    con los datos de Madrid a 50 L nunca se veía. Ahora hay dos variantes
    siempre presentes: verde si coincide, ámbar explicando el desvío si no.
  - Tooltip de la gráfica: se posicionaba con coordenadas del canvas como si
    fueran del marco. Ahora suma el `offset` del canvas.

### 2.6 Renombrado

- La carpeta pasó de `prototipos_bigpickle/` a
  `prototipos_opencode_bigpickle/` para alinearla con el resto de carpetas
  `prototipos_opencode_*`. Se versionó en `6fb4e42`.

---

## 3. Estado actual verificado (27/10/2026)

Comandos ejecutados y resultado real:

```powershell
node prototipos_opencode_bigpickle/auditar.mjs    # 0 avisos totales
node prototipos_opencode_bigpickle/capturar.mjs   # 9/9 sin errores de consola
```

| # | Prototipo | Vistas principales | Detalle con histórico | Auditoría |
|---|-----------|--------------------|-----------------------|-----------|
| 1 | Mapa + hojas | mapa · lista · ambos · IA · config | canvas pintado + combos combustible/días | 0 |
| 2 | Sala de control | mapa · datos · dual · IA · config | panel con sparklines + histórico | 0 |
| 3 | Lista primero | lista · mapa · IA (8 pestañas) · ajustes | panel con gráfica + histórico | 0 |
| 4 | Modo noche | mapa · lista · favoritas · IA · ajustes | diálogo con histórico | 0 |
| 5 | Split + comparador | lista · mapa · IA (8 paneles) · config | panel con gráfica + comparador | 0 |
| 6 | Gestos y atajos | mapa · lista · ambos · IA · config + paleta | canvas pintado + combos | 0 |
| 7 | Asistente | inicio · explorar · mapa · IA · config | canvas pintado + combos | 0 |
| 8 | Panel de datos | panel · estaciones · mapa · IA · config | ficha con 3 canvas + combos | 0 |
| 9 | Coste real | decisión · lista · mapa · IA · ajustes | ficha con canvas + tooltip y combos | 0 |

Verificado además con `capturar.mjs`: **el detalle se abre en los 9** (el 2
lleva `data-shot="detalle"` en su primera tarjeta desde esta sesión) y el
cambio de vista funciona en todos.

---

## 4. Pendiente (checklist)

### 4.1 Verificación funcional (cerrada el 27/10/2026)

Método: cada comprobación se hizo con una página recién cargada y se midió el
**efecto en el DOM** (nº de filas, precios, textos), no la mera presencia del
control. Varias sondas dieron falsos negativos por medir el contenedor
equivocado o por pulsar nodos ya re-renderizados; se repitieron.

- [x] Auditoría de diseño a 0 en los 9.
- [x] Smoke test sin errores de consola en los 9.
- [x] El detalle abre y el histórico se pinta: canvas en 1, 5, 6, 7, 8 y 9;
      SVG en 2, 3 y 4. Tooltip operativo en los 9 (en 5, cambiando de pestaña
      a «Histórico» para que el canvas tenga tamaño).
- [x] Filtros provincia / localidad / combustible / marca / solo favoritos:
      1 y 6 por hoja (`[data-chip]` → opción → «Aplicar»/«Ver resultados»),
      2 por chip-desplegable, 3 por `#capaFiltros`, 4/5/8/9 por `<select>` o
      desplegable (9: `#selProv`, `#selLocalidad`, `#selFuel`, `#btnMarcas`),
      7 por `#filtroProv` + `#filtroTexto`.
- [x] Búsqueda de texto en los 9 (en 6 se abre con la tecla `/`; en 9 con 🔍 o
      `/`, y se reabre sola si el texto venía restaurado).
- [x] Orden asc/desc en 2, 3, 4, 5, 7, 8 y 9; paginación en 1, 2, 5, 6 y 9
      (9: 5 filas → 1/3 de 14; «Todas» la desactiva). 3, 4 y 8 muestran la
      lista completa a propósito.
- [x] Favoritos: alta y baja en los 9 (7 con la estrella de la tarjeta,
      8 y 9 desde la ficha de la estación; la tabla marca la estrella).
- [x] Descuentos por marca: verificado en 1 (Repsol 0,05 → 0,20 hace que la
      1001 pase de 1,54 a 1,39) y el mismo `precioFinal()` en 2, 3, 5, 7, 8 y
      9 (allí con `data-desc="Repsol"`, y el total del héroe baja con él).
- [x] IA: envío + respuesta simulada + markdown + marca de agua
      (`⏱ proveedor · modelo · tiempo`) en los 9; historial por proveedor y
      borrado en los que lo exponen (1, 3, 4, 5, 6, 8, 9).
- [x] Tooltip de la gráfica en los 9.
- [x] Config: 6 bloques en 1, 2, 4, 5, 6 y 8; 3 los mete en «Ajustes»; 7 no
      muestra claves IA ni versión (decisión de su concepto); 9 tiene 8
      tarjetas (incluye persistencia y paginación).
- [x] Estados vacíos con texto propio en 1, 3, 5, 8 y 9 («Sin estaciones con
      estos filtros», «Sin resultados», «Ninguna estación coincide…»).
- [x] **Prototipo 9 — sonda completa (39 comprobaciones, 0 fallos):** provincia,
      localidad, combustible, marcas (14 → 2), búsqueda y estado vacío,
      favoritas, radio, orden (coste ≠ precio), paginación 5/10, stepper de
      litros (74,69 → 81,99 €), ficha + canvas + tooltip + favorito + 90 días,
      8 pestañas de IA con marca de agua, descuentos con punto decimal y su
      efecto en el héroe, 8 bloques de ajustes, **persistencia tras F5**
      (provincia, búsqueda, litros, descuentos, chat y marca de agua) y
      «Borrar datos guardados» → estado de fábrica con `localStorage` limpio.

### 4.2 Mejoras pendientes de la carpeta

- [x] `data-shot="detalle"` en el prototipo 2 (hecho: su captura de detalle ya
      se genera).
- [x] **Persistencia tras recarga**: cubierta en el prototipo 9
      (`gasolineras_proto9_estado` y `gasolineras_proto9_ia_<proveedor>`).
      Comprobado antes que **ninguno** de los 1–8 persistía (`localStorage`
      vacío tras filtrar). Si se quiere paridad completa, habría que añadirla a
      los 8; hoy es una diferencia deliberada para comparar.
- [ ] Script de verificación funcional reutilizable
      (`verificar.mjs`) que devuelva una matriz PASS/FAIL por prototipo,
      para no repetir la comprobación a mano en cada cambio. La sonda del 9
      (`_p9probe.mjs`, 39 checks) sirve de base, pero no se ha versionado.
- [ ] Actualizar `shared/informes/*.md` y `shared/capturas/*.png` tras cada
      cambio (ya se regeneran con los dos comandos de §3).

---

## 5. Cómo retomar

```powershell
# 1. Auditoría de diseño (escribe shared/informes/)
node prototipos_opencode_bigpickle/auditar.mjs

# 2. Smoke test + capturas (falla si hay errores de consola)
node prototipos_opencode_bigpickle/capturar.mjs

# 3. Un prototipo suelto
node prototipos_opencode_bigpickle/auditar.mjs 2
node prototipos_opencode_bigpickle/capturar.mjs 2

# 4. Sintaxis de un app.js concreto (check-syntax.mjs NO cubre prototipos)
node --check prototipos_opencode_bigpickle/prototipo4-modo-noche-conduccion/app.js
```

---

## 6. Paridad con la funcionalidad actual de la app

Funcionalidades de la app real que un rediseño debe seguir cubriendo.
`✅` = verificado con datos fake por su **efecto en el DOM**; `—` = ese
prototipo no lo expone (decisión de su concepto, no un fallo).
`T` = los nueve.

| # | Funcionalidad actual | Dónde y cómo se probó | Estado |
|---|----------------------|-----------------------|--------|
| 1 | Filtro por provincia | hoja en 1/6 (`[data-chip="prov"]` + «Ver estaciones»), chip-desplegable en 2 («Barcelona · 5»), `#fProvincia` 3, `#selProv` 4/8, `#fProvincia` 5, `#filtroProv` 7 (2319 → 1204) | ✅ T |
| 2 | Filtro por localidad | `#opcCuerpo` en 1/6 (Getafe: 34 → 3), desplegable de 2 (28 → 2), `#fLocalidad` 3/5, `#selLocalidad` 4/9 (5 opciones en Barcelona) | ✅ 1–6, 9 · — 7, 8 (no lo exponen) |
| 3 | Filtro por combustible | hoja en 1/6 (1,46 → 1,30), 2, `#fCombustible` 3, `#selCombustible` 4, `#fCombustible` 5, `#filtroFuel` 7, `#selFuel` 8 | ✅ T |
| 4 | Filtro por marca (multi) | `#opcCuerpo` multi en 1/6 (Repsol: 34 → 3 / 68 → 5), desplegable de 2 (71 → 6), `#fMarcas` 3, `#marcasChecks` 4 (31 → 5), `#fMarcas` 5 (44 → 18) | ✅ 1–6 · — 7, 8 |
| 5 | Búsqueda de texto | `#buscador` 1/2/3/4/5, tecla `/` en 6, `#filtroTexto` 7 (15 → 2), `#buscar` 8 (24 → 11) | ✅ T |
| 6 | Solo favoritos | chip 1/6, desplegable 2, `.switch-fila` 3 (14 → 3), `label:has(#chkFavoritos)` 4 (14 → 3), 5, 7 | ✅ 1–7 · — 8 (solo marca favoritas) |
| 7 | Ordenar (precio / distancia / marca) | `[data-chip="orden"]` 1/6, `#ordenLista` 2, `[data-orden]` 3/7, `#selOrden` 4, `#ordenSel` 5, `#ordenEst` 8 | ✅ T |
| 8 | Paginación configurable | 1 («Ver más»), 2 (`◀ ▶`), 5 (`#pageSizeSel`: 37 → 22 filas, 1/2 → 1/3), 6 | ✅ 1, 2, 5, 6 · — 3, 4, 8 (lista completa) |
| 9 | Vista mapa / lista / ambos | `data-vista` y sus paneles en los ocho | ✅ T |
| 10 | Marcador-precio con color semántico | marcadores de 1, 2, 4, 5, 6, 7, 8; mapa secundario de 3 | ✅ T |
| 11 | Tipos de mapa | 10 estilos en 1 (`#btnEstilo`), 4 en 2 (`#mapaEstilo`), calles/satélite/oscuro en 5; 4 es oscuro por concepto | ✅ 1, 2, 4, 5 · — 3, 6, 7, 8 |
| 12 | Leyenda de precios | leyenda de color en 1–7 | ✅ 1–7 · — 8 (usa píldoras y KPIs) |
| 13 | Popup con detalle e histórico | popup de 5 y 8; hoja de 1/6, panel de 2, ficha de 3/4/7 | ✅ T |
| 14 | Tabla marca/precio/distancia/localidad/calle | tablas de 1, 2, 5, 6, 8 (columnas completas) | ✅ 1, 2, 5, 6, 8 · — 3, 4, 7 (tarjetas) |
| 15 | Detalle de estación | dirección, localidad, distancia, horario, teléfono, IDEESS y precios en los ocho | ✅ T |
| 16 | Histórico con gráfica y tooltip | canvas 1/5/6/7/8, SVG 2/3/4; tooltip verificado en los ocho | ✅ T |
| 17 | Histórico: combustible y días | `#histCombustible`/`#histDias` 2/3/4, `#detFuel`/`#detDias` 5, combos propios en 1/6/7/8 | ✅ T |
| 18 | Favoritos (alta/baja) | estrella/botón en los ocho; 8 en la ficha (☆ → ★ y aparece en la tabla) | ✅ T |
| 19 | Descuentos por marca | config de 1 (`[data-desc-valor]`, 1,54 → 1,39 con 0,20) y `precioFinal()` equivalente en 2, 3, 5, 7, 8 | ✅ T |
| 20 | Chat IA (7 proveedores + General) | pestañas de proveedor y «General» en los ocho; respuesta simulada | ✅ T |
| 21 | IA: markdown escapado + marca de agua | `renderAiMarkdown`/equivalente y `⏱ proveedor · modelo · tiempo` | ✅ T |
| 22 | IA: historial por proveedor y borrar | 1, 3, 4, 5, 6, 8 | ✅ 1, 3, 4, 5, 6, 8 · — 2, 7 (hilo único) |
| 23 | Config: caché (IndexedDB / localStorage) | bloque de caché con tabs en 1, 2, 3 (dentro de Ajustes), 4, 5, 6, 8 | ✅ 1–6, 8 · — 7 |
| 24 | Config: paginación, logs, push, claves IA, versión | 6 bloques en 1, 2, 3, 4, 5, 6 y 8 | ✅ 1–6, 8 · — 7 (sin claves IA ni versión) |
| 25 | Persistencia del estado (recarga) | `gasolineras_proto9_estado` + chats: F5 conserva provincia, búsqueda, litros, descuentos, vista, favoritos e IA. En 1–8 `localStorage` seguía vacío | ✅ 9 · **— 1–8** (hueco deliberado, §4.2) |
| 26 | Gestos (móvil) y atajos (PC) | 6 (`/`, `?`, `j`/`k`, `1`–`5`, `⌘K`, swipe, long-press); apoyo en 1 y 7 | ✅ 6 (+1, 7) |
| 27 | Accesibilidad AA | medido por `auditar.mjs` en móvil y PC | ✅ T (0 avisos) |
| 28 | Coste total del repostaje | 9: litros × precio + desvío (ida/vuelta) y orden por total. A 5–20 L gana una cercana; a 50 L gana E.Leclerc Getafe, la más barata por litro | ✅ 9 · — 1–8 (concepto nuevo) |

---

## 7. Prototipo 9 · «Coste real» (implementado)

Carpeta: `prototipo9-coste-real/` (`index.html` + `estilo.css` + `app.js`).
Enlazado desde `prototipos_opencode_bigpickle/index.html` y el `README.md`.

### 7.1 La idea

Los ocho anteriores ordenan (o muestran) por **€/L**. Pero lo que el usuario
paga es el **total del repostaje**, y ahí entra el combustible que gasta para
llegar. El 9 cambia la pregunta: no «¿dónde está más barato el litro?» sino
**«¿dónde me cuesta menos repostar estos litros?»**.

```
coste total = litros × precio_final_€/L  +  trayecto_km × (consumo/100) × precio_final_€/L
trayecto_km = distancia × (ida y vuelta ? 2 : 1)
precio_final = precio − descuento de la marca
```

Con los datos fake de Madrid se ve el fenómeno sin tocar nada:

| Litros | Gana | Por qué |
|--------|------|---------|
| 5 | Repsol Avenida de América | el desvío a Getafe (9,2 km) pesa más que el ahorro por litro |
| 10 | Repsol Avenida de América | igual, aún con poco depósito |
| 20 | Ballenoil Villaverde | ya compensa acercarse, pero no hasta Getafe |
| 50 | E.Leclerc Getafe | 1,459 €/L con descuento: gana por litro y por total |
| 100 | E.Leclerc Getafe | el ahorro por litro crece con los litros |

Por eso el héroe lleva un **aviso educativo** con dos variantes: ámbar cuando
la más barata por litro pierde («el desvío se come el ahorro») y verde cuando
coinciden («con estos litros el desvío no le quita el primer puesto»).

### 7.2 Qué incluye (paridad con la app)

- **Decisión:** calculadora (litros con stepper, consumo L/100 km, ida y vuelta,
  radio máximo), héroe con total + precio/L + repostaje + desvío + ahorro neto
  frente a la media provincial + tendencia 14 días + razones, alternativas 2–5
  con delta, barras comparativas y botón «Ver las N estaciones».
- **Lista:** tabla con Marca · Precio · **Total** · Distancia · Localidad ·
  Calle, orden por coste / precio ↑↓ / distancia / marca, paginación
  configurable (5/10/15/30/50/Todas) y «coste desde» real.
- **Mapa:** SVG propio con 4 estilos (calles, satélite, oscuro, relieve),
  marcadores-precio con color semántico y ★ de favorita, leyenda y ficha al
  tocar.
- **Ficha:** datos completos (dirección, localidad, distancia, horario,
  teléfono, IDEESS, coste total, actualizado), precios por combustible con
  descuento, favorito, histórico en canvas con tooltip y combos de combustible
  y días (7–180), resumen mín/máx/media/tendencia/actual.
- **IA:** 8 pestañas (General + 7 proveedores), envío con respuesta simulada,
  markdown escapado, prompts, borrado y marca de agua `⏱ proveedor · modelo ·
  tiempo` guardada con el mensaje.
- **Ajustes:** persistencia (con borrado), descuentos por marca, caché
  IndexedDB/localStorage, paginación, registro API/push, push, claves IA
  (simuladas) y actualización de la app.
- **Estados vacíos** con acción para quitar filtros.

### 7.3 Persistencia (lo que no hace ningún otro)

`localStorage['gasolineras_proto9_estado']` guarda provincia, combustible,
localidad, marcas, texto, solo favoritas, orden, vista, página, filas por
página, litros, radio, consumo, ida/vuelta, descuentos, favoritos, estilo de
mapa, combustible/días de la ficha, proveedor de IA, tabs de caché/log, TTL,
push y el propio interruptor de persistencia. Los chats van por proveedor en
`gasolineras_proto9_ia_<id>` (máx. 100 mensajes, con su `meta`).

- Se guarda con *debounce* de 160 ms al cambiar algo (no en el arranque).
- Se restaura **antes** del primer render; si había texto, la fila de búsqueda
  se reabre.
- «Borrar datos guardados» cancela el guardado pendiente, borra todas las
  claves `gasolineras_proto9*` y recarga: la maqueta vuelve a fábrica y
  `localStorage` queda limpio hasta el siguiente cambio.
- El interruptor de persistencia permite comparar el comportamiento con y sin
  memoria.

### 7.4 Validación

```powershell
node --check prototipos_opencode_bigpickle/prototipo9-coste-real/app.js
node prototipos_opencode_bigpickle/auditar.mjs 9     # 0 avisos móvil y PC
node prototipos_opencode_bigpickle/capturar.mjs 9    # 0 errores de consola
```

Sonda funcional propia (no versionada): **39 comprobaciones, 0 fallos**, con
medida del efecto real en el DOM, incluida la persistencia tras F5 y el borrado
de datos. Resultado del auditor: 0 *taps* pequeños, 0 textos < 12 px, 0
contrastes y 0 solapamientos en móvil (390×844) y PC (1440×900).

---

## 8. Reglas de la carpeta

- Nada de lo que hay aquí se integra en la app: no se toca `index.html`, `js/`,
  `css/`, `sw.js`, el manifest ni `docs/` de la raíz.
- Todo abre por `file://`, sin módulos ES, sin CDN y sin build.
- Los datos salen siempre de `shared/datos-fake.js` (no inventar precios
  dentro de un prototipo).
- Los informes y capturas se regeneran con `auditar.mjs` y `capturar.mjs`; no
  se editan a mano.
- Objetivo de calidad: **0 avisos** de auditoría en móvil y PC.
