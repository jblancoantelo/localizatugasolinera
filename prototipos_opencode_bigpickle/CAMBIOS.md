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
| Prototipos | **8** (7 conceptos + variantes de interacción) |
| Ficheros por prototipo | `index.html`, `estilo.css`, `app.js` (sin build, sin CDN, `file://`) |
| Datos | `shared/datos-fake.js` → `window.FAKE` (determinista) |
| Auditoría de diseño | **0 avisos** en móvil 390×844 y PC 1440×900 en los 8 |
| Smoke test (`capturar.mjs`) | **8/8 sin errores de consola** |
| Capturas | `shared/capturas/*.png` (móvil, móvil-detalle, móvil-vista, PC) |
| Informes | `shared/informes/*.md` (generados por `auditar.mjs`) |
| Paridad funcional con la app real | **verificada** en los 8, con los huecos que marca §6 |
| Nuevo prototipo (9) | **en curso** (ver §7) |

---

## 2. Qué se ha hecho

### 2.1 Los 8 prototipos

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

### 2.6 Renombrado

- La carpeta pasó de `prototipos_bigpickle/` a
  `prototipos_opencode_bigpickle/` para alinearla con el resto de carpetas
  `prototipos_opencode_*`. Se versionó en `6fb4e42`.

---

## 3. Estado actual verificado (27/10/2026)

Comandos ejecutados y resultado real:

```powershell
node prototipos_opencode_bigpickle/auditar.mjs    # 0 avisos totales
node prototipos_opencode_bigpickle/capturar.mjs   # 8/8 sin errores de consola
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

Verificado además con `capturar.mjs`: **el detalle se abre en los 8** (el 2
lleva `data-shot="detalle"` en su primera tarjeta desde esta sesión) y el
cambio de vista funciona en todos.

---

## 4. Pendiente (checklist)

### 4.1 Verificación funcional (cerrada el 27/10/2026)

Método: cada comprobación se hizo con una página recién cargada y se midió el
**efecto en el DOM** (nº de filas, precios, textos), no la mera presencia del
control. Varias sondas dieron falsos negativos por medir el contenedor
equivocado o por pulsar nodos ya re-renderizados; se repitieron.

- [x] Auditoría de diseño a 0 en los 8.
- [x] Smoke test sin errores de consola en los 8.
- [x] El detalle abre y el histórico se pinta: canvas en 1, 5, 6, 7 y 8;
      SVG en 2, 3 y 4. Tooltip operativo en los 8 (en 5, cambiando de pestaña
      a «Histórico» para que el canvas tenga tamaño).
- [x] Filtros provincia / localidad / combustible / marca / solo favoritos:
      1 y 6 por hoja (`[data-chip]` → opción → «Aplicar»/«Ver resultados»),
      2 por chip-desplegable, 3 por `#capaFiltros`, 4/5/8 por `<select>`,
      7 por `#filtroProv` + `#filtroTexto`.
- [x] Búsqueda de texto en los 8 (en 6 se abre con la tecla `/`).
- [x] Orden asc/desc en 2, 3, 4, 5, 7 y 8; paginación en 1, 2, 5 y 6
      (3, 4 y 8 muestran la lista completa a propósito).
- [x] Favoritos: alta y baja en los 8 (7 con la estrella de la tarjeta,
      8 desde la ficha de la estación; la tabla de 8 marca la estrella).
- [x] Descuentos por marca: verificado en 1 (Repsol 0,05 → 0,20 hace que la
      1001 pase de 1,54 a 1,39) y el mismo `precioFinal()` en 2, 3, 5, 7 y 8.
- [x] IA: envío + respuesta simulada + markdown + marca de agua
      (`⏱ proveedor · modelo · tiempo`) en los 8; historial por proveedor y
      borrado en los que lo exponen (1, 3, 4, 5, 6, 8).
- [x] Tooltip de la gráfica en los 8.
- [x] Config: 6 bloques en 1, 2, 4, 5, 6 y 8; 3 los mete en «Ajustes»; 7 no
      muestra claves IA ni versión (decisión de su concepto).
- [x] Estados vacíos con texto propio en 1, 3, 5 y 8 («Sin estaciones con
      estos filtros», «Sin resultados», «Ninguna estación coincide…»).

### 4.2 Mejoras pendientes de la carpeta

- [x] `data-shot="detalle"` en el prototipo 2 (hecho: su captura de detalle ya
      se genera).
- [ ] **Persistencia tras recarga**: ningún prototipo la implementa (se
      comprobó: `localStorage` vacío en los 8 después de filtrar). La app real
      guarda filtros y pestaña. Se cubre en el prototipo 9 y, si se quiere
      paridad completa, habría que añadirla a los 8.
- [ ] Script de verificación funcional reutilizable
      (`verificar.mjs`) que devuelva una matriz PASS/FAIL por prototipo,
      para no repetir la comprobación a mano en cada cambio.
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
`T` = los ocho.

| # | Funcionalidad actual | Dónde y cómo se probó | Estado |
|---|----------------------|-----------------------|--------|
| 1 | Filtro por provincia | hoja en 1/6 (`[data-chip="prov"]` + «Ver estaciones»), chip-desplegable en 2 («Barcelona · 5»), `#fProvincia` 3, `#selProv` 4/8, `#fProvincia` 5, `#filtroProv` 7 (2319 → 1204) | ✅ T |
| 2 | Filtro por localidad | `#opcCuerpo` en 1/6 (Getafe: 34 → 3), desplegable de 2 (28 → 2), `#fLocalidad` 3/5, `#selLocalidad` 4 | ✅ 1–6 · — 7, 8 (no lo exponen) |
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
| 25 | Persistencia del estado (recarga) | `localStorage` seguía vacío tras filtrar en los ocho | **— T** (hueco, §4.2) |
| 26 | Gestos (móvil) y atajos (PC) | 6 (`/`, `?`, `j`/`k`, `1`–`5`, `⌘K`, swipe, long-press); apoyo en 1 y 7 | ✅ 6 (+1, 7) |
| 27 | Accesibilidad AA | medido por `auditar.mjs` en móvil y PC | ✅ T (0 avisos) |

---

## 7. Prototipo 9 (propuesta nueva)

Pendiente de implementar. La idea es cubrir el hueco que no exploran los 8
actuales: **un único lienzo con la decisión delante** — el usuario no elige
entre «mapa» o «lista», sino que ve **una recomendación razonada** (la mejor
opción ahora mismo, con el porqué y el ahorro estimado) y, debajo, la
alternativa siguiente; el mapa y la tabla quedan como *capas* del mismo
lienzo. Se detallará en `prototipo9-.../` y se enlazará desde `index.html` y
este README.

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
