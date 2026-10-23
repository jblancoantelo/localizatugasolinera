# Prototipos de diseño — Gasolineras (OpenCode · DeepSeek V4.1 Flash)

Carpeta de exploración de UX/UI responsive para la aplicación **Precios Gasolina España**. Cada prototipo es un HTML autónomo con **datos inventados** (29 estaciones de Madrid con precios, descuentos por marca y series sintéticas) y **navegación funcional**, para validar la interfaz antes de tocar el código real.

## Objetivo

Mejorar la experiencia **móvil actual** (pantallas táctiles, uso con una mano, safe areas) sin descuidar una versión de **PC** que aproveche pantallas grandes. Abre `index.html` para la galería visual de los 7 conceptos.

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
| `index.html` | Galería visual de los 7 prototipos con miniaturas CSS y enlaces (no es un prototipo navegable). |
| `assets/` | Sistema de diseño y datos compartidos (ver abajo). |
| `capturas/` | Capturas y `informe.json` generados por `_validar.mjs` (no versionar a mano). |

### Assets compartidos

| Archivo | Qué provee |
|---------|------------|
| `assets/proto.css` | **Petrol UI 2.0**: tokens (color claro/oscuro, tipografía, espacios, radios), componentes (topbar, bottom nav, sheets, chips, tarjetas, botones, badges) y utilidades. |
| `assets/proto-ui.js` | `Proto.*`: arranque, navegación por paneles, sheets arrastrables, tarjetas y detalle de estación, iconos SVG (`data-ico`), toasts. |
| `assets/proto-data.js` | `PROTO.*`: 29 estaciones con precios por combustible, descuentos por marca, geolocalización simulada y series históricas de 14 días. |
| `assets/proto-chart.js` | `ProtoChart.*`: gráfica canvas (claro/oscuro) con tooltip de precio/fecha. |
| `assets/proto-map.js` | `ProtoMap.*`: mapa sintético canvas (calles, agua, parques) con pines; sin red ni tiles externos. |

## Cómo usar

Abre cualquier `.html` con doble clic (funciona con `file://`, sin servidor ni red). Cada prototipo es funcional: filtra, busca, marca favoritos, abre la ficha de una estación, mira el histórico y navega entre vistas. La galería de entrada es `index.html`.

## Validación automática

Playwright ya está instalado en el repo:

```powershell
# Los 7 prototipos × móvil (390×844) + escritorio (1440×900)
node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs

# Solo los que contengan esos textos
node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs v7
node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs --movil
```

Recorre cada página, comprueba la sintaxis de los `<script>` inline, recoge errores de consola y excepciones, pulsa la navegación principal y guarda capturas + `informe.json` en `capturas/`. Sale con código 1 si algo falla. `index.html` queda excluido (no es un prototipo).

Depuración visual puntual (capturas sueltas de vistas concretas): `_dbg-map.cjs`, `_dbg-v4.cjs`, `_dbg-v5.cjs`, `_dbg-v5d.cjs`, `_dbg-v6.cjs`, `_dbg-v7.cjs`. Ejemplo: `node prototipos_opencode_deepseekv4.1flashfree/_dbg-v7.cjs`.

## Convenciones de diseño aplicadas

- **Touch targets ≥44×44 px** (56–72 px en v6).
- **Navegación inferior en móvil** (zona del pulgar); v2 la sustituye por sheet + menú lateral y v4 usa rail + inspector.
- **Bottom-sheet arrastrable** para filtros, orden y detalle (peek/medio/completo).
- **Safe areas**: `env(safe-area-inset-*)` para notch y barra de gestos.
- **Colores de precio por percentiles**: verde barato / naranja medio / rojo caro.
- **Tema claro/oscuro** con `data-theme` y toggle (v3 y v6 son dark-first).
- **Sin dependencias**: cero red; gráficas y mapa son canvas propio.

## Nota

Estos prototipos **no son la app**: HTML autocontenidos con datos inventados. Al portar, se extrae el diseño y la interacción y se aplica sobre la app real (`index.html`, `css/styles.css`, `js/*`) respetando `AGENTS.md` (tabs en kebab-case, `STATE`/`saveState`, módulos compartidos con el SW, `npm run bump` + `node check-syntax.mjs` + suite completa antes de commit). La carpeta es independiente: no toca `sw.js`, tests ni `ASSETS`.
