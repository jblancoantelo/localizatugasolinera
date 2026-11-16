# Prototipos de diseño — Gasolineras (OpenCode · DeepSeek V4.1 Flash)

Carpeta de exploración de UX/UI responsive para la aplicación **Precios Gasolina España**. Cada prototipo es un HTML autónomo con **datos inventados** (29 estaciones de Madrid con precios, descuentos por marca y series sintéticas deterministas) y **navegación funcional**, para validar la interfaz antes de tocar el código real.

## Objetivo

Mejorar la experiencia **móvil actual** (pantallas táctiles, uso con una mano, safe areas) sin descuidar una versión de **PC** que aproveche pantallas grandes. Abre `index.html` para la galería visual de los 8 conceptos.

## Estructura

| Archivo | Qué explora |
|---------|-------------|
| `v1-sheet.html` | **Evolución (base de menor riesgo):** la app actual ordenada — filtros en chips, KPIs, lista y mapa lado a lado en escritorio (42/58), detalle en bottom-sheet arrastrable con histórico y barra de comparación rápida. |
| `v2-map.html` | **Mapa primero:** el mapa es la pantalla; chips, FABs y sheet arrastrable (peek → medio → completo) sustituyen a las pestañas; menú lateral para vistas secundarias. |
| `v3-cards.html` | **Feed de ahorro (dark-first):** deja de ser una lista de precios y pasa a ser «mi gasolina» — cuánto cuesta repostar hoy, dónde, cuánto ahorras y por qué. |
| `v4-desktop.html` | **Consola de escritorio:** para 1280–1920 px — filtros a la izquierda, tabla densa o mapa en el centro, inspector fijo a la derecha y command palette (Ctrl+K). Degrada a móvil. |
| `v5-ia.html` | **Copiloto IA:** el chat es la app — respuestas con estaciones citadas, gráfica y mapa, contexto inspeccionable, marca de modelo/tiempo y la misma pregunta a varios proveedores en paralelo. |
| `v6-drive.html` | **Modo repostaje (una mano):** la app en el soporte del coche — un paso = una decisión, todo pulsable en el tercio inferior, botones de 56–72 px, AMOLED y decisión por minutos de desvío / €/hora. |
| `v7-compare.html` | **Comparador con veredicto:** elige 2–3 estaciones y la app dicta sentencia — ahorro NETO = diferencia de precio × litros − coste del desvío, con tabla de rankings, gráfica superpuesta e insights de «por qué gana». |
| `v8-plan.html` | **Planificador de repostaje:** la app decide **cuándo** repostar. Cruza el nivel del depósito, el consumo y la previsión de 7 días para señalar la ventana más barata, con presupuesto mensual, agenda y ahorro por depósito/mes. |
| `index.html` | Galería visual de los 8 prototipos con miniaturas CSS y enlaces (no es un prototipo navegable). |
| `assets/` | Sistema de diseño y datos compartidos (ver abajo). |
| `capturas/` | Capturas, `informe.json`, `cobertura.json` y `auditoria.json` generados por los scripts (no versionar a mano). |

### Assets compartidos

| Archivo | Qué provee |
|---------|------------|
| `assets/proto.css` | **Petrol UI 2.0**: tokens (color claro/oscuro, tipografía, espacios, radios), componentes (topbar, bottom nav, sheets, chips, tarjetas, botones, badges) y utilidades. |
| `assets/proto-ui.js` | `Proto.*`: arranque, navegación por paneles, sheets arrastrables, tarjetas y detalle de estación, iconos SVG (`data-ico`), toasts. |
| `assets/proto-data.js` | `PROTO.*`: 29 estaciones con precios por combustible, descuentos por marca, geolocalización simulada y series históricas de 14/21/30 días. |
| `assets/proto-chart.js` | `ProtoChart.*`: gráfica canvas (claro/oscuro) con tooltip de precio/fecha y soporte de series con `offset` para superponer una previsión corta. |
| `assets/proto-map.js` | `ProtoMap.*`: mapa sintético canvas (calles, agua, parques) con pines; sin red ni tiles externos. |
| `assets/proto-features.js` | **Paridad funcional compartida** (`ProtoFeat.*`): explorador completo (búsqueda, filtros, marcas, distancia, favoritos, orden, paginación, leyenda, mapa y 10 estilos, ficha con histórico), chat IA completo (General + 7 proveedores, contexto, editar, cancelar, borrar, marca de agua), Config completa (8 tarjetas, descuentos que mueven precios, caché, logs, push, claves IA, pestañas visibles, actualización) y overlays reutilizables. |

## Cómo usar

Abre cualquier `.html` con doble clic (funciona con `file://`, sin servidor ni red). Cada prototipo es funcional: filtra, busca, marca favoritos, abre la ficha de una estación, mira el histórico y navega entre vistas. La galería de entrada es `index.html`.

Todos los prototipos incorporan la capa de paridad: además de su diseño propio, permiten abrir el **explorador de datos**, el **copiloto IA** y la **Config completa** desde sus ajustes o su barra superior. Así se comparan de igual a igual con las funciones de la app real.

## Paridad con la app real

`_cobertura.mjs` mide dos cosas por separado, para no penalizar a un diseño por no usar patrones que la app real tampoco tiene:

- **Funciones de la app real (25)**: filtros (provincia/localidad, combustible, marca, distancia, búsqueda), favoritos, orden, paginación, mapa sintético con estilos y leyenda, estado vacío, detalle con histórico, las 9 tarjetas de Config y el panel de IA con sus proveedores.
- **Patrones extra (7)**: comparador, tema claro/oscuro, persistencia en `localStorage`, deep links, toasts, sheets arrastrables y `aria-label`.

Resultado actual (los 8 prototipos verificados):

| Prototipo | App real | Extras |
|-----------|----------|--------|
| `v1-sheet.html` | 25/25 | 5/7 |
| `v2-map.html` | 25/25 | 4/7 |
| `v3-cards.html` | 25/25 | 4/7 |
| `v4-desktop.html` | 25/25 | 5/7 |
| `v5-ia.html` | 25/25 | 5/7 |
| `v6-drive.html` | 25/25 | 5/7 |
| `v7-compare.html` | 25/25 | 5/7 |
| `v8-plan.html` | 25/25 | 4/7 |

Los extras que faltan son elecciones de diseño, no carencias: v2/v3/v6/v8 no llevan comparador porque su flujo no lo pide, v1/v2/v6/v8 no guardan estado porque cada uno propone un flujo lineal, y los que no tienen deep link priorizan el atajo de teclado o la navegación interna.

## Validación automática

Playwright ya está instalado en el repo:

```powershell
# Los 8 prototipos × móvil (390×844) + escritorio (1440×900)
node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs

# Solo los que contengan esos textos
node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs v8
node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs --movil

# Matriz estática de funcionalidades (25 funciones de la app real + 7 patrones extra × 8 prototipos)
node prototipos_opencode_deepseekv4.1flashfree/_cobertura.mjs

# Auditoría interactiva: datos, combustible, búsqueda, favoritos, ficha,
# chat IA, Config, tema y consola limpia en cada prototipo
node prototipos_opencode_deepseekv4.1flashfree/_auditar.cjs
node prototipos_opencode_deepseekv4.1flashfree/_auditar.cjs v8
```

`_validar.mjs` recorre cada página, comprueba la sintaxis de los `<script>` inline, recoge errores de consola y excepciones, pulsa la navegación principal y guarda capturas + `informe.json` en `capturas/`. `_cobertura.mjs` escribe `cobertura.json` (con `app`, `extra`, `faltanApp` y `faltanExtra` por prototipo) y `_auditar.cjs`, `auditoria.json` con 72 comprobaciones (9 por prototipo). Los tres salen con código 1 si algo falla. `index.html` queda excluido de la validación (no es un prototipo).

Depuración visual puntual (capturas sueltas de vistas concretas): `_dbg-map.cjs`, `_dbg-v3.cjs`, `_dbg-v4.cjs`, `_dbg-v5.cjs`, `_dbg-v5d.cjs`, `_dbg-v6.cjs`, `_dbg-v7.cjs`, `_dbg-v8.cjs`, `_dbg-voice.cjs`, `_dbg-err.cjs`. Ejemplo: `node prototipos_opencode_deepseekv4.1flashfree/_dbg-v7.cjs`.

## Convenciones de diseño aplicadas

- **Touch targets ≥44×44 px** (56–72 px en v6).
- **Navegación inferior en móvil** cuando la vista lo pide (zona del pulgar); v2 la sustituye por sheet + menú lateral, v4 usa rail + inspector y v8 apuesta por una lectura vertical con acciones al final del hero.
- **Bottom-sheet arrastrable** para filtros, orden y detalle (peek/medio/completo), con cierre real (scrim + `--sheet-y` fuera de pantalla).
- **Safe areas**: `env(safe-area-inset-*)` para notch y barra de gestos.
- **Colores de precio por percentiles**: verde barato / naranja medio / rojo caro.
- **Tema claro/oscuro** con `data-theme` y toggle (v3 y v6 son dark-first).
- **Previsión honesta**: la estimación se marca como tal; el histórico y el precio en vivo mandan.
- **Sin dependencias**: cero red; gráficas y mapa son canvas propio.

## Nota

Estos prototipos **no son la app**: HTML autocontenidos con datos inventados. Al portar, se extrae el diseño y la interacción y se aplica sobre la app real (`index.html`, `css/styles.css`, `js/*`) respetando `AGENTS.md` (tabs en kebab-case, `STATE`/`saveState`, módulos compartidos con el SW, `npm run bump` + `node check-syntax.mjs` + suite completa antes de commit). La carpeta es independiente: no toca `sw.js`, tests ni `ASSETS`.
